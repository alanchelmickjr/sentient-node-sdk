/**
 * ResponseEventAdapter: Validates and converts JSON objects to response events.
 */

import {
  DocumentEvent,
  DoneEvent,
  ErrorContent,
  ErrorEvent,
  EventContentType,
  ResponseEvent,
  TextBlockEvent,
  TextChunkEvent
} from '../interface/events';

/**
 * Adapter for validating and converting JSON objects to response events.
 */
export class ResponseEventAdapter {
  /**
   * Validate and convert a JSON object to a response event.
   * @param json The JSON object to validate.
   * @returns The validated response event.
   * @throws Error if the JSON object is not a valid response event.
   */
  static validateJson(json: any): ResponseEvent {
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
      case EventContentType.JSON:
        return this.validateDocumentEvent(json);
      case EventContentType.TEXTBLOCK:
        return this.validateTextBlockEvent(json);
      case EventContentType.TEXT_STREAM:
        return this.validateTextChunkEvent(json);
      case EventContentType.ERROR:
        return this.validateErrorEvent(json);
      case EventContentType.DONE:
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
  private static validateDocumentEvent(json: any): DocumentEvent {
    if (!json.content || typeof json.content !== 'object') {
      throw new Error('Invalid DocumentEvent: content must be an object');
    }

    return json as DocumentEvent;
  }

  /**
   * Validate a text block event.
   * @param json The JSON object to validate.
   * @returns The validated text block event.
   * @throws Error if the JSON object is not a valid text block event.
   */
  private static validateTextBlockEvent(json: any): TextBlockEvent {
    if (!json.content || typeof json.content !== 'string') {
      throw new Error('Invalid TextBlockEvent: content must be a string');
    }

    return json as TextBlockEvent;
  }

  /**
   * Validate a text chunk event.
   * @param json The JSON object to validate.
   * @returns The validated text chunk event.
   * @throws Error if the JSON object is not a valid text chunk event.
   */
  private static validateTextChunkEvent(json: any): TextChunkEvent {
    if (!json.stream_id) {
      throw new Error('Invalid TextChunkEvent: missing stream_id');
    }

    if (json.is_complete === undefined) {
      throw new Error('Invalid TextChunkEvent: missing is_complete');
    }

    if (!json.content || typeof json.content !== 'string') {
      throw new Error('Invalid TextChunkEvent: content must be a string');
    }

    return json as TextChunkEvent;
  }

  /**
   * Validate an error event.
   * @param json The JSON object to validate.
   * @returns The validated error event.
   * @throws Error if the JSON object is not a valid error event.
   */
  private static validateErrorEvent(json: any): ErrorEvent {
    if (!json.content || typeof json.content !== 'object') {
      throw new Error('Invalid ErrorEvent: content must be an object');
    }

    const content = json.content as ErrorContent;
    
    if (!content.error_message || typeof content.error_message !== 'string') {
      throw new Error('Invalid ErrorEvent: content.error_message must be a string');
    }

    // Set default error code if not provided
    if (!content.error_code) {
      content.error_code = 500;
    }

    return json as ErrorEvent;
  }

  /**
   * Validate a done event.
   * @param json The JSON object to validate.
   * @returns The validated done event.
   */
  private static validateDoneEvent(json: any): DoneEvent {
    return json as DoneEvent;
  }
}