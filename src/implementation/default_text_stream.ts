/**
 * DefaultTextStream: Streams text chunks as events.
 */

import { TextStreamClosedError } from '../interface/exceptions';
import { Hook } from '../interface/hook';
import { Identity } from '../interface/identity';
import { StreamEventEmitter } from '../interface/response_handler';
import { createTextChunkEvent } from '../interface/event_factories';

/**
 * Default implementation of the StreamEventEmitter interface for text streams.
 * Emits text chunks as events.
 */
export class DefaultTextStream implements StreamEventEmitter<string> {
  private _eventSource: Identity;
  private _eventName: string;
  private _streamId: string;
  private _hook: Hook;
  private _isComplete: boolean;

  /**
   * Create a new DefaultTextStream.
   * @param options Options for creating the text stream.
   */
  constructor(options: {
    eventSource: Identity;
    eventName: string;
    streamId: string;
    hook: Hook;
  }) {
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
  async emitChunk(chunk: string): Promise<this> {
    if (this._isComplete) {
      throw new TextStreamClosedError(
        `Cannot emit chunk to closed stream ${this._streamId}.`
      );
    }
    
    const event = createTextChunkEvent({
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
  async complete(): Promise<void> {
    if (this._isComplete) {
      throw new TextStreamClosedError(
        `Cannot complete already closed stream ${this._streamId}.`
      );
    }
    
    const event = createTextChunkEvent({
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
  get id(): string {
    return this._streamId;
  }

  /**
   * Check if the stream is complete.
   */
  get isComplete(): boolean {
    return this._isComplete;
  }
}