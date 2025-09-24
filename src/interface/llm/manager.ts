/**
 * LLM Manager Interfaces
 * 
 * Central orchestration interfaces for managing multiple LLM providers with
 * automatic failover, load balancing, and intelligent provider selection.
 * 
 * @module sentient-agent-framework/interface/llm/manager
 */

import { EventEmitter } from 'events';
import { LLMProvider, ProviderFactory } from './provider';
import { LLMRequest, LLMStreamChunk } from './request';
import { LLMResponse } from './response';
import { LLMProviderConfig } from './config';
import { ProviderMetrics, AggregatedMetrics, ProviderHealthStatus } from './metrics';

/**
 * Provider selection strategy enumeration
 */
export enum SelectionStrategy {
  ROUND_ROBIN = 'round_robin',
  RANDOM = 'random',
  LEAST_LOADED = 'least_loaded',
  FASTEST = 'fastest',
  CHEAPEST = 'cheapest',
  HIGHEST_QUALITY = 'highest_quality',
  CUSTOM = 'custom'
}

/**
 * Load balancing configuration
 */
export interface LoadBalancingConfig {
  /** Selection strategy */
  strategy: SelectionStrategy;
  
  /** Weight factors for provider selection */
  weights?: {
    performance: number;
    cost: number;
    reliability: number;
    quality: number;
  };
  
  /** Sticky sessions (route requests from same session to same provider) */
  stickySession?: boolean;
  
  /** Session timeout for sticky sessions */
  sessionTimeout?: number;
  
  /** Health check threshold for provider exclusion */
  healthThreshold?: number;
  
  /** Custom selection function */
  customSelector?: (providers: LLMProvider[], request: LLMRequest) => LLMProvider[];
}

/**
 * Failover configuration
 */
export interface FailoverConfig {
  /** Enable automatic failover */
  enabled: boolean;
  
  /** Maximum number of providers to try */
  maxAttempts: number;
  
  /** Delay between failover attempts */
  attemptDelay: number;
  
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  
  /** Maximum delay between attempts */
  maxDelay: number;
  
  /** Conditions that trigger failover */
  triggerConditions: {
    networkErrors: boolean;
    timeoutErrors: boolean;
    rateLimitErrors: boolean;
    authErrors: boolean;
    serverErrors: boolean;
  };
  
  /** Provider exclusion duration after failure */
  exclusionDuration: number;
}

/**
 * Provider ranking criteria
 */
export interface ProviderRanking {
  /** Provider ID */
  providerId: string;
  
  /** Overall score (0-1) */
  score: number;
  
  /** Performance score */
  performanceScore: number;
  
  /** Reliability score */
  reliabilityScore: number;
  
  /** Cost efficiency score */
  costScore: number;
  
  /** Model capability score */
  capabilityScore: number;
  
  /** Current load factor */
  loadFactor: number;
  
  /** Health status */
  isHealthy: boolean;
  
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Manager configuration
 */
export interface LLMManagerConfig {
  /** Default provider ID */
  defaultProvider?: string;
  
  /** Load balancing configuration */
  loadBalancing: LoadBalancingConfig;
  
  /** Failover configuration */
  failover: FailoverConfig;
  
  /** Global timeout for requests */
  globalTimeout: number;
  
  /** Enable provider health monitoring */
  healthMonitoring: boolean;
  
  /** Health check interval */
  healthCheckInterval: number;
  
  /** Enable metrics collection */
  metricsEnabled: boolean;
  
  /** Metrics aggregation interval */
  metricsInterval: number;
  
  /** Enable request caching */
  cachingEnabled: boolean;
  
  /** Cache TTL in milliseconds */
  cacheTTL: number;
  
  /** Enable request/response logging */
  loggingEnabled: boolean;
  
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Provider selection context
 */
export interface SelectionContext {
  /** Original request */
  request: LLMRequest;
  
  /** Previous attempts (for failover) */
  previousAttempts: string[];
  
  /** Session ID for sticky sessions */
  sessionId?: string;
  
  /** User preferences */
  preferences?: {
    preferredProviders?: string[];
    excludedProviders?: string[];
    maxCost?: number;
    maxLatency?: number;
  };
  
  /** Request priority */
  priority: 'low' | 'normal' | 'high' | 'critical';
  
  /** Custom selection hints */
  hints?: Record<string, any>;
}

/**
 * Provider selection result
 */
export interface SelectionResult {
  /** Selected provider */
  provider: LLMProvider;
  
  /** Selection reason */
  reason: string;
  
  /** Provider ranking at selection time */
  ranking: ProviderRanking;
  
  /** Alternative providers (for fallback) */
  alternatives: LLMProvider[];
  
  /** Selection metadata */
  metadata: {
    selectionTime: number;
    strategy: SelectionStrategy;
    factors: Record<string, number>;
  };
}

/**
 * Request execution context
 */
export interface ExecutionContext {
  /** Original request */
  request: LLMRequest;
  
  /** Selected provider */
  provider: LLMProvider;
  
  /** Selection result */
  selection: SelectionResult;
  
  /** Execution start time */
  startTime: Date;
  
  /** Attempt number (for retries/failover) */
  attempt: number;
  
  /** Previous errors */
  errors: Error[];
  
  /** Custom execution metadata */
  metadata?: Record<string, any>;
}

/**
 * Core LLM Manager interface
 */
export interface LLMManager extends EventEmitter {
  /**
   * Register a provider with the manager
   */
  registerProvider(provider: LLMProvider): Promise<void>;
  
  /**
   * Unregister a provider
   */
  unregisterProvider(providerId: string): Promise<void>;
  
  /**
   * Get all registered providers
   */
  getProviders(): LLMProvider[];
  
  /**
   * Get a specific provider by ID
   */
  getProvider(providerId: string): LLMProvider | null;
  
  /**
   * Generate response using optimal provider selection
   */
  generate(request: LLMRequest): Promise<LLMResponse>;
  
  /**
   * Stream generate response using optimal provider selection
   */
  streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  
  /**
   * Generate response with specific provider
   */
  generateWithProvider(providerId: string, request: LLMRequest): Promise<LLMResponse>;
  
  /**
   * Stream generate with specific provider
   */
  streamGenerateWithProvider(providerId: string, request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  
  /**
   * Select optimal provider for a request
   */
  selectProvider(context: SelectionContext): Promise<SelectionResult>;
  
  /**
   * Get provider rankings
   */
  getProviderRankings(request?: LLMRequest): ProviderRanking[];
  
  /**
   * Update manager configuration
   */
  updateConfig(config: Partial<LLMManagerConfig>): Promise<void>;
  
  /**
   * Get current configuration
   */
  getConfig(): LLMManagerConfig;
  
  /**
   * Get aggregated metrics across all providers
   */
  getMetrics(): AggregatedMetrics;
  
  /**
   * Get health status of all providers
   */
  getHealthStatus(): Record<string, ProviderHealthStatus>;
  
  /**
   * Perform health check on all providers
   */
  performHealthCheck(): Promise<Record<string, ProviderHealthStatus>>;
  
  /**
   * Initialize the manager
   */
  initialize(): Promise<void>;
  
  /**
   * Shutdown the manager gracefully
   */
  shutdown(): Promise<void>;
}

/**
 * Provider selector interface
 */
export interface ProviderSelector {
  /**
   * Select providers based on strategy and context
   */
  select(
    providers: LLMProvider[], 
    context: SelectionContext
  ): Promise<SelectionResult>;
  
  /**
   * Rank providers for given request
   */
  rank(providers: LLMProvider[], request: LLMRequest): ProviderRanking[];
  
  /**
   * Update provider rankings
   */
  updateRankings(metrics: AggregatedMetrics): void;
  
  /**
   * Get selection strategy
   */
  getStrategy(): SelectionStrategy;
  
  /**
   * Set selection strategy
   */
  setStrategy(strategy: SelectionStrategy): void;
}

/**
 * Failover manager interface
 */
export interface FailoverManager {
  /**
   * Execute request with automatic failover
   */
  execute<T>(
    operation: (provider: LLMProvider) => Promise<T>,
    context: ExecutionContext
  ): Promise<T>;
  
  /**
   * Execute streaming request with failover
   */
  executeStream(
    operation: (provider: LLMProvider) => AsyncIterable<LLMStreamChunk>,
    context: ExecutionContext
  ): AsyncIterable<LLMStreamChunk>;
  
  /**
   * Check if error should trigger failover
   */
  shouldFailover(error: Error, context: ExecutionContext): boolean;
  
  /**
   * Get next provider for failover
   */
  getNextProvider(context: ExecutionContext): LLMProvider | null;
  
  /**
   * Record provider failure
   */
  recordFailure(providerId: string, error: Error): void;
  
  /**
   * Record provider success
   */
  recordSuccess(providerId: string): void;
}

/**
 * Load balancer interface
 */
export interface LoadBalancer {
  /**
   * Select provider based on load balancing strategy
   */
  selectProvider(
    providers: LLMProvider[], 
    request: LLMRequest
  ): LLMProvider | null;
  
  /**
   * Update provider load information
   */
  updateLoad(providerId: string, load: number): void;
  
  /**
   * Get current load distribution
   */
  getLoadDistribution(): Record<string, number>;
  
  /**
   * Reset load balancer state
   */
  reset(): void;
}

/**
 * Manager factory interface
 */
export interface LLMManagerFactory {
  /**
   * Create a new manager instance
   */
  create(config: LLMManagerConfig): LLMManager;
  
  /**
   * Create manager with providers
   */
  createWithProviders(
    config: LLMManagerConfig, 
    providers: LLMProvider[]
  ): Promise<LLMManager>;
  
  /**
   * Create manager from configuration file
   */
  createFromConfig(configPath: string): Promise<LLMManager>;
  
  /**
   * Get default configuration
   */
  getDefaultConfig(): LLMManagerConfig;
}

/**
 * Manager utilities
 */
export class ManagerUtils {
  /**
   * Create default manager configuration
   */
  static createDefaultConfig(): LLMManagerConfig {
    return {
      loadBalancing: {
        strategy: SelectionStrategy.LEAST_LOADED,
        weights: {
          performance: 0.3,
          cost: 0.2,
          reliability: 0.4,
          quality: 0.1
        },
        stickySession: false,
        healthThreshold: 0.8
      },
      failover: {
        enabled: true,
        maxAttempts: 3,
        attemptDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 10000,
        triggerConditions: {
          networkErrors: true,
          timeoutErrors: true,
          rateLimitErrors: false,
          authErrors: false,
          serverErrors: true
        },
        exclusionDuration: 30000
      },
      globalTimeout: 60000,
      healthMonitoring: true,
      healthCheckInterval: 30000,
      metricsEnabled: true,
      metricsInterval: 10000,
      cachingEnabled: false,
      cacheTTL: 300000,
      loggingEnabled: true,
      logLevel: 'info'
    };
  }
  
  /**
   * Validate manager configuration
   */
  static validateConfig(config: LLMManagerConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (config.globalTimeout <= 0) {
      errors.push('Global timeout must be positive');
    }
    
    if (config.healthCheckInterval <= 0) {
      errors.push('Health check interval must be positive');
    }
    
    if (config.metricsInterval <= 0) {
      errors.push('Metrics interval must be positive');
    }
    
    if (config.failover.maxAttempts <= 0) {
      errors.push('Failover max attempts must be positive');
    }
    
    if (config.failover.attemptDelay <= 0) {
      errors.push('Failover attempt delay must be positive');
    }
    
    if (config.loadBalancing.weights) {
      const weights = config.loadBalancing.weights;
      const total = weights.performance + weights.cost + weights.reliability + weights.quality;
      if (Math.abs(total - 1.0) > 0.01) {
        errors.push('Load balancing weights must sum to 1.0');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Calculate provider score based on metrics
   */
  static calculateProviderScore(
    metrics: ProviderMetrics,
    weights: { performance: number; cost: number; reliability: number; quality: number }
  ): number {
    // Normalize metrics to 0-1 scale
    const successRate = metrics.requests.total > 0 ? 
      metrics.requests.successful / metrics.requests.total : 0;
    
    const avgResponseTime = metrics.performance.avgResponseTime;
    const performanceScore = Math.max(0, 1 - (avgResponseTime / 10000)); // Normalize to 10s
    
    const costScore = metrics.costs ? 
      Math.max(0, 1 - (metrics.costs.costPerRequest / 0.1)) : 0.5; // Normalize to $0.10
    
    const reliabilityScore = successRate;
    const qualityScore = 0.8; // Placeholder - would be based on model quality metrics
    
    return (
      performanceScore * weights.performance +
      costScore * weights.cost +
      reliabilityScore * weights.reliability +
      qualityScore * weights.quality
    );
  }
  
  /**
   * Create selection context from request
   */
  static createSelectionContext(
    request: LLMRequest,
    sessionId?: string,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ): SelectionContext {
    return {
      request,
      previousAttempts: [],
      sessionId,
      priority,
      preferences: {},
      hints: {}
    };
  }
  
  /**
   * Merge manager configurations
   */
  static mergeConfigs(base: LLMManagerConfig, override: Partial<LLMManagerConfig>): LLMManagerConfig {
    const result: LLMManagerConfig = {
      ...base,
      ...override,
      loadBalancing: {
        ...base.loadBalancing,
        ...override.loadBalancing
      },
      failover: {
        ...base.failover,
        ...override.failover
      }
    };

    // Handle weights carefully
    if (base.loadBalancing.weights && override.loadBalancing?.weights) {
      result.loadBalancing.weights = {
        performance: override.loadBalancing.weights.performance ?? base.loadBalancing.weights.performance,
        cost: override.loadBalancing.weights.cost ?? base.loadBalancing.weights.cost,
        reliability: override.loadBalancing.weights.reliability ?? base.loadBalancing.weights.reliability,
        quality: override.loadBalancing.weights.quality ?? base.loadBalancing.weights.quality
      };
    } else if (override.loadBalancing?.weights) {
      result.loadBalancing.weights = override.loadBalancing.weights as Required<typeof override.loadBalancing.weights>;
    }

    // Handle trigger conditions carefully
    if (override.failover?.triggerConditions) {
      result.failover.triggerConditions = {
        ...base.failover.triggerConditions,
        ...override.failover.triggerConditions
      };
    }

    return result;
  }
}