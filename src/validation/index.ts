/**
 * Sentient Agent Framework Validation System
 * 
 * Comprehensive Zod-based validation system equivalent to Python's Pydantic
 * functionality with runtime type checking, detailed error reporting, and
 * Express middleware integration.
 */

// ============================================================================
// Core Validation Exports
// ============================================================================

export {
  // Validation Pipeline
  ValidationPipeline,
  validator,
  createValidationPipeline,
  quickValidate
} from './pipeline';

export {
  // Validation Schemas
  ULIDSchema,
  OptionalULIDSchema,
  EventMetadataSchema,
  BaseEventSchema,
  AtomicEventSchema,
  StreamEventSchema,
  DocumentEventSchema,
  TextBlockEventSchema,
  TextChunkEventSchema,
  ErrorContentSchema,
  ErrorEventSchema,
  DoneEventSchema,
  ResponseEventSchema,
  CapabilitySpecSchema,
  AtomicCapabilitySpecSchema,
  StreamCapabilitySpecSchema,
  CapabilityConfigSchema,
  CapabilityRequestContentSchema,
  AssistRequestContentPartSchema,
  AssistRequestContentPartsSchema,
  AssistRequestContentSchema,
  RequestSchema,
  AssistRequestSchema,
  QuerySchema,
  InteractionMessageSchema,
  RequestMessageSchema,
  ResponseMessageSchema,
  InteractionSchema,
  SessionObjectSchema,
  SessionSchema,
  RequestWithSessionSchema,
  
  // Re-exported constants
  EventContentType,
  DEFAULT_ERROR_CODE,
  ERROR,
  DEFAULT_CAPABILITY,
  ASSIST_CAPABILITY
} from './schemas';

export type {
  // Types
  ValidationResult,
  ValidationSuccess,
  ValidationError,
  
  // Schema Types
  ULID,
  EventMetadata,
  BaseEvent,
  AtomicEvent,
  StreamEvent,
  DocumentEvent,
  TextBlockEvent,
  TextChunkEvent,
  ErrorContent,
  ErrorEvent,
  DoneEvent,
  ResponseEvent,
  CapabilitySpec,
  AtomicCapabilitySpec,
  StreamCapabilitySpec,
  CapabilityConfig,
  CapabilityRequestContent,
  AssistRequestContentPart,
  AssistRequestContentParts,
  AssistRequestContent,
  Request,
  AssistRequest,
  Query,
  InteractionMessage,
  RequestMessage,
  ResponseMessage,
  Interaction,
  SessionObject,
  Session,
  RequestWithSession
} from './schemas';

export {
  // Express Middleware
  createValidationMiddleware,
  validateULIDParam,
  validateAssistRequest,
  validateQueryRequest,
  validateSessionRequest,
  validateResponseEvent,
  createCapabilityValidationMiddleware,
  validationMetricsMiddleware,
  validationErrorRecoveryMiddleware,
  attachValidationResults,
  validateInMiddleware,
  createCustomValidator,
  formatValidationErrors,
  
  // Middleware Types
  type ValidationMiddlewareOptions,
  type RequestValidationConfig
} from './middleware';

export {
  // Validation Helpers
  isValidationSuccess,
  isValidationError,
  extractValidatedData,
  getFirstErrorMessage,
  getAllErrorMessages,
  formatErrorsForLogging,
  
  // ULID Helpers
  generateValidatedULID,
  validateAndNormalizeULID,
  isValidULID,
  filterValidULIDs,
  
  // Capability Helpers
  createCapabilitySchema,
  validateCapabilityRequest,
  validateAssistCapabilityRequest,
  createCapabilityValidator,
  
  // Common Validation Helpers
  validateUserInput,
  validateEmail,
  validateURL,
  validatePositiveInteger,
  validateArrayLength,
  
  // Request/Response Helpers
  validateCompleteRequest,
  validateQueryParams,
  validateResponseEvent as validateResponseEventHelper,
  validateEventContent,
  
  // Session Helpers
  validateSession,
  validateSessionObject,
  validateInteraction,
  createValidatedSession,
  
  // Batch Helpers
  validateBatch,
  validateBatchStrict,
  
  // Integration Helpers
  validateWithDefaults,
  validateAndTransform,
  createNestedValidator,
  
  // Performance Helpers
  validateWithTiming,
  getValidationMetricsSummary,
  resetValidationMetrics
} from './helpers';

// ============================================================================
// Convenience Factory Functions
// ============================================================================

/**
 * Creates a complete validation setup for a Sentient Agent application
 */
export function createValidationSystem() {
  // Import functions dynamically to avoid circular dependencies
  const { ValidationPipeline } = require('./pipeline');
  const { createValidationMiddleware, createCapabilityValidationMiddleware } = require('./middleware');
  const { isValidationSuccess, extractValidatedData, formatErrorsForLogging } = require('./helpers');
  
  const pipeline = ValidationPipeline.getInstance();
  
  return {
    pipeline,
    
    // Quick validators for common patterns
    validateULID: (data: unknown) => pipeline.validateULID(data),
    validateQuery: (data: unknown) => pipeline.validateQuery(data),
    validateRequest: (data: unknown) => pipeline.validateRequest(data),
    validateSession: (data: unknown) => pipeline.validateSession(data),
    validateResponseEvent: (data: unknown) => pipeline.validateResponseEvent(data),
    
    // Middleware factories
    createRequestValidation: createValidationMiddleware,
    createCapabilityValidation: createCapabilityValidationMiddleware,
    
    // Performance monitoring
    getMetrics: () => pipeline.getPerformanceMetrics(),
    resetMetrics: () => pipeline.resetMetrics(),
    
    // Utility functions
    isValid: isValidationSuccess,
    extractData: extractValidatedData,
    formatErrors: formatErrorsForLogging
  };
}

/**
 * Default validation system instance
 */
export const validationSystem = createValidationSystem();

// ============================================================================
// Version Information
// ============================================================================

export const VALIDATION_SYSTEM_VERSION = '1.0.0';
export const PYDANTIC_COMPATIBILITY_LEVEL = 'v2';

// ============================================================================
// Quick Start Documentation Export
// ============================================================================

export const QUICK_START_EXAMPLE = `
// Quick Start Example - Sentient Agent Validation System

import { validationSystem, validateAssistRequest } from './validation';

// 1. Validate a ULID
const ulidResult = validationSystem.validateULID('01ARZ3NDEKTSV4RRFFQ69G5FAV');
if (validationSystem.isValid(ulidResult)) {
  console.log('Valid ULID:', ulidResult.data);
}

// 2. Use Express middleware
import express from 'express';
const app = express();

app.use('/assist', validateAssistRequest);

// 3. Validate custom capability payloads
import { createCapabilityValidator } from './validation';
import { z } from 'zod';

const myCapabilityValidator = createCapabilityValidator(
  'my-capability',
  z.object({
    prompt: z.string(),
    options: z.object({
      temperature: z.number().min(0).max(2)
    })
  })
);

const result = myCapabilityValidator.validate(requestData);

// 4. Performance monitoring
console.log(validationSystem.getMetrics());
`;