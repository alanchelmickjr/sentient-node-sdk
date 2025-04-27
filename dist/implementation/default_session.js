"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultSession = void 0;
/**
 * Default implementation of the Session interface.
 * Adapts to stateless architecture by providing consistent access to session data.
 */
class DefaultSession {
    _sessionObject;
    constructor(sessionObject = {}) {
        // Ensure all required fields exist with defaults
        this._sessionObject = {
            processor_id: sessionObject.processor_id || 'default-processor',
            activity_id: sessionObject.activity_id || 'default-activity',
            request_id: sessionObject.request_id || 'default-request',
            interactions: sessionObject.interactions || []
        };
        // LOG: Construction
        console.info('[DefaultSession][LOG] Created with sessionObject:', this._sessionObject);
    }
    /**
     * Get processor ID
     */
    get processor_id() {
        return this._sessionObject.processor_id;
    }
    /**
     * Get activity ID
     */
    get activity_id() {
        return this._sessionObject.activity_id;
    }
    /**
     * Get request ID
     */
    get request_id() {
        return this._sessionObject.request_id;
    }
    /**
     * Get interactions as AsyncIterable
     * In a stateless environment, we convert the array to an AsyncIterable
     */
    async *get_interactions() {
        // LOG: Access get_interactions
        console.info('[DefaultSession][LOG] Accessing get_interactions');
        // Convert array to AsyncIterable
        for (const interaction of this._sessionObject.interactions) {
            yield interaction;
        }
    }
}
exports.DefaultSession = DefaultSession;
//# sourceMappingURL=default_session.js.map