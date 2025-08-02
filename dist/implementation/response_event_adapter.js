"use strict";
/**
 * ResponseEventAdapter: Validates and converts JSON objects to response events.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseEventAdapter = void 0;
const events_1 = require("../interface/events");
/**
 * Adapter for validating and converting JSON objects to response events.
 */
class ResponseEventAdapter {
    /**
     * Validate and convert a JSON object to a response event.
     * @param json The JSON object to validate.
     * @returns The validated response event.
     * @throws Error if the JSON object is not a valid response event.
     */
    static validateJson(json) {
        if (!json || typeof json !== 'object') {
            throw new Error('Invalid event: not an object');
        }
        if (!json.content_type) {
            throw new Error('Invalid event: missing content_type');
        }
        if (!json.event_name) {
            throw new Error('Invalid event: missing event_name');
        }
        if (!json.id) {
            throw new Error('Invalid event: missing id');
        }
        if (!json.source) {
            throw new Error('Invalid event: missing source');
        }
        // Set default schema_version if not provided
        if (!json.schema_version) {
            json.schema_version = '1.0';
        }
        // Validate based on content_type
        switch (json.content_type) {
            case events_1.EventContentType.JSON:
                return this.validateDocumentEvent(json);
            case events_1.EventContentType.TEXTBLOCK:
                return this.validateTextBlockEvent(json);
            case events_1.EventContentType.TEXT_STREAM:
                return this.validateTextChunkEvent(json);
            case events_1.EventContentType.ERROR:
                return this.validateErrorEvent(json);
            case events_1.EventContentType.DONE:
                return this.validateDoneEvent(json);
            default:
                throw new Error(`Invalid event: unknown content_type ${json.content_type}`);
        }
    }
    /**
     * Validate a document event.
     * @param json The JSON object to validate.
     * @returns The validated document event.
     * @throws Error if the JSON object is not a valid document event.
     */
    static validateDocumentEvent(json) {
        if (!json.content || typeof json.content !== 'object') {
            throw new Error('Invalid DocumentEvent: content must be an object');
        }
        return json;
    }
    /**
     * Validate a text block event.
     * @param json The JSON object to validate.
     * @returns The validated text block event.
     * @throws Error if the JSON object is not a valid text block event.
     */
    static validateTextBlockEvent(json) {
        if (!json.content || typeof json.content !== 'string') {
            throw new Error('Invalid TextBlockEvent: content must be a string');
        }
        return json;
    }
    /**
     * Validate a text chunk event.
     * @param json The JSON object to validate.
     * @returns The validated text chunk event.
     * @throws Error if the JSON object is not a valid text chunk event.
     */
    static validateTextChunkEvent(json) {
        if (json.is_complete === undefined) {
            throw new Error('Invalid TextChunkEvent: missing is_complete');
        }
        if (typeof json.content !== 'string') {
            throw new Error('Invalid TextChunkEvent: content must be a string');
        }
        if (!json.is_complete && !json.content) {
            throw new Error('Invalid TextChunkEvent: content must be a non-empty string when is_complete is false');
        }
        return json;
    }
    /**
     * Validate an error event.
     * @param json The JSON object to validate.
     * @returns The validated error event.
     * @throws Error if the JSON object is not a valid error event.
     */
    static validateErrorEvent(json) {
        if (!json.content || typeof json.content !== 'object') {
            throw new Error('Invalid ErrorEvent: content must be an object');
        }
        const content = json.content;
        if (!content.error_message || typeof content.error_message !== 'string') {
            throw new Error('Invalid ErrorEvent: content.error_message must be a string');
        }
        // Set default error code if not provided
        if (!content.error_code) {
            content.error_code = 500;
        }
        return json;
    }
    /**
     * Validate a done event.
     * @param json The JSON object to validate.
     * @returns The validated done event.
     */
    static validateDoneEvent(json) {
        return json;
    }
}
exports.ResponseEventAdapter = ResponseEventAdapter;
//# sourceMappingURL=response_event_adapter.js.map