declare module 'ulid' {
  /**
   * Generate a ULID string
   */
  export function ulid(seedTime?: number): string;
  
  /**
   * Create a monotonic ULID generator
   */
  export function monotonicFactory(seedTime?: number): () => string;
  
  /**
   * Decode a ULID to get a timestamp
   */
  export function decodeTime(id: string): number;
}