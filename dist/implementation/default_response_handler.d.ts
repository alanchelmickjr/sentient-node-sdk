/**
 * DefaultResponseHandler: Default implementation of the ResponseHandler interface.
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
