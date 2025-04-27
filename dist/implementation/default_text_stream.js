"use strict";
/**
 * DefaultTextStream: Streams text chunks as events.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultTextStream = void 0;
const exceptions_1 = require("../interface/exceptions");
const event_factories_1 = require("../interface/event_factories");
/**
 * Default implementation of the StreamEventEmitter interface for text streams.
 * Emits text chunks as events.
 */
class DefaultTextStream {
    _eventSource;
    _eventName;
    _streamId;
    _hook;
    _isComplete;
    /**
     * Create a new DefaultTextStream.
     * @param options Options for creating the text stream.
     */
    constructor(options) {
        this._eventSource = options.eventSource;
        this._eventName = options.eventName;
        this._streamId = options.streamId;
        this._hook = options.hook;
        this._isComplete = false;
        // LOG: Construction
        console.info('[DefaultTextStream][LOG] Created with streamId:', options.streamId);
    }
    /**
     * Send a chunk of text to stream.
     * @param chunk The text chunk to emit.
     * @returns This stream instance for chaining.
     * @throws TextStreamClosedError if the stream is already complete.
     */
    async emitChunk(chunk) {
        if (this._isComplete) {
            throw new exceptions_1.TextStreamClosedError(`Cannot emit chunk to closed stream ${this._streamId}.`);
        }
        const event = (0, event_factories_1.createTextChunkEvent)({
            source: this._eventSource.id,
            event_name: this._eventName,
            stream_id: this._streamId,
            is_complete: false,
            content: chunk
        });
        await this._hook.emit(event);
        // LOG: Emitted chunk
        console.info('[DefaultTextStream][LOG] Emitted chunk:', chunk);
        return this;
    }
    /**
     * Mark stream as complete.
     * @throws TextStreamClosedError if the stream is already complete.
     */
    async complete() {
        if (this._isComplete) {
            throw new exceptions_1.TextStreamClosedError(`Cannot complete already closed stream ${this._streamId}.`);
        }
        const event = (0, event_factories_1.createTextChunkEvent)({
            source: this._eventSource.id,
            event_name: this._eventName,
            stream_id: this._streamId,
            is_complete: true,
            content: ' ' // Empty space as final content
        });
        await this._hook.emit(event);
        this._isComplete = true;
        // LOG: Stream complete
        console.info('[DefaultTextStream][LOG] Stream marked complete.');
    }
    /**
     * Get the stream ID.
     */
    get id() {
        return this._streamId;
    }
    /**
     * Check if the stream is complete.
     */
    get isComplete() {
        return this._isComplete;
    }
}
exports.DefaultTextStream = DefaultTextStream;
//# sourceMappingURL=default_text_stream.js.map