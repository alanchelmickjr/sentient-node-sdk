/**
 * Exception classes for Sentient Agent Framework (TypeScript port).
 */

/**
 * Base class for exception due to error in processor.
 */
export class ProcessorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProcessorError';
    Object.setPrototypeOf(this, ProcessorError.prototype);
  }
}

/**
 * Base class for exception due to error in agents error.
 */
export class AgentError extends ProcessorError {
  constructor(message: string) {
    super(message);
    this.name = 'AgentError';
    Object.setPrototypeOf(this, AgentError.prototype);
  }
}

/**
 * Exception raised when the connection is closed.
 */
export class ResponseStreamClosedError extends ProcessorError {
  constructor(message: string) {
    super(message);
    this.name = 'ResponseStreamClosedError';
    Object.setPrototypeOf(this, ResponseStreamClosedError.prototype);
  }
}

/**
 * Exception raised when text stream is closed.
 */
export class TextStreamClosedError extends ProcessorError {
  constructor(message: string) {
    super(message);
    this.name = 'TextStreamClosedError';
    Object.setPrototypeOf(this, TextStreamClosedError.prototype);
  }
}