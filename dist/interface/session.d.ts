/**
 * TypeScript port of SessionObject and related types for Sentient Agent Framework.
 */
export interface Interaction {
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
    processor_id: string;
    activity_id: string;
    request_id: string;
    get_interactions(): AsyncIterable<Interaction>;
}
