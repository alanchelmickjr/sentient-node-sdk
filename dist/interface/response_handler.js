"use strict";
/**
 * Response Handler Interfaces
 *
 * This module defines the ResponseHandler and StreamEventEmitter interfaces
 * for the Sentient Agent Framework. These interfaces provide methods for
 * emitting events to clients, including text blocks, JSON objects, streaming
 * text, and error messages.
 *
 * The ResponseHandler is used by agents to emit events to clients, while the
 * StreamEventEmitter is used for streaming text in chunks.
 *
 * @example
 * ```typescript
 * // Emit a text block
 * await responseHandler.emitTextBlock('THINKING', 'Processing your query...');
 *
 * // Emit a JSON object
 * await responseHandler.emitJson('RESULTS', { items: [1, 2, 3] });
 *
 * // Stream text
 * const stream = responseHandler.createTextStream('RESPONSE');
 * await stream.emitChunk('Hello, ');
 * await stream.emitChunk('world!');
 * await stream.complete();
 *
 * // Complete the response
 * await responseHandler.complete();
 * ```
 *
 * @module sentient-agent-framework/interface/response-handler
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=response_handler.js.map