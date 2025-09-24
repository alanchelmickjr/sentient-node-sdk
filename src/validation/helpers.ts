/**
 * Validation Helper Functions for Sentient Agent Framework
 * 
 * Provides utility functions for common validation patterns, capability payload
 * validation, and integration with existing systems.
 */

import { z } from 'zod';
import { ulid } from 'ulid';
import { validator, ValidationPipeline } from './pipeline';
import {
  ValidationResult,
  ValidationSuccess,
  ValidationError,
  ULIDSchema,
  QuerySchema,
  RequestSchema,
  AssistRequestSchema,
  SessionObjectSchema,
  ResponseEventSchema,
  CapabilityRequestContentSchema,
  EventContentType,
  ASSIST_CAPABILITY
} from './schemas';

// ============================================================================
// Typed Validation Result Helpers
// ============================================================================

/**
 * Type-safe validation result checker
 */
export function isValidationSuccess<T>(result: ValidationResult<T>): result is ValidationSuccess<T> {
  return result.success === true;
}

/**
 * Type-safe validation error checker
 */
export function isValidationError<T>(result: ValidationResult<T>): result is ValidationError {
  return result.success === false;
}

/**
 * Extracts data from validation result or throws error
 */
export function extractValidatedData<T>(result: ValidationResult<T>): T {
  if (isValidationSuccess(result)) {
    return result.data;
  }
  
  const errorMessage = `Validation failed: ${result.message}`;
  throw new Error(errorMessage);
}

/**
 * Gets first error message from validation result
 */
export function getFirstErrorMessage(result: ValidationError): string {
  const firstFieldErrors = Object.values(result.field_errors)[0];
  return firstFieldErrors?.[0] || result.message;
}

/**
 * Gets all error messages as a flat array
 */
export function getAllErrorMessages(result: ValidationError): string[] {
  return Object.values(result.field_errors).flat();
}

/**
 * Formats validation errors for logging
 */
export function formatErrorsForLogging(result: ValidationError): string {
  const errors = Object.entries(result.field_errors)
    .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
    .join('; ');
  
  return `${result.message} - ${errors}`;
}

// ============================================================================
// ULID Generation and Validation Helpers
// ============================================================================

/**
 * Generates a new ULID and validates it
 */
export function generateValidatedULID(): string {
  const newULID = ulid();
  const result = validator.validateULID(newULID);
  
  if (!isValidationSuccess(result)) {
    throw new Error(`Generated invalid ULID: ${newULID}`);
  }
  
  return result.data;
}

/**
 * Validates and normalizes a ULID string
 */
export function validateAndNormalizeULID(input: unknown): ValidationResult<string> {
  return validator.validateULID(input);
}

/**
 * Checks if a string is a valid ULID without throwing
 */
export function isValidULID(input: unknown): boolean {
  const result = validator.validateULID(input);
  return isValidationSuccess(result);
}

/**
 * Validates multiple ULIDs and returns only valid ones
 */
export function filterValidULIDs(inputs: unknown[]): string[] {
  return inputs
    .map(input => validator.validateULID(input))
    .filter(isValidationSuccess)
    .map(result => result.data);
}

// ============================================================================
// Capability Payload Validation Helpers
// ============================================================================

/**
 * Creates a validation schema for a specific capability
 */
export function createCapabilitySchema<T>(
  capability: string,
  payloadSchema: z.ZodType<T>
): z.ZodObject<{
  capability: z.ZodLiteral<string>;
  request_payload: z.ZodType<T>;
}> {
  return z.object({
    capability: z.literal(capability),
    request_payload: payloadSchema
  });
}

/**
 * Validates a capability request with typed payload
 */
export function validateCapabilityRequest<T>(
  capability: string,
  payloadSchema: z.ZodType<T>,
  data: unknown
): ValidationResult<any> {
  const schema = createCapabilitySchema(capability, payloadSchema);
  return validator.validate(schema, data, `Capability_${capability}`);
}

/**
 * Helper for validating assist capability requests
 */
export function validateAssistCapabilityRequest(data: unknown): ValidationResult<any> {
  return validator.validateCapabilityRequestContent(
    data,
    z.object({
      parts: z.array(z.object({
        prompt: z.string().min(1),
        fileIds: z.array(z.string()).default([])
      }))
    }),
    'AssistCapability'
  );
}

/**
 * Creates a validator for custom capability types
 */
export function createCapabilityValidator<T>(
  capability: string,
  payloadSchema: z.ZodType<T>
) {
  return {
    capability,
    validate: (data: unknown) => validateCapabilityRequest(capability, payloadSchema, data),
    validatePayload: (payload: unknown) => validator.validate(payloadSchema, payload, `${capability}_Payload`)
  };
}

// ============================================================================
// Common Validation Pattern Helpers
// ============================================================================

/**
 * Validates and sanitizes user input strings
 */
export function validateUserInput(
  input: unknown,
  maxLength: number = 1000,
  required: boolean = true
): ValidationResult<string> {
  if (required) {
    const schema = z.string().min(1, 'Input cannot be empty').max(maxLength, `Input too long (max ${maxLength} characters)`);
    return validator.validate(schema, input, 'UserInput');
  } else {
    const schema = z.string().max(maxLength, `Input too long (max ${maxLength} characters)`);
    const result = validator.validate(schema, input, 'UserInput');
    
    // Convert ValidationResult<string> to handle the case where input might be undefined/empty
    if (!isValidationSuccess(result)) {
      // If validation fails and it's not required, return empty string as valid
      if (input === undefined || input === null || input === '') {
        return { success: true, data: '' };
      }
      return result;
    }
    
    return result;
  }
}

/**
 * Validates email addresses
 */
export function validateEmail(input: unknown): ValidationResult<string> {
  const emailSchema = z.string().email('Invalid email format');
  return validator.validate(emailSchema, input, 'Email');
}

/**
 * Validates URL strings
 */
export function validateURL(input: unknown): ValidationResult<string> {
  const urlSchema = z.string().url('Invalid URL format');
  return validator.validate(urlSchema, input, 'URL');
}

/**
 * Validates positive integers
 */
export function validatePositiveInteger(input: unknown): ValidationResult<number> {
  const schema = z.number().int().positive('Must be a positive integer');
  return validator.validate(schema, input, 'PositiveInteger');
}

/**
 * Validates arrays with minimum/maximum length constraints
 */
export function validateArrayLength<T>(
  input: unknown,
  itemSchema: z.ZodType<T>,
  minLength: number = 0,
  maxLength: number = 100
): ValidationResult<T[]> {
  const schema = z.array(itemSchema)
    .min(minLength, `Array must have at least ${minLength} items`)
    .max(maxLength, `Array must have at most ${maxLength} items`);
    
  return validator.validate(schema, input, 'ArrayLength');
}

// ============================================================================
// Request and Response Validation Helpers
// ============================================================================

/**
 * Validates a complete request object
 */
export function validateCompleteRequest(data: unknown): ValidationResult<any> {
  return validator.validateRequestWithSession(data, 'CompleteRequest');
}

/**
 * Validates query parameters from URL
 */
export function validateQueryParams(
  params: Record<string, any>,
  schema?: z.ZodType<any>
): ValidationResult<any> {
  const defaultSchema = z.record(z.string());
  const validationSchema = schema || defaultSchema;
  
  return validator.validate(validationSchema, params, 'QueryParams');
}

/**
 * Validates response events for consistency
 */
export function validateResponseEvent(event: unknown): ValidationResult<any> {
  return validator.validateResponseEvent(event, 'ResponseEventValidation');
}

/**
 * Validates event content based on event type
 */
export function validateEventContent(
  contentType: EventContentType,
  content: unknown
): ValidationResult<any> {
  let schema: z.ZodType<any>;
  
  switch (contentType) {
    case EventContentType.JSON:
      schema = z.record(z.any());
      break;
    case EventContentType.TEXTBLOCK:
    case EventContentType.TEXT_STREAM:
      schema = z.string();
      break;
    case EventContentType.ERROR:
      schema = z.object({
        error_message: z.string(),
        error_code: z.number().optional(),
        details: z.record(z.any()).optional()
      });
      break;
    case EventContentType.DONE:
      schema = z.undefined().or(z.null());
      break;
    default:
      return {
        success: false,
        error: new z.ZodError([{
          code: 'custom',
          message: `Unknown event content type: ${contentType}`,
          path: ['content_type']
        }]),
        message: `Invalid event content type`,
        field_errors: { content_type: [`Unknown content type: ${contentType}`] }
      };
  }
  
  return validator.validate(schema, content, `EventContent_${contentType}`);
}

// ============================================================================
// Session and Interaction Validation Helpers
// ============================================================================

/**
 * Validates session data
 */
export function validateSession(data: unknown): ValidationResult<any> {
  return validator.validateSession(data, 'SessionValidation');
}

/**
 * Validates session object with interactions
 */
export function validateSessionObject(data: unknown): ValidationResult<any> {
  return validator.validateSessionObject(data, 'SessionObjectValidation');
}

/**
 * Validates interaction data
 */
export function validateInteraction(data: unknown): ValidationResult<any> {
  return validator.validateInteraction(data, 'InteractionValidation');
}

/**
 * Creates a new session object with validation
 */
export function createValidatedSession(
  processorId: string,
  activityId?: string,
  requestId?: string
): ValidationResult<any> {
  const session = {
    processor_id: processorId,
    activity_id: activityId || generateValidatedULID(),
    request_id: requestId || generateValidatedULID(),
    interactions: []
  };
  
  return validator.validateSessionObject(session, 'NewSession');
}

// ============================================================================
// Batch Validation Helpers
// ============================================================================

/**
 * Validates multiple items and returns both successes and failures
 */
export function validateBatch<T>(
  items: unknown[],
  schema: z.ZodType<T>
): {
  successes: { index: number; data: T }[];
  failures: { index: number; error: ValidationError }[];
} {
  const successes: { index: number; data: T }[] = [];
  const failures: { index: number; error: ValidationError }[] = [];
  
  items.forEach((item, index) => {
    const result = validator.validate(schema, item, 'BatchItem', `Item[${index}]`);
    
    if (isValidationSuccess(result)) {
      successes.push({ index, data: result.data });
    } else {
      failures.push({ index, error: result });
    }
  });
  
  return { successes, failures };
}

/**
 * Validates multiple items and throws on first failure
 */
export function validateBatchStrict<T>(
  items: unknown[],
  schema: z.ZodType<T>
): T[] {
  const results = items.map((item, index) => 
    validator.validate(schema, item, 'BatchItemStrict', `Item[${index}]`)
  );
  
  for (const result of results) {
    if (isValidationError(result)) {
      throw new Error(formatErrorsForLogging(result));
    }
  }
  
  return results.map(result => (result as ValidationSuccess<T>).data);
}

// ============================================================================
// Integration Helpers for Existing Systems
// ============================================================================

/**
 * Validates data with fallback to default values
 */
export function validateWithDefaults<T>(
  data: unknown,
  schema: z.ZodType<T>,
  defaults: Partial<T>
): T {
  const result = validator.validate(schema, data, 'WithDefaults');
  
  if (isValidationSuccess(result)) {
    return { ...defaults, ...result.data } as T;
  }
  
  // Return defaults with original data overlaid
  return { ...defaults, ...(typeof data === 'object' && data !== null ? data : {}) } as T;
}

/**
 * Validates and transforms data in a single operation
 */
export function validateAndTransform<T, U>(
  data: unknown,
  schema: z.ZodType<T>,
  transformer: (data: T) => U
): ValidationResult<U> {
  const result = validator.validate(schema, data, 'ValidateAndTransform');
  
  if (isValidationSuccess(result)) {
    try {
      const transformed = transformer(result.data);
      return { success: true, data: transformed };
    } catch (error) {
      return {
        success: false,
        error: new z.ZodError([{
          code: 'custom',
          message: error instanceof Error ? error.message : 'Transformation failed',
          path: ['transform']
        }]),
        message: 'Transformation failed after validation',
        field_errors: { transform: ['Transformation error'] }
      };
    }
  }
  
  return result as ValidationResult<U>;
}

/**
 * Creates a validation pipeline for complex nested objects
 */
export function createNestedValidator<T>(
  schema: z.ZodType<T>,
  pathValidators: Record<string, (value: any) => ValidationResult<any>>
) {
  return (data: unknown): ValidationResult<T> => {
    // First validate the overall structure
    const structureResult = validator.validate(schema, data, 'NestedStructure');
    
    if (isValidationError(structureResult)) {
      return structureResult;
    }
    
    // Then validate nested paths
    const structuredData = structureResult.data;
    const nestedErrors: Record<string, string[]> = {};
    
    for (const [path, pathValidator] of Object.entries(pathValidators)) {
      const pathValue = getNestedValue(structuredData, path);
      const pathResult = pathValidator(pathValue);
      
      if (isValidationError(pathResult)) {
        Object.entries(pathResult.field_errors).forEach(([field, messages]) => {
          const fullPath = `${path}.${field}`;
          nestedErrors[fullPath] = messages;
        });
      }
    }
    
    if (Object.keys(nestedErrors).length > 0) {
      return {
        success: false,
        error: new z.ZodError([]),
        message: 'Nested validation failed',
        field_errors: nestedErrors
      };
    }
    
    return structureResult;
  };
}

/**
 * Helper to get nested object values by dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// ============================================================================
// Performance and Monitoring Helpers
// ============================================================================

/**
 * Wraps validation with timing metrics
 */
export function validateWithTiming<T>(
  schema: z.ZodType<T>,
  data: unknown,
  label: string = 'Validation'
): { result: ValidationResult<T>; duration: number } {
  const startTime = performance.now();
  const result = validator.validate(schema, data, label);
  const duration = performance.now() - startTime;
  
  return { result, duration };
}

/**
 * Gets validation performance summary
 */
export function getValidationMetricsSummary(): Record<string, any> {
  return validator.getPerformanceMetrics();
}

/**
 * Resets validation metrics
 */
export function resetValidationMetrics(): void {
  validator.resetMetrics();
}