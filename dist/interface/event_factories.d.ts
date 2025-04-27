/**
 * Factory functions for creating event objects.
 * These functions create objects that implement the event interfaces defined in events.ts.
 */
import { BaseEvent, DocumentEvent, DoneEvent, ErrorEvent, TextBlockEvent, TextChunkEvent } from './events';
/**
 * Create a base event with common properties.
 * @param source The source of the event.
 * @param eventName The name of the event.
 * @param id Optional ID for the event. If not provided, a new ULID will be generated.
 * @param schemaVersion Optional schema version. Defaults to '1.0'.
 * @param metadata Optional metadata for the event.
 * @returns A base event object.
 */
export declare function createBaseEvent(source: string, eventName: string, id?: string, schemaVersion?: string, metadata?: Record<string, any>): BaseEvent;
/**
 * Create a document event.
 * @param options Options for creating the document event.
 * @returns A document event object.
 */
export declare function createDocumentEvent(options: {
    source: string;
    event_name: string;
    content: Record<string, any>;
    id?: string;
    schema_version?: string;
    metadata?: Record<string, any>;
}): DocumentEvent;
/**
 * Create a text block event.
 * @param options Options for creating the text block event.
 * @returns A text block event object.
 */
export declare function createTextBlockEvent(options: {
    source: string;
    event_name: string;
    content: string;
    id?: string;
    schema_version?: string;
    metadata?: Record<string, any>;
}): TextBlockEvent;
/**
 * Create a text chunk event.
 * @param options Options for creating the text chunk event.
 * @returns A text chunk event object.
 */
export declare function createTextChunkEvent(options: {
    source: string;
    event_name: string;
    stream_id: string;
    is_complete: boolean;
    content: string;
    id?: string;
    schema_version?: string;
    metadata?: Record<string, any>;
}): TextChunkEvent;
/**
 * Create an error event.
 * @param options Options for creating the error event.
 * @returns An error event object.
 */
export declare function createErrorEvent(options: {
    source: string;
    error_message: string;
    error_code?: number;
    details?: Record<string, any>;
    id?: string;
    schema_version?: string;
    metadata?: Record<string, any>;
}): ErrorEvent;
/**
 * Create a done event.
 * @param options Options for creating the done event.
 * @returns A done event object.
 */
export declare function createDoneEvent(options: {
    source: string;
    id?: string;
    schema_version?: string;
    metadata?: Record<string, any>;
}): DoneEvent;
