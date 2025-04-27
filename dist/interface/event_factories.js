"use strict";
/**
 * Factory functions for creating event objects.
 * These functions create objects that implement the event interfaces defined in events.ts.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBaseEvent = createBaseEvent;
exports.createDocumentEvent = createDocumentEvent;
exports.createTextBlockEvent = createTextBlockEvent;
exports.createTextChunkEvent = createTextChunkEvent;
exports.createErrorEvent = createErrorEvent;
exports.createDoneEvent = createDoneEvent;
const ulidModule = __importStar(require("ulid"));
const events_1 = require("./events");
// Use the ulid function from the module
const { ulid } = ulidModule;
/**
 * Default schema version for events.
 */
const DEFAULT_SCHEMA_VERSION = '1.0';
/**
 * Create a base event with common properties.
 * @param source The source of the event.
 * @param eventName The name of the event.
 * @param id Optional ID for the event. If not provided, a new ULID will be generated.
 * @param schemaVersion Optional schema version. Defaults to '1.0'.
 * @param metadata Optional metadata for the event.
 * @returns A base event object.
 */
function createBaseEvent(source, eventName, id, schemaVersion, metadata) {
    return {
        id: id || ulid(),
        source,
        event_name: eventName,
        schema_version: schemaVersion || DEFAULT_SCHEMA_VERSION,
        metadata,
    };
}
/**
 * Create a document event.
 * @param options Options for creating the document event.
 * @returns A document event object.
 */
function createDocumentEvent(options) {
    return {
        ...createBaseEvent(options.source, options.event_name, options.id, options.schema_version, options.metadata),
        content_type: events_1.EventContentType.JSON,
        content: options.content,
    };
}
/**
 * Create a text block event.
 * @param options Options for creating the text block event.
 * @returns A text block event object.
 */
function createTextBlockEvent(options) {
    return {
        ...createBaseEvent(options.source, options.event_name, options.id, options.schema_version, options.metadata),
        content_type: events_1.EventContentType.TEXTBLOCK,
        content: options.content,
    };
}
/**
 * Create a text chunk event.
 * @param options Options for creating the text chunk event.
 * @returns A text chunk event object.
 */
function createTextChunkEvent(options) {
    return {
        ...createBaseEvent(options.source, options.event_name, options.id, options.schema_version, options.metadata),
        content_type: events_1.EventContentType.TEXT_STREAM,
        stream_id: options.stream_id,
        is_complete: options.is_complete,
        content: options.content,
    };
}
/**
 * Create an error event.
 * @param options Options for creating the error event.
 * @returns An error event object.
 */
function createErrorEvent(options) {
    const errorContent = {
        error_message: options.error_message,
        error_code: options.error_code,
        details: options.details,
    };
    return {
        ...createBaseEvent(options.source, 'error', options.id, options.schema_version, options.metadata),
        content_type: events_1.EventContentType.ERROR,
        event_name: 'error',
        content: errorContent,
    };
}
/**
 * Create a done event.
 * @param options Options for creating the done event.
 * @returns A done event object.
 */
function createDoneEvent(options) {
    return {
        ...createBaseEvent(options.source, 'done', options.id, options.schema_version, options.metadata),
        content_type: events_1.EventContentType.DONE,
        event_name: 'done',
    };
}
//# sourceMappingURL=event_factories.js.map