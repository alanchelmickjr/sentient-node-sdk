/**
 * LLM Metrics and Monitoring Interfaces
 * 
 * Comprehensive metrics collection and monitoring for LLM providers.
 * 
 * @module sentient-agent-framework/interface/llm/metrics
 */

import { ProviderStatus } from './provider';

/**
 * Request metrics
 */
export interface RequestMetrics {
  /** Total number of requests */
  total: number;
  
  /** Successful requests */
  successful: number;
  
  /** Failed requests */
  failed: number;
  
  /** Requests per second (current rate) */
  requestsPerSecond?: number;
  
  /** Average requests per minute */
  averageRequestsPerMinute?: number;
}

/**
 * Token usage metrics
 */
export interface TokenMetrics {
  /** Input tokens consumed */
  input: number;
  
  /** Output tokens generated */
  output: number;
  
  /** Total tokens */
  total: number;
  
  /** Cached tokens (if supported) */
  cached?: number;
  
  /** Tokens per second (current rate) */
  tokensPerSecond?: number;
  
  /** Average cost per token */
  averageCostPerToken?: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Average response time in milliseconds */
  avgResponseTime: number;
  
  /** Minimum response time in milliseconds */
  minResponseTime: number;
  
  /** Maximum response time in milliseconds */
  maxResponseTime: number;
  
  /** 95th percentile response time */
  p95ResponseTime?: number;
  
  /** 99th percentile response time */
  p99ResponseTime?: number;
  
  /** Current throughput (requests/second) */
  throughput?: number;
}

/**
 * Operation-specific metrics
 */
export interface OperationMetrics {
  /** Generate operations count */
  generate: number;
  
  /** Stream operations count */
  stream: number;
  
  /** Health checks count */
  healthChecks?: number;
  
  /** Configuration updates count */
  configUpdates?: number;
}

/**
 * Error metrics
 */
export interface ErrorMetrics {
  /** Network errors */
  networkErrors: number;
  
  /** API errors (4xx/5xx) */
  apiErrors: number;
  
  /** Timeout errors */
  timeoutErrors: number;
  
  /** Rate limit errors */
  rateLimitErrors: number;
  
  /** Authentication errors */
  authErrors?: number;
  
  /** Validation errors */
  validationErrors?: number;
  
  /** Circuit breaker errors */
  circuitBreakerErrors?: number;
}

/**
 * Health check metrics
 */
export interface HealthMetrics {
  /** Total health checks performed */
  total: number;
  
  /** Successful health checks */
  successful: number;
  
  /** Failed health checks */
  failed: number;
  
  /** Last health check timestamp */
  lastCheck: Date;
  
  /** Average health check response time */
  averageResponseTime?: number;
  
  /** Health check success rate */
  successRate?: number;
}

/**
 * Cost metrics
 */
export interface CostMetrics {
  /** Total cost in USD */
  totalCost: number;
  
  /** Input token costs */
  inputCost: number;
  
  /** Output token costs */
  outputCost: number;
  
  /** Cost per request */
  costPerRequest: number;
  
  /** Daily cost */
  dailyCost?: number;
  
  /** Monthly cost */
  monthlyCost?: number;
  
  /** Cost trend (increasing/decreasing) */
  costTrend?: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Rate limiting metrics
 */
export interface RateLimitMetrics {
  /** Current requests per minute */
  currentRpm: number;
  
  /** Current tokens per minute */
  currentTpm: number;
  
  /** Rate limit hits */
  rateLimitHits: number;
  
  /** Time until rate limit reset */
  resetTime?: Date;
  
  /** Remaining requests in current window */
  remainingRequests?: number;
  
  /** Remaining tokens in current window */
  remainingTokens?: number;
}

/**
 * Comprehensive provider metrics
 */
export interface ProviderMetrics {
  /** Request-related metrics */
  requests: RequestMetrics;
  
  /** Token usage metrics */
  tokens: TokenMetrics;
  
  /** Performance metrics */
  performance: PerformanceMetrics;
  
  /** Operation metrics */
  operations: OperationMetrics;
  
  /** Error metrics */
  errors: ErrorMetrics;
  
  /** Health check metrics */
  healthChecks: HealthMetrics;
  
  /** Cost metrics */
  costs?: CostMetrics;
  
  /** Rate limiting metrics */
  rateLimit?: RateLimitMetrics;
  
  /** Metrics collection timestamp */
  timestamp: Date;
  
  /** Metrics collection period */
  period?: {
    start: Date;
    end: Date;
  };
}

/**
 * Provider health status
 */
export interface ProviderHealthStatus {
  /** Whether provider is healthy */
  isHealthy: boolean;
  
  /** Current provider status */
  status: ProviderStatus;
  
  /** Health check timestamp */
  timestamp: Date;
  
  /** Response time for health check */
  responseTime: number;
  
  /** Health check details */
  details: {
    /** Connectivity status */
    connectivity?: boolean;
    
    /** Authentication status */
    authentication?: boolean;
    
    /** Rate limiting status */
    rateLimiting?: boolean;
    
    /** Model availability */
    modelAvailability?: boolean;
    
    /** Custom health indicators */
    custom?: Record<string, boolean>;
  };
  
  /** Error message if unhealthy */
  error?: string;
  
  /** Additional diagnostic information */
  diagnostics?: Record<string, any>;
}

/**
 * Aggregated metrics across multiple providers
 */
export interface AggregatedMetrics {
  /** Metrics by provider ID */
  byProvider: Record<string, ProviderMetrics>;
  
  /** Combined totals */
  totals: {
    requests: RequestMetrics;
    tokens: TokenMetrics;
    costs: CostMetrics;
    errors: ErrorMetrics;
  };
  
  /** Provider availability */
  availability: Record<string, boolean>;
  
  /** Performance comparison */
  performance: Record<string, PerformanceMetrics>;
  
  /** Aggregation timestamp */
  timestamp: Date;
  
  /** Aggregation period */
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * Metrics collection configuration
 */
export interface MetricsConfig {
  /** Enable metrics collection */
  enabled: boolean;
  
  /** Collection interval in milliseconds */
  interval: number;
  
  /** Metrics retention period in milliseconds */
  retention: number;
  
  /** Buffer size for metrics data points */
  bufferSize: number;
  
  /** Export configuration */
  export?: {
    /** Enable export */
    enabled: boolean;
    
    /** Export format */
    format: 'prometheus' | 'json' | 'csv' | 'influxdb';
    
    /** Export endpoint */
    endpoint?: string;
    
    /** Export interval */
    interval: number;
    
    /** Custom labels */
    labels?: Record<string, string>;
  };
  
  /** Alerting configuration */
  alerting?: {
    /** Enable alerting */
    enabled: boolean;
    
    /** Thresholds for alerts */
    thresholds: {
      errorRate: number;
      responseTime: number;
      successRate: number;
      costPerHour?: number;
    };
    
    /** Alert channels */
    channels?: Array<{
      type: 'webhook' | 'email' | 'slack';
      config: Record<string, any>;
    }>;
  };
}

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
  /**
   * Record a request metric
   */
  recordRequest(
    providerId: string,
    operation: 'generate' | 'stream',
    duration: number,
    success: boolean,
    tokens?: { input: number; output: number },
    cost?: number
  ): void;
  
  /**
   * Record an error
   */
  recordError(
    providerId: string,
    errorType: string,
    error: Error
  ): void;
  
  /**
   * Record health check
   */
  recordHealthCheck(
    providerId: string,
    success: boolean,
    responseTime: number,
    details?: Record<string, any>
  ): void;
  
  /**
   * Get metrics for a provider
   */
  getProviderMetrics(providerId: string): ProviderMetrics | null;
  
  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(
    providers?: string[],
    period?: { start: Date; end: Date }
  ): AggregatedMetrics;
  
  /**
   * Reset metrics for a provider
   */
  resetProviderMetrics(providerId: string): void;
  
  /**
   * Reset all metrics
   */
  resetAllMetrics(): void;
  
  /**
   * Export metrics
   */
  exportMetrics(format: 'prometheus' | 'json' | 'csv'): string;
}

/**
 * Real-time metrics stream
 */
export interface MetricsStream {
  /**
   * Subscribe to real-time metrics updates
   */
  subscribe(
    providerId: string,
    callback: (metrics: ProviderMetrics) => void
  ): string;
  
  /**
   * Subscribe to aggregated metrics updates
   */
  subscribeAggregated(
    callback: (metrics: AggregatedMetrics) => void
  ): string;
  
  /**
   * Subscribe to health status updates
   */
  subscribeHealth(
    providerId: string,
    callback: (status: ProviderHealthStatus) => void
  ): string;
  
  /**
   * Unsubscribe from updates
   */
  unsubscribe(subscriptionId: string): void;
  
  /**
   * Start the metrics stream
   */
  start(): void;
  
  /**
   * Stop the metrics stream
   */
  stop(): void;
}

/**
 * Metrics utilities
 */
export class MetricsUtils {
  /**
   * Calculate success rate from metrics
   */
  static calculateSuccessRate(metrics: RequestMetrics): number {
    if (metrics.total === 0) return 0;
    return metrics.successful / metrics.total;
  }
  
  /**
   * Calculate error rate from metrics
   */
  static calculateErrorRate(metrics: RequestMetrics): number {
    if (metrics.total === 0) return 0;
    return metrics.failed / metrics.total;
  }
  
  /**
   * Calculate cost efficiency (tokens per dollar)
   */
  static calculateCostEfficiency(tokens: TokenMetrics, costs: CostMetrics): number {
    if (costs.totalCost === 0) return 0;
    return tokens.total / costs.totalCost;
  }
  
  /**
   * Calculate performance score (0-100)
   */
  static calculatePerformanceScore(
    performance: PerformanceMetrics,
    requests: RequestMetrics
  ): number {
    const successRate = MetricsUtils.calculateSuccessRate(requests);
    const responseTimeScore = Math.max(0, 100 - (performance.avgResponseTime / 100));
    return (successRate * 0.7 + responseTimeScore * 0.3) * 100;
  }
  
  /**
   * Format metrics for display
   */
  static formatMetrics(metrics: ProviderMetrics): Record<string, string> {
    return {
      'Total Requests': metrics.requests.total.toLocaleString(),
      'Success Rate': `${(MetricsUtils.calculateSuccessRate(metrics.requests) * 100).toFixed(2)}%`,
      'Avg Response Time': `${metrics.performance.avgResponseTime.toFixed(0)}ms`,
      'Total Tokens': metrics.tokens.total.toLocaleString(),
      'Total Cost': metrics.costs ? `$${metrics.costs.totalCost.toFixed(4)}` : 'N/A'
    };
  }
  
  /**
   * Create empty metrics object
   */
  static createEmptyMetrics(): ProviderMetrics {
    const now = new Date();
    
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
      errors: {
        networkErrors: 0,
        apiErrors: 0,
        timeoutErrors: 0,
        rateLimitErrors: 0
      },
      healthChecks: {
        total: 0,
        successful: 0,
        failed: 0,
        lastCheck: now
      },
      timestamp: now
    };
  }
  
  /**
   * Merge multiple metrics objects
   */
  static mergeMetrics(metricsArray: ProviderMetrics[]): ProviderMetrics {
    if (metricsArray.length === 0) {
      return MetricsUtils.createEmptyMetrics();
    }
    
    const merged = MetricsUtils.createEmptyMetrics();
    
    for (const metrics of metricsArray) {
      // Merge request metrics
      merged.requests.total += metrics.requests.total;
      merged.requests.successful += metrics.requests.successful;
      merged.requests.failed += metrics.requests.failed;
      
      // Merge token metrics
      merged.tokens.input += metrics.tokens.input;
      merged.tokens.output += metrics.tokens.output;
      merged.tokens.total += metrics.tokens.total;
      
      // Merge performance metrics (weighted average)
      const totalRequests = merged.requests.total;
      if (totalRequests > 0) {
        merged.performance.avgResponseTime = 
          (merged.performance.avgResponseTime * (totalRequests - metrics.requests.total) + 
           metrics.performance.avgResponseTime * metrics.requests.total) / totalRequests;
      }
      
      merged.performance.minResponseTime = Math.min(
        merged.performance.minResponseTime || Infinity,
        metrics.performance.minResponseTime
      );
      merged.performance.maxResponseTime = Math.max(
        merged.performance.maxResponseTime,
        metrics.performance.maxResponseTime
      );
      
      // Merge operation metrics
      merged.operations.generate += metrics.operations.generate;
      merged.operations.stream += metrics.operations.stream;
      
      // Merge error metrics
      merged.errors.networkErrors += metrics.errors.networkErrors;
      merged.errors.apiErrors += metrics.errors.apiErrors;
      merged.errors.timeoutErrors += metrics.errors.timeoutErrors;
      merged.errors.rateLimitErrors += metrics.errors.rateLimitErrors;
      
      // Merge health check metrics
      merged.healthChecks.total += metrics.healthChecks.total;
      merged.healthChecks.successful += metrics.healthChecks.successful;
      merged.healthChecks.failed += metrics.healthChecks.failed;
      
      // Use latest timestamp
      if (metrics.timestamp > merged.timestamp) {
        merged.timestamp = metrics.timestamp;
      }
      
      // Merge cost metrics if available
      if (metrics.costs && merged.costs) {
        merged.costs.totalCost += metrics.costs.totalCost;
        merged.costs.inputCost += metrics.costs.inputCost;
        merged.costs.outputCost += metrics.costs.outputCost;
        merged.costs.costPerRequest = merged.costs.totalCost / merged.requests.total;
      } else if (metrics.costs) {
        merged.costs = { ...metrics.costs };
      }
    }
    
    return merged;
  }
}