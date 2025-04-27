/**
 * DefaultTextStream: Streams text chunks as events.
 */
import { Hook } from '../interface/hook';
import { Identity } from '../interface/identity';
import { StreamEventEmitter } from '../interface/response_handler';
/**
 * Default implementation of the StreamEventEmitter interface for text streams.
 * Emits text chunks as events.
 */
export declare class DefaultTextStream implements StreamEventEmitter<string> {
    private _eventSource;
    private _eventName;
    private _streamId;
    private _hook;
    private _isComplete;
    /**
     * Create a new DefaultTextStream.
     * @param options Options for creating the text stream.
     */
    constructor(options: {
        eventSource: Identity;
        eventName: string;
        streamId: string;
        hook: Hook;
    });
    /**
     * Send a chunk of text to stream.
     * @param chunk The text chunk to emit.
     * @returns This stream instance for chaining.
     * @throws TextStreamClosedError if the stream is already complete.
     */
    emitChunk(chunk: string): Promise<this>;
    /**
     * Mark stream as complete.
     * @throws TextStreamClosedError if the stream is already complete.
     */
    complete(): Promise<void>;
    /**
     * Get the stream ID.
     */
    get id(): string;
    /**
     * Check if the stream is complete.
     */
    get isComplete(): boolean;
}
