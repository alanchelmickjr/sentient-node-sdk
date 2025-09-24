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
export async function streamHelper(
  responseHandler: ResponseHandler,
  eventName: string,
  content: string | Record<string, any>
): Promise<void> {
  if (typeof content === 'string') {
    // Stream text content chunk by chunk
    const textStream = responseHandler.createTextStream(eventName);
    
    // Split into words for streaming effect (similar to Python chunking)
    const words = content.split(' ');
    for (const word of words) {
      await textStream.emitChunk(word + ' ');
    }
    
    await textStream.complete();
  } else {
    // Emit JSON object directly
    await responseHandler.emitJson(eventName, content);
  }
}

/**
 * Error handling helper that wraps function execution with automatic error emission.
 * Similar to Python's @handle_errors decorator pattern.
 * 
 * @param fn The function to execute
 * @param responseHandler The response handler for error emission
 * @returns Promise that resolves with the function result or handles errors
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  responseHandler: ResponseHandler
): Promise<T | void> {
  try {
    return await fn();
  } catch (error) {
    console.error('[withErrorHandling] Caught error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorDetails = error instanceof Error ? { stack: error.stack } : { error: String(error) };
    
    await responseHandler.emitError(errorMessage, 500, errorDetails);
    await responseHandler.complete();
  }
}

/**
 * Timeout helper that adds timeout functionality to async operations.
 * Similar to Python's @timeout decorator pattern.
 * 
 * @param fn The function to execute with timeout
 * @param timeoutMs Timeout in milliseconds
 * @param responseHandler Optional response handler for timeout error emission
 * @returns Promise that resolves with the function result or times out
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  responseHandler?: ResponseHandler
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } catch (error) {
    if (responseHandler && error instanceof Error && error.message.includes('timed out')) {
      await responseHandler.emitError(
        `Operation timed out after ${timeoutMs}ms`,
        408,
        { timeout: timeoutMs }
      );
      await responseHandler.complete();
    }
    throw error;
  }
}

/**
 * Logging helper that adds automatic logging to function execution.
 * Similar to Python's @log decorator pattern.
 * 
 * @param fn The function to execute with logging
 * @param label Optional label for the log messages
 * @returns Promise that resolves with the function result
 */
export async function withLogging<T>(
  fn: () => Promise<T>,
  label: string = 'Operation'
): Promise<T> {
  console.info(`[${label}] Starting...`);
  const startTime = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    console.info(`[${label}] Completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${label}] Failed after ${duration}ms:`, error);
    throw error;
  }
}

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
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  responseHandler?: ResponseHandler
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.info(`[withRetry] Attempt ${attempt}/${maxRetries}`);
        if (responseHandler) {
          await responseHandler.emitTextBlock(
            'RETRY',
            `Retrying operation (attempt ${attempt}/${maxRetries})...`
          );
        }
      }
      
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        console.warn(`[withRetry] Attempt ${attempt} failed, retrying in ${delayMs}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  console.error(`[withRetry] All ${maxRetries} attempts failed`);
  throw lastError!;
}