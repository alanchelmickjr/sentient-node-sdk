/**
 * Default Response Handler Implementation
 *
 * This module provides the DefaultResponseHandler class, which implements the
 * ResponseHandler interface. It is responsible for emitting events to clients,
 * including text blocks, JSON objects, streaming text, and error messages.
 *
 * The DefaultResponseHandler uses a Hook to emit events to clients, and provides
 * methods for creating text streams, emitting JSON objects, and handling errors.
 *
 * @example
 * ```typescript
 * // Create a response handler
 * const responseHandler = new DefaultResponseHandler(source, hook);
 *
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
 * @module sentient-agent-framework/implementation/default-response-handler
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */
import { Hook } from '../interface/hook';
import { Identity } from '../interface/identity';
import { ResponseHandler, StreamEventEmitter } from '../interface/response_handler';
/**
 * Default implementation of the ResponseHandler interface.
 * Handles emitting events to the client via a Hook.
 */
export declare class DefaultResponseHandler implements ResponseHandler {
    private _source;
    private _hook;
    private _streams;
    private _isComplete;
    /**
     * Create a new DefaultResponseHandler.
     * @param source The identity of the event source.
     * @param hook The hook to emit events through.
     */
    constructor(source: Identity, hook: Hook);
    /**
     * Verify that the response stream is open.
     * @throws ResponseStreamClosedError if the response is complete.
     */
    private verifyResponseStreamIsOpen;
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
    get isComplete(): boolean;
    /**
     * Internal method to emit events using hook.
     * @param event The event to emit.
     */
    private emitEvent;
}
