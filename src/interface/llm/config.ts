/**
 * LLM Configuration Interfaces
 * 
 * Configuration structures for LLM providers and model specifications.
 * 
 * @module sentient-agent-framework/interface/llm/config
 */

/**
 * Model pricing information
 */
export interface ModelPricing {
  /** Cost per input token (in USD) */
  inputCost: number;
  
  /** Cost per output token (in USD) */
  outputCost: number;
  
  /** Currency code */
  currency: string;
  
  /** Pricing tier or plan */
  tier?: string;
  
  /** Batch pricing (if different) */
  batchPricing?: {
    inputCost: number;
    outputCost: number;
    minimumBatch?: number;
  };
}

/**
 * Model capability information
 */
export interface ModelCapability {
  /** Maximum context length in tokens */
  maxContextLength: number;
  
  /** Maximum output tokens */
  maxOutputTokens: number;
  
  /** Supports function calling */
  supportsFunctionCalling: boolean;
  
  /** Supports tool calling */
  supportsToolCalling: boolean;
  
  /** Supports vision/image input */
  supportsVision: boolean;
  
  /** Supports JSON mode */
  supportsJsonMode: boolean;
  
  /** Supports streaming */
  supportsStreaming: boolean;
  
  /** Supported languages */
  supportedLanguages: string[];
  
  /** Training data cutoff */
  trainingDataCutoff?: string;
  
  /** Special capabilities */
  specialCapabilities?: string[];
}

/**
 * Model information
 */
export interface ModelInfo {
  /** Model identifier */
  name: string;
  
  /** Human-readable display name */
  displayName: string;
  
  /** Model description */
  description?: string;
  
  /** Model version */
  version?: string;
  
  /** Model capabilities */
  capabilities: ModelCapability;
  
  /** Pricing information */
  pricing: ModelPricing;
  
  /** Whether model is deprecated */
  deprecated?: boolean;
  
  /** Model family or category */
  family?: string;
  
  /** Provider-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitInfo {
  /** Requests per minute */
  requestsPerMinute: number;
  
  /** Tokens per minute */
  tokensPerMinute: number;
  
  /** Concurrent requests limit */
  concurrentRequests: number;
  
  /** Burst allowance */
  burstAllowance?: number;
  
  /** Rate limit reset interval */
  resetInterval?: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  
  /** Base delay in milliseconds */
  baseDelay: number;
  
  /** Maximum delay in milliseconds */
  maxDelay: number;
  
  /** Jitter amount in milliseconds */
  jitterMs: number;
  
  /** Backoff multiplier */
  backoffMultiplier: number;
  
  /** Retry on specific error types */
  retryOn: string[];
  
  /** Don't retry on specific error types */
  dontRetryOn?: string[];
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Failure threshold to open circuit */
  failureThreshold: number;
  
  /** Success threshold to close circuit */
  successThreshold: number;
  
  /** Timeout for half-open state */
  timeout: number;
  
  /** Monitoring window in milliseconds */
  monitoringWindow: number;
  
  /** Minimum calls before circuit breaker activates */
  minimumCalls: number;
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  /** Maximum number of sockets per host */
  maxSockets: number;
  
  /** Maximum number of free sockets per host */
  maxFreeSockets: number;
  
  /** Socket timeout in milliseconds */
  timeout: number;
  
  /** Keep alive timeout in milliseconds */
  keepAliveMsecs: number;
  
  /** Maximum total sockets */
  maxTotalSockets?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Cache TTL in milliseconds */
  ttlMs: number;
  
  /** Maximum cache size in entries */
  maxSize: number;
  
  /** Cache strategy */
  strategy: 'lru' | 'lfu' | 'fifo';
  
  /** Cache key generation strategy */
  keyStrategy: 'full' | 'hash' | 'custom';
  
  /** Custom key function */
  customKeyFn?: (request: any) => string;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  /** API key encryption */
  encryptApiKeys: boolean;
  
  /** Encryption algorithm */
  encryptionAlgorithm?: string;
  
  /** Key derivation options */
  keyDerivation?: {
    iterations: number;
    keyLength: number;
    digest: string;
  };
  
  /** Request signing */
  signRequests?: boolean;
  
  /** TLS options */
  tls?: {
    rejectUnauthorized: boolean;
    minVersion?: string;
    maxVersion?: string;
    ciphers?: string;
  };
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  /** Enable metrics collection */
  enabled: boolean;
  
  /** Metrics collection interval */
  interval: number;
  
  /** Metrics retention period */
  retention: number;
  
  /** Export format */
  exportFormat: 'prometheus' | 'json' | 'csv';
  
  /** Custom metric labels */
  customLabels?: Record<string, string>;
  
  /** Performance thresholds */
  thresholds?: {
    responseTime: number;
    errorRate: number;
    successRate: number;
  };
}

/**
 * Base LLM provider configuration
 */
export interface LLMProviderConfig {
  /** Provider identifier */
  providerId: string;
  
  /** API key or credentials */
  apiKey: string;
  
  /** Base URL for API endpoints */
  baseUrl?: string;
  
  /** Organization ID (for providers that support it) */
  organizationId?: string;
  
  /** Default model to use */
  defaultModel: string;
  
  /** Request timeout in milliseconds */
  timeout: number;
  
  /** Retry configuration */
  retries: RetryConfig;
  
  /** Circuit breaker configuration */
  circuitBreaker: CircuitBreakerConfig;
  
  /** Rate limiting configuration */
  rateLimit: RateLimitInfo;
  
  /** Connection pool configuration */
  connectionPool: ConnectionPoolConfig;
  
  /** Cache configuration */
  cache?: CacheConfig;
  
  /** Security configuration */
  security?: SecurityConfig;
  
  /** Monitoring configuration */
  monitoring?: MonitoringConfig;
  
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
  
  /** Enable request/response logging */
  enableLogging: boolean;
  
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  /** Custom headers */
  customHeaders?: Record<string, string>;
  
  /** Provider-specific options */
  providerOptions?: Record<string, any>;
}

/**
 * OpenAI-specific configuration
 */
export interface OpenAIProviderConfig extends LLMProviderConfig {
  /** OpenAI organization */
  organization?: string;
  
  /** OpenAI project ID */
  projectId?: string;
  
  /** Enable beta features */
  enableBeta?: boolean;
  
  /** User identifier for monitoring */
  user?: string;
}

/**
 * Anthropic-specific configuration
 */
export interface AnthropicProviderConfig extends LLMProviderConfig {
  /** Anthropic version header */
  anthropicVersion?: string;
  
  /** Beta features */
  anthropicBeta?: string[];
}

/**
 * Hugging Face-specific configuration
 */
export interface HuggingFaceProviderConfig extends LLMProviderConfig {
  /** Hugging Face model repository */
  repository?: string;
  
  /** Model revision/branch */
  revision?: string;
  
  /** Use dedicated inference endpoint */
  useDedicatedEndpoint?: boolean;
  
  /** Dedicated endpoint URL */
  dedicatedEndpointUrl?: string;
  
  /** Wait for model to load */
  waitForModel?: boolean;
  
  /** Use cache */
  useCache?: boolean;
}

/**
 * Sentient-specific configuration for Dobby model
 */
export interface SentientProviderConfig extends LLMProviderConfig {
  /** Sentient API version */
  apiVersion?: string;
  
  /** Model variant (e.g., 'dobby-unhinged') */
  modelVariant: string;
  
  /** Custom prompt template */
  promptTemplate?: string;
  
  /** Personality settings */
  personality?: {
    creativityLevel: number;
    formalityLevel: number;
    verbosityLevel: number;
    humorLevel: number;
  };
  
  /** Content filtering settings */
  contentFilter?: {
    enabled: boolean;
    strictness: 'low' | 'medium' | 'high';
    customRules?: string[];
  };
}

/**
 * Configuration validation result
 */
export interface ConfigValidation {
  /** Whether configuration is valid */
  isValid: boolean;
  
  /** Validation errors */
  errors: string[];
  
  /** Warnings (non-blocking) */
  warnings: string[];
  
  /** Normalized configuration */
  normalized?: LLMProviderConfig;
}

/**
 * Configuration manager interface
 */
export interface ConfigManager {
  /**
   * Load configuration from source
   */
  load(source: string): Promise<LLMProviderConfig>;
  
  /**
   * Save configuration to source
   */
  save(config: LLMProviderConfig, target: string): Promise<void>;
  
  /**
   * Validate configuration
   */
  validate(config: LLMProviderConfig): ConfigValidation;
  
  /**
   * Watch for configuration changes
   */
  watch(callback: (config: LLMProviderConfig) => void): void;
  
  /**
   * Stop watching for changes
   */
  unwatch(): void;
}

/**
 * Configuration utilities
 */
export class ConfigUtils {
  /**
   * Create default OpenAI configuration
   */
  static createOpenAIConfig(apiKey: string, overrides: Partial<OpenAIProviderConfig> = {}): OpenAIProviderConfig {
    return {
      providerId: 'openai',
      apiKey,
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4-turbo-preview',
      timeout: 60000,
      retries: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        jitterMs: 100,
        backoffMultiplier: 2,
        retryOn: ['NetworkError', 'TimeoutError', 'RateLimitError']
      },
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 30000,
        monitoringWindow: 60000,
        minimumCalls: 10
      },
      rateLimit: {
        requestsPerMinute: 500,
        tokensPerMinute: 80000,
        concurrentRequests: 10
      },
      connectionPool: {
        maxSockets: 10,
        maxFreeSockets: 5,
        timeout: 30000,
        keepAliveMsecs: 1000
      },
      enableLogging: true,
      logLevel: 'info',
      ...overrides
    };
  }
  
  /**
   * Create default Anthropic configuration
   */
  static createAnthropicConfig(apiKey: string, overrides: Partial<AnthropicProviderConfig> = {}): AnthropicProviderConfig {
    return {
      providerId: 'anthropic',
      apiKey,
      baseUrl: 'https://api.anthropic.com',
      defaultModel: 'claude-3-5-sonnet-20241022',
      timeout: 60000,
      anthropicVersion: '2023-06-01',
      retries: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        jitterMs: 100,
        backoffMultiplier: 2,
        retryOn: ['NetworkError', 'TimeoutError', 'RateLimitError']
      },
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 30000,
        monitoringWindow: 60000,
        minimumCalls: 10
      },
      rateLimit: {
        requestsPerMinute: 200,
        tokensPerMinute: 40000,
        concurrentRequests: 5
      },
      connectionPool: {
        maxSockets: 10,
        maxFreeSockets: 5,
        timeout: 30000,
        keepAliveMsecs: 1000
      },
      enableLogging: true,
      logLevel: 'info',
      ...overrides
    };
  }
  
  /**
   * Create default Hugging Face configuration
   */
  static createHuggingFaceConfig(apiKey: string, overrides: Partial<HuggingFaceProviderConfig> = {}): HuggingFaceProviderConfig {
    return {
      providerId: 'huggingface',
      apiKey,
      baseUrl: 'https://api-inference.huggingface.co',
      defaultModel: 'microsoft/DialoGPT-large',
      timeout: 120000,
      waitForModel: true,
      useCache: true,
      retries: {
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 30000,
        jitterMs: 500,
        backoffMultiplier: 2,
        retryOn: ['NetworkError', 'TimeoutError', 'ModelLoadingError']
      },
      circuitBreaker: {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 60000,
        monitoringWindow: 120000,
        minimumCalls: 5
      },
      rateLimit: {
        requestsPerMinute: 100,
        tokensPerMinute: 20000,
        concurrentRequests: 3
      },
      connectionPool: {
        maxSockets: 5,
        maxFreeSockets: 2,
        timeout: 60000,
        keepAliveMsecs: 2000
      },
      enableLogging: true,
      logLevel: 'info',
      ...overrides
    };
  }
  
  /**
   * Create Sentient/Dobby configuration
   */
  static createSentientConfig(apiKey: string, overrides: Partial<SentientProviderConfig> = {}): SentientProviderConfig {
    return {
      providerId: 'sentient',
      apiKey,
      baseUrl: 'https://api.sentient.ai/v1',
      defaultModel: 'dobby-unhinged-v2',
      modelVariant: 'dobby-unhinged',
      timeout: 90000,
      personality: {
        creativityLevel: 0.8,
        formalityLevel: 0.3,
        verbosityLevel: 0.7,
        humorLevel: 0.9
      },
      contentFilter: {
        enabled: true,
        strictness: 'medium'
      },
      retries: {
        maxRetries: 4,
        baseDelay: 1500,
        maxDelay: 15000,
        jitterMs: 200,
        backoffMultiplier: 2,
        retryOn: ['NetworkError', 'TimeoutError', 'RateLimitError']
      },
      circuitBreaker: {
        failureThreshold: 4,
        successThreshold: 3,
        timeout: 45000,
        monitoringWindow: 90000,
        minimumCalls: 8
      },
      rateLimit: {
        requestsPerMinute: 300,
        tokensPerMinute: 60000,
        concurrentRequests: 8
      },
      connectionPool: {
        maxSockets: 8,
        maxFreeSockets: 4,
        timeout: 45000,
        keepAliveMsecs: 1500
      },
      enableLogging: true,
      logLevel: 'info',
      ...overrides
    };
  }
  
  /**
   * Validate provider configuration
   */
  static validateConfig(config: LLMProviderConfig): ConfigValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!config.providerId) errors.push('Provider ID is required');
    if (!config.apiKey) errors.push('API key is required');
    if (!config.defaultModel) errors.push('Default model is required');
    
    // Timeout validation
    if (config.timeout <= 0) errors.push('Timeout must be positive');
    if (config.timeout > 300000) warnings.push('Timeout is very high (>5 minutes)');
    
    // Retry configuration validation
    if (config.retries) {
      if (config.retries.maxRetries < 0) errors.push('Max retries cannot be negative');
      if (config.retries.baseDelay <= 0) errors.push('Base delay must be positive');
      if (config.retries.maxDelay <= config.retries.baseDelay) {
        errors.push('Max delay must be greater than base delay');
      }
    }
    
    // Circuit breaker validation
    if (config.circuitBreaker) {
      if (config.circuitBreaker.failureThreshold <= 0) {
        errors.push('Failure threshold must be positive');
      }
      if (config.circuitBreaker.successThreshold <= 0) {
        errors.push('Success threshold must be positive');
      }
    }
    
    // Rate limit validation
    if (config.rateLimit) {
      if (config.rateLimit.requestsPerMinute <= 0) {
        errors.push('Requests per minute must be positive');
      }
      if (config.rateLimit.tokensPerMinute <= 0) {
        errors.push('Tokens per minute must be positive');
      }
      if (config.rateLimit.concurrentRequests <= 0) {
        errors.push('Concurrent requests must be positive');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Merge configurations with proper precedence
   */
  static mergeConfigs(base: LLMProviderConfig, override: Partial<LLMProviderConfig>): LLMProviderConfig {
    const result: LLMProviderConfig = {
      ...base,
      ...override,
      retries: { ...base.retries, ...(override.retries || {}) },
      circuitBreaker: { ...base.circuitBreaker, ...(override.circuitBreaker || {}) },
      rateLimit: { ...base.rateLimit, ...(override.rateLimit || {}) },
      connectionPool: { ...base.connectionPool, ...(override.connectionPool || {}) }
    };

    // Handle optional nested objects
    if (base.cache || override.cache) {
      result.cache = { ...(base.cache || {} as CacheConfig), ...(override.cache || {}) };
    }

    if (base.security || override.security) {
      result.security = { ...(base.security || {} as SecurityConfig), ...(override.security || {}) };
    }

    if (base.monitoring || override.monitoring) {
      result.monitoring = { ...(base.monitoring || {} as MonitoringConfig), ...(override.monitoring || {}) };
    }

    return result;
  }
}