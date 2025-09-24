/**
 * LLM Request and Streaming Interfaces
 * 
 * Defines request structures and streaming chunk formats for LLM providers.
 * 
 * @module sentient-agent-framework/interface/llm/request
 */

/**
 * Chat message role enumeration
 */
export enum ChatRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  FUNCTION = 'function',
  TOOL = 'tool'
}

/**
 * Function definition for function calling
 */
export interface FunctionDefinition {
  /** Function name */
  name: string;
  
  /** Function description */
  description?: string;
  
  /** JSON schema for function parameters */
  parameters: Record<string, any>;
  
  /** Whether this function is required */
  required?: boolean;
}

/**
 * Tool definition for tool calling
 */
export interface ToolDefinition {
  /** Tool type */
  type: 'function';
  
  /** Function definition */
  function: FunctionDefinition;
}

/**
 * Chat message content (can be text or multimodal)
 */
export interface MessageContent {
  /** Content type */
  type: 'text' | 'image_url' | 'image_base64';
  
  /** Text content */
  text?: string;
  
  /** Image URL for image_url type */
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
  
  /** Base64 image data for image_base64 type */
  image_base64?: {
    data: string;
    media_type: string;
  };
}

/**
 * Chat message interface supporting multimodal content
 */
export interface ChatMessage {
  /** Message role */
  role: ChatRole;
  
  /** Message content (string for simple text, array for multimodal) */
  content: string | MessageContent[];
  
  /** Function name (for function role) */
  name?: string;
  
  /** Function call data */
  function_call?: {
    name: string;
    arguments: string;
  };
  
  /** Tool calls data */
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  
  /** Tool call ID (for tool role) */
  tool_call_id?: string;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * LLM generation parameters
 */
export interface LLMParameters {
  /** Sampling temperature (0.0 to 2.0) */
  temperature?: number;
  
  /** Maximum tokens to generate */
  maxTokens?: number;
  
  /** Top-p sampling parameter */
  topP?: number;
  
  /** Top-k sampling parameter */
  topK?: number;
  
  /** Frequency penalty (-2.0 to 2.0) */
  frequencyPenalty?: number;
  
  /** Presence penalty (-2.0 to 2.0) */
  presencePenalty?: number;
  
  /** Stop sequences */
  stopSequences?: string[];
  
  /** Random seed for reproducibility */
  seed?: number;
  
  /** Response format specification */
  responseFormat?: {
    type: 'text' | 'json_object' | 'json_schema';
    schema?: Record<string, any>;
  };
  
  /** Function definitions for function calling */
  functions?: FunctionDefinition[];
  
  /** Function call mode */
  functionCall?: 'none' | 'auto' | { name: string };
  
  /** Tool definitions for tool calling */
  tools?: ToolDefinition[];
  
  /** Tool call mode */
  toolChoice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
  
  /** Provider-specific parameters */
  [key: string]: any;
}

/**
 * Request metadata for tracking and context
 */
export interface RequestMetadata {
  /** Session ID for conversation context */
  sessionId?: string;
  
  /** Unique request ID */
  requestId: string;
  
  /** User ID for personalization */
  userId?: string;
  
  /** Request timestamp */
  timestamp: Date;
  
  /** Request priority */
  priority?: 'low' | 'normal' | 'high' | 'critical';
  
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Custom tags for categorization */
  tags?: string[];
  
  /** Custom metadata */
  custom?: Record<string, any>;
}

/**
 * Complete LLM request interface
 */
export interface LLMRequest {
  /** Model identifier */
  model: string;
  
  /** Chat messages */
  messages: ChatMessage[];
  
  /** Generation parameters */
  parameters: LLMParameters;
  
  /** Request metadata */
  metadata: RequestMetadata;
  
  /** Enable streaming response */
  stream?: boolean;
  
  /** Provider-specific options */
  providerOptions?: Record<string, any>;
}

/**
 * Finish reason enumeration for streaming chunks
 */
export enum FinishReason {
  STOP = 'stop',
  LENGTH = 'length',
  FUNCTION_CALL = 'function_call',
  TOOL_CALLS = 'tool_calls',
  CONTENT_FILTER = 'content_filter',
  ERROR = 'error'
}

/**
 * Token usage information
 */
export interface TokenUsage {
  /** Input tokens consumed */
  promptTokens: number;
  
  /** Output tokens generated */
  completionTokens: number;
  
  /** Total tokens */
  totalTokens: number;
  
  /** Cached tokens (if supported) */
  cachedTokens?: number;
}

/**
 * Streaming chunk from LLM provider
 */
export interface LLMStreamChunk {
  /** Chunk content */
  content: string;
  
  /** Model used for generation */
  model: string;
  
  /** Finish reason (null if not finished) */
  finishReason: FinishReason | null;
  
  /** Token usage (may be partial or final) */
  usage?: Partial<TokenUsage>;
  
  /** Function call data (for streaming function calls) */
  functionCall?: {
    name?: string;
    arguments?: string;
  };
  
  /** Tool calls data (for streaming tool calls) */
  toolCalls?: Array<{
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
  
  /** Chunk index in the stream */
  index?: number;
  
  /** Delta information for partial updates */
  delta?: {
    role?: ChatRole;
    content?: string;
    function_call?: {
      name?: string;
      arguments?: string;
    };
    tool_calls?: Array<{
      index?: number;
      id?: string;
      type?: 'function';
      function?: {
        name?: string;
        arguments?: string;
      };
    }>;
  };
  
  /** Chunk timestamp */
  timestamp: Date;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Request validation result
 */
export interface RequestValidation {
  /** Whether the request is valid */
  isValid: boolean;
  
  /** Validation errors */
  errors: string[];
  
  /** Warnings (non-blocking) */
  warnings: string[];
  
  /** Normalized request */
  normalized?: LLMRequest;
}

/**
 * Request transformation interface for provider compatibility
 */
export interface RequestTransformer {
  /**
   * Transform a generic LLM request to provider-specific format
   */
  transform(request: LLMRequest): any;
  
  /**
   * Validate request compatibility with provider
   */
  validate(request: LLMRequest): RequestValidation;
  
  /**
   * Get supported models for this transformer
   */
  getSupportedModels(): string[];
}

/**
 * Utility functions for request handling
 */
export class RequestUtils {
  /**
   * Create a simple text request
   */
  static createTextRequest(
    model: string,
    prompt: string,
    parameters: Partial<LLMParameters> = {},
    metadata: Partial<RequestMetadata> = {}
  ): LLMRequest {
    return {
      model,
      messages: [{
        role: ChatRole.USER,
        content: prompt
      }],
      parameters: {
        temperature: 0.7,
        maxTokens: 1000,
        ...parameters
      },
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        ...metadata
      }
    };
  }
  
  /**
   * Create a conversation request
   */
  static createConversationRequest(
    model: string,
    messages: ChatMessage[],
    parameters: Partial<LLMParameters> = {},
    metadata: Partial<RequestMetadata> = {}
  ): LLMRequest {
    return {
      model,
      messages,
      parameters: {
        temperature: 0.7,
        maxTokens: 1000,
        ...parameters
      },
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        ...metadata
      }
    };
  }
  
  /**
   * Estimate token count for a request (rough approximation)
   */
  static estimateTokenCount(request: LLMRequest): number {
    let totalTokens = 0;
    
    for (const message of request.messages) {
      if (typeof message.content === 'string') {
        // Rough approximation: 4 characters per token
        totalTokens += Math.ceil(message.content.length / 4);
      } else if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text' && content.text) {
            totalTokens += Math.ceil(content.text.length / 4);
          } else if (content.type === 'image_url' || content.type === 'image_base64') {
            // Images typically cost more tokens
            totalTokens += 255; // Standard image token cost
          }
        }
      }
    }
    
    return totalTokens;
  }
  
  /**
   * Validate request structure
   */
  static validateRequest(request: LLMRequest): RequestValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!request.model || typeof request.model !== 'string') {
      errors.push('Model is required and must be a string');
    }
    
    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      errors.push('Messages array is required and must not be empty');
    }
    
    if (!request.metadata || !request.metadata.requestId) {
      errors.push('Metadata with requestId is required');
    }
    
    // Validate messages
    if (request.messages) {
      for (let i = 0; i < request.messages.length; i++) {
        const message = request.messages[i];
        if (!message.role || !Object.values(ChatRole).includes(message.role)) {
          errors.push(`Message ${i}: Invalid role`);
        }
        
        if (!message.content || (typeof message.content !== 'string' && !Array.isArray(message.content))) {
          errors.push(`Message ${i}: Content is required`);
        }
      }
    }
    
    // Check token limits
    const estimatedTokens = RequestUtils.estimateTokenCount(request);
    if (estimatedTokens > 100000) {
      warnings.push('Request may exceed token limits for some providers');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}