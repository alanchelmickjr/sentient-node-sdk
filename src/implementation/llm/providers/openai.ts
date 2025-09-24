/**
 * OpenAI Provider Implementation
 * 
 * Production-ready OpenAI LLM provider with streaming support, comprehensive
 * error handling, and seamless integration with the Sentient framework.
 * 
 * @module sentient-agent-framework/implementation/llm/providers/openai
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';

// OpenAI API types
interface OpenAICompletionRequest {
  model: string;
  messages: any[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  seed?: number;
  response_format?: { type: string; json_schema?: any };
  functions?: any[];
  function_call?: string | { name: string };
  tools?: any[];
  tool_choice?: string | { type: string; function: { name: string } };
}

interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      function_call?: { name: string; arguments: string };
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string | null;
    logprobs?: {
      content?: Array<{ top_logprobs?: Record<string, number> }>;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      function_call?: { name?: string; arguments?: string };
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: string | null;
    logprobs?: any;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// OpenAI client implementation
class OpenAIClient {
  private httpClient: AxiosInstance;
  
  constructor(config: { apiKey: string; baseURL?: string; organization?: string; timeout?: number }) {
    this.httpClient = axios.create({
      baseURL: config.baseURL || 'https://api.openai.com/v1',
      timeout: config.timeout || 60000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(config.organization && { 'OpenAI-Organization': config.organization })
      }
    });
  }
  
  // Chat completions interface
  chat = {
    completions: {
      create: async (params: OpenAICompletionRequest): Promise<OpenAICompletionResponse> => {
        if (params.stream) {
          throw new Error('Use createStream for streaming requests');
        }
        const response = await this.httpClient.post('/chat/completions', params);
        return response.data;
      },
      
      createStream: async (params: OpenAICompletionRequest): Promise<AsyncIterable<OpenAIStreamChunk>> => {
        const response = await this.httpClient.post('/chat/completions', params, {
          responseType: 'stream'
        });
        
        return this.processStream(response.data);
      }
    }
  };
  
  // Models interface
  models = {
    list: async (): Promise<any> => {
      const response = await this.httpClient.get('/models');
      return response.data;
    },
    
    retrieve: async (model: string): Promise<any> => {
      const response = await this.httpClient.get(`/models/${model}`);
      return response.data;
    }
  };
  
  private async *processStream(stream: any): AsyncIterable<OpenAIStreamChunk> {
    let buffer = '';
    
    for await (const chunk of stream) {
      buffer += chunk.toString();
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data.trim() === '[DONE]') return;
          
          try {
            const parsed = JSON.parse(data) as OpenAIStreamChunk;
            yield parsed;
          } catch (error) {
            console.warn('Failed to parse streaming chunk:', data);
          }
        }
      }
    }
  }
}

// Custom OpenAI Error class
class OpenAIAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public type?: string,
    public code?: string,
    public headers?: any
  ) {
    super(message);
    this.name = 'OpenAIAPIError';
  }
}
import { BaseLLMProvider, ProviderCapabilities, ProviderStatus } from '../../../interface/llm/provider';
import { 
  LLMRequest, 
  LLMStreamChunk, 
  ChatMessage, 
  ChatRole, 
  FinishReason,
  RequestUtils 
} from '../../../interface/llm/request';
import { LLMResponse, ResponseUtils } from '../../../interface/llm/response';
import { 
  OpenAIProviderConfig, 
  ModelInfo, 
  ModelCapability, 
  ModelPricing,
  ConfigUtils 
} from '../../../interface/llm/config';
import { ProviderHealthStatus, MetricsUtils } from '../../../interface/llm/metrics';
import { 
  OpenAIError, 
  NetworkError, 
  TimeoutError, 
  RateLimitError, 
  AuthenticationError,
  ModelNotFoundError,
  ErrorUtils 
} from '../../../interface/llm/exceptions';

/**
 * OpenAI model definitions with capabilities and pricing
 */
const OPENAI_MODELS: ModelInfo[] = [
  {
    name: 'gpt-4-turbo-preview',
    displayName: 'GPT-4 Turbo Preview',
    description: 'Latest GPT-4 model with improved instruction following',
    version: '2024-01-25',
    family: 'gpt-4',
    capabilities: {
      maxContextLength: 128000,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsToolCalling: true,
      supportsVision: false,
      supportsJsonMode: true,
      supportsStreaming: true,
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
      trainingDataCutoff: '2023-12',
      specialCapabilities: ['reasoning', 'analysis', 'code-generation']
    },
    pricing: {
      inputCost: 0.00001,  // $0.01 per 1K tokens
      outputCost: 0.00003, // $0.03 per 1K tokens
      currency: 'USD'
    }
  },
  {
    name: 'gpt-4',
    displayName: 'GPT-4',
    description: 'Large multimodal model with broad general knowledge',
    version: '2023-06-13',
    family: 'gpt-4',
    capabilities: {
      maxContextLength: 8192,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsToolCalling: true,
      supportsVision: false,
      supportsJsonMode: false,
      supportsStreaming: true,
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
      trainingDataCutoff: '2023-09',
      specialCapabilities: ['reasoning', 'analysis', 'code-generation']
    },
    pricing: {
      inputCost: 0.00003,  // $0.03 per 1K tokens
      outputCost: 0.00006, // $0.06 per 1K tokens
      currency: 'USD'
    }
  },
  {
    name: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    description: 'Fast, inexpensive model for simple tasks',
    version: '2023-11-06',
    family: 'gpt-3.5',
    capabilities: {
      maxContextLength: 16384,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsToolCalling: true,
      supportsVision: false,
      supportsJsonMode: true,
      supportsStreaming: true,
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
      trainingDataCutoff: '2023-09',
      specialCapabilities: ['conversation', 'simple-reasoning']
    },
    pricing: {
      inputCost: 0.0000005,  // $0.0005 per 1K tokens
      outputCost: 0.0000015, // $0.0015 per 1K tokens
      currency: 'USD'
    }
  }
];

/**
 * OpenAI LLM Provider Implementation
 */
export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAIClient;
  private rateLimitTracker: Map<string, { count: number; resetTime: number }> = new Map();
  
  constructor(config: OpenAIProviderConfig) {
    super(
      'openai',
      'OpenAI',
      '1.0.0',
      config,
      OpenAIProvider.createCapabilities()
    );
    
    this.client = new OpenAIClient({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      organization: config.organization,
      timeout: config.timeout
    });
  }
  
  /**
   * Generate a complete response from OpenAI
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // Validate request
      const validation = RequestUtils.validateRequest(request);
      if (!validation.isValid) {
        throw new OpenAIError(
          `Request validation failed: ${validation.errors.join(', ')}`,
          'validation_error',
          undefined,
          request.metadata.requestId
        );
      }
      
      // Check rate limits
      this.checkRateLimit();
      
      // Transform request to OpenAI format
      const openAIRequest = this.transformRequest(request);
      
      // Make API call
      const response = await this.client.chat.completions.create(openAIRequest);
      
      // Transform response
      const transformedResponse = this.transformResponse(response, request);
      
      // Update metrics
      const duration = Date.now() - startTime;
      const tokens = {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0
      };
      const cost = this.calculateCost(request.model, tokens);
      
      this.updateMetrics('generate', duration, true, tokens);
      
      // Update rate limit tracking
      this.updateRateLimit(response);
      
      return transformedResponse;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics('generate', duration, false);
      
      // Transform and re-throw error
      throw this.transformError(error, request.metadata.requestId);
    }
  }
  
  /**
   * Stream generate responses from OpenAI
   */
  async *streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const startTime = Date.now();
    let success = false;
    let totalTokens = { input: 0, output: 0 };
    
    try {
      // Validate request
      const validation = RequestUtils.validateRequest(request);
      if (!validation.isValid) {
        throw new OpenAIError(
          `Request validation failed: ${validation.errors.join(', ')}`,
          'validation_error',
          undefined,
          request.metadata.requestId
        );
      }
      
      // Check rate limits
      this.checkRateLimit();
      
      // Transform request to OpenAI streaming format
      const openAIRequest = this.transformRequest({ ...request, stream: true });
      
      // Create streaming request
      const stream = await this.client.chat.completions.createStream(openAIRequest);
      
      let chunkIndex = 0;
      
      for await (const chunk of stream) {
        try {
          const transformedChunk = this.transformStreamChunk(chunk, request, chunkIndex++);
          
          // Track token usage
          if (chunk.usage) {
            totalTokens.input = chunk.usage.prompt_tokens || 0;
            totalTokens.output = chunk.usage.completion_tokens || 0;
          }
          
          yield transformedChunk;
          
        } catch (chunkError) {
          // Log chunk error but continue stream
          console.warn('Error processing stream chunk:', chunkError);
          continue;
        }
      }
      
      success = true;
      
    } catch (error) {
      const transformedError = this.transformError(error, request.metadata.requestId);
      throw transformedError;
      
    } finally {
      // Update metrics
      const duration = Date.now() - startTime;
      const cost = this.calculateCost(request.model, totalTokens);
      this.updateMetrics('stream', duration, success, totalTokens);
    }
  }
  
  /**
   * Initialize the provider
   */
  protected async performInitialization(): Promise<void> {
    try {
      // Test API connectivity
      await this.client.models.list();
      
      // Initialize rate limit tracking
      this.rateLimitTracker.clear();
      
      console.log('OpenAI provider initialized successfully');
    } catch (error) {
      throw new OpenAIError(
        `Failed to initialize OpenAI provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'initialization_error'
      );
    }
  }
  
  /**
   * Perform health check
   */
  protected async performHealthCheck(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Simple API call to test connectivity
      await this.client.models.retrieve('gpt-3.5-turbo');
      
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: true,
        status: ProviderStatus.READY,
        timestamp: new Date(),
        responseTime,
        details: {
          connectivity: true,
          authentication: true,
          rateLimiting: this.getRateLimitStatus(),
          modelAvailability: true
        }
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: false,
        status: ProviderStatus.UNAVAILABLE,
        timestamp: new Date(),
        responseTime,
        details: {
          connectivity: false,
          authentication: error instanceof AuthenticationError,
          rateLimiting: this.getRateLimitStatus(),
          modelAvailability: false
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Shutdown the provider
   */
  protected async performShutdown(): Promise<void> {
    // Clear rate limit tracking
    this.rateLimitTracker.clear();
    
    console.log('OpenAI provider shut down');
  }
  
  /**
   * Apply configuration changes
   */
  protected async applyConfigChanges(
    oldConfig: OpenAIProviderConfig, 
    newConfig: OpenAIProviderConfig
  ): Promise<void> {
    // Recreate client if API key or base URL changed
    if (oldConfig.apiKey !== newConfig.apiKey ||
        oldConfig.baseUrl !== newConfig.baseUrl ||
        oldConfig.organization !== newConfig.organization) {
      
      this.client = new OpenAIClient({
        apiKey: newConfig.apiKey,
        baseURL: newConfig.baseUrl,
        organization: newConfig.organization,
        timeout: newConfig.timeout
      });
    }
  }
  
  /**
   * Perform lightweight ping
   */
  protected async performPing(): Promise<void> {
    await this.client.models.retrieve('gpt-3.5-turbo');
  }
  
  // Private helper methods
  
  private createHttpAgent(): any {
    const { connectionPool } = this._config;
    
    // Create HTTP agent with connection pooling
    const Agent = require('https').Agent;
    return new Agent({
      keepAlive: true,
      maxSockets: connectionPool.maxSockets,
      maxFreeSockets: connectionPool.maxFreeSockets,
      timeout: connectionPool.timeout,
      keepAliveMsecs: connectionPool.keepAliveMsecs
    });
  }
  
  private transformRequest(request: LLMRequest): OpenAICompletionRequest {
    const messages = request.messages.map(msg => this.transformMessage(msg));
    
    const params: OpenAICompletionRequest = {
      model: request.model,
      messages,
      stream: request.stream || false,
      max_tokens: request.parameters.maxTokens,
      temperature: request.parameters.temperature,
      top_p: request.parameters.topP,
      frequency_penalty: request.parameters.frequencyPenalty,
      presence_penalty: request.parameters.presencePenalty,
      stop: request.parameters.stopSequences,
      seed: request.parameters.seed
    };
    
    // Add response format if specified
    if (request.parameters.responseFormat) {
      params.response_format = {
        type: request.parameters.responseFormat.type as any
      };
      
      if (request.parameters.responseFormat.schema) {
        (params.response_format as any).json_schema = request.parameters.responseFormat.schema;
      }
    }
    
    // Add function calling if specified
    if (request.parameters.functions && request.parameters.functions.length > 0) {
      params.functions = request.parameters.functions.map(fn => ({
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters
      }));
      
      if (request.parameters.functionCall) {
        if (typeof request.parameters.functionCall === 'string') {
          params.function_call = request.parameters.functionCall;
        } else {
          params.function_call = { name: request.parameters.functionCall.name };
        }
      }
    }
    
    // Add tool calling if specified
    if (request.parameters.tools && request.parameters.tools.length > 0) {
      params.tools = request.parameters.tools.map(tool => ({
        type: tool.type,
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters
        }
      }));
      
      if (request.parameters.toolChoice) {
        if (typeof request.parameters.toolChoice === 'string') {
          params.tool_choice = request.parameters.toolChoice;
        } else {
          params.tool_choice = {
            type: request.parameters.toolChoice.type,
            function: { name: request.parameters.toolChoice.function.name }
          };
        }
      }
    }
    
    return params;
  }
  
  private transformMessage(message: ChatMessage): any {
    const baseMessage: any = {
      role: message.role,
      content: message.content
    };
    
    if (message.name) {
      baseMessage.name = message.name;
    }
    
    if (message.function_call) {
      baseMessage.function_call = message.function_call;
    }
    
    if (message.tool_calls) {
      baseMessage.tool_calls = message.tool_calls;
    }
    
    if (message.tool_call_id) {
      baseMessage.tool_call_id = message.tool_call_id;
    }
    
    return baseMessage;
  }
  
  private transformResponse(
    response: OpenAICompletionResponse,
    originalRequest: LLMRequest
  ): LLMResponse {
    const choice = response.choices[0];
    
    const transformedChoice = {
      index: choice.index,
      message: {
        role: choice.message.role as ChatRole,
        content: choice.message.content,
        function_call: choice.message.function_call ? {
          name: choice.message.function_call.name,
          arguments: choice.message.function_call.arguments,
          parsedArguments: this.parseArguments(choice.message.function_call.arguments)
        } : undefined,
        tool_calls: choice.message.tool_calls?.map((tc: any) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
            parsedArguments: this.parseArguments(tc.function.arguments)
          }
        }))
      },
      finishReason: this.transformFinishReason(choice.finish_reason),
      logprobs: choice.logprobs ? {
        tokens: [],
        token_logprobs: [],
        top_logprobs: choice.logprobs.content?.map((c: any) => c.top_logprobs || {}) || []
      } : undefined
    };
    
    return {
      id: response.id,
      object: response.object,
      created: response.created,
      model: response.model,
      choices: [transformedChoice],
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      systemFingerprint: response.system_fingerprint,
      metadata: {
        processingTime: Date.now() - originalRequest.metadata.timestamp.getTime(),
        provider: this.providerId,
        requestId: originalRequest.metadata.requestId
      }
    };
  }
  
  private transformStreamChunk(
    chunk: OpenAIStreamChunk,
    originalRequest: LLMRequest,
    index: number
  ): LLMStreamChunk {
    const choice = chunk.choices[0];
    const delta = choice?.delta;
    
    return {
      content: delta?.content || '',
      model: chunk.model,
      finishReason: choice?.finish_reason ? this.transformFinishReason(choice.finish_reason) : null,
      usage: chunk.usage ? {
        promptTokens: chunk.usage.prompt_tokens || 0,
        completionTokens: chunk.usage.completion_tokens || 0,
        totalTokens: chunk.usage.total_tokens || 0
      } : undefined,
      functionCall: delta?.function_call ? {
        name: delta.function_call.name,
        arguments: delta.function_call.arguments
      } : undefined,
      toolCalls: delta?.tool_calls?.map((tc: any) => ({
        id: tc.id,
        type: tc.type,
        function: tc.function ? {
          name: tc.function.name,
          arguments: tc.function.arguments
        } : undefined
      })),
      index,
      delta: {
        role: delta?.role as ChatRole,
        content: delta?.content,
        function_call: delta?.function_call,
        tool_calls: delta?.tool_calls?.map((tc: any) => ({
          index: tc.index,
          id: tc.id,
          type: tc.type,
          function: tc.function
        }))
      },
      timestamp: new Date(),
      metadata: {
        requestId: originalRequest.metadata.requestId,
        chunkIndex: index
      }
    };
  }
  
  private transformFinishReason(reason: string | null): FinishReason {
    switch (reason) {
      case 'stop': return FinishReason.STOP;
      case 'length': return FinishReason.LENGTH;
      case 'function_call': return FinishReason.FUNCTION_CALL;
      case 'tool_calls': return FinishReason.TOOL_CALLS;
      case 'content_filter': return FinishReason.CONTENT_FILTER;
      default: return FinishReason.STOP;
    }
  }
  
  private parseArguments(args: string): any {
    try {
      return JSON.parse(args);
    } catch {
      return null;
    }
  }
  
  private transformError(error: any, requestId?: string): Error {
    if (error instanceof OpenAIAPIError) {
      if (error.status === 401) {
        return new AuthenticationError(this.providerId, error.message);
      } else if (error.status === 429) {
        return new RateLimitError(
          this.providerId,
          'requests',
          0,
          0,
          this.extractRetryAfter(error)
        );
      } else if (error.status === 404 && error.message.includes('model')) {
        return new ModelNotFoundError(this.providerId, 'unknown');
      } else if (error.status && error.status >= 500) {
        return new NetworkError(this.providerId, error.message, error.status, error, requestId);
      }
      
      return new OpenAIError(error.message, error.type || 'api_error', error.code, requestId);
    }
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new TimeoutError(this.providerId, this._config.timeout, requestId);
    }
    
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      return new NetworkError(this.providerId, error.message, undefined, error, requestId);
    }
    
    return ErrorUtils.toLLMError(error, this.providerId, requestId);
  }
  
  private extractRetryAfter(error: any): number | undefined {
    const retryAfter = error.headers?.['retry-after'];
    return retryAfter ? parseInt(retryAfter, 10) : undefined;
  }
  
  private checkRateLimit(): void {
    // Simple rate limiting check - in production, this would be more sophisticated
    const now = Date.now();
    const windowKey = Math.floor(now / 60000).toString(); // 1-minute windows
    
    const current = this.rateLimitTracker.get(windowKey) || { count: 0, resetTime: now + 60000 };
    
    if (current.count >= this._config.rateLimit.requestsPerMinute) {
      throw new RateLimitError(
        this.providerId,
        'requests',
        this._config.rateLimit.requestsPerMinute,
        0,
        Math.ceil((current.resetTime - now) / 1000)
      );
    }
    
    current.count++;
    this.rateLimitTracker.set(windowKey, current);
  }
  
  private updateRateLimit(response: any): void {
    // Update rate limit tracking based on response headers
    const headers = response.headers || {};
    
    if (headers['x-ratelimit-remaining-requests']) {
      // OpenAI provides rate limit info in headers
      console.debug('Rate limit remaining:', headers['x-ratelimit-remaining-requests']);
    }
  }
  
  private getRateLimitStatus(): boolean {
    const now = Date.now();
    const windowKey = Math.floor(now / 60000).toString();
    const current = this.rateLimitTracker.get(windowKey);
    
    if (!current) return true;
    
    return current.count < this._config.rateLimit.requestsPerMinute;
  }
  
  private calculateCost(model: string, tokens: { input: number; output: number }): number {
    const modelInfo = OPENAI_MODELS.find(m => m.name === model);
    if (!modelInfo) return 0;
    
    return (tokens.input * modelInfo.pricing.inputCost) + 
           (tokens.output * modelInfo.pricing.outputCost);
  }
  
  private static createCapabilities(): ProviderCapabilities {
    return {
      models: OPENAI_MODELS,
      maxTokens: 128000,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsImageInput: false, // Will be true for GPT-4V models
      supportsSystemPrompts: true,
      supportsMultimodal: false, // Will be true for GPT-4V models
      rateLimits: {
        requestsPerMinute: 500,
        tokensPerMinute: 80000,
        concurrentRequests: 10
      }
    };
  }
}

/**
 * OpenAI provider factory
 */
export class OpenAIProviderFactory {
  static create(config: Partial<OpenAIProviderConfig>): OpenAIProvider {
    const fullConfig = ConfigUtils.createOpenAIConfig(
      config.apiKey || process.env.OPENAI_API_KEY || '',
      config
    );
    
    return new OpenAIProvider(fullConfig);
  }
  
  static validateConfig(config: OpenAIProviderConfig): boolean {
    const validation = ConfigUtils.validateConfig(config);
    return validation.isValid;
  }
  
  static getDefaultConfig(): Partial<OpenAIProviderConfig> {
    return ConfigUtils.createOpenAIConfig('');
  }
}