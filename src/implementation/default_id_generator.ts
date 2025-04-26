/**
 * DefaultIdGenerator: Generates monotonic ULIDs for event IDs.
 * NOTE: Requires 'ulid' npm package. Install with: npm install ulid
 */

import { ulid, monotonicFactory } from 'ulid';

class AsyncLock {
  private _locked = false;
  private _waiting: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (!this._locked) {
      this._locked = true;
      return;
    }
    await new Promise<void>(resolve => this._waiting.push(resolve));
  }

  release(): void {
    if (this._waiting.length > 0) {
      const next = this._waiting.shift();
      if (next) next();
    } else {
      this._locked = false;
    }
  }
}

export class DefaultIdGenerator {
  private _latestId: string;
  private _lock: AsyncLock;
  private _monotonicUlid: () => string;

  constructor(seedId?: string) {
    this._latestId = seedId ?? ulid();
    this._lock = new AsyncLock();
    this._monotonicUlid = monotonicFactory();
  }

  /**
   * Generate the next ULID. If a newId is provided and is greater than the latest, use it.
   * Otherwise, generate a new ULID strictly greater than the previous.
   * @param newId Optionally provide a new ULID string.
   * @param offset Not used in JS; for compatibility.
   */
  async getNextId(newId?: string, offset: number = 10): Promise<string> {
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
    } finally {
      this._lock.release();
    }
  }
}