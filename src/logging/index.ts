/**
 * Sentient Agent Framework - Comprehensive Structured Logging System
 *
 * Complete production-ready logging system with multiple transports,
 * centralized management, middleware integration, and monitoring capabilities.
 *
 * @module sentient-agent-framework/logging
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

// ============================================================================
// Core Interfaces and Types
// ============================================================================

export {
  // Enums and Types
  LogLevel,
  type LogLevelName,
  type LogContext,
  type LogEntry,
  type LogError,
  type LogTimer,
  
  // Interfaces
  type Logger,
  type LogTransport,
  type LogFormatter,
  type LogFilter,
  type LoggerManager,
  
  // Configuration Types
  type LoggerConfig,
  type LoggingSystemConfig,
  type TransportConfig,
  type ConsoleTransportConfig,
  type FileTransportConfig,
  type HTTPTransportConfig,
  type LoggingMiddlewareConfig,
  type RequestLogContext,
  type SamplingRule,
  
  // Metrics and Monitoring
  type LoggingMetrics,
  type TransportMetrics,
  
  // Errors
  LoggingError,
  TransportError,
  ConfigurationError
} from '../interface/logging';

// ============================================================================
// Core Logger Implementation
// ============================================================================

export {
  DefaultLogger,
  createLogger,
  createConsoleLogger,
  createMultiTransportLogger,
  withLogging,
  logMethod,
  PerformanceLogger
} from '../implementation/logger';

// ============================================================================
// Transport Implementations
// ============================================================================

// Console Transport
export {
  ConsoleTransport,
  ConsoleFormatter,
  ConsoleJSONFormatter,
  createConsoleTransport,
  createJSONConsoleTransport,
  createDevConsoleTransport,
  createProdConsoleTransport,
  COLORS,
  LEVEL_COLORS,
  LEVEL_SYMBOLS
} from '../implementation/transports/console_transport';

// File Transport
export {
  FileTransport,
  FileFormatter,
  createFileTransport,
  createRotatingFileTransport,
  createTimedRotatingFileTransport,
  type RotatedFile,
  type AuditEntry
} from '../implementation/transports/file_transport';

// HTTP Transport
export {
  HTTPTransport,
  HTTPFormatter,
  createHTTPTransport,
  createHTTPSTransport,
  createElasticsearchTransport,
  createSplunkTransport,
  createWebhookTransport,
  type BatchEntry,
  type RetryConfig,
  type HTTPResponse
} from '../implementation/transports/http_transport';

// ============================================================================
// Logger Manager
// ============================================================================

export {
  DefaultLoggerManager,
  getGlobalLoggerManager,
  setGlobalLoggerManager,
  createLoggerManager,
  getLogger,
  configureLogging,
  addGlobalTransport,
  shutdownLogging,
  setupEnvironmentLogging,
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_SAMPLING_RULES
} from '../implementation/logger_manager';

// ============================================================================
// Express Middleware
// ============================================================================

export {
  createLoggingMiddleware,
  createRequestIdMiddleware,
  createErrorLoggingMiddleware,
  createPerformanceMiddleware,
  createDevelopmentLoggingMiddleware,
  createProductionLoggingMiddleware,
  createSecurityLoggingMiddleware,
  createLoggingMiddlewareStack,
  DEFAULT_LOGGING_CONFIG
} from '../implementation/middleware/logging_middleware';

// ============================================================================
// Re-export with proper types
// ============================================================================

import {
  LogLevel as LogLevelEnum,
  type LogContext as LogContextType,
  type Logger as LoggerType,
  type LoggingMiddlewareConfig as LoggingMiddlewareConfigType
} from '../interface/logging';

import {
  getGlobalLoggerManager as getManager,
  getLogger as getLoggerFn,
  configureLogging as configureLoggingFn,
  setupEnvironmentLogging as setupEnvironmentLoggingFn
} from '../implementation/logger_manager';

import {
  createDevConsoleTransport as createDevConsole,
  createProdConsoleTransport as createProdConsole
} from '../implementation/transports/console_transport';

import {
  createRotatingFileTransport as createRotatingFile
} from '../implementation/transports/file_transport';

import {
  createHTTPTransport as createHTTP,
  createHTTPSTransport as createHTTPS
} from '../implementation/transports/http_transport';

import {
  createLoggingMiddleware,
  createLoggingMiddlewareStack as createMiddlewareStack,
  createErrorLoggingMiddleware as createErrorMiddleware
} from '../implementation/middleware/logging_middleware';

import {
  createConsoleTransport
} from '../implementation/transports/console_transport';

import {
  createFileTransport
} from '../implementation/transports/file_transport';

// ============================================================================
// Convenience Functions and Shortcuts
// ============================================================================

/**
 * Quick setup for development environment
 */
export function setupDevelopmentLogging(logLevel: LogLevelEnum = LogLevelEnum.DEBUG): LoggerType {
  setupEnvironmentLoggingFn('development');
  
  const manager = getManager();
  manager.setDefaultLevel(logLevel);
  
  // Add development-friendly transports
  manager.addGlobalTransport(createDevConsole());
  
  return getLoggerFn('app');
}

/**
 * Quick setup for production environment
 */
export function setupProductionLogging(config?: {
  logLevel?: LogLevelEnum;
  fileLogging?: {
    filename: string;
    maxSize?: string;
    maxFiles?: number;
  };
  httpLogging?: {
    host: string;
    token?: string;
    ssl?: boolean;
  };
}): LoggerType {
  setupEnvironmentLoggingFn('production');
  
  const manager = getManager();
  manager.setDefaultLevel(config?.logLevel || LogLevelEnum.INFO);
  
  // Add production transports
  manager.addGlobalTransport(createProdConsole());
  
  if (config?.fileLogging) {
    manager.addGlobalTransport(
      createRotatingFile(
        'production-file',
        config.fileLogging.filename,
        config.fileLogging.maxSize || '10MB',
        config.fileLogging.maxFiles || 10
      )
    );
  }
  
  if (config?.httpLogging) {
    const httpTransport = config.httpLogging.token
      ? createHTTPS(
          'production-http',
          config.httpLogging.host,
          config.httpLogging.token
        )
      : createHTTP(
          'production-http',
          config.httpLogging.host,
          { ssl: config.httpLogging.ssl }
        );
    
    manager.addGlobalTransport(httpTransport);
  }
  
  return getLoggerFn('app');
}

/**
 * Create a complete Express app with logging middleware
 */
export function createLoggedExpressApp(config?: {
  logger?: LoggerType;
  environment?: 'development' | 'production' | 'security';
  customLoggingConfig?: Partial<LoggingMiddlewareConfigType>;
}) {
  const express = require('express');
  const app = express();
  
  // Add logging middleware stack
  const middlewares = createMiddlewareStack({
    logger: config?.logger,
    environment: config?.environment || 'production',
    customConfig: config?.customLoggingConfig
  });
  
  middlewares.forEach((middleware: any) => app.use(middleware));
  
  // Add error logging middleware
  app.use(createErrorMiddleware(config?.logger));
  
  return app;
}

/**
 * Create structured log entry helpers
 */
export const LogHelpers = {
  /**
   * Create a standardized request context
   */
  requestContext: (req: any): LogContextType => ({
    requestId: req.requestId,
    correlationId: req.correlationId,
    method: req.method,
    path: req.path,
    userAgent: req.get?.('user-agent'),
    ip: req.ip || req.connection?.remoteAddress
  }),

  /**
   * Create a standardized error context
   */
  errorContext: (error: Error, additionalContext?: LogContextType): LogContextType => ({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...additionalContext
  }),

  /**
   * Create a performance measurement context
   */
  performanceContext: (operation: string, duration: number, additionalContext?: LogContextType): LogContextType => ({
    operation,
    duration,
    performance: true,
    ...additionalContext
  }),

  /**
   * Create a security event context
   */
  securityContext: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', additionalContext?: LogContextType): LogContextType => ({
    securityEvent: event,
    severity,
    timestamp: new Date().toISOString(),
    ...additionalContext
  })
};

/**
 * Export common log level constants for convenience
 */
export const LOG_LEVELS = {
  TRACE: LogLevelEnum.TRACE,
  DEBUG: LogLevelEnum.DEBUG,
  INFO: LogLevelEnum.INFO,
  WARN: LogLevelEnum.WARN,
  ERROR: LogLevelEnum.ERROR,
  FATAL: LogLevelEnum.FATAL,
  OFF: LogLevelEnum.OFF
} as const;

/**
 * Export version information
 */
export const LOGGING_SYSTEM_VERSION = '1.0.0';

/**
 * Export feature flags for runtime detection
 */
export const FEATURES = {
  STRUCTURED_LOGGING: true,
  MULTIPLE_TRANSPORTS: true,
  LOG_ROTATION: true,
  HTTP_TRANSPORT: true,
  CORRELATION_IDS: true,
  PERFORMANCE_MONITORING: true,
  ERROR_TRACKING: true,
  LOG_SAMPLING: true,
  EXPRESS_MIDDLEWARE: true,
  METRICS_COLLECTION: true
} as const;

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default export provides the most commonly used functionality
 */
export default {
  // Core functions
  getLogger: getLoggerFn,
  configureLogging: configureLoggingFn,
  setupEnvironmentLogging: setupEnvironmentLoggingFn,
  setupDevelopmentLogging,
  setupProductionLogging,
  
  // Log levels
  LogLevel: LogLevelEnum,
  LOG_LEVELS,
  
  // Transports
  createConsoleTransport,
  createFileTransport,
  createHTTPTransport: createHTTP,
  
  // Middleware
  createLoggingMiddleware,
  createLoggingMiddlewareStack: createMiddlewareStack,
  
  // Helpers
  LogHelpers,
  
  // Constants
  FEATURES,
  VERSION: LOGGING_SYSTEM_VERSION
};