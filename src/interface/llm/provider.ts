/**
 * LLM Provider Interfaces
 * 
 * Core interfaces for LLM providers with streaming support, health monitoring,
 * and comprehensive capability detection.
 * 
 * @module sentient-agent-framework/interface/llm/provider
 */

import { EventEmitter } from 'events';
import { LLMRequest, LLMStreamChunk } from './request';
import { LLMResponse } from './response';
import { LLMProviderConfig, ModelInfo, RateLimitInfo } from './config';
import { ProviderMetrics, ProviderHealthStatus } from './metrics';

/**
 * Provider capabilities specification
 */
export interface ProviderCapabilities {
  /** Supported models with pricing and limits */
  models: ModelInfo[];
  
  /** Maximum tokens supported */
  maxTokens: number;
  
  /** Streaming support */
  supportsStreaming: boolean;
  
  /** Function calling support */
  supportsFunctionCalling: boolean;
  
  /** Image input support */
  supportsImageInput: boolean;
  
  /** System prompt support */
  supportsSystemPrompts: boolean;
  
  /** Multimodal support (text + images) */
  supportsMultimodal: boolean;
  
  /** Rate limiting information */
  rateLimits: RateLimitInfo;
  
  /** Custom capabilities */
  customCapabilities?: Record<string, any>;
}

/**
 * Provider status enumeration
 */
export enum ProviderStatus {
  INITIALIZING = 'initializing',
  READY = 'ready',
  DEGRADED = 'degraded',
  UNAVAILABLE = 'unavailable',
  MAINTENANCE = 'maintenance'
}

/**
 * Core LLM Provider interface
 */
export interface LLMProvider extends EventEmitter {
  /** Unique provider identifier */
  readonly providerId: string;
  
  /** Human-readable provider name */
  readonly name: string;
  
  /** Provider version */
  readonly version: string;
  
  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;
  
  /** Current configuration */
  readonly config: LLMProviderConfig;
  
  /** Current status */
  readonly status: ProviderStatus;
  
  // Core generation methods
  
  /**
   * Generate a complete response from the LLM
   */
  generate(request: LLMRequest): Promise<LLMResponse>;
  
  /**
   * Stream generate responses from the LLM
   */
  streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  
  // Provider lifecycle management
  
  /**
   * Initialize the provider
   */
  initialize(): Promise<void>;
  
  /**
   * Validate provider health and connectivity
   */
  validate(): Promise<ProviderHealthStatus>;
  
  /**
   * Gracefully shutdown the provider
   */
  shutdown(): Promise<void>;
  
  // Configuration management
  
  /**
   * Update provider configuration
   */
  updateConfig(config: Partial<LLMProviderConfig>): Promise<void>;
  
  /**
   * Get current metrics
   */
  getMetrics(): ProviderMetrics;
  
  /**
   * Reset metrics
   */
  resetMetrics(): void;
  
  // Health and monitoring
  
  /**
   * Check if provider is healthy
   */
  isHealthy(): boolean;
  
  /**
   * Get last health check result
   */
  getHealthStatus(): ProviderHealthStatus;
  
  /**
   * Perform a lightweight health check
   */
  ping(): Promise<boolean>;
}

/**
 * Base abstract class for LLM providers
 * Provides common functionality and event handling
 */
export abstract class BaseLLMProvider extends EventEmitter implements LLMProvider {
  public readonly providerId: string;
  public readonly name: string;
  public readonly version: string;
  
  protected _config: LLMProviderConfig;
  protected _status: ProviderStatus = ProviderStatus.INITIALIZING;
  protected _capabilities: ProviderCapabilities;
  protected _metrics: ProviderMetrics;
  protected _lastHealthCheck?: ProviderHealthStatus;
  protected _healthCheckInterval?: NodeJS.Timeout;
  
  constructor(
    providerId: string,
    name: string,
    version: string,
    config: LLMProviderConfig,
    capabilities: ProviderCapabilities
  ) {
    super();
    this.providerId = providerId;
    this.name = name;
    this.version = version;
    this._config = config;
    this._capabilities = capabilities;
    this._metrics = this.initializeMetrics();
  }
  
  // Getters
  get capabilities(): ProviderCapabilities {
    return { ...this._capabilities };
  }
  
  get config(): LLMProviderConfig {
    return { ...this._config };
  }
  
  get status(): ProviderStatus {
    return this._status;
  }
  
  // Abstract methods that must be implemented
  abstract generate(request: LLMRequest): Promise<LLMResponse>;
  abstract streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  
  // Default implementations
  
  async initialize(): Promise<void> {
    this._status = ProviderStatus.INITIALIZING;
    this.emit('statusChanged', this._status);
    
    try {
      await this.performInitialization();
      this._status = ProviderStatus.READY;
      this.startHealthMonitoring();
      this.emit('statusChanged', this._status);
      this.emit('initialized');
    } catch (error) {
      this._status = ProviderStatus.UNAVAILABLE;
      this.emit('statusChanged', this._status);
      this.emit('error', error);
      throw error;
    }
  }
  
  async validate(): Promise<ProviderHealthStatus> {
    const healthStatus = await this.performHealthCheck();
    this._lastHealthCheck = healthStatus;
    this.emit('healthChecked', healthStatus);
    return healthStatus;
  }
  
  async shutdown(): Promise<void> {
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = undefined;
    }
    
    this._status = ProviderStatus.UNAVAILABLE;
    await this.performShutdown();
    this.emit('shutdown');
  }
  
  async updateConfig(config: Partial<LLMProviderConfig>): Promise<void> {
    const oldConfig = { ...this._config };
    this._config = { ...this._config, ...config };
    
    try {
      await this.applyConfigChanges(oldConfig, this._config);
      this.emit('configUpdated', { old: oldConfig, new: this._config });
    } catch (error) {
      this._config = oldConfig;
      throw error;
    }
  }
  
  getMetrics(): ProviderMetrics {
    return { ...this._metrics };
  }
  
  resetMetrics(): void {
    this._metrics = this.initializeMetrics();
    this.emit('metricsReset');
  }
  
  isHealthy(): boolean {
    return this._status === ProviderStatus.READY || this._status === ProviderStatus.DEGRADED;
  }
  
  getHealthStatus(): ProviderHealthStatus {
    return this._lastHealthCheck || {
      isHealthy: this.isHealthy(),
      status: this._status,
      timestamp: new Date(),
      responseTime: 0,
      details: {}
    };
  }
  
  async ping(): Promise<boolean> {
    try {
      const start = Date.now();
      await this.performPing();
      const responseTime = Date.now() - start;
      
      // Update metrics
      this._metrics.healthChecks.total++;
      this._metrics.healthChecks.successful++;
      this._metrics.performance.avgResponseTime = 
        (this._metrics.performance.avgResponseTime + responseTime) / 2;
      
      return true;
    } catch (error) {
      this._metrics.healthChecks.total++;
      this._metrics.healthChecks.failed++;
      return false;
    }
  }
  
  // Protected methods for subclasses to implement
  protected abstract performInitialization(): Promise<void>;
  protected abstract performHealthCheck(): Promise<ProviderHealthStatus>;
  protected abstract performShutdown(): Promise<void>;
  protected abstract applyConfigChanges(oldConfig: LLMProviderConfig, newConfig: LLMProviderConfig): Promise<void>;
  protected abstract performPing(): Promise<void>;
  
  // Protected utility methods
  protected updateMetrics(operation: 'generate' | 'stream', duration: number, success: boolean, tokens?: { input: number; output: number }): void {
    this._metrics.requests.total++;
    
    if (success) {
      this._metrics.requests.successful++;
    } else {
      this._metrics.requests.failed++;
    }
    
    // Update performance metrics
    const perfMetrics = this._metrics.performance;
    perfMetrics.avgResponseTime = (perfMetrics.avgResponseTime + duration) / 2;
    perfMetrics.minResponseTime = Math.min(perfMetrics.minResponseTime || duration, duration);
    perfMetrics.maxResponseTime = Math.max(perfMetrics.maxResponseTime, duration);
    
    // Update token metrics if provided
    if (tokens) {
      this._metrics.tokens.input += tokens.input;
      this._metrics.tokens.output += tokens.output;
      this._metrics.tokens.total += tokens.input + tokens.output;
    }
    
    // Update operation-specific metrics
    if (operation === 'generate') {
      this._metrics.operations.generate++;
    } else {
      this._metrics.operations.stream++;
    }
    
    this.emit('metricsUpdated', this._metrics);
  }
  
  protected setStatus(status: ProviderStatus): void {
    if (this._status !== status) {
      const oldStatus = this._status;
      this._status = status;
      this.emit('statusChanged', status, oldStatus);
    }
  }
  
  private initializeMetrics(): ProviderMetrics {
    return {
      requests: {
        total: 0,
        successful: 0,
        failed: 0
      },
      tokens: {
        input: 0,
        output: 0,
        total: 0
      },
      performance: {
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0
      },
      operations: {
        generate: 0,
        stream: 0
      },
      healthChecks: {
        total: 0,
        successful: 0,
        failed: 0,
        lastCheck: new Date()
      },
      errors: {
        networkErrors: 0,
        apiErrors: 0,
        timeoutErrors: 0,
        rateLimitErrors: 0
      },
      timestamp: new Date()
    };
  }
  
  private startHealthMonitoring(): void {
    if (this._config.healthCheckInterval && this._config.healthCheckInterval > 0) {
      this._healthCheckInterval = setInterval(async () => {
        try {
          await this.validate();
        } catch (error) {
          this.emit('healthCheckFailed', error);
        }
      }, this._config.healthCheckInterval);
    }
  }
}

/**
 * Provider factory interface for creating provider instances
 */
export interface ProviderFactory {
  /**
   * Create a new provider instance
   */
  create(config: LLMProviderConfig): LLMProvider;
  
  /**
   * Provider type identifier
   */
  readonly type: string;
  
  /**
   * Validate configuration for this provider type
   */
  validateConfig(config: LLMProviderConfig): boolean;
  
  /**
   * Get default configuration for this provider type
   */
  getDefaultConfig(): Partial<LLMProviderConfig>;
}