"use strict";
/**
 * DefaultResponseHandler: Default implementation of the ResponseHandler interface.
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
     * Emit a response and mark the response as complete.
     * @param eventName The name of the event.
     * @param response The response content, either a string or a JSON object.
     */
    async respond(eventName, response) {
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
        await this.complete();
    }
    /**
     * Emit a JSON object as an event.
     * @param eventName The name of the event.
     * @param data The JSON data to emit.
     */
    async emitJson(eventName, data) {
        this.verifyResponseStreamIsOpen();
        try {
            // Verify JSON serializable
            JSON.stringify(data);
        }
        catch (e) {
            throw new exceptions_1.AgentError("Response content must be JSON serializable");
        }
        const event = (0, event_factories_1.createDocumentEvent)({
            source: this._source.id,
            event_name: eventName,
            content: data
        });
        await this.emitEvent(event);
    }
    /**
     * Emit a text block as an event.
     * @param eventName The name of the event.
     * @param content The text content to emit.
     */
    async emitTextBlock(eventName, content) {
        this.verifyResponseStreamIsOpen();
        const event = (0, event_factories_1.createTextBlockEvent)({
            source: this._source.id,
            event_name: eventName,
            content: content
        });
        await this.emitEvent(event);
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
        this.verifyResponseStreamIsOpen();
        const event = (0, event_factories_1.createErrorEvent)({
            source: this._source.id,
            error_message: errorMessage,
            error_code: errorCode,
            details
        });
        await this.emitEvent(event);
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