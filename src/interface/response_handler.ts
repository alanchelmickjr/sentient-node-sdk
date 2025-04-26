/**
 * Placeholder for StreamEventEmitter interface.
 * Extend as needed once full requirements are known.
 */
export interface StreamEventEmitter<T> {
  emitChunk(chunk: T): Promise<this>;
  complete(): Promise<void>;
  readonly id: string;
  readonly isComplete: boolean;
}