/**
 * Express Logging Middleware for Sentient Agent Framework
 *
 * Provides automatic request/response logging with structured data,
 * correlation IDs, performance monitoring, and error tracking.
 *
 * @module sentient-agent-framework/implementation/middleware/logging_middleware
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

import { Request, Response, NextFunction } from 'express';
import { ulid } from 'ulid';
import {
  Logger,
  LogLevel,
  LogContext,
  RequestLogContext,
  LoggingMiddlewareConfig
} from '../../interface/logging';
import { getLogger } from '../logger_manager';

// ============================================================================
// Extended Express Types
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      logger?: Logger;
      correlationId?: string;
      requestId?: string;
      startTime?: number;
      logContext?: LogContext;
    }
    interface Response {
      logger?: Logger;
    }
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Omit<Required<LoggingMiddlewareConfig>, 'logger'> = {
  skipPaths: ['/health', '/metrics', '/favicon.ico'],
  skipMethods: [],
  logLevel: LogLevel.INFO,
  logRequestBody: false,
  logResponseBody: false,
  maxBodySize: 1024, // 1KB
  requestIdHeader: 'x-request-id',
  correlationIdHeader: 'x-correlation-id',
  includeHeaders: ['user-agent', 'content-type', 'authorization', 'accept'],
  excludeHeaders: ['cookie', 'set-cookie', 'authorization'],
  logSlowRequests: true,
  slowThreshold: 1000 // 1 second
};

// ============================================================================
// Utility Functions
// ============================================================================

function shouldSkipLogging(req: Request, config: Omit<Required<LoggingMiddlewareConfig>, 'logger'>): boolean {
  // Check skip paths
  if (config.skipPaths.some(path => req.path === path || req.path.startsWith(path))) {
    return true;
  }

  // Check skip methods
  if (config.skipMethods.includes(req.method)) {
    return true;
  }

  return false;
}

function extractHeaders(
  headers: Record<string, any>,
  includeHeaders: string[],
  excludeHeaders: string[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    // Skip excluded headers
    if (excludeHeaders.includes(lowerKey)) {
      continue;
    }

    // Include only specified headers (if list is not empty)
    if (includeHeaders.length > 0 && !includeHeaders.includes(lowerKey)) {
      continue;
    }

    // Handle array values (multiple headers with same name)
    if (Array.isArray(value)) {
      result[key] = value.join(', ');
    } else {
      result[key] = String(value);
    }
  }

  return result;
}

function truncateBody(body: any, maxSize: number): any {
  if (!body) return undefined;

  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  
  if (bodyStr.length <= maxSize) {
    return body;
  }

  return {
    truncated: true,
    size: bodyStr.length,
    preview: bodyStr.substring(0, maxSize) + '...'
  };
}

function getClientIP(req: Request): string {
  return (
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function createRequestLogContext(req: Request, config: Omit<Required<LoggingMiddlewareConfig>, 'logger'>): RequestLogContext {
  const context: RequestLogContext = {
    method: req.method,
    url: req.url,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userAgent: req.get('user-agent'),
    ip: getClientIP(req),
    correlationId: req.correlationId,
    requestId: req.requestId
  };

  // Add headers
  if (config.includeHeaders.length > 0) {
    context.headers = extractHeaders(req.headers, config.includeHeaders, config.excludeHeaders);
  }

  // Add request body
  if (config.logRequestBody && req.body) {
    context.body = truncateBody(req.body, config.maxBodySize);
  }

  return context;
}

function createResponseLogContext(
  req: Request,
  res: Response,
  config: Omit<Required<LoggingMiddlewareConfig>, 'logger'>,
  responseBody?: any
): RequestLogContext {
  const duration = req.startTime ? Date.now() - req.startTime : 0;

  const context: RequestLogContext = {
    method: req.method,
    url: req.url,
    path: req.path,
    statusCode: res.statusCode,
    responseTime: duration,
    contentLength: parseInt(res.get('content-length') || '0', 10) || undefined,
    correlationId: req.correlationId,
    requestId: req.requestId
  };

  // Add response body
  if (config.logResponseBody && responseBody) {
    context.body = truncateBody(responseBody, config.maxBodySize);
  }

  return context;
}

// ============================================================================
// Core Middleware Functions
// ============================================================================

/**
 * Creates request/response logging middleware
 */
export function createLoggingMiddleware(
  logger?: Logger,
  config?: Partial<LoggingMiddlewareConfig>
): (req: Request, res: Response, next: NextFunction) => void {
  
  const effectiveConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    logger: logger || config?.logger || getLogger('http')
  };

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip logging for certain paths
    if (shouldSkipLogging(req, effectiveConfig)) {
      return next();
    }

    // Set up request tracking
    req.startTime = Date.now();
    req.requestId = req.get(effectiveConfig.requestIdHeader) || ulid();
    req.correlationId = req.get(effectiveConfig.correlationIdHeader) || ulid();

    // Create logger for this request
    const requestLogger = effectiveConfig.logger.withContext({
      requestId: req.requestId,
      correlationId: req.correlationId,
      component: 'http-middleware'
    });

    req.logger = requestLogger;
    res.logger = requestLogger;

    // Add correlation ID to response headers
    res.set(effectiveConfig.correlationIdHeader, req.correlationId);
    res.set(effectiveConfig.requestIdHeader, req.requestId);

    // Log incoming request
    const requestContext = createRequestLogContext(req, effectiveConfig);
    requestLogger.log(
      effectiveConfig.logLevel,
      `Incoming ${req.method} ${req.path}`,
      requestContext
    );

    // Capture response data
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody: any;

    // Override response methods to capture body
    if (effectiveConfig.logResponseBody) {
      res.send = function(body: any) {
        responseBody = body;
        return originalSend.call(this, body);
      };

      res.json = function(obj: any) {
        responseBody = obj;
        return originalJson.call(this, obj);
      };
    }

    // Log response when finished
    res.on('finish', () => {
      const duration = req.startTime ? Date.now() - req.startTime : 0;
      const responseContext = createResponseLogContext(req, res, effectiveConfig, responseBody);

      // Determine log level based on status code and timing
      let logLevel = effectiveConfig.logLevel;
      let message = `${req.method} ${req.path} - ${res.statusCode}`;

      if (res.statusCode >= 500) {
        logLevel = LogLevel.ERROR;
        message += ' (Server Error)';
      } else if (res.statusCode >= 400) {
        logLevel = LogLevel.WARN;
        message += ' (Client Error)';
      } else if (effectiveConfig.logSlowRequests && duration > effectiveConfig.slowThreshold) {
        logLevel = LogLevel.WARN;
        message += ' (Slow Request)';
      }

      requestLogger.log(logLevel, message, responseContext);

      // Log performance metrics for slow requests
      if (duration > effectiveConfig.slowThreshold) {
        requestLogger.warn('Slow request detected', {
          ...responseContext,
          operation: 'slow_request_detection',
          threshold: effectiveConfig.slowThreshold
        });
      }
    });

    // Handle errors
    res.on('error', (error: Error) => {
      const responseContext = createResponseLogContext(req, res, effectiveConfig);
      requestLogger.error('Response error', error, {
        ...responseContext,
        operation: 'response_error'
      });
    });

    next();
  };
}

/**
 * Creates request ID middleware (adds request ID without full logging)
 */
export function createRequestIdMiddleware(
  requestIdHeader: string = 'x-request-id',
  correlationIdHeader: string = 'x-correlation-id'
): (req: Request, res: Response, next: NextFunction) => void {
  
  return (req: Request, res: Response, next: NextFunction) => {
    req.requestId = req.get(requestIdHeader) || ulid();
    req.correlationId = req.get(correlationIdHeader) || req.requestId;

    res.set(requestIdHeader, req.requestId);
    res.set(correlationIdHeader, req.correlationId);

    next();
  };
}

/**
 * Creates error logging middleware
 */
export function createErrorLoggingMiddleware(
  logger?: Logger
): (error: any, req: Request, res: Response, next: NextFunction) => void {
  
  return (error: any, req: Request, res: Response, next: NextFunction) => {
    const errorLogger = logger || req.logger || getLogger('http-error');

    const errorContext: RequestLogContext = {
      method: req.method,
      url: req.url,
      path: req.path,
      statusCode: res.statusCode || 500,
      correlationId: req.correlationId,
      requestId: req.requestId,
      operation: 'error_handling'
    };

    // Log the error
    errorLogger.error(
      `Unhandled error in ${req.method} ${req.path}`,
      error,
      errorContext
    );

    next(error);
  };
}

/**
 * Creates performance monitoring middleware
 */
export function createPerformanceMiddleware(
  logger?: Logger,
  slowThreshold: number = 1000
): (req: Request, res: Response, next: NextFunction) => void {
  
  return (req: Request, res: Response, next: NextFunction) => {
    req.startTime = Date.now();
    
    const performanceLogger = logger || getLogger('performance');

    res.on('finish', () => {
      const duration = Date.now() - (req.startTime || 0);
      
      if (duration > slowThreshold) {
        performanceLogger.warn('Slow request detected', {
          method: req.method,
          path: req.path,
          duration,
          threshold: slowThreshold,
          statusCode: res.statusCode,
          correlationId: req.correlationId,
          requestId: req.requestId,
          operation: 'performance_monitoring'
        });
      }

      // Log performance metrics
      performanceLogger.debug('Request completed', {
        method: req.method,
        path: req.path,
        duration,
        statusCode: res.statusCode,
        correlationId: req.correlationId,
        requestId: req.requestId,
        operation: 'performance_tracking'
      });
    });

    next();
  };
}

// ============================================================================
// Pre-configured Middleware
// ============================================================================

/**
 * Development logging middleware with verbose output
 */
export function createDevelopmentLoggingMiddleware(logger?: Logger) {
  return createLoggingMiddleware(logger, {
    logLevel: LogLevel.DEBUG,
    logRequestBody: true,
    logResponseBody: true,
    maxBodySize: 2048,
    includeHeaders: ['user-agent', 'content-type', 'accept', 'authorization'],
    logSlowRequests: true,
    slowThreshold: 500
  });
}

/**
 * Production logging middleware with minimal output
 */
export function createProductionLoggingMiddleware(logger?: Logger) {
  return createLoggingMiddleware(logger, {
    logLevel: LogLevel.INFO,
    logRequestBody: false,
    logResponseBody: false,
    includeHeaders: ['user-agent', 'content-type'],
    excludeHeaders: ['authorization', 'cookie', 'set-cookie'],
    logSlowRequests: true,
    slowThreshold: 2000
  });
}

/**
 * Security-focused logging middleware
 */
export function createSecurityLoggingMiddleware(logger?: Logger) {
  return createLoggingMiddleware(logger, {
    logLevel: LogLevel.INFO,
    logRequestBody: true,
    logResponseBody: false,
    maxBodySize: 512,
    includeHeaders: ['user-agent', 'x-forwarded-for', 'x-real-ip'],
    excludeHeaders: ['authorization', 'cookie', 'set-cookie'],
    skipPaths: [], // Log everything for security
    logSlowRequests: true,
    slowThreshold: 1000
  });
}

// ============================================================================
// Middleware Composition Helpers
// ============================================================================

/**
 * Creates a complete logging middleware stack
 */
export function createLoggingMiddlewareStack(
  config?: {
    logger?: Logger;
    environment?: 'development' | 'production' | 'security';
    customConfig?: Partial<LoggingMiddlewareConfig>;
  }
) {
  const middlewares: ((req: Request, res: Response, next: NextFunction) => void)[] = [];

  // Always add request ID middleware first
  middlewares.push(createRequestIdMiddleware());

  // Add main logging middleware based on environment
  switch (config?.environment) {
    case 'development':
      middlewares.push(createDevelopmentLoggingMiddleware(config?.logger));
      break;
    case 'security':
      middlewares.push(createSecurityLoggingMiddleware(config?.logger));
      break;
    case 'production':
    default:
      middlewares.push(createProductionLoggingMiddleware(config?.logger));
      break;
  }

  // Add performance middleware
  middlewares.push(createPerformanceMiddleware(config?.logger));

  return middlewares;
}

// ============================================================================
// Exports
// ============================================================================

export {
  DEFAULT_CONFIG as DEFAULT_LOGGING_CONFIG,
  type RequestLogContext
};