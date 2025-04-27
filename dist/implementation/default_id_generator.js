"use strict";
/**
 * DefaultIdGenerator: Generates monotonic ULIDs for event IDs.
 * NOTE: Requires 'ulid' npm package. Install with: npm install ulid
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultIdGenerator = void 0;
const ulid_1 = require("ulid");
class AsyncLock {
    _locked = false;
    _waiting = [];
    async acquire() {
        if (!this._locked) {
            this._locked = true;
            return;
        }
        await new Promise(resolve => this._waiting.push(resolve));
    }
    release() {
        if (this._waiting.length > 0) {
            const next = this._waiting.shift();
            if (next)
                next();
        }
        else {
            this._locked = false;
        }
    }
}
class DefaultIdGenerator {
    _latestId;
    _lock;
    _monotonicUlid;
    constructor(seedId) {
        this._latestId = seedId ?? (0, ulid_1.ulid)();
        this._lock = new AsyncLock();
        this._monotonicUlid = (0, ulid_1.monotonicFactory)();
    }
    /**
     * Generate the next ULID. If a newId is provided and is greater than the latest, use it.
     * Otherwise, generate a new ULID strictly greater than the previous.
     * @param newId Optionally provide a new ULID string.
     * @param offset Not used in JS; for compatibility.
     */
    async getNextId(newId, offset = 10) {
        await this._lock.acquire();
        try {
            let resolvedNewId = newId ?? this._monotonicUlid();
            if (resolvedNewId <= this._latestId) {
                // Re-generate to ensure monotonicity
                resolvedNewId = this._monotonicUlid();
            }
            this._latestId = resolvedNewId;
            // LOG: id generation
            console.info('[DefaultIdGenerator][LOG] Generated new ID:', resolvedNewId);
            return resolvedNewId;
        }
        finally {
            this._lock.release();
        }
    }
}
exports.DefaultIdGenerator = DefaultIdGenerator;
//# sourceMappingURL=default_id_generator.js.map