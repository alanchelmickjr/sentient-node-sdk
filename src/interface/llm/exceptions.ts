/**
 * LLM Provider Exceptions
 * 
 * Comprehensive error handling and exception types for LLM providers.
 * 
 * @module sentient-agent-framework/interface/llm/exceptions
 */

import { ProcessorError, AgentError } from '../exceptions';

/**
 * Base LLM error class
 */
export class LLMError extends ProcessorError {
  public readonly providerId?: string;
  public readonly requestId?: string;
  public readonly metadata?: Record<string, any>;
  
  constructor(
    message: string, 
    providerId?: string, 
    requestId?: string, 
    metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'LLMError';
    this.providerId = providerId;
    this.requestId = requestId;
    this.metadata = metadata;
    Object.setPrototypeOf(this, LLMError.prototype);
  }
}

/**
 * Provider initialization error
 */
export class ProviderInitializationError extends LLMError {
  constructor(providerId: string, reason: string, cause?: Error) {
    super(`Failed to initialize provider ${providerId}: ${reason}`, providerId);
    this.name = 'ProviderInitializationError';
    this.cause = cause;
    Object.setPrototypeOf(this, ProviderInitializationError.prototype);
  }
}

/**
 * Provider not found error
 */
export class ProviderNotFoundError extends LLMError {
  constructor(providerId: string) {
    super(`Provider not found: ${providerId}`, providerId);
    this.name = 'ProviderNotFoundError';
    Object.setPrototypeOf(this, ProviderNotFoundError.prototype);
  }
}

/**
 * Provider unavailable error
 */
export class ProviderUnavailableError extends LLMError {
  public readonly retryAfter?: number;
  
  constructor(providerId: string, reason?: string, retryAfter?: number) {
    super(`Provider ${providerId} is unavailable${reason ? `: ${reason}` : ''}`, providerId);
    this.name = 'ProviderUnavailableError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, ProviderUnavailableError.prototype);
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends LLMError {
  constructor(providerId: string, message = 'Authentication failed') {
    super(`${message} for provider ${providerId}`, providerId);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends LLMError {
  constructor(providerId: string, resource?: string) {
    super(
      `Authorization failed for provider ${providerId}${resource ? ` accessing ${resource}` : ''}`,
      providerId
    );
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends LLMError {
  public readonly retryAfter?: number;
  public readonly limitType: 'requests' | 'tokens' | 'concurrent';
  public readonly limit: number;
  public readonly remaining: number;
  
  constructor(
    providerId: string,
    limitType: 'requests' | 'tokens' | 'concurrent',
    limit: number,
    remaining: number,
    retryAfter?: number
  ) {
    super(
      `Rate limit exceeded for provider ${providerId}: ${limitType} limit (${limit}), ${remaining} remaining`,
      providerId
    );
    this.name = 'RateLimitError';
    this.limitType = limitType;
    this.limit = limit;
    this.remaining = remaining;
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Model not found error
 */
export class ModelNotFoundError extends LLMError {
  public readonly model: string;
  
  constructor(providerId: string, model: string) {
    super(`Model ${model} not found for provider ${providerId}`, providerId);
    this.name = 'ModelNotFoundError';
    this.model = model;
    Object.setPrototypeOf(this, ModelNotFoundError.prototype);
  }
}

/**
 * Model not supported error
 */
export class ModelNotSupportedError extends LLMError {
  public readonly model: string;
  public readonly capability: string;
  
  constructor(providerId: string, model: string, capability: string) {
    super(
      `Model ${model} does not support ${capability} for provider ${providerId}`,
      providerId
    );
    this.name = 'ModelNotSupportedError';
    this.model = model;
    this.capability = capability;
    Object.setPrototypeOf(this, ModelNotSupportedError.prototype);
  }
}

/**
 * Request validation error
 */
export class RequestValidationError extends LLMError {
  public readonly validationErrors: string[];
  
  constructor(providerId: string, errors: string[], requestId?: string) {
    super(`Request validation failed for provider ${providerId}: ${errors.join(', ')}`, providerId, requestId);
    this.name = 'RequestValidationError';
    this.validationErrors = errors;
    Object.setPrototypeOf(this, RequestValidationError.prototype);
  }
}

/**
 * Response validation error
 */
export class ResponseValidationError extends LLMError {
  public readonly validationErrors: string[];
  
  constructor(providerId: string, errors: string[], requestId?: string) {
    super(`Response validation failed for provider ${providerId}: ${errors.join(', ')}`, providerId, requestId);
    this.name = 'ResponseValidationError';
    this.validationErrors = errors;
    Object.setPrototypeOf(this, ResponseValidationError.prototype);
  }
}

/**
 * Content filter error
 */
export class ContentFilterError extends LLMError {
  public readonly filterType: string;
  public readonly content?: string;
  
  constructor(providerId: string, filterType: string, content?: string, requestId?: string) {
    super(
      `Content filtered by ${filterType} filter for provider ${providerId}`,
      providerId,
      requestId
    );
    this.name = 'ContentFilterError';
    this.filterType = filterType;
    this.content = content;
    Object.setPrototypeOf(this, ContentFilterError.prototype);
  }
}

/**
 * Network error
 */
export class NetworkError extends LLMError {
  public readonly statusCode?: number;
  public readonly response?: any;
  
  constructor(
    providerId: string,
    message: string,
    statusCode?: number,
    response?: any,
    requestId?: string
  ) {
    super(`Network error for provider ${providerId}: ${message}`, providerId, requestId);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.response = response;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends LLMError {
  public readonly timeout: number;
  
  constructor(providerId: string, timeout: number, requestId?: string) {
    super(`Request timeout after ${timeout}ms for provider ${providerId}`, providerId, requestId);
    this.name = 'TimeoutError';
    this.timeout = timeout;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Stream error
 */
export class StreamError extends LLMError {
  public readonly streamId?: string;
  
  constructor(providerId: string, message: string, streamId?: string, requestId?: string) {
    super(`Stream error for provider ${providerId}: ${message}`, providerId, requestId);
    this.name = 'StreamError';
    this.streamId = streamId;
    Object.setPrototypeOf(this, StreamError.prototype);
  }
}

/**
 * Circuit breaker error
 */
export class CircuitOpenError extends LLMError {
  public readonly retryAfter?: number;
  
  constructor(providerId: string, retryAfter?: number) {
    super(`Circuit breaker is open for provider ${providerId}`, providerId);
    this.name = 'CircuitOpenError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, CircuitOpenError.prototype);
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends LLMError {
  public readonly configKey?: string;
  
  constructor(providerId: string, message: string, configKey?: string) {
    super(`Configuration error for provider ${providerId}: ${message}`, providerId);
    this.name = 'ConfigurationError';
    this.configKey = configKey;
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Function calling error
 */
export class FunctionCallError extends LLMError {
  public readonly functionName: string;
  public readonly functionError?: string;
  
  constructor(
    providerId: string,
    functionName: string,
    message: string,
    functionError?: string,
    requestId?: string
  ) {
    super(`Function call error for ${functionName} on provider ${providerId}: ${message}`, providerId, requestId);
    this.name = 'FunctionCallError';
    this.functionName = functionName;
    this.functionError = functionError;
    Object.setPrototypeOf(this, FunctionCallError.prototype);
  }
}

/**
 * Token limit exceeded error
 */
export class TokenLimitExceededError extends LLMError {
  public readonly tokenLimit: number;
  public readonly tokensUsed: number;
  
  constructor(
    providerId: string,
    tokenLimit: number,
    tokensUsed: number,
    requestId?: string
  ) {
    super(
      `Token limit exceeded for provider ${providerId}: ${tokensUsed}/${tokenLimit} tokens`,
      providerId,
      requestId
    );
    this.name = 'TokenLimitExceededError';
    this.tokenLimit = tokenLimit;
    this.tokensUsed = tokensUsed;
    Object.setPrototypeOf(this, TokenLimitExceededError.prototype);
  }
}

/**
 * Cost limit exceeded error
 */
export class CostLimitExceededError extends LLMError {
  public readonly costLimit: number;
  public readonly currentCost: number;
  
  constructor(
    providerId: string,
    costLimit: number,
    currentCost: number,
    requestId?: string
  ) {
    super(
      `Cost limit exceeded for provider ${providerId}: $${currentCost}/$${costLimit}`,
      providerId,
      requestId
    );
    this.name = 'CostLimitExceededError';
    this.costLimit = costLimit;
    this.currentCost = currentCost;
    Object.setPrototypeOf(this, CostLimitExceededError.prototype);
  }
}

/**
 * Provider-specific error for OpenAI
 */
export class OpenAIError extends LLMError {
  public readonly errorType: string;
  public readonly errorCode?: string;
  
  constructor(
    message: string,
    errorType: string,
    errorCode?: string,
    requestId?: string
  ) {
    super(`OpenAI error (${errorType}): ${message}`, 'openai', requestId);
    this.name = 'OpenAIError';
    this.errorType = errorType;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, OpenAIError.prototype);
  }
}

/**
 * Provider-specific error for Anthropic
 */
export class AnthropicError extends LLMError {
  public readonly errorType: string;
  
  constructor(message: string, errorType: string, requestId?: string) {
    super(`Anthropic error (${errorType}): ${message}`, 'anthropic', requestId);
    this.name = 'AnthropicError';
    this.errorType = errorType;
    Object.setPrototypeOf(this, AnthropicError.prototype);
  }
}

/**
 * Provider-specific error for Hugging Face
 */
export class HuggingFaceError extends LLMError {
  public readonly errorType: string;
  public readonly estimatedTime?: number;
  
  constructor(
    message: string,
    errorType: string,
    estimatedTime?: number,
    requestId?: string
  ) {
    super(`Hugging Face error (${errorType}): ${message}`, 'huggingface', requestId);
    this.name = 'HuggingFaceError';
    this.errorType = errorType;
    this.estimatedTime = estimatedTime;
    Object.setPrototypeOf(this, HuggingFaceError.prototype);
  }
}

/**
 * Provider-specific error for Sentient
 */
export class SentientError extends LLMError {
  public readonly errorType: string;
  public readonly modelVariant?: string;
  
  constructor(
    message: string,
    errorType: string,
    modelVariant?: string,
    requestId?: string
  ) {
    super(`Sentient error (${errorType}): ${message}`, 'sentient', requestId);
    this.name = 'SentientError';
    this.errorType = errorType;
    this.modelVariant = modelVariant;
    Object.setPrototypeOf(this, SentientError.prototype);
  }
}

/**
 * Error utilities
 */
export class ErrorUtils {
  /**
   * Check if error is retryable
   */
  static isRetryable(error: Error): boolean {
    if (error instanceof RateLimitError) return true;
    if (error instanceof NetworkError) return error.statusCode !== 401 && error.statusCode !== 403;
    if (error instanceof TimeoutError) return true;
    if (error instanceof ProviderUnavailableError) return true;
    
    return false;
  }
  
  /**
   * Get retry delay for error
   */
  static getRetryDelay(error: Error): number | null {
    if (error instanceof RateLimitError && error.retryAfter) {
      return error.retryAfter * 1000; // Convert to milliseconds
    }
    
    if (error instanceof ProviderUnavailableError && error.retryAfter) {
      return error.retryAfter * 1000;
    }
    
    if (error instanceof CircuitOpenError && error.retryAfter) {
      return error.retryAfter * 1000;
    }
    
    return null;
  }
  
  /**
   * Extract error details for logging
   */
  static extractErrorDetails(error: Error): Record<string, any> {
    const details: Record<string, any> = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
    
    if (error instanceof LLMError) {
      details.providerId = error.providerId;
      details.requestId = error.requestId;
      details.metadata = error.metadata;
    }
    
    if (error instanceof RateLimitError) {
      details.limitType = error.limitType;
      details.limit = error.limit;
      details.remaining = error.remaining;
      details.retryAfter = error.retryAfter;
    }
    
    if (error instanceof NetworkError) {
      details.statusCode = error.statusCode;
      details.response = error.response;
    }
    
    if (error instanceof TimeoutError) {
      details.timeout = error.timeout;
    }
    
    return details;
  }
  
  /**
   * Create user-friendly error message
   */
  static createUserFriendlyMessage(error: Error): string {
    if (error instanceof AuthenticationError) {
      return 'Authentication failed. Please check your API credentials.';
    }
    
    if (error instanceof RateLimitError) {
      const retryMessage = error.retryAfter 
        ? ` Please retry after ${error.retryAfter} seconds.`
        : ' Please retry later.';
      return `Rate limit exceeded.${retryMessage}`;
    }
    
    if (error instanceof ModelNotFoundError) {
      return `The requested model (${error.model}) is not available.`;
    }
    
    if (error instanceof TimeoutError) {
      return 'Request timed out. Please try again.';
    }
    
    if (error instanceof NetworkError) {
      if (error.statusCode === 503) {
        return 'Service is temporarily unavailable. Please try again later.';
      }
      return 'Network error occurred. Please check your connection and try again.';
    }
    
    if (error instanceof ContentFilterError) {
      return 'Your request was blocked by content filtering. Please modify your input.';
    }
    
    if (error instanceof TokenLimitExceededError) {
      return `Request exceeded token limit (${error.tokenLimit}). Please shorten your input.`;
    }
    
    if (error instanceof ProviderUnavailableError) {
      return 'AI service is temporarily unavailable. Please try again later.';
    }
    
    return 'An unexpected error occurred. Please try again.';
  }
  
  /**
   * Convert generic error to LLM error
   */
  static toLLMError(
    error: Error,
    providerId: string,
    requestId?: string
  ): LLMError {
    if (error instanceof LLMError) {
      return error;
    }
    
    // Handle common error patterns
    if (error.message.includes('timeout')) {
      return new TimeoutError(providerId, 30000, requestId);
    }
    
    if (error.message.includes('rate limit') || error.message.includes('quota')) {
      return new RateLimitError(providerId, 'requests', 0, 0);
    }
    
    if (error.message.includes('unauthorized') || error.message.includes('invalid api key')) {
      return new AuthenticationError(providerId);
    }
    
    if (error.message.includes('model') && error.message.includes('not found')) {
      return new ModelNotFoundError(providerId, 'unknown');
    }
    
    // Generic network error
    return new NetworkError(providerId, error.message, undefined, undefined, requestId);
  }
}