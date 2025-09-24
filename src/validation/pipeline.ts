/**
 * ValidationPipeline - Runtime validation system for Sentient Agent Framework
 * 
 * Provides Pydantic-equivalent functionality with comprehensive error reporting,
 * performance optimization, and type-safe validation results.
 */

import { z } from 'zod';
import {
  ValidationResult,
  ValidationSuccess,
  ValidationError,
  ULIDSchema,
  QuerySchema,
  RequestSchema,
  AssistRequestSchema,
  SessionObjectSchema,
  SessionSchema,
  RequestWithSessionSchema,
  ResponseEventSchema,
  CapabilityRequestContentSchema,
  CapabilitySpecSchema,
  AtomicCapabilitySpecSchema,
  StreamCapabilitySpecSchema,
  InteractionSchema,
  RequestMessageSchema,
  ResponseMessageSchema,
  ErrorEventSchema,
  DocumentEventSchema,
  TextBlockEventSchema,
  TextChunkEventSchema,
  DoneEventSchema
} from './schemas';

// ============================================================================
// Performance Cache for Schema Validation
// ============================================================================

interface ValidationCache {
  [schemaName: string]: {
    schema: z.ZodType<any>;
    lastUsed: number;
    hitCount: number;
  };
}

const validationCache: ValidationCache = {};
const CACHE_TTL = 300000; // 5 minutes
const MAX_CACHE_SIZE = 100;

// ============================================================================
// Validation Error Processing
// ============================================================================

/**
 * Processes Zod errors into structured field-level error messages
 */
function processValidationError(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const fieldPath = err.path.join('.');
    const fieldKey = fieldPath || 'root';
    
    if (!fieldErrors[fieldKey]) {
      fieldErrors[fieldKey] = [];
    }
    
    let message = err.message;
    
    // Enhanced error messages based on error type
    switch (err.code) {
      case 'invalid_type':
        message = `Expected ${err.expected}, received ${err.received}`;
        break;
      case 'too_small':
        if (err.type === 'string') {
          message = `String must be at least ${err.minimum} characters long`;
        } else if (err.type === 'array') {
          message = `Array must contain at least ${err.minimum} item(s)`;
        } else {
          message = `Value must be at least ${err.minimum}`;
        }
        break;
      case 'too_big':
        if (err.type === 'string') {
          message = `String must be at most ${err.maximum} characters long`;
        } else if (err.type === 'array') {
          message = `Array must contain at most ${err.maximum} item(s)`;
        } else {
          message = `Value must be at most ${err.maximum}`;
        }
        break;
      case 'invalid_string':
        if (err.validation === 'regex') {
          message = `Invalid format for field ${fieldKey}`;
        }
        break;
      case 'custom':
        // Keep custom validation messages as-is
        break;
    }
    
    fieldErrors[fieldKey].push(message);
  });

  return fieldErrors;
}

/**
 * Creates a validation error result with enhanced messaging
 */
function createValidationError<T>(error: z.ZodError, context?: string): ValidationError {
  const fieldErrors = processValidationError(error);
  const contextMsg = context ? ` in ${context}` : '';
  
  return {
    success: false,
    error,
    message: `Validation failed${contextMsg}: ${error.errors.length} error(s) found`,
    field_errors: fieldErrors
  };
}

/**
 * Creates a successful validation result
 */
function createValidationSuccess<T>(data: T): ValidationSuccess<T> {
  return {
    success: true,
    data
  };
}

// ============================================================================
// ValidationPipeline Class
// ============================================================================

export class ValidationPipeline {
  private static instance: ValidationPipeline;
  private performanceMetrics: Map<string, { totalTime: number; calls: number }> = new Map();

  private constructor() {}

  /**
   * Singleton instance getter for performance optimization
   */
  static getInstance(): ValidationPipeline {
    if (!ValidationPipeline.instance) {
      ValidationPipeline.instance = new ValidationPipeline();
    }
    return ValidationPipeline.instance;
  }

  /**
   * Generic validation method with performance tracking
   */
  validate<T>(
    schema: z.ZodType<T>,
    data: unknown,
    schemaName: string,
    context?: string
  ): ValidationResult<T> {
    const startTime = performance.now();
    
    try {
      const result = schema.parse(data);
      this.updateMetrics(schemaName, startTime);
      return createValidationSuccess(result);
    } catch (error) {
      this.updateMetrics(schemaName, startTime);
      if (error instanceof z.ZodError) {
        return createValidationError<T>(error, context);
      }
      
      // Handle unexpected errors
      const zodError = new z.ZodError([{
        code: 'custom',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        path: []
      }]);
      
      return createValidationError<T>(zodError, context);
    }
  }

  /**
   * Updates performance metrics for schema validation
   */
  private updateMetrics(schemaName: string, startTime: number): void {
    const duration = performance.now() - startTime;
    const current = this.performanceMetrics.get(schemaName) || { totalTime: 0, calls: 0 };
    
    this.performanceMetrics.set(schemaName, {
      totalTime: current.totalTime + duration,
      calls: current.calls + 1
    });
  }

  // ============================================================================
  // ULID Validation Methods
  // ============================================================================

  /**
   * Validates a ULID string
   */
  validateULID(data: unknown, context?: string): ValidationResult<string> {
    return this.validate(ULIDSchema, data, 'ULID', context);
  }

  /**
   * Validates multiple ULIDs
   */
  validateULIDs(data: unknown[], context?: string): ValidationResult<string[]> {
    const ulidArraySchema = z.array(ULIDSchema);
    return this.validate(ulidArraySchema, data, 'ULID_Array', context);
  }

  // ============================================================================
  // Request Validation Methods
  // ============================================================================

  /**
   * Validates a Query object
   */
  validateQuery(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(QuerySchema, data, 'Query', context);
  }

  /**
   * Validates a generic Request object
   */
  validateRequest(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(RequestSchema, data, 'Request', context);
  }

  /**
   * Validates an AssistRequest object
   */
  validateAssistRequest(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(AssistRequestSchema, data, 'AssistRequest', context);
  }

  /**
   * Validates a Request with optional Session
   */
  validateRequestWithSession(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(RequestWithSessionSchema, data, 'RequestWithSession', context);
  }

  // ============================================================================
  // Session Validation Methods
  // ============================================================================

  /**
   * Validates a SessionObject
   */
  validateSessionObject(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(SessionObjectSchema, data, 'SessionObject', context);
  }

  /**
   * Validates a Session interface
   */
  validateSession(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(SessionSchema, data, 'Session', context);
  }

  /**
   * Validates an Interaction
   */
  validateInteraction(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(InteractionSchema, data, 'Interaction', context);
  }

  // ============================================================================
  // Event Validation Methods
  // ============================================================================

  /**
   * Validates a ResponseEvent (discriminated union)
   */
  validateResponseEvent(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(ResponseEventSchema, data, 'ResponseEvent', context);
  }

  /**
   * Validates an ErrorEvent specifically
   */
  validateErrorEvent(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(ErrorEventSchema, data, 'ErrorEvent', context);
  }

  /**
   * Validates a DocumentEvent specifically
   */
  validateDocumentEvent(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(DocumentEventSchema, data, 'DocumentEvent', context);
  }

  /**
   * Validates a TextBlockEvent specifically
   */
  validateTextBlockEvent(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(TextBlockEventSchema, data, 'TextBlockEvent', context);
  }

  /**
   * Validates a TextChunkEvent specifically
   */
  validateTextChunkEvent(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(TextChunkEventSchema, data, 'TextChunkEvent', context);
  }

  /**
   * Validates a DoneEvent specifically
   */
  validateDoneEvent(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(DoneEventSchema, data, 'DoneEvent', context);
  }

  // ============================================================================
  // Capability Validation Methods
  // ============================================================================

  /**
   * Validates a CapabilitySpec
   */
  validateCapabilitySpec(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(CapabilitySpecSchema, data, 'CapabilitySpec', context);
  }

  /**
   * Validates an AtomicCapabilitySpec
   */
  validateAtomicCapabilitySpec(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(AtomicCapabilitySpecSchema, data, 'AtomicCapabilitySpec', context);
  }

  /**
   * Validates a StreamCapabilitySpec
   */
  validateStreamCapabilitySpec(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(StreamCapabilitySpecSchema, data, 'StreamCapabilitySpec', context);
  }

  /**
   * Validates capability request content with custom payload schema
   */
  validateCapabilityRequestContent<T>(
    data: unknown,
    payloadSchema: z.ZodType<T>,
    context?: string
  ): ValidationResult<any> {
    const dynamicSchema = CapabilityRequestContentSchema.extend({
      request_payload: payloadSchema
    });
    
    return this.validate(dynamicSchema, data, 'CapabilityRequestContent', context);
  }

  // ============================================================================
  // Message Validation Methods
  // ============================================================================

  /**
   * Validates a RequestMessage
   */
  validateRequestMessage(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(RequestMessageSchema, data, 'RequestMessage', context);
  }

  /**
   * Validates a ResponseMessage
   */
  validateResponseMessage(data: unknown, context?: string): ValidationResult<any> {
    return this.validate(ResponseMessageSchema, data, 'ResponseMessage', context);
  }

  // ============================================================================
  // Batch Validation Methods
  // ============================================================================

  /**
   * Validates an array of items using the specified schema
   */
  validateArray<T>(
    schema: z.ZodType<T>,
    data: unknown[],
    context?: string
  ): ValidationResult<T[]> {
    const arraySchema = z.array(schema);
    return this.validate(arraySchema, data, 'Array', context);
  }

  /**
   * Validates multiple objects in parallel for better performance
   */
  async validateBatch<T>(
    schema: z.ZodType<T>,
    dataArray: unknown[],
    context?: string
  ): Promise<ValidationResult<T>[]> {
    const promises = dataArray.map((data, index) => 
      Promise.resolve(this.validate(schema, data, 'Batch', `${context}[${index}]`))
    );
    
    return Promise.all(promises);
  }

  // ============================================================================
  // Performance and Monitoring Methods
  // ============================================================================

  /**
   * Gets performance metrics for validation operations
   */
  getPerformanceMetrics(): Record<string, { avgTime: number; totalCalls: number }> {
    const metrics: Record<string, { avgTime: number; totalCalls: number }> = {};
    
    this.performanceMetrics.forEach((value, key) => {
      metrics[key] = {
        avgTime: value.totalTime / value.calls,
        totalCalls: value.calls
      };
    });
    
    return metrics;
  }

  /**
   * Resets performance metrics
   */
  resetMetrics(): void {
    this.performanceMetrics.clear();
  }

  /**
   * Clears validation cache to free memory
   */
  clearCache(): void {
    Object.keys(validationCache).forEach(key => {
      delete validationCache[key];
    });
  }
}

// ============================================================================
// Convenience Factory Functions
// ============================================================================

/**
 * Creates a ValidationPipeline instance (singleton)
 */
export function createValidationPipeline(): ValidationPipeline {
  return ValidationPipeline.getInstance();
}

/**
 * Quick validation helper for one-off validations
 */
export function quickValidate<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context?: string
): ValidationResult<T> {
  const pipeline = ValidationPipeline.getInstance();
  return pipeline.validate(schema, data, 'QuickValidate', context);
}

// ============================================================================
// Export default instance for convenience
// ============================================================================

export const validator = ValidationPipeline.getInstance();