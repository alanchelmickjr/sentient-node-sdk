/**
 * LLM Response Interfaces
 * 
 * Defines response structures and formats returned by LLM providers.
 * 
 * @module sentient-agent-framework/interface/llm/response
 */

import { FinishReason, TokenUsage, ChatRole } from './request';

/**
 * Function call response
 */
export interface FunctionCall {
  /** Function name */
  name: string;
  
  /** Function arguments as JSON string */
  arguments: string;
  
  /** Parsed arguments (if successfully parsed) */
  parsedArguments?: Record<string, any>;
}

/**
 * Tool call response
 */
export interface ToolCall {
  /** Tool call ID */
  id: string;
  
  /** Tool type */
  type: 'function';
  
  /** Function call details */
  function: FunctionCall;
}

/**
 * Choice in LLM response (for models that return multiple choices)
 */
export interface ResponseChoice {
  /** Choice index */
  index: number;
  
  /** Message content */
  message: {
    role: ChatRole;
    content: string | null;
    function_call?: FunctionCall;
    tool_calls?: ToolCall[];
  };
  
  /** Finish reason for this choice */
  finishReason: FinishReason;
  
  /** Log probabilities (if available) */
  logprobs?: {
    tokens: string[];
    token_logprobs: number[];
    top_logprobs?: Record<string, number>[];
  };
}

/**
 * Complete LLM response
 */
export interface LLMResponse {
  /** Response ID */
  id: string;
  
  /** Object type (typically 'chat.completion') */
  object: string;
  
  /** Creation timestamp */
  created: number;
  
  /** Model used for generation */
  model: string;
  
  /** Response choices */
  choices: ResponseChoice[];
  
  /** Token usage information */
  usage: TokenUsage;
  
  /** System fingerprint for reproducibility */
  systemFingerprint?: string;
  
  /** Response metadata */
  metadata?: {
    /** Processing time in milliseconds */
    processingTime: number;
    
    /** Provider that handled the request */
    provider: string;
    
    /** Request ID that generated this response */
    requestId: string;
    
    /** Whether response was cached */
    cached?: boolean;
    
    /** Custom provider metadata */
    custom?: Record<string, any>;
  };
}

/**
 * Streaming response chunk delta
 */
export interface StreamDelta {
  /** Role (usually only in first chunk) */
  role?: ChatRole;
  
  /** Content delta */
  content?: string;
  
  /** Function call delta */
  function_call?: {
    name?: string;
    arguments?: string;
  };
  
  /** Tool calls delta */
  tool_calls?: Array<{
    index?: number;
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

/**
 * Streaming response choice
 */
export interface StreamChoice {
  /** Choice index */
  index: number;
  
  /** Delta information */
  delta: StreamDelta;
  
  /** Finish reason (null until finished) */
  finishReason: FinishReason | null;
  
  /** Log probabilities (if available) */
  logprobs?: {
    tokens: string[];
    token_logprobs: number[];
    top_logprobs?: Record<string, number>[];
  };
}

/**
 * Streaming response chunk
 */
export interface StreamResponse {
  /** Response ID */
  id: string;
  
  /** Object type (typically 'chat.completion.chunk') */
  object: string;
  
  /** Creation timestamp */
  created: number;
  
  /** Model used for generation */
  model: string;
  
  /** Stream choices */
  choices: StreamChoice[];
  
  /** System fingerprint */
  systemFingerprint?: string;
  
  /** Usage information (typically in final chunk) */
  usage?: TokenUsage;
}

/**
 * Error response from LLM provider
 */
export interface LLMErrorResponse {
  /** Error object */
  error: {
    /** Error message */
    message: string;
    
    /** Error type */
    type: string;
    
    /** Error code */
    code?: string | number;
    
    /** Parameter that caused the error */
    param?: string;
    
    /** Additional error details */
    details?: Record<string, any>;
  };
  
  /** Request ID that caused the error */
  requestId?: string;
  
  /** Provider that generated the error */
  provider?: string;
  
  /** Error timestamp */
  timestamp: Date;
}

/**
 * Response validation result
 */
export interface ResponseValidation {
  /** Whether the response is valid */
  isValid: boolean;
  
  /** Validation errors */
  errors: string[];
  
  /** Warnings (non-blocking) */
  warnings: string[];
  
  /** Normalized response */
  normalized?: LLMResponse;
}

/**
 * Response transformer interface for provider compatibility
 */
export interface ResponseTransformer {
  /**
   * Transform provider-specific response to generic format
   */
  transform(response: any): LLMResponse;
  
  /**
   * Transform provider-specific stream chunk to generic format
   */
  transformChunk(chunk: any): StreamResponse;
  
  /**
   * Validate response format
   */
  validate(response: any): ResponseValidation;
}

/**
 * Response aggregator for combining streaming chunks
 */
export class ResponseAggregator {
  private chunks: StreamResponse[] = [];
  private content: string = '';
  private functionCall?: Partial<FunctionCall>;
  private toolCalls: Map<number, Partial<ToolCall>> = new Map();
  
  /**
   * Add a streaming chunk to the aggregator
   */
  addChunk(chunk: StreamResponse): void {
    this.chunks.push(chunk);
    
    for (const choice of chunk.choices) {
      if (choice.delta.content) {
        this.content += choice.delta.content;
      }
      
      // Aggregate function call
      if (choice.delta.function_call) {
        if (!this.functionCall) {
          this.functionCall = {};
        }
        
        if (choice.delta.function_call.name) {
          this.functionCall.name = choice.delta.function_call.name;
        }
        
        if (choice.delta.function_call.arguments) {
          this.functionCall.arguments = (this.functionCall.arguments || '') + choice.delta.function_call.arguments;
        }
      }
      
      // Aggregate tool calls
      if (choice.delta.tool_calls) {
        for (const toolCall of choice.delta.tool_calls) {
          if (toolCall.index !== undefined) {
            if (!this.toolCalls.has(toolCall.index)) {
              this.toolCalls.set(toolCall.index, { type: 'function', function: { name: '', arguments: '' } });
            }
            
            const existingToolCall = this.toolCalls.get(toolCall.index)!;
            
            if (toolCall.id) {
              existingToolCall.id = toolCall.id;
            }
            
            if (toolCall.function) {
              if (toolCall.function.name) {
                existingToolCall.function!.name = toolCall.function.name;
              }
              
              if (toolCall.function.arguments) {
                existingToolCall.function!.arguments = 
                  (existingToolCall.function!.arguments || '') + toolCall.function.arguments;
              }
            }
          }
        }
      }
    }
  }
  
  /**
   * Get the aggregated response
   */
  getResponse(): Partial<LLMResponse> {
    if (this.chunks.length === 0) {
      throw new Error('No chunks to aggregate');
    }
    
    const firstChunk = this.chunks[0];
    const lastChunk = this.chunks[this.chunks.length - 1];
    
    // Find the final chunk with usage information
    const usageChunk = this.chunks.reverse().find(chunk => chunk.usage);
    
    const choice: ResponseChoice = {
      index: 0,
      message: {
        role: ChatRole.ASSISTANT,
        content: this.content || null
      },
      finishReason: lastChunk.choices[0]?.finishReason || FinishReason.STOP
    };
    
    // Add function call if present
    if (this.functionCall && this.functionCall.name && this.functionCall.arguments) {
      choice.message.function_call = this.functionCall as FunctionCall;
      
      // Try to parse arguments
      try {
        choice.message.function_call.parsedArguments = JSON.parse(this.functionCall.arguments);
      } catch (error) {
        // Keep unparsed arguments
      }
    }
    
    // Add tool calls if present
    if (this.toolCalls.size > 0) {
      choice.message.tool_calls = Array.from(this.toolCalls.values())
        .filter(tc => tc.id && tc.function?.name && tc.function?.arguments)
        .map(tc => {
          const toolCall = tc as ToolCall;
          
          // Try to parse function arguments
          try {
            toolCall.function.parsedArguments = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            // Keep unparsed arguments
          }
          
          return toolCall;
        });
    }
    
    return {
      id: firstChunk.id,
      object: 'chat.completion',
      created: firstChunk.created,
      model: firstChunk.model,
      choices: [choice],
      usage: usageChunk?.usage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      systemFingerprint: firstChunk.systemFingerprint
    };
  }
  
  /**
   * Get accumulated content
   */
  getContent(): string {
    return this.content;
  }
  
  /**
   * Get chunk count
   */
  getChunkCount(): number {
    return this.chunks.length;
  }
  
  /**
   * Reset the aggregator
   */
  reset(): void {
    this.chunks = [];
    this.content = '';
    this.functionCall = undefined;
    this.toolCalls.clear();
  }
}

/**
 * Utility functions for response handling
 */
export class ResponseUtils {
  /**
   * Extract text content from response
   */
  static extractText(response: LLMResponse): string {
    return response.choices[0]?.message.content || '';
  }
  
  /**
   * Check if response contains function calls
   */
  static hasFunctionCall(response: LLMResponse): boolean {
    return response.choices[0]?.message.function_call !== undefined;
  }
  
  /**
   * Check if response contains tool calls
   */
  static hasToolCalls(response: LLMResponse): boolean {
    return response.choices[0]?.message.tool_calls !== undefined && 
           response.choices[0].message.tool_calls.length > 0;
  }
  
  /**
   * Get function calls from response
   */
  static getFunctionCalls(response: LLMResponse): FunctionCall[] {
    const functionCall = response.choices[0]?.message.function_call;
    return functionCall ? [functionCall] : [];
  }
  
  /**
   * Get tool calls from response
   */
  static getToolCalls(response: LLMResponse): ToolCall[] {
    return response.choices[0]?.message.tool_calls || [];
  }
  
  /**
   * Calculate response cost (requires pricing information)
   */
  static calculateCost(
    response: LLMResponse, 
    pricing: { input: number; output: number }
  ): number {
    const usage = response.usage;
    return (usage.promptTokens * pricing.input) + (usage.completionTokens * pricing.output);
  }
  
  /**
   * Validate response structure
   */
  static validateResponse(response: any): ResponseValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!response || typeof response !== 'object') {
      errors.push('Response must be an object');
      return { isValid: false, errors, warnings };
    }
    
    if (!response.id || typeof response.id !== 'string') {
      errors.push('Response must have a valid ID');
    }
    
    if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
      errors.push('Response must have at least one choice');
    }
    
    if (!response.usage || typeof response.usage !== 'object') {
      errors.push('Response must include usage information');
    }
    
    // Validate choices
    if (response.choices) {
      for (let i = 0; i < response.choices.length; i++) {
        const choice = response.choices[i];
        
        if (!choice.message || typeof choice.message !== 'object') {
          errors.push(`Choice ${i}: Must have a message object`);
        }
        
        if (choice.message && !choice.message.role) {
          errors.push(`Choice ${i}: Message must have a role`);
        }
        
        if (!choice.finishReason) {
          warnings.push(`Choice ${i}: Missing finish reason`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Create error response
   */
  static createErrorResponse(
    error: Error, 
    requestId?: string, 
    provider?: string
  ): LLMErrorResponse {
    return {
      error: {
        message: error.message,
        type: error.constructor.name,
        details: error instanceof Error ? { stack: error.stack } : undefined
      },
      requestId,
      provider,
      timestamp: new Date()
    };
  }
  
  /**
   * Check if response indicates rate limiting
   */
  static isRateLimited(response: LLMErrorResponse): boolean {
    return response.error.type === 'RateLimitError' ||
           response.error.message.toLowerCase().includes('rate limit') ||
           response.error.message.toLowerCase().includes('quota exceeded');
  }
  
  /**
   * Check if error is retryable
   */
  static isRetryableError(response: LLMErrorResponse): boolean {
    const retryableTypes = [
      'NetworkError',
      'TimeoutError',
      'ServiceUnavailableError',
      'InternalServerError'
    ];
    
    return retryableTypes.includes(response.error.type) ||
           ResponseUtils.isRateLimited(response) ||
           (typeof response.error.code === 'number' && response.error.code >= 500);
  }
}