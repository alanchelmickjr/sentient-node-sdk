/**
 * Express Validation Middleware for Sentient Agent Framework
 * 
 * Provides automatic request validation for Express servers using the Zod-based
 * validation pipeline. Includes detailed error responses and performance monitoring.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationPipeline, validator } from './pipeline';
import {
  ValidationResult,
  QuerySchema,
  RequestSchema,
  AssistRequestSchema,
  SessionObjectSchema,
  RequestWithSessionSchema,
  ResponseEventSchema,
  ULIDSchema
} from './schemas';

// ============================================================================
// Middleware Configuration Types
// ============================================================================

interface ValidationMiddlewareOptions {
  /** Custom error response format */
  errorResponseFormat?: 'detailed' | 'simple' | 'custom';
  /** Custom error handler function */
  customErrorHandler?: (errors: Record<string, string[]>, req: Request, res: Response) => void;
  /** Skip validation for certain paths */
  skipPaths?: string[];
  /** Enable performance monitoring */
  enableMetrics?: boolean;
  /** Log validation errors */
  logErrors?: boolean;
}

interface RequestValidationConfig {
  /** Validate request body */
  body?: z.ZodType<any>;
  /** Validate query parameters */
  query?: z.ZodType<any>;
  /** Validate URL parameters */
  params?: z.ZodType<any>;
  /** Validate request headers */
  headers?: z.ZodType<any>;
  /** Custom validation function */
  custom?: (req: Request) => ValidationResult<any>;
}

// ============================================================================
// Error Response Formatters
// ============================================================================

/**
 * Formats validation errors for API responses
 */
function formatValidationErrors(
  fieldErrors: Record<string, string[]>,
  format: 'detailed' | 'simple' | 'custom' = 'detailed'
): any {
  switch (format) {
    case 'simple':
      return {
        error: 'Validation failed',
        message: Object.values(fieldErrors).flat().join(', ')
      };
    
    case 'detailed':
      return {
        error: 'Validation failed',
        message: 'Request validation errors found',
        errors: fieldErrors,
        errorCount: Object.keys(fieldErrors).length,
        timestamp: new Date().toISOString()
      };
    
    case 'custom':
    default:
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: fieldErrors,
        code: 400
      };
  }
}

// ============================================================================
// Core Validation Middleware Functions
// ============================================================================

/**
 * Creates a validation middleware for Express routes
 */
export function createValidationMiddleware(
  config: RequestValidationConfig,
  options: ValidationMiddlewareOptions = {}
) {
  const {
    errorResponseFormat = 'detailed',
    customErrorHandler,
    enableMetrics = true,
    logErrors = true
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const validationErrors: Record<string, string[]> = {};
    let hasErrors = false;

    // Skip validation for certain paths
    if (options.skipPaths?.includes(req.path)) {
      return next();
    }

    // Validate request body
    if (config.body) {
      const bodyResult = validator.validate(
        config.body,
        req.body,
        'RequestBody',
        `${req.method} ${req.path}`
      );
      
      if (!bodyResult.success) {
        Object.assign(validationErrors, bodyResult.field_errors);
        hasErrors = true;
      } else {
        req.body = bodyResult.data; // Use validated data
      }
    }

    // Validate query parameters
    if (config.query) {
      const queryResult = validator.validate(
        config.query,
        req.query,
        'QueryParams',
        `${req.method} ${req.path}`
      );
      
      if (!queryResult.success) {
        Object.assign(validationErrors, queryResult.field_errors);
        hasErrors = true;
      } else {
        req.query = queryResult.data; // Use validated data
      }
    }

    // Validate URL parameters
    if (config.params) {
      const paramsResult = validator.validate(
        config.params,
        req.params,
        'URLParams',
        `${req.method} ${req.path}`
      );
      
      if (!paramsResult.success) {
        Object.assign(validationErrors, paramsResult.field_errors);
        hasErrors = true;
      } else {
        req.params = paramsResult.data; // Use validated data
      }
    }

    // Validate headers
    if (config.headers) {
      const headersResult = validator.validate(
        config.headers,
        req.headers,
        'Headers',
        `${req.method} ${req.path}`
      );
      
      if (!headersResult.success) {
        Object.assign(validationErrors, headersResult.field_errors);
        hasErrors = true;
      }
    }

    // Custom validation
    if (config.custom) {
      const customResult = config.custom(req);
      if (!customResult.success) {
        Object.assign(validationErrors, customResult.field_errors);
        hasErrors = true;
      }
    }

    // Handle validation errors
    if (hasErrors) {
      if (logErrors) {
        console.error(`Validation failed for ${req.method} ${req.path}:`, validationErrors);
      }

      if (customErrorHandler) {
        return customErrorHandler(validationErrors, req, res);
      }

      const errorResponse = formatValidationErrors(validationErrors, errorResponseFormat);
      return res.status(400).json(errorResponse);
    }

    // Validation passed, continue to next middleware
    next();
  };
}

// ============================================================================
// Pre-built Middleware for Common Sentient Agent Patterns
// ============================================================================

/**
 * Validates ULID parameters in URL paths
 */
export const validateULIDParam = (paramName: string = 'id') => {
  const paramsSchema = z.object({
    [paramName]: ULIDSchema
  });

  return createValidationMiddleware({
    params: paramsSchema
  });
};

/**
 * Validates assist request body for /assist endpoint
 */
export const validateAssistRequest = createValidationMiddleware({
  body: RequestWithSessionSchema
}, {
  errorResponseFormat: 'detailed',
  logErrors: true
});

/**
 * Validates query parameters for queries
 */
export const validateQueryRequest = createValidationMiddleware({
  body: QuerySchema
});

/**
 * Validates session objects in request bodies
 */
export const validateSessionRequest = createValidationMiddleware({
  body: SessionObjectSchema
});

/**
 * Validates response events (useful for testing or proxying)
 */
export const validateResponseEvent = createValidationMiddleware({
  body: ResponseEventSchema
});

// ============================================================================
// Capability-Specific Validation Middleware
// ============================================================================

/**
 * Creates middleware for validating capability-specific payloads
 */
export function createCapabilityValidationMiddleware<T>(
  capability: string,
  payloadSchema: z.ZodType<T>,
  options: ValidationMiddlewareOptions = {}
) {
  const capabilityRequestSchema = z.object({
    query: QuerySchema,
    session: SessionObjectSchema.optional()
  }).refine((data: any) => {
    // Validate that the capability matches
    return data.query?.capability === capability;
  }, {
    message: `Invalid capability. Expected '${capability}'`,
    path: ['query', 'capability']
  });

  return createValidationMiddleware({
    body: capabilityRequestSchema,
    custom: (req: Request) => {
      // Validate the capability payload specifically
      if (req.body?.query?.request_payload) {
        return validator.validateCapabilityRequestContent(
          { 
            capability,
            request_payload: req.body.query.request_payload 
          },
          payloadSchema,
          `Capability ${capability}`
        );
      }
      return { success: true, data: req.body };
    }
  }, options);
}

// ============================================================================
// Performance Monitoring Middleware
// ============================================================================

/**
 * Middleware to collect validation performance metrics
 */
export const validationMetricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to capture metrics
  res.end = function(this: Response, chunk?: any, encoding?: any, cb?: any): Response {
    const duration = Date.now() - startTime;
    
    // Log validation metrics
    console.log(`Validation metrics for ${req.method} ${req.path}: ${duration}ms`);
    
    // Restore original end function and call it
    res.end = originalEnd;
    return originalEnd.call(this, chunk, encoding, cb);
  } as any;
  
  next();
};

// ============================================================================
// Error Recovery Middleware
// ============================================================================

/**
 * Middleware to handle validation pipeline errors gracefully
 */
export const validationErrorRecoveryMiddleware = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error && error.name === 'ValidationError') {
    console.error('Validation pipeline error:', error);
    
    return res.status(500).json({
      error: 'Internal validation error',
      message: 'An error occurred during request validation',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
  
  next(error);
};

// ============================================================================
// Validation Result Extensions for Express
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      validationResult?: ValidationResult<any>;
      validatedData?: {
        body?: any;
        query?: any;
        params?: any;
        headers?: any;
      };
    }
  }
}

/**
 * Middleware to attach validation results to request object
 */
export const attachValidationResults = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Initialize validation data storage
  req.validatedData = {};
  
  next();
};

// ============================================================================
// Helper Functions for Custom Validation
// ============================================================================

/**
 * Helper to validate arbitrary data in middleware
 */
export function validateInMiddleware<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context?: string
): ValidationResult<T> {
  return validator.validate(schema, data, 'CustomMiddleware', context);
}

/**
 * Helper to create custom validation functions for middleware
 */
export function createCustomValidator<T>(
  schema: z.ZodType<T>,
  extractor: (req: Request) => unknown
) {
  return (req: Request): ValidationResult<T> => {
    const data = extractor(req);
    return validator.validate(schema, data, 'CustomExtraction', `${req.method} ${req.path}`);
  };
}

// ============================================================================
// Exports
// ============================================================================

export type {
  ValidationMiddlewareOptions,
  RequestValidationConfig
};

export {
  formatValidationErrors,
  ValidationPipeline
};