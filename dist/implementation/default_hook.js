"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultHook = void 0;
const default_id_generator_1 = require("./default_id_generator");
/**
 * An async event queue hook that collects events in a queue.
 * Default implementation of the Hook protocol.
 */
class DefaultHook {
    _queue;
    _idGenerator;
    _timeoutMs;
    constructor(options = {}) {
        this._queue = options.queue ?? [];
        this._idGenerator = options.idGenerator ?? new default_id_generator_1.DefaultIdGenerator();
        this._timeoutMs = options.timeoutMs;
    }
    /**
     * Add event to queue.
     * Ensures event id is greater than previous one.
     * If timeoutMs is set, rejects after timeout.
     */
    async emit(event) {
        // LOG: Emitting event
        console.info('[DefaultHook][LOG] Emitting event:', event);
        // Ensure event has incremented id
        const baseEvent = event;
        baseEvent.id = await this._idGenerator.getNextId(baseEvent.id);
        // Emulate queue put with timeout
        if (this._timeoutMs == null) {
            this._queue.push(event);
            return;
        }
        // Timeout logic
        await new Promise((resolve, reject) => {
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
    getQueue() {
        return this._queue;
    }
}
exports.DefaultHook = DefaultHook;
//# sourceMappingURL=default_hook.js.map