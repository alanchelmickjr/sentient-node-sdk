/**
 * Factory functions for creating event objects.
 * These functions create objects that implement the event interfaces defined in events.ts.
 */

import * as ulidModule from 'ulid';
import {
  BaseEvent,
  DocumentEvent,
  DoneEvent,
  ErrorContent,
  ErrorEvent,
  EventContentType,
  TextBlockEvent,
  TextChunkEvent,
} from './events';

// Use the ulid function from the module
const { ulid } = ulidModule;

/**
 * Default schema version for events.
 */
const DEFAULT_SCHEMA_VERSION = '1.0';

/**
 * Create a base event with common properties.
 * @param source The source of the event.
 * @param eventName The name of the event.
 * @param id Optional ID for the event. If not provided, a new ULID will be generated.
 * @param schemaVersion Optional schema version. Defaults to '1.0'.
 * @param metadata Optional metadata for the event.
 * @returns A base event object.
 */
export function createBaseEvent(
  source: string,
  eventName: string,
  id?: string,
  schemaVersion?: string,
  metadata?: Record<string, any>
): BaseEvent {
  return {
    id: id || ulid(),
    source,
    event_name: eventName,
    schema_version: schemaVersion || DEFAULT_SCHEMA_VERSION,
    metadata,
  } as BaseEvent;
}

/**
 * Create a document event.
 * @param options Options for creating the document event.
 * @returns A document event object.
 */
export function createDocumentEvent(options: {
  source: string;
  event_name: string;
  content: Record<string, any>;
  id?: string;
  schema_version?: string;
  metadata?: Record<string, any>;
}): DocumentEvent {
  return {
    ...createBaseEvent(
      options.source,
      options.event_name,
      options.id,
      options.schema_version,
      options.metadata
    ),
    content_type: EventContentType.JSON,
    content: options.content,
  };
}

/**
 * Create a text block event.
 * @param options Options for creating the text block event.
 * @returns A text block event object.
 */
export function createTextBlockEvent(options: {
  source: string;
  event_name: string;
  content: string;
  id?: string;
  schema_version?: string;
  metadata?: Record<string, any>;
}): TextBlockEvent {
  return {
    ...createBaseEvent(
      options.source,
      options.event_name,
      options.id,
      options.schema_version,
      options.metadata
    ),
    content_type: EventContentType.TEXTBLOCK,
    content: options.content,
  };
}

/**
 * Create a text chunk event.
 * @param options Options for creating the text chunk event.
 * @returns A text chunk event object.
 */
export function createTextChunkEvent(options: {
  source: string;
  event_name: string;
  stream_id: string;
  is_complete: boolean;
  content: string;
  id?: string;
  schema_version?: string;
  metadata?: Record<string, any>;
}): TextChunkEvent {
  return {
    ...createBaseEvent(
      options.source,
      options.event_name,
      options.id,
      options.schema_version,
      options.metadata
    ),
    content_type: EventContentType.TEXT_STREAM,
    stream_id: options.stream_id,
    is_complete: options.is_complete,
    content: options.content,
  };
}

/**
 * Create an error event.
 * @param options Options for creating the error event.
 * @returns An error event object.
 */
export function createErrorEvent(options: {
  source: string;
  error_message: string;
  error_code?: number;
  details?: Record<string, any>;
  id?: string;
  schema_version?: string;
  metadata?: Record<string, any>;
}): ErrorEvent {
  const errorContent: ErrorContent = {
    error_message: options.error_message,
    error_code: options.error_code,
    details: options.details,
  };

  return {
    ...createBaseEvent(
      options.source,
      'error',
      options.id,
      options.schema_version,
      options.metadata
    ),
    content_type: EventContentType.ERROR,
    event_name: 'error',
    content: errorContent,
  };
}

/**
 * Create a done event.
 * @param options Options for creating the done event.
 * @returns A done event object.
 */
export function createDoneEvent(options: {
  source: string;
  id?: string;
  schema_version?: string;
  metadata?: Record<string, any>;
}): DoneEvent {
  return {
    ...createBaseEvent(
      options.source,
      'done',
      options.id,
      options.schema_version,
      options.metadata
    ),
    content_type: EventContentType.DONE,
    event_name: 'done',
  };
}