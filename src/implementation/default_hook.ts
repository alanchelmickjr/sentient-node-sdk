import { DefaultIdGenerator } from './default_id_generator';
import { AsyncQueue } from './async_queue';
import { BaseEvent, Event } from '../interface/events';
import { Hook } from '../interface/hook';

/**
 * An async event queue hook that collects events in a queue.
 * Default implementation of the Hook protocol.
 */
export class DefaultHook implements Hook {
  private _queue: AsyncQueue<Event>;
  private _idGenerator: DefaultIdGenerator;
  private _timeoutMs?: number;

  constructor(options: {
    queue?: AsyncQueue<Event>;
    idGenerator?: DefaultIdGenerator;
    timeoutMs?: number;
  } = {}) {
    this._queue = options.queue ?? new AsyncQueue<Event>();
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

    // Use async queue
    if (this._timeoutMs == null) {
      await this._queue.put(event);
      return;
    }

    // Timeout logic
    await Promise.race([
      this._queue.put(event),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Timeout while adding event to queue'));
        }, this._timeoutMs);
      })
    ]);
  }

  /**
   * Get next event from queue
   */
  async getNextEvent(): Promise<Event> {
    return await this._queue.get();
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this._queue.empty();
  }

  /**
   * Returns current queue items (for test/debug use).
   */
  getQueue(): Event[] {
    return this._queue.getItems();
  }
}