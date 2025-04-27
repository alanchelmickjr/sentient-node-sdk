"use strict";
/**
 * Event Types for Sentient Agent Framework
 *
 * This module defines the event types used in the Sentient Agent Framework.
 * It includes interfaces for different types of events that can be emitted
 * by agents, such as text blocks, JSON documents, streaming text, and errors.
 *
 * The event system is designed to be flexible and extensible, allowing agents
 * to emit a variety of event types to provide a rich user experience.
 *
 * @module sentient-agent-framework/interface/events
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventContentType = exports.BaseEventType = exports.DEFAULT_ERROR_CODE = exports.ERROR = void 0;
exports.ERROR = "error";
exports.DEFAULT_ERROR_CODE = 500;
var BaseEventType;
(function (BaseEventType) {
    BaseEventType["ATOMIC"] = "atomic";
    BaseEventType["CHUNKED"] = "chunked";
})(BaseEventType || (exports.BaseEventType = BaseEventType = {}));
var EventContentType;
(function (EventContentType) {
    EventContentType["JSON"] = "atomic.json";
    EventContentType["TEXTBLOCK"] = "atomic.textblock";
    EventContentType["TEXT_STREAM"] = "chunked.text";
    EventContentType["ERROR"] = "atomic.error";
    EventContentType["DONE"] = "atomic.done";
})(EventContentType || (exports.EventContentType = EventContentType = {}));
//# sourceMappingURL=events.js.map