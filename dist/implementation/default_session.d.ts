import { Session, SessionObject, Interaction } from '../interface/session';
/**
 * Default implementation of the Session interface.
 * Adapts to stateless architecture by providing consistent access to session data.
 */
export declare class DefaultSession implements Session {
    private _sessionObject;
    constructor(sessionObject?: Partial<SessionObject>);
    /**
     * Get processor ID
     */
    get processor_id(): string;
    /**
     * Get activity ID
     */
    get activity_id(): string;
    /**
     * Get request ID
     */
    get request_id(): string;
    /**
     * Get interactions as AsyncIterable
     * In a stateless environment, we convert the array to an AsyncIterable
     */
    get_interactions(): AsyncIterable<Interaction>;
}
