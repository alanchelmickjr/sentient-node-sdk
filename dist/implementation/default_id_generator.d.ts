/**
 * DefaultIdGenerator: Generates monotonic ULIDs for event IDs.
 * NOTE: Requires 'ulid' npm package. Install with: npm install ulid
 */
export declare class DefaultIdGenerator {
    private _latestId;
    private _lock;
    private _monotonicUlid;
    constructor(seedId?: string);
    /**
     * Generate the next ULID. If a newId is provided and is greater than the latest, use it.
     * Otherwise, generate a new ULID strictly greater than the previous.
     * @param newId Optionally provide a new ULID string.
     * @param offset Not used in JS; for compatibility.
     */
    getNextId(newId?: string, offset?: number): Promise<string>;
}
