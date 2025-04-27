/**
 * Exception classes for Sentient Agent Framework (TypeScript port).
 */
/**
 * Base class for exception due to error in processor.
 */
export declare class ProcessorError extends Error {
    constructor(message: string);
}
/**
 * Base class for exception due to error in agents error.
 */
export declare class AgentError extends ProcessorError {
    constructor(message: string);
}
/**
 * Exception raised when the connection is closed.
 */
export declare class ResponseStreamClosedError extends ProcessorError {
    constructor(message: string);
}
/**
 * Exception raised when text stream is closed.
 */
export declare class TextStreamClosedError extends ProcessorError {
    constructor(message: string);
}
