/**
 * Response Handler Interfaces
 *
 * This module defines the ResponseHandler and StreamEventEmitter interfaces
 * for the Sentient Agent Framework. These interfaces provide methods for
 * emitting events to clients, including text blocks, JSON objects, streaming
 * text, and error messages.
 *
 * The ResponseHandler is used by agents to emit events to clients, while the
 * StreamEventEmitter is used for streaming text in chunks.
 *
 * @example
 * ```typescript
 * // Emit a text block
 * await responseHandler.emitTextBlock('THINKING', 'Processing your query...');
 *
 * // Emit a JSON object
 * await responseHandler.emitJson('RESULTS', { items: [1, 2, 3] });
 *
 * // Stream text
 * const stream = responseHandler.createTextStream('RESPONSE');
 * await stream.emitChunk('Hello, ');
 * await stream.emitChunk('world!');
 * await stream.complete();
 *
 * // Complete the response
 * await responseHandler.complete();
 * ```
 *
 * @module sentient-agent-framework/interface/response-handler
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

import { DocumentEvent, ErrorEvent, TextBlockEvent } from './events';
import { Hook } from './hook';
import { Identity } from './identity';

/**
 * StreamEventEmitter interface for emitting chunks of data in a stream.
 */
export interface StreamEventEmitter<T> {
  /**
   * Emit a chunk of data to the stream.
   * @param chunk The chunk of data to emit.
   */
  emitChunk(chunk: T): Promise<this>;

  /**
   * Mark the stream as complete.
   */
  complete(): Promise<void>;

  /**
   * The unique identifier for this stream.
   */
  readonly id: string;

  /**
   * Whether the stream is complete.
   */
  readonly isComplete: boolean;
}

/**
 * ResponseHandler interface for handling agent responses.
 * Provides methods for emitting events to the client.
 */
export interface ResponseHandler {
  /**
   * Emit a response and mark the response as complete.
   * @param eventName The name of the event.
   * @param response The response content, either a string or a JSON object.
   */
  respond(eventName: string, response: string | Record<string, any>): Promise<void>;

  /**
   * Emit a JSON object as an event.
   * @param eventName The name of the event.
   * @param data The JSON data to emit.
   */
  emitJson(eventName: string, data: Record<string, any>): Promise<void>;

  /**
   * Emit a text block as an event.
   * @param eventName The name of the event.
   * @param content The text content to emit.
   */
  emitTextBlock(eventName: string, content: string): Promise<void>;

  /**
   * Create a new text stream for emitting chunks of text.
   * @param eventName The name of the event.
   * @returns A StreamEventEmitter for emitting text chunks.
   */
  createTextStream(eventName: string): StreamEventEmitter<string>;

  /**
   * Emit an error event.
   * @param errorMessage The error message.
   * @param errorCode The error code (default: 500).
   * @param details Additional error details.
   */
  emitError(errorMessage: string, errorCode?: number, details?: Record<string, any>): Promise<void>;

  /**
   * Mark the response as complete.
   * This will also mark all streams as complete.
   */
  complete(): Promise<void>;

  /**
   * Whether the response is complete.
   */
  readonly isComplete: boolean;
}

/**
 * ResponseEventAdapter interface for adapting server-sent events to response events.
 */
export interface ResponseEventAdapter {
  /**
   * Validate and convert a JSON object to a response event.
   * @param json The JSON object to validate.
   * @returns The validated response event.
   */
  validateJson(json: any): DocumentEvent | TextBlockEvent | ErrorEvent;
}