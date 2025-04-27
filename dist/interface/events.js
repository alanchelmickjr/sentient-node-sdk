"use strict";
/**
 * TypeScript port of event types for Sentient Agent Framework.
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