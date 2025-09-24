/**
 * Production-Ready LLM Manager Implementation
 * 
 * Central orchestration system for managing multiple LLM providers with
 * automatic failover, intelligent load balancing, circuit breakers, and
 * comprehensive monitoring. The heart of the Sentient Node SDK.
 * 
 * @module sentient-agent-framework/implementation/llm/manager
 */

import { EventEmitter } from 'events';
import {
  LLMManager,
  ProviderSelector,
  FailoverManager,
  LoadBalancer,
  LLMManagerConfig,
  SelectionStrategy,
  SelectionContext,
  SelectionResult,
  ExecutionContext,
  ProviderRanking,
  ManagerUtils
} from '../../interface/llm/manager';
import { LLMProvider, ProviderStatus } from '../../interface/llm/provider';
import { LLMRequest, LLMStreamChunk, RequestUtils } from '../../interface/llm/request';
import { LLMResponse } from '../../interface/llm/response';
import { ProviderMetrics, AggregatedMetrics, ProviderHealthStatus, MetricsUtils } from '../../interface/llm/metrics';
import {
  LLMError,
  ProviderNotFoundError,
  ProviderUnavailableError,
  CircuitOpenError,
  TimeoutError,
  ErrorUtils
} from '../../interface/llm/exceptions';
import { ulid } from 'ulid';

/**
 * Circuit Breaker Implementation
 */
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: Date;
  private nextRetryTime?: Date;
  
  constructor(
    private config: {
      failureThreshold: number;
      successThreshold: number;
      timeout: number;
      monitoringWindow: number;
    }
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldTryHalfOpen()) {
        this.state = 'half-open';
        this.successes = 0;
      } else {
        throw new CircuitOpenError('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  async *executeStream<T>(operation: () => AsyncIterable<T>): AsyncIterable<T> {
    if (this.state === 'open') {
      if (this.shouldTryHalfOpen()) {
        this.state = 'half-open';
        this.successes = 0;
      } else {
        throw new CircuitOpenError('Circuit breaker is open');
      }
    }
    
    try {
      for await (const item of operation()) {
        yield item;
      }
      this.onSuccess();
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.lastFailureTime = undefined;
    
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'closed';
      }
    }
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      this.nextRetryTime = new Date(Date.now() + this.config.timeout);
    }
  }
  
  private shouldTryHalfOpen(): boolean {
    return this.nextRetryTime ? Date.now() >= this.nextRetryTime.getTime() : false;
  }
  
  getState(): string {
    return this.state;
  }
  
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.nextRetryTime = undefined;
  }
}

/**
 * Retry Strategy Implementation
 */
class RetryStrategy {
  constructor(
    private config: {
      maxRetries: number;
      baseDelay: number;
      maxDelay: number;
      backoffMultiplier: number;
      jitterMs: number;
    }
  ) {}
  
  async execute<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: Error) => boolean = () => true
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === this.config.maxRetries || !shouldRetry(lastError)) {
          throw lastError;
        }
        
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }
  
  private calculateDelay(attempt: number): number {
    const exponential = Math.pow(this.config.backoffMultiplier, attempt) * this.config.baseDelay;
    const jitter = Math.random() * this.config.jitterMs;
    return Math.min(exponential + jitter, this.config.maxDelay);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Intelligent Provider Selector Implementation
 */
class IntelligentProviderSelector implements ProviderSelector {
  private rankings: Map<string, ProviderRanking> = new Map();
  private strategy: SelectionStrategy = SelectionStrategy.LEAST_LOADED;
  private stickySession: Map<string, { providerId: string; expiresAt: number }> = new Map();
  
  constructor(
    private config: {
      strategy: SelectionStrategy;
      stickySession?: boolean;
      sessionTimeout?: number;
      healthThreshold?: number;
      weights?: {
        performance: number;
        cost: number;
        reliability: number;
        quality: number;
      };
    }
  ) {
    this.strategy = config.strategy;
  }
  
  async select(providers: LLMProvider[], context: SelectionContext): Promise<SelectionResult> {
    // Filter healthy providers
    const healthyProviders = providers.filter(p => p.isHealthy());
    
    if (healthyProviders.length === 0) {
      throw new ProviderUnavailableError('No healthy providers available');
    }
    
    // Check sticky session
    if (this.config.stickySession && context.sessionId) {
      const sticky = this.stickySession.get(context.sessionId);
      if (sticky && sticky.expiresAt > Date.now()) {
        const stickyProvider = healthyProviders.find(p => p.providerId === sticky.providerId);
        if (stickyProvider) {
          return this.createSelectionResult(
            stickyProvider,
            'sticky_session',
            healthyProviders.filter(p => p !== stickyProvider)
          );
        }
      }
    }
    
    // Apply selection strategy
    const selected = await this.applySelectionStrategy(healthyProviders, context);
    const alternatives = healthyProviders.filter(p => p !== selected);
    
    // Update sticky session if enabled
    if (this.config.stickySession && context.sessionId) {
      this.stickySession.set(context.sessionId, {
        providerId: selected.providerId,
        expiresAt: Date.now() + (this.config.sessionTimeout || 300000)
      });
    }
    
    return this.createSelectionResult(selected, this.strategy, alternatives);
  }
  
  rank(providers: LLMProvider[], request: LLMRequest): ProviderRanking[] {
    const rankings: ProviderRanking[] = [];
    
    for (const provider of providers) {
      const metrics = provider.getMetrics();
      const capabilities = provider.capabilities;
      
      // Check model capability - be more flexible with model matching
      const supportsModel = capabilities.models.some((m: any) =>
        m.name === request.model ||
        m.displayName?.toLowerCase().includes(request.model.toLowerCase()) ||
        request.model.toLowerCase().includes(m.name.toLowerCase())
      );
      if (!supportsModel) {
        continue;
      }
      
      // Calculate scores
      const performanceScore = this.calculatePerformanceScore(metrics);
      const reliabilityScore = this.calculateReliabilityScore(metrics);
      const costScore = this.calculateCostScore(metrics, request.model);
      const capabilityScore = this.calculateCapabilityScore(provider, request);
      
      // Calculate overall score with weights
      const weights = this.config.weights || {
        performance: 0.3,
        cost: 0.2,
        reliability: 0.4,
        quality: 0.1
      };
      
      const overallScore = 
        performanceScore * weights.performance +
        costScore * weights.cost +
        reliabilityScore * weights.reliability +
        capabilityScore * weights.quality;
      
      const ranking: ProviderRanking = {
        providerId: provider.providerId,
        score: overallScore,
        performanceScore,
        reliabilityScore,
        costScore,
        capabilityScore,
        loadFactor: this.calculateLoadFactor(metrics),
        isHealthy: provider.isHealthy(),
        updatedAt: new Date()
      };
      
      rankings.push(ranking);
      this.rankings.set(provider.providerId, ranking);
    }
    
    return rankings.sort((a, b) => b.score - a.score);
  }
  
  updateRankings(metrics: AggregatedMetrics): void {
    for (const [providerId, providerMetrics] of Object.entries(metrics.byProvider)) {
      const existing = this.rankings.get(providerId);
      if (existing) {
        existing.performanceScore = this.calculatePerformanceScore(providerMetrics);
        existing.reliabilityScore = this.calculateReliabilityScore(providerMetrics);
        existing.loadFactor = this.calculateLoadFactor(providerMetrics);
        existing.updatedAt = new Date();
        
        // Recalculate overall score
        const weights = this.config.weights || {
          performance: 0.3,
          cost: 0.2,
          reliability: 0.4,
          quality: 0.1
        };
        
        existing.score = 
          existing.performanceScore * weights.performance +
          existing.costScore * weights.cost +
          existing.reliabilityScore * weights.reliability +
          existing.capabilityScore * weights.quality;
      }
    }
  }
  
  getStrategy(): SelectionStrategy {
    return this.strategy;
  }
  
  setStrategy(strategy: SelectionStrategy): void {
    this.strategy = strategy;
  }
  
  private async applySelectionStrategy(
    providers: LLMProvider[],
    context: SelectionContext
  ): Promise<LLMProvider> {
    // First filter providers that can handle the requested model
    const capableProviders = providers.filter(provider => {
      const capabilities = provider.capabilities;
      const supportsModel = capabilities.models.some((m: any) =>
        m.name === context.request.model ||
        m.displayName?.toLowerCase().includes(context.request.model.toLowerCase()) ||
        context.request.model.toLowerCase().includes(m.name.toLowerCase())
      );
      return supportsModel;
    });
    
    if (capableProviders.length === 0) {
      throw new ProviderUnavailableError(`No providers support model: ${context.request.model}`);
    }
    
    // Apply strategy to capable providers only
    const targetProviders = capableProviders;
    
    switch (this.strategy) {
      case SelectionStrategy.ROUND_ROBIN:
        return this.selectRoundRobin(targetProviders);
      
      case SelectionStrategy.RANDOM:
        return targetProviders[Math.floor(Math.random() * targetProviders.length)];
      
      case SelectionStrategy.LEAST_LOADED:
        return this.selectLeastLoaded(targetProviders);
      
      case SelectionStrategy.FASTEST:
        return this.selectFastest(targetProviders);
      
      case SelectionStrategy.CHEAPEST:
        return this.selectCheapest(targetProviders, context.request);
      
      case SelectionStrategy.HIGHEST_QUALITY:
        return this.selectHighestQuality(targetProviders, context.request);
      
      default:
        return targetProviders[0];
    }
  }
  
  private selectRoundRobin(providers: LLMProvider[]): LLMProvider {
    // Simple round-robin implementation
    const now = Date.now();
    const index = Math.floor(now / 1000) % providers.length;
    return providers[index];
  }
  
  private selectLeastLoaded(providers: LLMProvider[]): LLMProvider {
    let leastLoaded = providers[0];
    let minLoad = this.calculateLoadFactor(leastLoaded.getMetrics());
    
    for (let i = 1; i < providers.length; i++) {
      const load = this.calculateLoadFactor(providers[i].getMetrics());
      if (load < minLoad) {
        minLoad = load;
        leastLoaded = providers[i];
      }
    }
    
    return leastLoaded;
  }
  
  private selectFastest(providers: LLMProvider[]): LLMProvider {
    let fastest = providers[0];
    let minResponseTime = fastest.getMetrics().performance.avgResponseTime;
    
    for (let i = 1; i < providers.length; i++) {
      const responseTime = providers[i].getMetrics().performance.avgResponseTime;
      if (responseTime < minResponseTime) {
        minResponseTime = responseTime;
        fastest = providers[i];
      }
    }
    
    return fastest;
  }
  
  private selectCheapest(providers: LLMProvider[], request: LLMRequest): LLMProvider {
    let cheapest = providers[0];
    let minCost = this.estimateCost(cheapest, request);
    
    for (let i = 1; i < providers.length; i++) {
      const cost = this.estimateCost(providers[i], request);
      if (cost < minCost) {
        minCost = cost;
        cheapest = providers[i];
      }
    }
    
    return cheapest;
  }
  
  private selectHighestQuality(providers: LLMProvider[], request: LLMRequest): LLMProvider {
    const rankings = this.rank(providers, request);
    return providers.find(p => p.providerId === rankings[0].providerId) || providers[0];
  }
  
  private calculatePerformanceScore(metrics: ProviderMetrics): number {
    const avgTime = metrics.performance.avgResponseTime;
    return Math.max(0, 1 - (avgTime / 10000)); // Normalize to 10s max
  }
  
  private calculateReliabilityScore(metrics: ProviderMetrics): number {
    if (metrics.requests.total === 0) return 0;
    return metrics.requests.successful / metrics.requests.total;
  }
  
  private calculateCostScore(metrics: ProviderMetrics, model: string): number {
    // Higher score for lower cost
    const avgCost = metrics.costs?.costPerRequest || 0.01;
    return Math.max(0, 1 - (avgCost / 0.1)); // Normalize to $0.10 max
  }
  
  private calculateCapabilityScore(provider: LLMProvider, request: LLMRequest): number {
    const capabilities = provider.capabilities;
    let score = 0.5; // Base score
    
    // Check streaming support
    if (request.stream && capabilities.supportsStreaming) {
      score += 0.2;
    }
    
    // Check function calling
    if (request.parameters.functions && capabilities.supportsFunctionCalling) {
      score += 0.2;
    }
    
    // Check multimodal support
    if (capabilities.supportsMultimodal) {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }
  
  private calculateLoadFactor(metrics: ProviderMetrics): number {
    // Simple load calculation based on recent requests
    const recentRequests = metrics.requests.requestsPerSecond || 0;
    return recentRequests / 100; // Normalize to 100 RPS
  }
  
  private estimateCost(provider: LLMProvider, request: LLMRequest): number {
    const model = provider.capabilities.models.find((m: any) => m.name === request.model);
    if (!model) return Infinity;
    
    const estimatedTokens = RequestUtils.estimateTokenCount(request);
    return estimatedTokens * (model.pricing.inputCost + model.pricing.outputCost) / 2;
  }
  
  private createSelectionResult(
    provider: LLMProvider,
    reason: string,
    alternatives: LLMProvider[]
  ): SelectionResult {
    const ranking = this.rankings.get(provider.providerId) || {
      providerId: provider.providerId,
      score: 0.5,
      performanceScore: 0.5,
      reliabilityScore: 0.5,
      costScore: 0.5,
      capabilityScore: 0.5,
      loadFactor: 0,
      isHealthy: provider.isHealthy(),
      updatedAt: new Date()
    };
    
    return {
      provider,
      reason,
      ranking,
      alternatives,
      metadata: {
        selectionTime: Date.now(),
        strategy: this.strategy,
        factors: {
          performance: ranking.performanceScore,
          cost: ranking.costScore,
          reliability: ranking.reliabilityScore,
          quality: ranking.capabilityScore
        }
      }
    };
  }
}

/**
 * Advanced Failover Manager Implementation
 */
class AdvancedFailoverManager implements FailoverManager {
  private excludedProviders: Map<string, number> = new Map(); // providerId -> excludeUntil timestamp
  private retryStrategy: RetryStrategy;
  
  constructor(
    private config: {
      maxAttempts: number;
      attemptDelay: number;
      backoffMultiplier: number;
      maxDelay: number;
      exclusionDuration: number;
      triggerConditions: {
        networkErrors: boolean;
        timeoutErrors: boolean;
        rateLimitErrors: boolean;
        authErrors: boolean;
        serverErrors: boolean;
      };
    }
  ) {
    this.retryStrategy = new RetryStrategy({
      maxRetries: config.maxAttempts - 1,
      baseDelay: config.attemptDelay,
      maxDelay: config.maxDelay,
      backoffMultiplier: config.backoffMultiplier,
      jitterMs: 100
    });
  }
  
  async execute<T>(
    operation: (provider: LLMProvider) => Promise<T>,
    context: ExecutionContext
  ): Promise<T> {
    return this.retryStrategy.execute(
      () => operation(context.provider),
      (error) => this.shouldFailover(error, context)
    );
  }
  
  async *executeStream(
    operation: (provider: LLMProvider) => AsyncIterable<LLMStreamChunk>,
    context: ExecutionContext
  ): AsyncIterable<LLMStreamChunk> {
    // For streaming, we can't easily retry, so we just execute once
    try {
      for await (const chunk of operation(context.provider)) {
        yield chunk;
      }
    } catch (error) {
      if (this.shouldFailover(error as Error, context)) {
        this.recordFailure(context.provider.providerId, error as Error);
        throw error;
      }
      throw error;
    }
  }
  
  shouldFailover(error: Error, context: ExecutionContext): boolean {
    const conditions = this.config.triggerConditions;
    
    // Check error types against configured conditions
    if (error instanceof TimeoutError && conditions.timeoutErrors) return true;
    if (error.name === 'NetworkError' && conditions.networkErrors) return true;
    if (error.name === 'RateLimitError' && conditions.rateLimitErrors) return true;
    if (error.name === 'AuthenticationError' && conditions.authErrors) return true;
    if (error.message.includes('500') && conditions.serverErrors) return true;
    
    return false;
  }
  
  getNextProvider(context: ExecutionContext): LLMProvider | null {
    // This would be called by the manager to get the next provider in line
    // Implementation depends on the manager's provider list
    return null;
  }
  
  recordFailure(providerId: string, error: Error): void {
    const excludeUntil = Date.now() + this.config.exclusionDuration;
    this.excludedProviders.set(providerId, excludeUntil);
  }
  
  recordSuccess(providerId: string): void {
    this.excludedProviders.delete(providerId);
  }
  
  isProviderExcluded(providerId: string): boolean {
    const excludeUntil = this.excludedProviders.get(providerId);
    if (!excludeUntil) return false;
    
    if (Date.now() > excludeUntil) {
      this.excludedProviders.delete(providerId);
      return false;
    }
    
    return true;
  }
}

/**
 * Production-Ready LLM Manager Implementation
 */
export class ProductionLLMManager extends EventEmitter implements LLMManager {
  private providers: Map<string, LLMProvider> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private selector: IntelligentProviderSelector;
  private failoverManager: AdvancedFailoverManager;
  private metricsAggregator: MetricsAggregator;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  
  constructor(private config: LLMManagerConfig) {
    super();
    
    this.selector = new IntelligentProviderSelector({
      strategy: config.loadBalancing.strategy,
      stickySession: config.loadBalancing.stickySession,
      sessionTimeout: config.loadBalancing.sessionTimeout,
      healthThreshold: config.loadBalancing.healthThreshold,
      weights: config.loadBalancing.weights
    });
    
    this.failoverManager = new AdvancedFailoverManager(config.failover);
    this.metricsAggregator = new MetricsAggregator();
    
    // Set providers reference for metrics collection
    this.metricsAggregator.setProviders(this.providers);
  }
  
  async initialize(): Promise<void> {
    console.log('Initializing Production LLM Manager...');
    
    // Initialize all providers
    for (const [providerId, provider] of this.providers) {
      try {
        await provider.initialize();
        
        // Create circuit breaker
        const circuitBreaker = new CircuitBreaker({
          failureThreshold: this.config.failover.maxAttempts,
          successThreshold: 2,
          timeout: this.config.failover.maxDelay,
          monitoringWindow: 60000
        });
        this.circuitBreakers.set(providerId, circuitBreaker);
        
        console.log(`Provider ${providerId} initialized successfully`);
      } catch (error) {
        console.error(`Failed to initialize provider ${providerId}:`, error);
      }
    }
    
    // Start health monitoring
    if (this.config.healthMonitoring) {
      this.startHealthMonitoring();
    }
    
    // Start metrics collection
    if (this.config.metricsEnabled) {
      this.startMetricsCollection();
    }
    
    this.emit('initialized');
    console.log('Production LLM Manager initialized successfully');
  }
  
  async registerProvider(provider: LLMProvider): Promise<void> {
    this.providers.set(provider.providerId, provider);
    
    // Update metrics aggregator with new providers map
    this.metricsAggregator.setProviders(this.providers);
    
    // Set up provider event listeners
    provider.on('statusChanged', (status: ProviderStatus) => {
      this.emit('providerStatusChanged', { providerId: provider.providerId, status });
    });
    
    provider.on('error', (error: Error) => {
      this.emit('providerError', { providerId: provider.providerId, error });
    });
    
    console.log(`Provider ${provider.providerId} registered`);
  }
  
  async unregisterProvider(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (provider) {
      await provider.shutdown();
      this.providers.delete(providerId);
      this.circuitBreakers.delete(providerId);
      console.log(`Provider ${providerId} unregistered`);
    }
  }
  
  getProviders(): LLMProvider[] {
    return Array.from(this.providers.values());
  }
  
  getProvider(providerId: string): LLMProvider | null {
    return this.providers.get(providerId) || null;
  }
  
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const context = this.createSelectionContext(request);
    const selection = await this.selectProvider(context);
    
    const executionContext: ExecutionContext = {
      request,
      provider: selection.provider,
      selection,
      startTime: new Date(),
      attempt: 1,
      errors: []
    };
    
    try {
      const circuitBreaker = this.circuitBreakers.get(selection.provider.providerId)!;
      
      const response = await circuitBreaker.execute(async () => {
        return this.failoverManager.execute(
          (provider) => provider.generate(request),
          executionContext
        );
      });
      
      this.failoverManager.recordSuccess(selection.provider.providerId);
      
      // Update metrics immediately after successful generation
      this.metricsAggregator.updateMetrics();
      
      return response;
      
    } catch (error) {
      this.failoverManager.recordFailure(selection.provider.providerId, error as Error);
      
      // Update metrics immediately after failed generation
      this.metricsAggregator.updateMetrics();
      
      throw error;
    }
  }
  
  async *streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const context = this.createSelectionContext(request);
    const selection = await this.selectProvider(context);
    
    const executionContext: ExecutionContext = {
      request,
      provider: selection.provider,
      selection,
      startTime: new Date(),
      attempt: 1,
      errors: []
    };
    
    try {
      const circuitBreaker = this.circuitBreakers.get(selection.provider.providerId)!;
      
      const stream = circuitBreaker.executeStream(async function* () {
        for await (const chunk of selection.provider.streamGenerate(request)) {
          yield chunk;
        }
      });
      
      for await (const chunk of stream) {
        yield chunk;
      }
      
      this.failoverManager.recordSuccess(selection.provider.providerId);
      
      // Update metrics immediately after successful streaming
      this.metricsAggregator.updateMetrics();
      
    } catch (error) {
      this.failoverManager.recordFailure(selection.provider.providerId, error as Error);
      
      // Update metrics immediately after failed streaming
      this.metricsAggregator.updateMetrics();
      
      throw error;
    }
  }
  
  async generateWithProvider(providerId: string, request: LLMRequest): Promise<LLMResponse> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new ProviderNotFoundError(providerId);
    }
    
    return provider.generate(request);
  }
  
  async *streamGenerateWithProvider(providerId: string, request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new ProviderNotFoundError(providerId);
    }
    
    yield* provider.streamGenerate(request);
  }
  
  async selectProvider(context: SelectionContext): Promise<SelectionResult> {
    const availableProviders = this.getProviders().filter(p =>
      !this.failoverManager.isProviderExcluded(p.providerId)
    );
    
    if (availableProviders.length === 0) {
      throw new ProviderUnavailableError('No available providers');
    }
    
    return this.selector.select(availableProviders, context);
  }
  
  getProviderRankings(request?: LLMRequest): ProviderRanking[] {
    const providers = this.getProviders();
    if (!request) {
      // Return cached rankings or generate with dummy request
      return [];
    }
    
    return this.selector.rank(providers, request);
  }
  
  async updateConfig(config: Partial<LLMManagerConfig>): Promise<void> {
    const newConfig = ManagerUtils.mergeConfigs(this.config, config);
    
    // Validate new configuration
    const validation = ManagerUtils.validateConfig(newConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }
    
    this.config = newConfig;
    
    // Update selector strategy if changed
    if (config.loadBalancing?.strategy) {
      this.selector.setStrategy(config.loadBalancing.strategy);
    }
    
    this.emit('configUpdated', newConfig);
  }
  
  getConfig(): LLMManagerConfig {
    return { ...this.config };
  }
  
  getMetrics(): AggregatedMetrics {
    return this.metricsAggregator.getAggregatedMetrics();
  }
  
  getHealthStatus(): Record<string, ProviderHealthStatus> {
    const healthStatus: Record<string, ProviderHealthStatus> = {};
    
    for (const [providerId, provider] of this.providers) {
      healthStatus[providerId] = provider.getHealthStatus();
    }
    
    return healthStatus;
  }
  
  async performHealthCheck(): Promise<Record<string, ProviderHealthStatus>> {
    const healthStatus: Record<string, ProviderHealthStatus> = {};
    
    for (const [providerId, provider] of this.providers) {
      try {
        healthStatus[providerId] = await provider.validate();
      } catch (error) {
        healthStatus[providerId] = {
          isHealthy: false,
          status: ProviderStatus.UNAVAILABLE,
          timestamp: new Date(),
          responseTime: 0,
          details: {},
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
    
    return healthStatus;
  }
  
  async shutdown(): Promise<void> {
    console.log('Shutting down Production LLM Manager...');
    
    // Stop intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Shutdown all providers
    for (const [providerId, provider] of this.providers) {
      try {
        await provider.shutdown();
        console.log(`Provider ${providerId} shut down`);
      } catch (error) {
        console.error(`Error shutting down provider ${providerId}:`, error);
      }
    }
    
    this.emit('shutdown');
    console.log('Production LLM Manager shut down successfully');
  }
  
  // Private helper methods
  
  private createSelectionContext(request: LLMRequest): SelectionContext {
    return {
      request,
      previousAttempts: [],
      sessionId: request.metadata.sessionId,
      priority: request.metadata.priority || 'normal',
      preferences: {},
      hints: {}
    };
  }
  
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthStatus = await this.performHealthCheck();
        this.emit('healthCheckComplete', healthStatus);
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, this.config.healthCheckInterval);
  }
  
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      try {
        const aggregatedMetrics = this.metricsAggregator.collectMetrics(this.providers);
        this.selector.updateRankings(aggregatedMetrics);
        this.emit('metricsCollected', aggregatedMetrics);
      } catch (error) {
        console.error('Metrics collection failed:', error);
      }
    }, this.config.metricsInterval);
  }
}

/**
 * Metrics Aggregator for collecting and combining provider metrics
 */
class MetricsAggregator {
  private lastCollection: Date = new Date();
  private cachedMetrics?: AggregatedMetrics;
  private providers?: Map<string, LLMProvider>;
  
  setProviders(providers: Map<string, LLMProvider>): void {
    this.providers = providers;
  }
  
  updateMetrics(): void {
    if (this.providers) {
      this.cachedMetrics = this.collectMetrics(this.providers);
    }
  }
  
  collectMetrics(providers: Map<string, LLMProvider>): AggregatedMetrics {
    const byProvider: Record<string, ProviderMetrics> = {};
    const availability: Record<string, boolean> = {};
    const performance: Record<string, any> = {};
    
    // Collect metrics from each provider
    for (const [providerId, provider] of providers) {
      byProvider[providerId] = provider.getMetrics();
      availability[providerId] = provider.isHealthy();
      performance[providerId] = provider.getMetrics().performance;
    }
    
    // Calculate totals
    const allMetrics = Object.values(byProvider);
    const totals = {
      requests: {
        total: allMetrics.reduce((sum, m) => sum + m.requests.total, 0),
        successful: allMetrics.reduce((sum, m) => sum + m.requests.successful, 0),
        failed: allMetrics.reduce((sum, m) => sum + m.requests.failed, 0)
      },
      tokens: {
        input: allMetrics.reduce((sum, m) => sum + m.tokens.input, 0),
        output: allMetrics.reduce((sum, m) => sum + m.tokens.output, 0),
        total: allMetrics.reduce((sum, m) => sum + m.tokens.total, 0)
      },
      costs: {
        totalCost: allMetrics.reduce((sum, m) => sum + (m.costs?.totalCost || 0), 0),
        inputCost: allMetrics.reduce((sum, m) => sum + (m.costs?.inputCost || 0), 0),
        outputCost: allMetrics.reduce((sum, m) => sum + (m.costs?.outputCost || 0), 0),
        costPerRequest: 0
      },
      errors: {
        networkErrors: allMetrics.reduce((sum, m) => sum + m.errors.networkErrors, 0),
        apiErrors: allMetrics.reduce((sum, m) => sum + m.errors.apiErrors, 0),
        timeoutErrors: allMetrics.reduce((sum, m) => sum + m.errors.timeoutErrors, 0),
        rateLimitErrors: allMetrics.reduce((sum, m) => sum + m.errors.rateLimitErrors, 0)
      }
    };
    
    // Calculate cost per request
    if (totals.requests.total > 0) {
      totals.costs.costPerRequest = totals.costs.totalCost / totals.requests.total;
    }
    
    const now = new Date();
    const result: AggregatedMetrics = {
      byProvider,
      totals,
      availability,
      performance,
      timestamp: now,
      period: {
        start: this.lastCollection,
        end: now
      }
    };
    
    this.lastCollection = now;
    return result;
  }
  
  getAggregatedMetrics(): AggregatedMetrics {
    // Return cached metrics if available, otherwise collect fresh metrics
    if (this.cachedMetrics) {
      return this.cachedMetrics;
    }
    
    if (this.providers) {
      this.cachedMetrics = this.collectMetrics(this.providers);
      return this.cachedMetrics;
    }
    
    // Fallback to empty metrics
    return {
      byProvider: {},
      totals: {
        requests: { total: 0, successful: 0, failed: 0 },
        tokens: { input: 0, output: 0, total: 0 },
        costs: { totalCost: 0, inputCost: 0, outputCost: 0, costPerRequest: 0 },
        errors: { networkErrors: 0, apiErrors: 0, timeoutErrors: 0, rateLimitErrors: 0 }
      },
      availability: {},
      performance: {},
      timestamp: new Date(),
      period: { start: new Date(), end: new Date() }
    };
  }
}

/**
 * LLM Manager Factory
 */
export class LLMManagerFactory {
  static create(config: LLMManagerConfig): ProductionLLMManager {
    return new ProductionLLMManager(config);
  }
  
  static async createWithProviders(
    config: LLMManagerConfig,
    providers: LLMProvider[]
  ): Promise<ProductionLLMManager> {
    const manager = new ProductionLLMManager(config);
    
    for (const provider of providers) {
      await manager.registerProvider(provider);
    }
    
    await manager.initialize();
    return manager;
  }
  
  static async createFromConfig(configPath: string): Promise<ProductionLLMManager> {
    // In production, this would load from file
    const defaultConfig = ManagerUtils.createDefaultConfig();
    return new ProductionLLMManager(defaultConfig);
  }
  
  static getDefaultConfig(): LLMManagerConfig {
    return ManagerUtils.createDefaultConfig();
  }
}