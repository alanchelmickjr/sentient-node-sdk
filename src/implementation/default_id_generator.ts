import { ULID, ulid } from 'ulid';

/**
 * ULID generator that tracks the latest identifier and ensures that the
 * next identifier is always greater than the latest.
 */
export class DefaultIdGenerator {
  private _latest_id: ULID;
  private _lock: Promise<void> = Promise.resolve();

  constructor(seed_id?: ULID) {
    this._latest_id = seed_id || ulid();
  }

  /**
   * Generate the next identifier.
   * @param new_id - The user suggested new identifier to use.
   * @param offset - The offset in milliseconds to add if the new id is not greater.
   * @returns The next ULID as a string.
   */
  async getNextId(new_id?: ULID | string, offset: number = 10): Promise<string> {
    let release: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    const previousLock = this._lock;
    this._lock = lockPromise;

    await previousLock;

    try {
      let resolved_new_id = new_id ? new ULID(new_id) : ulid();

      if (resolved_new_id.toString() <= this._latest_id.toString()) {
        resolved_new_id = ULID.fromTimestamp(this._latest_id.millis() + offset);
      }
      this._latest_id = resolved_new_id;
      return this._latest_id.toString();
    } finally {
      release!();
    }
  }
}