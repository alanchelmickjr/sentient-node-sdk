/**
 * DefaultTextStream: Streams text chunks as events.
 * NOTE: Imports require interface files to be ported to TypeScript.
 */

import { TextChunkEvent } from '../interface/events'; // TODO: Port to TS
import { TextStreamClosedError } from '../interface/exceptions'; // TODO: Port to TS
import { Hook } from '../interface/hook'; // TODO: Port to TS
import { Identity } from '../interface/identity'; // TODO: Port to TS
import { StreamEventEmitter } from '../interface/response_handler'; // TODO: Port to TS

export class DefaultTextStream extends (StreamEventEmitter as any)<string> {
  private _eventSource: Identity;
  private _eventName: string;
  private _streamId: string;
  private _hook: Hook;
  private _isComplete: boolean;

  constructor(options: {
    eventSource: Identity;
    eventName: string;
    streamId: string;
    hook: Hook;
  }) {
    super();
    this._eventSource = options.eventSource;
    this._eventName = options.eventName;
    this._streamId = options.streamId;
    this._hook = options.hook;
    this._isComplete = false;
  }

  /**
   * Send a chunk of text to stream.
   */
  async emitChunk(chunk: string): Promise<this> {
    if (this._isComplete) {
      throw new TextStreamClosedError(
        `Cannot emit chunk to closed stream ${this._streamId}.`
      );
    }
    const event = new TextChunkEvent({
      source: this._eventSource.id,
      eventName: this._eventName,
      streamId: this._streamId,
      isComplete: false,
      content: chunk,
    });
    await this._hook.emit(event);
    // LOG: Emitted chunk
    console.info('[DefaultTextStream][LOG] Emitted chunk:', chunk);
    return this;
  }

  /**
   * Mark stream as complete.
   */
  async complete(): Promise<void> {
    const event = new TextChunkEvent({
      source: this._eventSource.id,
      eventName: this._eventName,
      streamId: this._streamId,
      isComplete: true,
      content: ' ',
    });
    await this._hook.emit(event);
    this._isComplete = true;
    // LOG: Stream complete
    console.info('[DefaultTextStream][LOG] Stream marked complete.');
  }

  get id(): string {
    return this._streamId;
  }

  get isComplete(): boolean {
    return this._isComplete;
  }
}