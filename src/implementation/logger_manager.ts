/**
 * Logger Manager for Sentient Agent Framework Logging
 *
 * Provides centralized management of loggers, transports, and configuration.
 * Handles metrics collection, system shutdown, and global logging settings.
 *
 * @module sentient-agent-framework/implementation/logger_manager
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

import { ulid } from 'ulid';
import {
  Logger,
  LoggerManager,
  LoggerConfig,
  LoggingSystemConfig,
  LogLevel,
  LogContext,
  LogTransport,
  LoggingMetrics,
  TransportMetrics,
  SamplingRule,
  LogFilter,
  LogFormatter,
  ConfigurationError,
  LoggingError
} from '../interface/logging';
import { DefaultLogger } from './logger';
import { ConsoleTransport, createDevConsoleTransport, createProdConsoleTransport } from './transports/console_transport';
import { FileTransport, createRotatingFileTransport } from './transports/file_transport';
import { HTTPTransport, createHTTPSTransport } from './transports/http_transport';

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_SAMPLING_RULES: SamplingRule[] = [
  {
    logger: '*',
    level: LogLevel.DEBUG,
    rate: 0.1 // Sample 10% of debug logs
  },
  {
    logger: '*',
    level: LogLevel.TRACE,
    rate: 0.05 // Sample 5% of trace logs
  }
];

const DEFAULT_SYSTEM_CONFIG: LoggingSystemConfig = {
  defaultLevel: LogLevel.INFO,
  environment: 'development',
  globalContext: {
    service: 'sentient-agent-framework',
    version: '1.0.0'
  },
  performance: {
    enableMetrics: true,
    metricsInterval: 60000, // 1 minute
    slowThreshold: 1000 // 1 second
  },
  correlation: {
    enabled: true,
    headerName: 'x-correlation-id',
    generateIds: true
  },
  sampling: {
    enabled: false,
    rules: DEFAULT_SAMPLING_RULES
  }
};

// ============================================================================
// Logger Manager Implementation
// ============================================================================

export class DefaultLoggerManager implements LoggerManager {
  private _loggers: Map<string, Logger> = new Map();
  private _globalTransports: Map<string, LogTransport> = new Map();
  private _config: LoggingSystemConfig = { ...DEFAULT_SYSTEM_CONFIG };
  private _metrics: LoggingMetrics;
  private _metricsTimer?: NodeJS.Timeout;
  private _isShuttingDown = false;
  private _correlationIdGenerator: () => string = () => ulid();

  constructor(config?: Partial<LoggingSystemConfig>) {
    if (config) {
      this.configure(config);
    }

    this._metrics = this._initializeMetrics();
    this._setupMetricsCollection();
    this._setupDefaultTransports();
  }

  // ============================================================================
  // Logger Management
  // ============================================================================

  getLogger(name: string): Logger {
    let logger = this._loggers.get(name);
    
    if (!logger) {
      logger = this.createLogger(name);
      this._loggers.set(name, logger);
    }

    return logger;
  }

  createLogger(name: string, config?: LoggerConfig): Logger {
    const effectiveConfig: LoggerConfig = {
      name,
      level: config?.level ?? this._config.defaultLevel ?? LogLevel.INFO,
      context: {
        ...this._config.globalContext,
        ...config?.context
      },
      transports: config?.transports ?? [],
      enableMetrics: config?.enableMetrics ?? this._config.performance?.enableMetrics,
      enableSampling: config?.enableSampling ?? this._config.sampling?.enabled,
      samplingRate: config?.samplingRate,
      enableCorrelation: config?.enableCorrelation ?? this._config.correlation?.enabled,
      formatters: config?.formatters ?? {},
      filters: config?.filters ?? {}
    };

    const logger = new DefaultLogger(name, effectiveConfig);

    // Add global transports
    for (const transport of this._globalTransports.values()) {
      logger.addTransport(transport);
    }

    // Add logger-specific transports
    if (config?.transports) {
      for (const transportConfig of config.transports) {
        const transport = this._createTransportFromConfig(transportConfig);
        if (transport) {
          logger.addTransport(transport);
        }
      }
    }

    this._loggers.set(name, logger);
    this._updateMetrics();

    return logger;
  }

  removeLogger(name: string): void {
    const logger = this._loggers.get(name);
    if (logger) {
      // Close logger resources if needed
      this._loggers.delete(name);
      this._updateMetrics();
    }
  }

  listLoggers(): string[] {
    return Array.from(this._loggers.keys());
  }

  // ============================================================================
  // Configuration Management
  // ============================================================================

  configure(config: Partial<LoggingSystemConfig>): void {
    // Deep merge configuration
    this._config = {
      ...this._config,
      ...config,
      performance: {
        ...this._config.performance,
        ...config.performance
      },
      correlation: {
        ...this._config.correlation,
        ...config.correlation
      },
      sampling: {
        ...this._config.sampling,
        ...config.sampling,
        rules: config.sampling?.rules ?? this._config.sampling?.rules
      },
      globalContext: {
        ...this._config.globalContext,
        ...config.globalContext
      }
    };

    // Apply configuration to existing loggers
    this._applyConfigurationToExistingLoggers();

    // Setup metrics collection
    this._setupMetricsCollection();
  }

  getConfiguration(): LoggingSystemConfig {
    return { ...this._config };
  }

  setDefaultLevel(level: LogLevel): void {
    this._config.defaultLevel = level;
    
    // Update all existing loggers
    for (const logger of this._loggers.values()) {
      logger.setLevel(level);
    }
  }

  setGlobalContext(context: LogContext): void {
    this._config.globalContext = { ...this._config.globalContext, ...context };
    
    // Note: Existing loggers won't automatically get new global context
    // They would need to be recreated or manually updated
  }

  // ============================================================================
  // Transport Management
  // ============================================================================

  addGlobalTransport(transport: LogTransport): void {
    this._globalTransports.set(transport.name, transport);
    
    // Add to all existing loggers
    for (const logger of this._loggers.values()) {
      logger.addTransport(transport);
    }
  }

  removeGlobalTransport(name: string): void {
    const transport = this._globalTransports.get(name);
    if (transport) {
      this._globalTransports.delete(name);
      
      // Remove from all existing loggers
      for (const logger of this._loggers.values()) {
        logger.removeTransport(name);
      }
      
      // Close transport
      transport.close();
    }
  }

  listTransports(): string[] {
    return Array.from(this._globalTransports.keys());
  }

  // ============================================================================
  // Metrics and Monitoring
  // ============================================================================

  getMetrics(): LoggingMetrics {
    // Update memory usage
    if (this._config.performance?.enableMetrics) {
      const memoryUsage = process.memoryUsage();
      this._metrics.memoryUsage = {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      };
    }

    return { ...this._metrics };
  }

  resetMetrics(): void {
    this._metrics = this._initializeMetrics();
  }

  // ============================================================================
  // System Control
  // ============================================================================

  async shutdown(): Promise<void> {
    this._isShuttingDown = true;

    // Clear metrics timer
    if (this._metricsTimer) {
      clearInterval(this._metricsTimer);
      this._metricsTimer = undefined;
    }

    // Close all transports
    const closePromises: Promise<void>[] = [];
    
    for (const transport of this._globalTransports.values()) {
      const closeResult = transport.close();
      if (closeResult instanceof Promise) {
        closePromises.push(closeResult);
      }
    }

    await Promise.all(closePromises);

    // Clear collections
    this._loggers.clear();
    this._globalTransports.clear();
  }

  async flush(): Promise<void> {
    const flushPromises: Promise<void>[] = [];

    // Flush all transports that support it
    for (const transport of this._globalTransports.values()) {
      if ('flush' in transport && typeof transport.flush === 'function') {
        const flushResult = (transport as any).flush();
        if (flushResult instanceof Promise) {
          flushPromises.push(flushResult);
        }
      }
    }

    await Promise.all(flushPromises);
  }

  // ============================================================================
  // Correlation ID Management
  // ============================================================================

  generateCorrelationId(): string {
    return this._correlationIdGenerator();
  }

  setCorrelationIdGenerator(generator: () => string): void {
    this._correlationIdGenerator = generator;
  }

  // ============================================================================
  // Sampling and Filtering
  // ============================================================================

  shouldSample(loggerName: string, level: LogLevel): boolean {
    if (!this._config.sampling?.enabled || !this._config.sampling.rules) {
      return true;
    }

    for (const rule of this._config.sampling.rules) {
      if (this._matchesRule(rule, loggerName, level)) {
        return Math.random() < rule.rate;
      }
    }

    return true; // Default to sampling if no rules match
  }

  addSamplingRule(rule: SamplingRule): void {
    if (!this._config.sampling) {
      this._config.sampling = { enabled: true, rules: [] };
    }
    
    if (!this._config.sampling.rules) {
      this._config.sampling.rules = [];
    }

    this._config.sampling.rules.push(rule);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private _initializeMetrics(): LoggingMetrics {
    return {
      totalLogs: 0,
      logsByLevel: {
        TRACE: 0,
        DEBUG: 0,
        INFO: 0,
        WARN: 0,
        ERROR: 0,
        FATAL: 0,
        OFF: 0
      },
      logsByLogger: {},
      errorCount: 0,
      droppedLogs: 0,
      averageProcessingTime: 0,
      transportMetrics: {},
      uptime: Date.now()
    };
  }

  private _setupMetricsCollection(): void {
    if (this._metricsTimer) {
      clearInterval(this._metricsTimer);
    }

    if (this._config.performance?.enableMetrics) {
      const interval = this._config.performance.metricsInterval ?? 60000;
      this._metricsTimer = setInterval(() => {
        this._updateMetrics();
      }, interval);
    }
  }

  private _setupDefaultTransports(): void {
    if (this._config.environment === 'development') {
      this.addGlobalTransport(createDevConsoleTransport());
    } else if (this._config.environment === 'production') {
      this.addGlobalTransport(createProdConsoleTransport());
    }
  }

  private _updateMetrics(): void {
    // Update uptime
    this._metrics.uptime = Date.now() - this._metrics.uptime;

    // Update transport metrics
    for (const [name, transport] of this._globalTransports.entries()) {
      if (!this._metrics.transportMetrics[name]) {
        this._metrics.transportMetrics[name] = {
          name,
          type: transport.type,
          logsProcessed: 0,
          errors: 0,
          averageTime: 0
        };
      }
    }
  }

  private _applyConfigurationToExistingLoggers(): void {
    // Apply default level to loggers that don't have explicit levels
    if (this._config.defaultLevel !== undefined) {
      for (const logger of this._loggers.values()) {
        // Note: This is a simplified approach. In a real implementation,
        // you'd want to track which loggers have explicit levels vs defaults
        logger.setLevel(this._config.defaultLevel);
      }
    }
  }

  private _createTransportFromConfig(config: any): LogTransport | null {
    try {
      switch (config.type) {
        case 'console':
          return new ConsoleTransport(config.name, config);
        
        case 'file':
          if (config.maxSize) {
            return createRotatingFileTransport(
              config.name,
              config.filename,
              config.maxSize,
              config.maxFiles
            );
          } else {
            return new FileTransport(config.name, config);
          }
        
        case 'http':
          return new HTTPTransport(config.name, config);
        
        default:
          console.warn(`Unknown transport type: ${config.type}`);
          return null;
      }
    } catch (error) {
      throw new ConfigurationError(
        `Failed to create transport ${config.name}: ${error instanceof Error ? error.message : String(error)}`,
        `transports.${config.name}`
      );
    }
  }

  private _matchesRule(rule: SamplingRule, loggerName: string, level: LogLevel): boolean {
    // Check logger name pattern
    if (rule.logger && rule.logger !== '*') {
      const pattern = rule.logger.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      if (!regex.test(loggerName)) {
        return false;
      }
    }

    // Check level
    if (rule.level !== undefined && level !== rule.level) {
      return false;
    }

    return true;
  }
}

// ============================================================================
// Global Logger Manager Instance
// ============================================================================

let globalLoggerManager: LoggerManager | null = null;

/**
 * Gets the global logger manager instance
 */
export function getGlobalLoggerManager(): LoggerManager {
  if (!globalLoggerManager) {
    globalLoggerManager = new DefaultLoggerManager();
  }
  return globalLoggerManager;
}

/**
 * Sets the global logger manager instance
 */
export function setGlobalLoggerManager(manager: LoggerManager): void {
  globalLoggerManager = manager;
}

/**
 * Creates a new logger manager with configuration
 */
export function createLoggerManager(config?: Partial<LoggingSystemConfig>): LoggerManager {
  return new DefaultLoggerManager(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Gets a logger from the global manager
 */
export function getLogger(name: string): Logger {
  return getGlobalLoggerManager().getLogger(name);
}

/**
 * Configures the global logging system
 */
export function configureLogging(config: Partial<LoggingSystemConfig>): void {
  getGlobalLoggerManager().configure(config);
}

/**
 * Adds a transport to all loggers
 */
export function addGlobalTransport(transport: LogTransport): void {
  getGlobalLoggerManager().addGlobalTransport(transport);
}

/**
 * Shuts down the global logging system
 */
export async function shutdownLogging(): Promise<void> {
  if (globalLoggerManager) {
    await globalLoggerManager.shutdown();
    globalLoggerManager = null;
  }
}

/**
 * Sets up logging for different environments
 */
export function setupEnvironmentLogging(environment: 'development' | 'staging' | 'production' | 'test'): void {
  const config: Partial<LoggingSystemConfig> = {
    environment,
    defaultLevel: environment === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
    performance: {
      enableMetrics: environment !== 'test',
      metricsInterval: environment === 'production' ? 300000 : 60000, // 5 min in prod, 1 min otherwise
      slowThreshold: environment === 'production' ? 2000 : 1000
    },
    sampling: {
      enabled: environment === 'production',
      rules: environment === 'production' ? DEFAULT_SAMPLING_RULES : []
    }
  };

  configureLogging(config);
}

// ============================================================================
// Exports
// ============================================================================

export {
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_SAMPLING_RULES
};