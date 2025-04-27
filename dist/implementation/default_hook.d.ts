import { DefaultIdGenerator } from './default_id_generator';
import { Event } from '../interface/events';
import { Hook } from '../interface/hook';
/**
 * An async event queue hook that collects events in a queue.
 * Default implementation of the Hook protocol.
 */
export declare class DefaultHook implements Hook {
    private _queue;
    private _idGenerator;
    private _timeoutMs?;
    constructor(options?: {
        queue?: Array<Event>;
        idGenerator?: DefaultIdGenerator;
        timeoutMs?: number;
    });
    /**
     * Add event to queue.
     * Ensures event id is greater than previous one.
     * If timeoutMs is set, rejects after timeout.
     */
    emit(event: Event): Promise<void>;
    /**
     * Returns current queue (for test/debug use).
     */
    getQueue(): Array<Event>;
}
