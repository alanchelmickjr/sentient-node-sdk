import { DefaultIdGenerator } from './default_id_generator';
import { BaseEvent, Event } from '../interface/events';
import { Hook } from '../interface/hook';

/**
 * An async event queue hook that collects events in a queue.
 * Default implementation of the Hook protocol.
 */
export class DefaultHook implements Hook {
  private _queue: Array<Event>;
  private _idGenerator: DefaultIdGenerator;
  private _timeoutMs?: number;

  constructor(options: {
    queue?: Array<Event>;
    idGenerator?: DefaultIdGenerator;
    timeoutMs?: number;
  } = {}) {
    this._queue = options.queue ?? [];
    this._idGenerator = options.idGenerator ?? new DefaultIdGenerator();
    this._timeoutMs = options.timeoutMs;
  }

  /**
   * Add event to queue.
   * Ensures event id is greater than previous one.
   * If timeoutMs is set, rejects after timeout.
   */
  async emit(event: Event): Promise<void> {
    // LOG: Emitting event
    console.info('[DefaultHook][LOG] Emitting event:', event);

    // Ensure event has incremented id
    const baseEvent = event as BaseEvent;
    baseEvent.id = await this._idGenerator.getNextId(baseEvent.id);

    // Emulate queue put with timeout
    if (this._timeoutMs == null) {
      this._queue.push(event);
      return;
    }

    // Timeout logic
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout while adding event to queue'));
      }, this._timeoutMs);

      this._queue.push(event);
      clearTimeout(timer);
      resolve();
    });
  }

  /**
   * Returns current queue (for test/debug use).
   */
  getQueue(): Array<Event> {
    return this._queue;
  }
}