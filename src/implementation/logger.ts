/**
 * Core Logger Implementation for Sentient Agent Framework
 *
 * Provides structured JSON logging with multiple transport support,
 * performance monitoring, and contextual metadata management.
 *
 * @module sentient-agent-framework/implementation/logger
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

import { ulid } from 'ulid';
import { 
  Logger,
  LogLevel,
  LogLevelName,
  LogEntry,
  LogContext,
  LogError,
  LogTransport,
  LogTimer,
  LoggerConfig,
  LoggingError,
  EventMetadata
} from '../interface/logging';

// ============================================================================
// Utility Functions
// ============================================================================

const LOG_LEVEL_NAMES: Record<LogLevel, LogLevelName> = {
  [LogLevel.TRACE]: 'TRACE',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
  [LogLevel.OFF]: 'OFF'
};

function formatError(error: Error | LogError): LogError {
  if ('name' in error && 'message' in error && 'stack' in error) {
    // Standard Error object
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      details: (error as any).details
    };
  }
  // Already a LogError
  return error as LogError;
}

function mergeContext(base?: LogContext, additional?: LogContext): LogContext {
  if (!base && !additional) return {};
  if (!base) return { ...additional };
  if (!additional) return { ...base };
  return { ...base, ...additional };
}

function getSystemInfo(): Partial<LogEntry> {
  return {
    hostname: process.env.HOSTNAME || 'unknown',
    pid: process.pid,
    source: 'sentient-agent-framework'
  };
}

// ============================================================================
// Log Timer Implementation
// ============================================================================

class DefaultLogTimer implements LogTimer {
  public readonly startTime: number;
  
  constructor(
    public readonly operation: string,
    private readonly logger: DefaultLogger
  ) {
    this.startTime = Date.now();
  }

  done(message?: string, level: LogLevel = LogLevel.INFO, context?: LogContext): void {
    const duration = Date.now() - this.startTime;
    const finalMessage = message || `Operation '${this.operation}' completed`;
    
    this.logger.log(level, finalMessage, {
      ...context,
      operation: this.operation,
      duration
    });
  }
}

// ============================================================================
// Core Logger Implementation
// ============================================================================

export class DefaultLogger implements Logger {
  private _level: LogLevel;
  private _context: LogContext;
  private _transports: Map<string, LogTransport> = new Map();
  private _timers: Map<string, number> = new Map();

  constructor(
    public readonly name: string,
    config?: LoggerConfig
  ) {
    this._level = config?.level ?? LogLevel.INFO;
    this._context = config?.context ?? {};

    // Add configured transports
    if (config?.transports) {
      // Note: In a real implementation, we would create transport instances here
      // For now, we'll add them via addTransport method
    }
  }

  // ============================================================================
  // Core Properties
  // ============================================================================

  get level(): LogLevel {
    return this._level;
  }

  get context(): LogContext {
    return { ...this._context };
  }

  // ============================================================================
  // Core Logging Methods
  // ============================================================================

  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error | LogError, context?: LogContext): void {
    const logContext = error ? { ...context, error: formatError(error) } : context;
    this.log(LogLevel.ERROR, message, logContext);
  }

  fatal(message: string, error?: Error | LogError, context?: LogContext): void {
    const logContext = error ? { ...context, error: formatError(error) } : context;
    this.log(LogLevel.FATAL, message, logContext);
  }

  // ============================================================================
  // Generic Logging Method
  // ============================================================================

  log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.isEnabled(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      levelName: LOG_LEVEL_NAMES[level],
      message,
      logger: this.name,
      context: mergeContext(this._context, context),
      ...getSystemInfo()
    };

    // Add error to top level if present in context
    if (context?.error) {
      entry.error = context.error;
    }

    // Process through all transports
    this._processLogEntry(entry);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  isEnabled(level: LogLevel): boolean {
    return level >= this._level && this._level !== LogLevel.OFF;
  }

  child(context: LogContext): Logger {
    const childLogger = new DefaultLogger(this.name, {
      name: this.name,
      level: this._level,
      context: mergeContext(this._context, context)
    });

    // Copy transports to child
    for (const [name, transport] of this._transports) {
      childLogger.addTransport(transport);
    }

    return childLogger;
  }

  setLevel(level: LogLevel): void {
    this._level = level;
  }

  // ============================================================================
  // Transport Management
  // ============================================================================

  addTransport(transport: LogTransport): void {
    this._transports.set(transport.name, transport);
  }

  removeTransport(name: string): void {
    this._transports.delete(name);
  }

  // ============================================================================
  // Performance and Timing
  // ============================================================================

  time(operation: string): LogTimer {
    return new DefaultLogTimer(operation, this);
  }

  profile(id: string): void {
    const now = Date.now();
    
    if (this._timers.has(id)) {
      // End profiling
      const startTime = this._timers.get(id)!;
      const duration = now - startTime;
      this._timers.delete(id);
      
      this.info(`Profile '${id}' completed`, { 
        profileId: id,
        duration,
        operation: 'profile'
      });
    } else {
      // Start profiling
      this._timers.set(id, now);
      this.debug(`Profile '${id}' started`, { 
        profileId: id,
        operation: 'profile_start'
      });
    }
  }

  // ============================================================================
  // Structured Logging Helpers
  // ============================================================================

  withContext(context: LogContext): Logger {
    return this.child(context);
  }

  withCorrelationId(correlationId: string): Logger {
    return this.child({ correlationId });
  }

  withRequestId(requestId: string): Logger {
    return this.child({ requestId });
  }

  withSessionId(sessionId: string): Logger {
    return this.child({ sessionId });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async _processLogEntry(entry: LogEntry): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const transport of this._transports.values()) {
      if (!transport.enabled || entry.level < transport.level) {
        continue;
      }

      try {
        const result = transport.log(entry);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        // Log transport errors to console as fallback
        console.error(`Transport ${transport.name} error:`, error);
      }
    }

    // Wait for async transports
    if (promises.length > 0) {
      try {
        await Promise.all(promises);
      } catch (error) {
        console.error('One or more transports failed:', error);
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a new logger with the specified configuration
 */
export function createLogger(name: string, config?: LoggerConfig): Logger {
  return new DefaultLogger(name, config);
}

/**
 * Creates a logger with console transport pre-configured
 */
export function createConsoleLogger(name: string, level: LogLevel = LogLevel.INFO): Logger {
  const logger = new DefaultLogger(name, { name, level });
  // Note: Console transport will be added when we implement it
  return logger;
}

/**
 * Creates a logger with multiple transports
 */
export function createMultiTransportLogger(
  name: string,
  transports: LogTransport[],
  config?: Omit<LoggerConfig, 'transports'>
): Logger {
  const logger = new DefaultLogger(name, config);
  
  for (const transport of transports) {
    logger.addTransport(transport);
  }
  
  return logger;
}

// ============================================================================
// Convenience Methods for Common Patterns
// ============================================================================

/**
 * Logger mixin for classes that need logging capabilities
 */
export function withLogging<T extends new (...args: any[]) => {}>(Base: T, loggerName?: string) {
  return class extends Base {
    public logger: Logger;

    constructor(...args: any[]) {
      super(...args);
      this.logger = createLogger(loggerName || this.constructor.name);
    }

    public setLogLevel(level: LogLevel): void {
      this.logger.setLevel(level);
    }

    public addLogTransport(transport: LogTransport): void {
      this.logger.addTransport(transport);
    }
  };
}

/**
 * Decorator for automatic method logging
 */
export function logMethod(level: LogLevel = LogLevel.DEBUG) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function(...args: any[]) {
      const logger = (this as any).logger as Logger;
      
      if (logger && logger.isEnabled(level)) {
        const timer = logger.time(`${target.constructor.name}.${propertyKey}`);
        
        try {
          const result = originalMethod.apply(this, args);
          
          if (result instanceof Promise) {
            return result
              .then((value) => {
                timer.done(`Method completed successfully`, level);
                return value;
              })
              .catch((error) => {
                logger.error(`Method failed`, error, { 
                  method: propertyKey,
                  className: target.constructor.name
                });
                throw error;
              });
          } else {
            timer.done(`Method completed successfully`, level);
            return result;
          }
        } catch (error) {
          logger.error(`Method failed`, error as Error, { 
            method: propertyKey,
            className: target.constructor.name
          });
          throw error;
        }
      } else {
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * Performance monitoring helper
 */
export class PerformanceLogger {
  private timers: Map<string, number> = new Map();

  constructor(private logger: Logger) {}

  start(operation: string, context?: LogContext): void {
    this.timers.set(operation, Date.now());
    this.logger.debug(`Starting ${operation}`, { ...context, operation });
  }

  end(operation: string, context?: LogContext): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      this.logger.warn(`No timer found for operation: ${operation}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operation);
    
    this.logger.info(`Completed ${operation}`, { 
      ...context, 
      operation, 
      duration 
    });

    return duration;
  }

  measure<T>(operation: string, fn: () => T, context?: LogContext): T;
  measure<T>(operation: string, fn: () => Promise<T>, context?: LogContext): Promise<T>;
  measure<T>(operation: string, fn: () => T | Promise<T>, context?: LogContext): T | Promise<T> {
    this.start(operation, context);
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result
          .then((value) => {
            this.end(operation, context);
            return value;
          })
          .catch((error) => {
            this.end(operation, { ...context, error: true });
            throw error;
          });
      } else {
        this.end(operation, context);
        return result;
      }
    } catch (error) {
      this.end(operation, { ...context, error: true });
      throw error;
    }
  }
}