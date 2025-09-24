/**
 * TypeScript port of SessionObject and related types for Sentient Agent Framework.
 */

export interface Interaction {
  // TODO: Flesh out complete Interaction type as needed
  // For now, a minimal placeholder
  [key: string]: any;
}

export interface SessionObject {
  processor_id: string;
  activity_id: string;
  request_id: string;
  interactions: Interaction[];
}

/**
 * Session protocol (interface) placeholder.
 * Extend as needed.
 */
export interface Session {
  readonly processor_id: string;
  readonly activity_id: string;
  readonly request_id: string;
  get_interactions(): AsyncIterable<Interaction>;
}