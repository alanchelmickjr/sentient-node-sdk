/**
 * AsyncQueue implementation to match Python's asyncio.Queue behavior
 */

export class AsyncQueue<T> {
  private _items: T[] = [];
  private _waiters: Array<(value: T) => void> = [];
  private _maxSize: number;

  constructor(maxSize: number = 0) {
    this._maxSize = maxSize;
  }

  /**
   * Add an item to the queue
   */
  async put(item: T): Promise<void> {
    if (this._maxSize > 0 && this._items.length >= this._maxSize) {
      throw new Error('Queue is full');
    }
    
    this._items.push(item);
    
    // If there are waiters, resolve the first one
    if (this._waiters.length > 0) {
      const waiter = this._waiters.shift();
      if (waiter) {
        waiter(this._items.shift()!);
      }
    }
  }

  /**
   * Get an item from the queue (blocks if empty)
   */
  async get(): Promise<T> {
    if (this._items.length > 0) {
      return this._items.shift()!;
    }

    // No items available, wait for one
    return new Promise<T>((resolve) => {
      this._waiters.push(resolve);
    });
  }

  /**
   * Check if queue is empty
   */
  empty(): boolean {
    return this._items.length === 0;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this._items.length;
  }

  /**
   * Get all items (for debugging)
   */
  getItems(): T[] {
    return [...this._items];
  }
}