/**
 * Decorator-style utilities for Sentient Agent Framework
 *
 * This module provides decorator-like functionality that mirrors
 * Python decorator patterns commonly used in agent frameworks.
 *
 * @module sentient-agent-framework/implementation/decorators
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */
import { ResponseHandler } from '../interface/response_handler';
/**
 * Stream helper function that mimics Python decorators for streaming responses.
 * This function provides a convenient way to handle streaming responses with
 * automatic completion handling, similar to Python's @stream decorator pattern.
 *
 * @param responseHandler The response handler to use for streaming
 * @param eventName The name of the event to emit
 * @param content The content to stream (string or object)
 * @returns Promise that resolves when streaming is complete
 */
export declare function streamHelper(responseHandler: ResponseHandler, eventName: string, content: string | Record<string, any>): Promise<void>;
/**
 * Error handling helper that wraps function execution with automatic error emission.
 * Similar to Python's @handle_errors decorator pattern.
 *
 * @param fn The function to execute
 * @param responseHandler The response handler for error emission
 * @returns Promise that resolves with the function result or handles errors
 */
export declare function withErrorHandling<T>(fn: () => Promise<T>, responseHandler: ResponseHandler): Promise<T | void>;
/**
 * Timeout helper that adds timeout functionality to async operations.
 * Similar to Python's @timeout decorator pattern.
 *
 * @param fn The function to execute with timeout
 * @param timeoutMs Timeout in milliseconds
 * @param responseHandler Optional response handler for timeout error emission
 * @returns Promise that resolves with the function result or times out
 */
export declare function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, responseHandler?: ResponseHandler): Promise<T>;
/**
 * Logging helper that adds automatic logging to function execution.
 * Similar to Python's @log decorator pattern.
 *
 * @param fn The function to execute with logging
 * @param label Optional label for the log messages
 * @returns Promise that resolves with the function result
 */
export declare function withLogging<T>(fn: () => Promise<T>, label?: string): Promise<T>;
/**
 * Retry helper that adds automatic retry functionality.
 * Similar to Python's @retry decorator pattern.
 *
 * @param fn The function to execute with retry logic
 * @param maxRetries Maximum number of retry attempts
 * @param delayMs Delay between retries in milliseconds
 * @param responseHandler Optional response handler for retry notifications
 * @returns Promise that resolves with the function result
 */
export declare function withRetry<T>(fn: () => Promise<T>, maxRetries?: number, delayMs?: number, responseHandler?: ResponseHandler): Promise<T>;
