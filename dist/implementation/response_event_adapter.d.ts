/**
 * ResponseEventAdapter: Validates and converts JSON objects to response events.
 */
import { ResponseEvent } from '../interface/events';
/**
 * Adapter for validating and converting JSON objects to response events.
 */
export declare class ResponseEventAdapter {
    /**
     * Validate and convert a JSON object to a response event.
     * @param json The JSON object to validate.
     * @returns The validated response event.
     * @throws Error if the JSON object is not a valid response event.
     */
    static validateJson(json: any): ResponseEvent;
    /**
     * Validate a document event.
     * @param json The JSON object to validate.
     * @returns The validated document event.
     * @throws Error if the JSON object is not a valid document event.
     */
    private static validateDocumentEvent;
    /**
     * Validate a text block event.
     * @param json The JSON object to validate.
     * @returns The validated text block event.
     * @throws Error if the JSON object is not a valid text block event.
     */
    private static validateTextBlockEvent;
    /**
     * Validate a text chunk event.
     * @param json The JSON object to validate.
     * @returns The validated text chunk event.
     * @throws Error if the JSON object is not a valid text chunk event.
     */
    private static validateTextChunkEvent;
    /**
     * Validate an error event.
     * @param json The JSON object to validate.
     * @returns The validated error event.
     * @throws Error if the JSON object is not a valid error event.
     */
    private static validateErrorEvent;
    /**
     * Validate a done event.
     * @param json The JSON object to validate.
     * @returns The validated done event.
     */
    private static validateDoneEvent;
}
