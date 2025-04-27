"use strict";
/**
 * Exception classes for Sentient Agent Framework (TypeScript port).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextStreamClosedError = exports.ResponseStreamClosedError = exports.AgentError = exports.ProcessorError = void 0;
/**
 * Base class for exception due to error in processor.
 */
class ProcessorError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProcessorError';
        Object.setPrototypeOf(this, ProcessorError.prototype);
    }
}
exports.ProcessorError = ProcessorError;
/**
 * Base class for exception due to error in agents error.
 */
class AgentError extends ProcessorError {
    constructor(message) {
        super(message);
        this.name = 'AgentError';
        Object.setPrototypeOf(this, AgentError.prototype);
    }
}
exports.AgentError = AgentError;
/**
 * Exception raised when the connection is closed.
 */
class ResponseStreamClosedError extends ProcessorError {
    constructor(message) {
        super(message);
        this.name = 'ResponseStreamClosedError';
        Object.setPrototypeOf(this, ResponseStreamClosedError.prototype);
    }
}
exports.ResponseStreamClosedError = ResponseStreamClosedError;
/**
 * Exception raised when text stream is closed.
 */
class TextStreamClosedError extends ProcessorError {
    constructor(message) {
        super(message);
        this.name = 'TextStreamClosedError';
        Object.setPrototypeOf(this, TextStreamClosedError.prototype);
    }
}
exports.TextStreamClosedError = TextStreamClosedError;
//# sourceMappingURL=exceptions.js.map