/**
 * Comprehensive Zod Validation Schemas for Sentient Agent Framework
 * 
 * This module provides Zod-based validation schemas equivalent to Python's Pydantic
 * functionality for runtime type checking and validation.
 */

import { z } from 'zod';
import { ulid, decodeTime } from 'ulid';
import {
  EventContentType,
  BaseEventType,
  DEFAULT_ERROR_CODE,
  ERROR
} from '../interface/events';
import {
  DEFAULT_CAPABILITY,
  ASSIST_CAPABILITY
} from '../interface/session';

// Re-export for use in other validation modules
export { EventContentType, DEFAULT_ERROR_CODE, ERROR, DEFAULT_CAPABILITY, ASSIST_CAPABILITY };

// ============================================================================
// ULID Validation Patterns
// ============================================================================

/**
 * ULID validation schema with comprehensive checks
 */
export const ULIDSchema = z.string()
  .min(26, 'ULID must be exactly 26 characters')
  .max(26, 'ULID must be exactly 26 characters')
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'ULID contains invalid characters')
  .refine((value) => {
    try {
      // Validate by attempting to decode timestamp
      const timestamp = decodeTime(value);
      return timestamp > 0 && timestamp <= Date.now();
    } catch {
      return false;
    }
  }, 'Invalid ULID format or future timestamp');

/**
 * Optional ULID schema for nullable fields
 */
export const OptionalULIDSchema = z.union([ULIDSchema, z.null()]).optional();

// ============================================================================
// Event Metadata and Base Schemas
// ============================================================================

export const EventMetadataSchema = z.record(
  z.union([z.string(), z.number(), z.boolean()])
);

export const BaseEventSchema = z.object({
  content_type: z.nativeEnum(EventContentType),
  event_name: z.string().min(1, 'Event name cannot be empty'),
  schema_version: z.string().default('1.0'),
  id: ULIDSchema,
  source: z.string().min(1, 'Event source cannot be empty'),
  metadata: EventMetadataSchema.optional()
});

export const AtomicEventSchema = BaseEventSchema;

export const StreamEventSchema = BaseEventSchema.extend({
  stream_id: z.string().min(1, 'Stream ID cannot be empty'),
  is_complete: z.boolean()
});

// ============================================================================
// Response Event Schemas
// ============================================================================

export const DocumentEventSchema = z.object({
  content_type: z.literal(EventContentType.JSON),
  event_name: z.string().min(1, 'Event name cannot be empty'),
  schema_version: z.string().default('1.0'),
  id: ULIDSchema,
  source: z.string().min(1, 'Event source cannot be empty'),
  metadata: EventMetadataSchema.optional(),
  content: z.record(z.any())
});

export const TextBlockEventSchema = z.object({
  content_type: z.literal(EventContentType.TEXTBLOCK),
  event_name: z.string().min(1, 'Event name cannot be empty'),
  schema_version: z.string().default('1.0'),
  id: ULIDSchema,
  source: z.string().min(1, 'Event source cannot be empty'),
  metadata: EventMetadataSchema.optional(),
  content: z.string()
});

export const TextChunkEventSchema = z.object({
  content_type: z.literal(EventContentType.TEXT_STREAM),
  event_name: z.string().min(1, 'Event name cannot be empty'),
  schema_version: z.string().default('1.0'),
  id: ULIDSchema,
  source: z.string().min(1, 'Event source cannot be empty'),
  metadata: EventMetadataSchema.optional(),
  stream_id: z.string().min(1, 'Stream ID cannot be empty'),
  is_complete: z.boolean(),
  content: z.string()
});

export const ErrorContentSchema = z.object({
  error_message: z.string().min(1, 'Error message cannot be empty'),
  error_code: z.number().int().positive().default(DEFAULT_ERROR_CODE),
  details: z.record(z.any()).optional()
});

export const ErrorEventSchema = z.object({
  content_type: z.literal(EventContentType.ERROR),
  event_name: z.literal(ERROR),
  schema_version: z.string().default('1.0'),
  id: ULIDSchema,
  source: z.string().min(1, 'Event source cannot be empty'),
  metadata: EventMetadataSchema.optional(),
  content: ErrorContentSchema
});

export const DoneEventSchema = z.object({
  content_type: z.literal(EventContentType.DONE),
  event_name: z.literal('done'),
  schema_version: z.string().default('1.0'),
  id: ULIDSchema,
  source: z.string().min(1, 'Event source cannot be empty'),
  metadata: EventMetadataSchema.optional()
});

export const ResponseEventSchema = z.discriminatedUnion('content_type', [
  DocumentEventSchema,
  TextBlockEventSchema,
  TextChunkEventSchema,
  ErrorEventSchema,
  DoneEventSchema
]);

// ============================================================================
// Capability Schemas
// ============================================================================

export const CapabilitySpecSchema = z.object({
  name: z.string().min(1, 'Capability name cannot be empty'),
  description: z.string().min(1, 'Capability description cannot be empty'),
  stream_response: z.boolean()
});

export const AtomicCapabilitySpecSchema = CapabilitySpecSchema.extend({
  stream_response: z.literal(false),
  input_schema: z.any(),
  output_schema: z.any()
});

export const StreamCapabilitySpecSchema = CapabilitySpecSchema.extend({
  stream_response: z.literal(true),
  input_schema: z.any(),
  output_events_schema: z.array(z.any())
});

export const CapabilityConfigSchema = z.object({
  name: z.string().min(1, 'Capability name cannot be empty'),
  id: z.string().min(1, 'Capability ID cannot be empty'),
  description: z.string().nullable().optional()
});

export const CapabilityRequestContentSchema = z.object({
  capability: z.string().min(1, 'Capability cannot be empty'),
  request_payload: z.any()
});

// ============================================================================
// Request and Session Schemas
// ============================================================================

export const AssistRequestContentPartSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty'),
  fileIds: z.array(z.string()).default([])
});

export const AssistRequestContentPartsSchema = z.object({
  parts: z.array(AssistRequestContentPartSchema).min(1, 'At least one part required')
});

export const AssistRequestContentSchema = z.object({
  capability: z.literal(ASSIST_CAPABILITY),
  request_payload: AssistRequestContentPartsSchema
});

export const RequestSchema = z.object({
  id: ULIDSchema,
  chatId: ULIDSchema,
  content: CapabilityRequestContentSchema,
  parent_request_id: OptionalULIDSchema,
  root_request_id: OptionalULIDSchema
});

export const AssistRequestSchema = z.object({
  id: ULIDSchema,
  chatId: ULIDSchema,
  content: AssistRequestContentSchema,
  parent_request_id: OptionalULIDSchema,
  root_request_id: OptionalULIDSchema
});

export const QuerySchema = z.object({
  id: ULIDSchema,
  prompt: z.string().min(1, 'Query prompt cannot be empty')
});

export const InteractionMessageSchema = z.object({
  sender: z.string().nullable().optional(),
  recipients: z.set(z.string()).nullable().optional()
});

export const RequestMessageSchema = InteractionMessageSchema.extend({
  event: AssistRequestSchema
});

export const ResponseMessageSchema = InteractionMessageSchema.extend({
  event: ResponseEventSchema
});

export const InteractionSchema = z.object({
  request: RequestMessageSchema,
  responses: z.array(ResponseMessageSchema).default([])
});

export const SessionObjectSchema = z.object({
  processor_id: z.string().min(1, 'Processor ID cannot be empty'),
  activity_id: ULIDSchema,
  request_id: ULIDSchema,
  interactions: z.array(InteractionSchema).default([])
});

export const SessionSchema = z.object({
  processor_id: z.string().min(1, 'Processor ID cannot be empty'),
  activity_id: ULIDSchema,
  request_id: ULIDSchema
});

export const RequestWithSessionSchema = z.object({
  query: QuerySchema,
  session: SessionObjectSchema.optional()
});

// ============================================================================
// Validation Result Types
// ============================================================================

export type ValidationSuccess<T> = {
  success: true;
  data: T;
};

export type ValidationError = {
  success: false;
  error: z.ZodError;
  message: string;
  field_errors: Record<string, string[]>;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

// ============================================================================
// Schema Type Exports for TypeScript Integration
// ============================================================================

export type ULID = z.infer<typeof ULIDSchema>;
export type EventMetadata = z.infer<typeof EventMetadataSchema>;
export type BaseEvent = z.infer<typeof BaseEventSchema>;
export type AtomicEvent = z.infer<typeof AtomicEventSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type DocumentEvent = z.infer<typeof DocumentEventSchema>;
export type TextBlockEvent = z.infer<typeof TextBlockEventSchema>;
export type TextChunkEvent = z.infer<typeof TextChunkEventSchema>;
export type ErrorContent = z.infer<typeof ErrorContentSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type DoneEvent = z.infer<typeof DoneEventSchema>;
export type ResponseEvent = z.infer<typeof ResponseEventSchema>;
export type CapabilitySpec = z.infer<typeof CapabilitySpecSchema>;
export type AtomicCapabilitySpec<I = any, O = any> = z.infer<typeof AtomicCapabilitySpecSchema>;
export type StreamCapabilitySpec<I = any> = z.infer<typeof StreamCapabilitySpecSchema>;
export type CapabilityConfig = z.infer<typeof CapabilityConfigSchema>;
export type CapabilityRequestContent<I = any> = z.infer<typeof CapabilityRequestContentSchema>;
export type AssistRequestContentPart = z.infer<typeof AssistRequestContentPartSchema>;
export type AssistRequestContentParts = z.infer<typeof AssistRequestContentPartsSchema>;
export type AssistRequestContent = z.infer<typeof AssistRequestContentSchema>;
export type Request<I = any> = z.infer<typeof RequestSchema>;
export type AssistRequest = z.infer<typeof AssistRequestSchema>;
export type Query = z.infer<typeof QuerySchema>;
export type InteractionMessage = z.infer<typeof InteractionMessageSchema>;
export type RequestMessage = z.infer<typeof RequestMessageSchema>;
export type ResponseMessage = z.infer<typeof ResponseMessageSchema>;
export type Interaction = z.infer<typeof InteractionSchema>;
export type SessionObject = z.infer<typeof SessionObjectSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type RequestWithSession = z.infer<typeof RequestWithSessionSchema>;