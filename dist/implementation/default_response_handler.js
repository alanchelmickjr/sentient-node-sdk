"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultResponseHandler = void 0;
const ulid_1 = require("ulid");
const events_1 = require("../interface/events");
const exceptions_1 = require("../interface/exceptions");
const event_factories_1 = require("../interface/event_factories");
const default_text_stream_1 = require("./default_text_stream");
/**
 * Default implementation of the ResponseHandler interface.
 * Handles emitting events to the client via a Hook.
 */
class DefaultResponseHandler {
    _source;
    _hook;
    _streams = new Map();
    _isComplete = false;
    /**
     * Create a new DefaultResponseHandler.
     * @param source The identity of the event source.
     * @param hook The hook to emit events through.
     */
    constructor(source, hook) {
        this._source = source;
        this._hook = hook;
        // LOG: Construction
        console.info('[DefaultResponseHandler][LOG] Created with source:', source);
    }
    /**
     * Verify that the response stream is open.
     * @throws ResponseStreamClosedError if the response is complete.
     */
    verifyResponseStreamIsOpen() {
        if (this._isComplete) {
            throw new exceptions_1.ResponseStreamClosedError("Cannot send to a completed response handler.");
        }
    }
    /**
     * Emit a response and optionally mark the response as complete.
     * @param eventName The name of the event.
     * @param response The response content, either a string or a JSON object.
     * @param complete Whether to mark the response as complete (default: true).
     */
    async respond(eventName, response, complete = true) {
        this.verifyResponseStreamIsOpen();
        if (typeof response === 'string') {
            const event = (0, event_factories_1.createTextBlockEvent)({
                source: this._source.id,
                event_name: eventName,
                content: response
            });
            await this.emitEvent(event);
        }
        else {
            try {
                // Verify JSON serializable
                JSON.stringify(response);
            }
            catch (e) {
                throw new exceptions_1.AgentError("Response content must be JSON serializable");
            }
            const event = (0, event_factories_1.createDocumentEvent)({
                source: this._source.id,
                event_name: eventName,
                content: response
            });
            await this.emitEvent(event);
        }
        if (complete) {
            await this.complete();
        }
    }
    /**
     * Emit a JSON object as an event.
     * @param eventName The name of the event.
     * @param data The JSON data to emit.
     */
    async emitJson(eventName, data) {
        this.verifyResponseStreamIsOpen();
        try {
            // Verify JSON serializable before creating event
            JSON.stringify(data);
            await this.emitEvent((0, event_factories_1.createDocumentEvent)({
                source: this._source.id,
                event_name: eventName,
                content: data
            }));
        }
        catch (e) {
            // If serialization fails, emit an error event instead
            await this.emitError("Response content must be JSON serializable", 500, { originalEventName: eventName, error: e.message });
            // Re-throw the error after emitting the error event to signal failure
            console.error("[DefaultResponseHandler][ERROR] Failed to serialize JSON:", e);
            throw new exceptions_1.AgentError(`Failed to serialize JSON response content: ${e.message}`);
        }
    }
    /**
     * Emit a text block as an event.
     * @param eventName The name of the event.
     * @param content The text content to emit.
     */
    async emitTextBlock(eventName, content) {
        this.verifyResponseStreamIsOpen();
        await this.emitEvent((0, event_factories_1.createTextBlockEvent)({
            source: this._source.id,
            event_name: eventName,
            content: content
        }));
    }
    /**
     * Create a new text stream for emitting chunks of text.
     * @param eventName The name of the event.
     * @returns A StreamEventEmitter for emitting text chunks.
     */
    createTextStream(eventName) {
        this.verifyResponseStreamIsOpen();
        const streamId = (0, ulid_1.ulid)();
        const stream = new default_text_stream_1.DefaultTextStream({
            eventSource: this._source,
            eventName,
            streamId,
            hook: this._hook
        });
        this._streams.set(streamId, stream);
        // LOG: Stream creation
        console.info('[DefaultResponseHandler][LOG] Created text stream:', streamId);
        return stream;
    }
    /**
     * Emit an error event.
     * @param errorMessage The error message.
     * @param errorCode The error code (default: 500).
     * @param details Additional error details.
     */
    async emitError(errorMessage, errorCode = events_1.DEFAULT_ERROR_CODE, details) {
        // Allow emitting errors even if stream is 'complete' in some scenarios,
        // but log a warning. Consider if this should throw instead.
        if (this._isComplete) {
            console.warn('[DefaultResponseHandler][WARN] Emitting error after response stream marked as complete.');
        }
        // Re-introduce check to prevent emitting errors after completion.
        this.verifyResponseStreamIsOpen();
        await this.emitEvent((0, event_factories_1.createErrorEvent)({
            source: this._source.id,
            error_message: errorMessage,
            error_code: errorCode,
            details
        }));
    }
    /**
     * Mark the response as complete.
     * This will also mark all streams as complete.
     */
    async complete() {
        // Nop if already complete
        if (this.isComplete) {
            return;
        }
        // Mark all streams as complete
        for (const stream of this._streams.values()) {
            if (!stream.isComplete) {
                await stream.complete();
            }
        }
        this._isComplete = true;
        await this.emitEvent((0, event_factories_1.createDoneEvent)({
            source: this._source.id
        }));
        // LOG: Response complete
        console.info('[DefaultResponseHandler][LOG] Response marked as complete');
    }
    /**
     * Whether the response is complete.
     */
    get isComplete() {
        return this._isComplete;
    }
    /**
     * Internal method to emit events using hook.
     * @param event The event to emit.
     */
    async emitEvent(event) {
        await this._hook.emit(event);
    }
}
exports.DefaultResponseHandler = DefaultResponseHandler;
//# sourceMappingURL=default_response_handler.js.map