/**
 * Logging Interfaces for Sentient Agent Framework
 *
 * This module defines the core logging interfaces for structured logging,
 * multiple transports, and production-ready logging capabilities.
 * Designed to provide comprehensive logging similar to Python's logging module.
 *
 * @module sentient-agent-framework/interface/logging
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

import { EventMetadata } from './events';

// ============================================================================
// Log Levels and Types
// ============================================================================

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
  OFF = 99
}

export type LogLevelName = keyof typeof LogLevel;

export type { EventMetadata } from './events';

// ============================================================================
// Log Entry Structure
// ============================================================================

export interface LogContext extends EventMetadata {
  correlationId?: string;
  sessionId?: string;
  requestId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
  component?: string;
  operation?: string;
  duration?: number;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  levelName: LogLevelName;
  message: string;
  logger: string;
  context?: LogContext;
  error?: LogError;
  metadata?: EventMetadata;
  source?: string;
  hostname?: string;
  pid?: number;
  version?: string;
}

export interface LogError {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  details?: Record<string, any>;
}

// ============================================================================
// Transport Configuration
// ============================================================================

export interface TransportConfig {
  name: string;
  type: 'console' | 'file' | 'http' | 'custom';
  level?: LogLevel;
  enabled?: boolean;
  formatter?: LogFormatter;
  filter?: LogFilter;
}

export interface ConsoleTransportConfig extends TransportConfig {
  type: 'console';
  colors?: boolean;
  timestamp?: boolean;
}

export interface FileTransportConfig extends TransportConfig {
  type: 'file';
  filename: string;
  maxSize?: string | number; // e.g., '10MB', 10485760
  maxFiles?: number;
  compress?: boolean;
  datePattern?: string;
  createSymlink?: boolean;
  symlinkName?: string;
  auditFile?: string;
  frequency?: string;
  utc?: boolean;
  extension?: string;
}

export interface HTTPTransportConfig extends TransportConfig {
  type: 'http';
  host: string;
  port?: number;
  path?: string;
  ssl?: boolean;
  timeout?: number;
  headers?: Record<string, string>;
  auth?: {
    username?: string;
    password?: string;
    token?: string;
  };
  batch?: {
    size?: number;
    timeout?: number;
  };
}

// ============================================================================
// Logger Configuration
// ============================================================================

export interface LoggerConfig {
  name: string;
  level?: LogLevel;
  transports?: TransportConfig[];
  context?: LogContext;
  enableMetrics?: boolean;
  enableSampling?: boolean;
  samplingRate?: number;
  enableCorrelation?: boolean;
  formatters?: Record<string, LogFormatter>;
  filters?: Record<string, LogFilter>;
}

export interface LoggingSystemConfig {
  defaultLevel?: LogLevel;
  environment?: 'development' | 'staging' | 'production' | 'test';
  loggers?: Record<string, LoggerConfig>;
  transports?: Record<string, TransportConfig>;
  globalContext?: LogContext;
  performance?: {
    enableMetrics?: boolean;
    metricsInterval?: number;
    slowThreshold?: number;
  };
  correlation?: {
    enabled?: boolean;
    headerName?: string;
    generateIds?: boolean;
  };
  sampling?: {
    enabled?: boolean;
    rules?: SamplingRule[];
  };
}

// ============================================================================
// Formatting and Filtering
// ============================================================================

export interface LogFormatter {
  format(entry: LogEntry): string | Record<string, any>;
}

export interface LogFilter {
  filter(entry: LogEntry): boolean;
}

export interface SamplingRule {
  logger?: string;
  level?: LogLevel;
  rate: number;
  condition?: (entry: LogEntry) => boolean;
}

// ============================================================================
// Transport Interface
// ============================================================================

export interface LogTransport {
  readonly name: string;
  readonly type: string;
  readonly level: LogLevel;
  readonly enabled: boolean;

  log(entry: LogEntry): Promise<void> | void;
  close(): Promise<void> | void;
  setLevel(level: LogLevel): void;
  setEnabled(enabled: boolean): void;
}

// ============================================================================
// Logger Interface
// ============================================================================

export interface Logger {
  readonly name: string;
  readonly level: LogLevel;
  readonly context: LogContext;

  // Core logging methods
  trace(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | LogError, context?: LogContext): void;
  fatal(message: string, error?: Error | LogError, context?: LogContext): void;

  // Generic logging method
  log(level: LogLevel, message: string, context?: LogContext): void;

  // Utility methods
  isEnabled(level: LogLevel): boolean;
  child(context: LogContext): Logger;
  setLevel(level: LogLevel): void;
  addTransport(transport: LogTransport): void;
  removeTransport(name: string): void;

  // Performance and timing
  time(operation: string): LogTimer;
  profile(id: string): void;

  // Structured logging helpers
  withContext(context: LogContext): Logger;
  withCorrelationId(correlationId: string): Logger;
  withRequestId(requestId: string): Logger;
  withSessionId(sessionId: string): Logger;
}

export interface LogTimer {
  readonly operation: string;
  readonly startTime: number;
  
  done(message?: string, level?: LogLevel, context?: LogContext): void;
}

// ============================================================================
// Logger Manager Interface
// ============================================================================

export interface LoggerManager {
  // Logger management
  getLogger(name: string): Logger;
  createLogger(name: string, config?: LoggerConfig): Logger;
  removeLogger(name: string): void;
  listLoggers(): string[];

  // Configuration management
  configure(config: LoggingSystemConfig): void;
  getConfiguration(): LoggingSystemConfig;
  setDefaultLevel(level: LogLevel): void;
  setGlobalContext(context: LogContext): void;

  // Transport management
  addGlobalTransport(transport: LogTransport): void;
  removeGlobalTransport(name: string): void;
  listTransports(): string[];

  // Metrics and monitoring
  getMetrics(): LoggingMetrics;
  resetMetrics(): void;

  // System control
  shutdown(): Promise<void>;
  flush(): Promise<void>;
}

// ============================================================================
// Metrics and Monitoring
// ============================================================================

export interface LoggingMetrics {
  totalLogs: number;
  logsByLevel: Record<LogLevelName, number>;
  logsByLogger: Record<string, number>;
  errorCount: number;
  droppedLogs: number;
  averageProcessingTime: number;
  transportMetrics: Record<string, TransportMetrics>;
  uptime: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

export interface TransportMetrics {
  name: string;
  type: string;
  logsProcessed: number;
  errors: number;
  averageTime: number;
  lastError?: string;
  lastErrorTime?: Date;
}

// ============================================================================
// Middleware and Integration Types
// ============================================================================

export interface LoggingMiddlewareConfig {
  logger?: Logger;
  skipPaths?: string[];
  skipMethods?: string[];
  logLevel?: LogLevel;
  logRequestBody?: boolean;
  logResponseBody?: boolean;
  maxBodySize?: number;
  requestIdHeader?: string;
  correlationIdHeader?: string;
  includeHeaders?: string[];
  excludeHeaders?: string[];
  logSlowRequests?: boolean;
  slowThreshold?: number;
}

export interface RequestLogContext extends LogContext {
  method?: string;
  url?: string;
  path?: string;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
  userAgent?: string;
  ip?: string;
  statusCode?: number;
  responseTime?: number;
  contentLength?: number;
}

// ============================================================================
// Error and Exception Types
// ============================================================================

export class LoggingError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'LoggingError';
  }
}

export class TransportError extends LoggingError {
  constructor(
    transportName: string,
    message: string,
    public readonly originalError?: Error
  ) {
    super(`Transport ${transportName}: ${message}`, 'TRANSPORT_ERROR', {
      transportName,
      originalError: originalError?.message
    });
    this.name = 'TransportError';
  }
}

export class ConfigurationError extends LoggingError {
  constructor(message: string, public readonly configPath?: string) {
    super(message, 'CONFIGURATION_ERROR', { configPath });
    this.name = 'ConfigurationError';
  }
}