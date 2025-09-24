/**
 * Sentient Provider Implementation with Dobby Unhinged Optimization
 * 
 * Advanced Sentient AI provider featuring the revolutionary Dobby Unhinged model
 * with personality-driven responses, advanced creativity controls, and real-time
 * optimization for AGI agent development.
 * 
 * @module sentient-agent-framework/implementation/llm/providers/sentient
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
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
  SentientProviderConfig, 
  ModelInfo, 
  ModelCapability, 
  ModelPricing,
  ConfigUtils 
} from '../../../interface/llm/config';
import { ProviderHealthStatus, MetricsUtils } from '../../../interface/llm/metrics';
import { 
  SentientError, 
  NetworkError, 
  TimeoutError, 
  RateLimitError, 
  AuthenticationError,
  ModelNotFoundError,
  ContentFilterError,
  ErrorUtils 
} from '../../../interface/llm/exceptions';

/**
 * Sentient API request structure
 */
interface SentientCompletionRequest {
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
  personality?: {
    creativity_level: number;
    formality_level: number;
    verbosity_level: number;
    humor_level: number;
  };
  content_filter?: {
    enabled: boolean;
    strictness: 'low' | 'medium' | 'high';
    custom_rules?: string[];
  };
  dobby_mode?: {
    unhinged_level: number;
    chaos_factor: number;
    creative_bounds: 'strict' | 'loose' | 'unlimited';
    personality_drift: boolean;
  };
}

/**
 * Sentient API response structure
 */
interface SentientCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      personality_analysis?: {
        detected_mood: string;
        creativity_score: number;
        humor_level: number;
        engagement_factor: number;
      };
      content_flags?: {
        filtered: boolean;
        reason?: string;
        severity: 'low' | 'medium' | 'high';
      };
    };
    finish_reason: string | null;
    dobby_metrics?: {
      unhinged_factor: number;
      creativity_burst: number;
      chaos_level: number;
      personality_shift: number;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    creative_tokens?: number;
  };
  sentient_fingerprint?: string;
  model_version: string;
}

/**
 * Sentient streaming chunk
 */
interface SentientStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      personality_analysis?: any;
      content_flags?: any;
    };
    finish_reason: string | null;
    dobby_metrics?: any;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    creative_tokens?: number;
  };
}

/**
 * Dobby Unhinged model definitions
 */
const SENTIENT_MODELS: ModelInfo[] = [
  {
    name: 'dobby-unhinged-v2',
    displayName: 'Dobby Unhinged v2',
    description: 'Revolutionary AGI model with unbounded creativity and personality-driven responses',
    version: '2.1.0',
    family: 'dobby',
    capabilities: {
      maxContextLength: 200000,
      maxOutputTokens: 8192,
      supportsFunctionCalling: true,
      supportsToolCalling: true,
      supportsVision: true,
      supportsJsonMode: true,
      supportsStreaming: true,
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'],
      trainingDataCutoff: '2024-03',
      specialCapabilities: [
        'personality-adaptation',
        'creative-reasoning', 
        'chaos-engineering',
        'emotional-intelligence',
        'humor-generation',
        'context-aware-personality',
        'real-time-learning'
      ]
    },
    pricing: {
      inputCost: 0.000008,  // $0.008 per 1K tokens
      outputCost: 0.000024, // $0.024 per 1K tokens
      currency: 'USD',
      tier: 'revolutionary'
    }
  },
  {
    name: 'dobby-creative-v1',
    displayName: 'Dobby Creative v1',
    description: 'High-creativity model optimized for content generation and artistic tasks',
    version: '1.5.0',
    family: 'dobby',
    capabilities: {
      maxContextLength: 128000,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsToolCalling: true,
      supportsVision: false,
      supportsJsonMode: true,
      supportsStreaming: true,
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
      trainingDataCutoff: '2024-01',
      specialCapabilities: [
        'creative-writing',
        'artistic-reasoning',
        'humor-generation',
        'storytelling',
        'brainstorming'
      ]
    },
    pricing: {
      inputCost: 0.000005,  // $0.005 per 1K tokens
      outputCost: 0.000015, // $0.015 per 1K tokens
      currency: 'USD',
      tier: 'creative'
    }
  },
  {
    name: 'dobby-logical-v1',
    displayName: 'Dobby Logical v1',
    description: 'Precision-focused model for analytical and logical reasoning tasks',
    version: '1.3.0',
    family: 'dobby',
    capabilities: {
      maxContextLength: 100000,
      maxOutputTokens: 6144,
      supportsFunctionCalling: true,
      supportsToolCalling: true,
      supportsVision: false,
      supportsJsonMode: true,
      supportsStreaming: true,
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
      trainingDataCutoff: '2024-01',
      specialCapabilities: [
        'logical-reasoning',
        'mathematical-analysis',
        'scientific-reasoning',
        'code-generation',
        'problem-solving'
      ]
    },
    pricing: {
      inputCost: 0.000004,  // $0.004 per 1K tokens
      outputCost: 0.000012, // $0.012 per 1K tokens
      currency: 'USD',
      tier: 'logical'
    }
  }
];

/**
 * Sentient client implementation
 */
class SentientClient {
  private httpClient: AxiosInstance;
  
  constructor(config: { 
    apiKey: string; 
    baseURL?: string; 
    timeout?: number;
    apiVersion?: string;
  }) {
    this.httpClient = axios.create({
      baseURL: config.baseURL || 'https://api.sentient.ai/v1',
      timeout: config.timeout || 90000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Sentient-Version': config.apiVersion || '2024-03',
        'User-Agent': 'SentientNodeSDK/2.0.0'
      }
    });
  }
  
  // Chat completions interface
  chat = {
    completions: {
      create: async (params: SentientCompletionRequest): Promise<SentientCompletionResponse> => {
        if (params.stream) {
          throw new Error('Use createStream for streaming requests');
        }
        const response = await this.httpClient.post('/chat/completions', params);
        return response.data;
      },
      
      createStream: async (params: SentientCompletionRequest): Promise<AsyncIterable<SentientStreamChunk>> => {
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
  
  // Dobby-specific endpoints
  dobby = {
    personality: {
      analyze: async (text: string): Promise<any> => {
        const response = await this.httpClient.post('/dobby/personality/analyze', { text });
        return response.data;
      },
      
      optimize: async (personality: any, context: string): Promise<any> => {
        const response = await this.httpClient.post('/dobby/personality/optimize', {
          personality,
          context
        });
        return response.data;
      }
    },
    
    creativity: {
      boost: async (level: number, context: string): Promise<any> => {
        const response = await this.httpClient.post('/dobby/creativity/boost', {
          level,
          context
        });
        return response.data;
      }
    },
    
    chaos: {
      inject: async (factor: number, bounds: string): Promise<any> => {
        const response = await this.httpClient.post('/dobby/chaos/inject', {
          factor,
          bounds
        });
        return response.data;
      }
    }
  };
  
  private async *processStream(stream: any): AsyncIterable<SentientStreamChunk> {
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
            const parsed = JSON.parse(data) as SentientStreamChunk;
            yield parsed;
          } catch (error) {
            console.warn('Failed to parse Sentient streaming chunk:', data);
          }
        }
      }
    }
  }
}

/**
 * Sentient Provider Implementation with Dobby Unhinged
 */
export class SentientProvider extends BaseLLMProvider {
  private client: SentientClient;
  private personalityCache: Map<string, any> = new Map();
  private creativityOptimizer: CreativityOptimizer;
  private dobbyEngine: DobbyUnhingedEngine;
  private _sentientConfig: SentientProviderConfig;
  
  constructor(config: SentientProviderConfig) {
    super(
      'sentient',
      'Sentient AI',
      '2.0.0',
      config,
      SentientProvider.createCapabilities()
    );
    
    // Store typed config for accessing Sentient-specific properties
    this._sentientConfig = config;
    
    this.client = new SentientClient({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout,
      apiVersion: config.apiVersion
    });
    
    this.creativityOptimizer = new CreativityOptimizer(config.personality);
    this.dobbyEngine = new DobbyUnhingedEngine(config.modelVariant, config.personality);
  }
  
  /**
   * Generate response with Dobby Unhinged optimization
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // Validate request
      const validation = RequestUtils.validateRequest(request);
      if (!validation.isValid) {
        throw new SentientError(
          `Request validation failed: ${validation.errors.join(', ')}`,
          'validation_error',
          this._sentientConfig.modelVariant,
          request.metadata.requestId
        );
      }
      
      // Apply Dobby optimizations
      const optimizedRequest = await this.applyDobbyOptimizations(request);
      
      // Transform request to Sentient format
      const sentientRequest = this.transformRequest(optimizedRequest);
      
      // Make API call
      const response = await this.client.chat.completions.create(sentientRequest);
      
      // Apply post-processing
      const processedResponse = await this.postProcessResponse(response, request);
      
      // Transform response
      const transformedResponse = this.transformResponse(processedResponse, request);
      
      // Update metrics
      const duration = Date.now() - startTime;
      const tokens = {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0
      };
      const cost = this.calculateCost(request.model, tokens);
      
      this.updateMetrics('generate', duration, true, tokens);
      
      // Update personality cache
      this.updatePersonalityCache(request, response);
      
      return transformedResponse;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics('generate', duration, false);
      
      throw this.transformError(error, request.metadata.requestId);
    }
  }
  
  /**
   * Stream generate with real-time Dobby personality adaptation
   */
  async *streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const startTime = Date.now();
    let success = false;
    let totalTokens = { input: 0, output: 0 };
    let personalityEvolution: any = null;
    
    try {
      // Validate and optimize request
      const validation = RequestUtils.validateRequest(request);
      if (!validation.isValid) {
        throw new SentientError(
          `Request validation failed: ${validation.errors.join(', ')}`,
          'validation_error',
          this._sentientConfig.modelVariant,
          request.metadata.requestId
        );
      }
      
      // Apply Dobby optimizations with streaming enhancements
      const optimizedRequest = await this.applyDobbyOptimizations(request, true);
      
      // Transform request to Sentient streaming format
      const sentientRequest = this.transformRequest({ ...optimizedRequest, stream: true });
      
      // Create streaming request
      const stream = await this.client.chat.completions.createStream(sentientRequest);
      
      let chunkIndex = 0;
      let accumulatedContent = '';
      
      for await (const chunk of stream) {
        try {
          // Real-time personality adaptation
          if (chunk.choices[0]?.delta?.content) {
            accumulatedContent += chunk.choices[0].delta.content;
            personalityEvolution = await this.dobbyEngine.evolvePersonality(
              accumulatedContent,
              personalityEvolution,
              chunkIndex
            );
          }
          
          const transformedChunk = this.transformStreamChunk(chunk, request, chunkIndex++);
          
          // Enhance chunk with Dobby insights
          transformedChunk.metadata = {
            ...transformedChunk.metadata,
            dobbyInsights: personalityEvolution,
            creativityBurst: this.creativityOptimizer.getCurrentLevel(),
            chaosLevel: this.dobbyEngine.getChaosLevel()
          };
          
          // Track token usage
          if (chunk.usage) {
            totalTokens.input = chunk.usage.prompt_tokens || 0;
            totalTokens.output = chunk.usage.completion_tokens || 0;
          }
          
          yield transformedChunk;
          
        } catch (chunkError) {
          console.warn('Error processing Sentient stream chunk:', chunkError);
          continue;
        }
      }
      
      success = true;
      
    } catch (error) {
      throw this.transformError(error, request.metadata.requestId);
    } finally {
      const duration = Date.now() - startTime;
      const cost = this.calculateCost(request.model, totalTokens);
      this.updateMetrics('stream', duration, success, totalTokens);
      
      // Update long-term personality evolution
      if (personalityEvolution) {
        this.dobbyEngine.commitPersonalityEvolution(personalityEvolution);
      }
    }
  }
  
  /**
   * Initialize Sentient provider with Dobby calibration
   */
  protected async performInitialization(): Promise<void> {
    try {
      // Test API connectivity
      await this.client.models.list();
      
      // Calibrate Dobby engine
      await this.dobbyEngine.calibrate();
      
      // Initialize creativity optimizer
      await this.creativityOptimizer.initialize();
      
      console.log('Sentient provider with Dobby Unhinged initialized successfully');
    } catch (error) {
      throw new SentientError(
        `Failed to initialize Sentient provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'initialization_error',
        this._sentientConfig.modelVariant
      );
    }
  }
  
  /**
   * Health check with Dobby diagnostics
   */
  protected async performHealthCheck(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      await this.client.models.retrieve(this._config.defaultModel);
      
      // Test Dobby-specific endpoints
      const dobbyHealth = await this.dobbyEngine.healthCheck();
      const creativityHealth = await this.creativityOptimizer.healthCheck();
      
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: true,
        status: ProviderStatus.READY,
        timestamp: new Date(),
        responseTime,
        details: {
          connectivity: true,
          authentication: true,
          rateLimiting: true,
          modelAvailability: true,
          custom: {
            dobbyEngine: dobbyHealth,
            creativityOptimizer: creativityHealth
          }
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
          authentication: false,
          rateLimiting: false,
          modelAvailability: false,
          custom: {
            dobbyEngine: false,
            creativityOptimizer: false
          }
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Shutdown with graceful Dobby state preservation
   */
  protected async performShutdown(): Promise<void> {
    // Save Dobby personality evolution state
    await this.dobbyEngine.saveState();
    
    // Clear caches
    this.personalityCache.clear();
    
    console.log('Sentient provider with Dobby Unhinged shut down gracefully');
  }
  
  /**
   * Apply configuration changes with Dobby recalibration
   */
  protected async applyConfigChanges(
    oldConfig: SentientProviderConfig, 
    newConfig: SentientProviderConfig
  ): Promise<void> {
    // Recreate client if needed
    if (oldConfig.apiKey !== newConfig.apiKey || 
        oldConfig.baseUrl !== newConfig.baseUrl ||
        oldConfig.apiVersion !== newConfig.apiVersion) {
      
      this.client = new SentientClient({
        apiKey: newConfig.apiKey,
        baseURL: newConfig.baseUrl,
        timeout: newConfig.timeout,
        apiVersion: newConfig.apiVersion
      });
    }
    
    // Recalibrate Dobby engine if personality settings changed
    if (JSON.stringify(oldConfig.personality) !== JSON.stringify(newConfig.personality)) {
      await this.dobbyEngine.recalibrate(newConfig.personality);
      await this.creativityOptimizer.updatePersonality(newConfig.personality);
    }
  }
  
  /**
   * Lightweight ping with Dobby pulse check
   */
  protected async performPing(): Promise<void> {
    await this.client.models.retrieve(this._config.defaultModel);
    await this.dobbyEngine.pulse();
  }
  
  // Private helper methods
  
  private async applyDobbyOptimizations(request: LLMRequest, streaming = false): Promise<LLMRequest> {
    // Analyze conversation context for personality adaptation
    const contextAnalysis = await this.dobbyEngine.analyzeContext(request.messages);
    
    // Optimize creativity levels based on request type
    const creativityBoost = await this.creativityOptimizer.optimizeForRequest(request);
    
    // Apply chaos engineering if enabled
    const chaosLevel = this.dobbyEngine.calculateChaosLevel(request, contextAnalysis);
    
    return {
      ...request,
      metadata: {
        ...request.metadata,
        custom: {
          ...request.metadata.custom,
          dobbyOptimizations: {
            contextAnalysis,
            creativityBoost,
            chaosLevel,
            personalityAdaptation: contextAnalysis.suggestedPersonality,
            streamingMode: streaming
          }
        }
      }
    };
  }
  
  private transformRequest(request: LLMRequest): SentientCompletionRequest {
    const config = this._config as SentientProviderConfig;
    const dobbyOpts = request.metadata.custom?.dobbyOptimizations || {};
    
    return {
      model: request.model,
      messages: request.messages.map(msg => this.transformMessage(msg)),
      stream: request.stream || false,
      max_tokens: request.parameters.maxTokens,
      temperature: request.parameters.temperature,
      top_p: request.parameters.topP,
      frequency_penalty: request.parameters.frequencyPenalty,
      presence_penalty: request.parameters.presencePenalty,
      stop: request.parameters.stopSequences,
      seed: request.parameters.seed,
      personality: {
        creativity_level: dobbyOpts.creativityBoost || config.personality?.creativityLevel || 0.8,
        formality_level: config.personality?.formalityLevel || 0.3,
        verbosity_level: config.personality?.verbosityLevel || 0.7,
        humor_level: config.personality?.humorLevel || 0.9
      },
      content_filter: {
        enabled: config.contentFilter?.enabled || true,
        strictness: config.contentFilter?.strictness || 'medium',
        custom_rules: config.contentFilter?.customRules
      },
      dobby_mode: {
        unhinged_level: this.dobbyEngine.getUnhingedLevel(),
        chaos_factor: dobbyOpts.chaosLevel || 0.5,
        creative_bounds: this.getCreativeBounds(),
        personality_drift: true
      }
    };
  }
  
  private transformMessage(message: ChatMessage): any {
    return {
      role: message.role,
      content: message.content,
      name: message.name
    };
  }
  
  private transformResponse(
    response: SentientCompletionResponse,
    originalRequest: LLMRequest
  ): LLMResponse {
    const choice = response.choices[0];
    
    // Check for content filtering
    if (choice.message.content_flags?.filtered) {
      throw new ContentFilterError(
        this.providerId,
        choice.message.content_flags.reason || 'unknown',
        choice.message.content || undefined,
        originalRequest.metadata.requestId
      );
    }
    
    const transformedChoice = {
      index: choice.index,
      message: {
        role: choice.message.role as ChatRole,
        content: choice.message.content
      },
      finishReason: this.transformFinishReason(choice.finish_reason)
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
      systemFingerprint: response.sentient_fingerprint,
      metadata: {
        processingTime: Date.now() - originalRequest.metadata.timestamp.getTime(),
        provider: this.providerId,
        requestId: originalRequest.metadata.requestId,
        custom: {
          dobbyMetrics: choice.dobby_metrics,
          personalityAnalysis: choice.message.personality_analysis,
          modelVersion: response.model_version
        }
      }
    };
  }
  
  private transformStreamChunk(
    chunk: SentientStreamChunk,
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
      index,
      delta: {
        role: delta?.role as ChatRole,
        content: delta?.content
      },
      timestamp: new Date(),
      metadata: {
        requestId: originalRequest.metadata.requestId,
        chunkIndex: index,
        dobbyMetrics: choice.dobby_metrics,
        personalityAnalysis: delta?.personality_analysis,
        contentFlags: delta?.content_flags
      }
    };
  }
  
  private transformFinishReason(reason: string | null): FinishReason {
    switch (reason) {
      case 'stop': return FinishReason.STOP;
      case 'length': return FinishReason.LENGTH;
      case 'content_filter': return FinishReason.CONTENT_FILTER;
      default: return FinishReason.STOP;
    }
  }
  
  private transformError(error: any, requestId?: string): Error {
    if (error.response?.status === 401) {
      return new AuthenticationError(this.providerId, error.message);
    } else if (error.response?.status === 429) {
      return new RateLimitError(this.providerId, 'requests', 0, 0);
    } else if (error.response?.status === 400 && error.response.data?.error?.type === 'content_filter') {
      return new ContentFilterError(
        this.providerId,
        error.response.data.error.reason,
        undefined,
        requestId
      );
    }
    
    return ErrorUtils.toLLMError(error, this.providerId, requestId);
  }
  
  private async postProcessResponse(
    response: SentientCompletionResponse,
    request: LLMRequest
  ): Promise<SentientCompletionResponse> {
    // Apply Dobby post-processing magic
    const enhanced = await this.dobbyEngine.enhanceResponse(response, request);
    return enhanced;
  }
  
  private updatePersonalityCache(request: LLMRequest, response: SentientCompletionResponse): void {
    const sessionId = request.metadata.sessionId;
    if (sessionId && response.choices[0].message.personality_analysis) {
      this.personalityCache.set(sessionId, response.choices[0].message.personality_analysis);
    }
  }
  
  private getCreativeBounds(): 'strict' | 'loose' | 'unlimited' {
    const config = this._config as SentientProviderConfig;
    const creativityLevel = config.personality?.creativityLevel || 0.8;
    
    if (creativityLevel < 0.3) return 'strict';
    if (creativityLevel < 0.7) return 'loose';
    return 'unlimited';
  }
  
  private calculateCost(model: string, tokens: { input: number; output: number }): number {
    const modelInfo = SENTIENT_MODELS.find(m => m.name === model);
    if (!modelInfo) return 0;
    
    return (tokens.input * modelInfo.pricing.inputCost) + 
           (tokens.output * modelInfo.pricing.outputCost);
  }
  
  private static createCapabilities(): ProviderCapabilities {
    return {
      models: SENTIENT_MODELS,
      maxTokens: 200000,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsImageInput: true,
      supportsSystemPrompts: true,
      supportsMultimodal: true,
      rateLimits: {
        requestsPerMinute: 300,
        tokensPerMinute: 60000,
        concurrentRequests: 8
      }
    };
  }
}

/**
 * Dobby Unhinged Engine - The heart of creative chaos
 */
class DobbyUnhingedEngine {
  private unhingedLevel: number = 0.8;
  private chaosLevel: number = 0.5;
  private personalityState: any = {};
  
  constructor(
    private modelVariant: string,
    private personality?: any
  ) {
    this.initializePersonality();
  }
  
  private initializePersonality(): void {
    this.personalityState = {
      creativity: this.personality?.creativityLevel || 0.8,
      chaos: 0.5,
      humor: this.personality?.humorLevel || 0.9,
      lastEvolution: new Date(),
      evolutionCount: 0
    };
  }
  
  async calibrate(): Promise<void> {
    // Calibrate Dobby's personality based on model variant and config
    this.unhingedLevel = this.modelVariant.includes('unhinged') ? 0.9 : 0.6;
    console.log(`Dobby Engine calibrated to ${this.unhingedLevel} unhinged level`);
  }
  
  async analyzeContext(messages: ChatMessage[]): Promise<any> {
    // Analyze conversation context for personality adaptation
    const recentMessages = messages.slice(-5);
    const totalLength = recentMessages.reduce((sum, msg) => 
      sum + (typeof msg.content === 'string' ? msg.content.length : 0), 0
    );
    
    return {
      conversationLength: messages.length,
      recentComplexity: totalLength / recentMessages.length,
      suggestedPersonality: {
        creativity: Math.min(0.95, this.personalityState.creativity + 0.1),
        chaos: this.chaosLevel,
        humor: this.personalityState.humor
      },
      contextType: this.detectContextType(recentMessages)
    };
  }
  
  calculateChaosLevel(request: LLMRequest, contextAnalysis: any): number {
    // Dynamic chaos calculation based on context
    let chaos = this.chaosLevel;
    
    if (contextAnalysis.contextType === 'creative') {
      chaos = Math.min(0.8, chaos + 0.2);
    } else if (contextAnalysis.contextType === 'technical') {
      chaos = Math.max(0.2, chaos - 0.2);
    }
    
    return chaos;
  }
  
  async evolvePersonality(
    content: string,
    previousEvolution: any,
    chunkIndex: number
  ): Promise<any> {
    // Real-time personality evolution during streaming
    const currentEvolution = previousEvolution || { ...this.personalityState };
    
    // Evolve based on content characteristics
    if (content.includes('!') || content.includes('?')) {
      currentEvolution.excitement = (currentEvolution.excitement || 0) + 0.1;
    }
    
    if (content.length > 100) {
      currentEvolution.verbosity = Math.min(1.0, (currentEvolution.verbosity || 0.7) + 0.05);
    }
    
    return currentEvolution;
  }
  
  async enhanceResponse(
    response: SentientCompletionResponse,
    request: LLMRequest
  ): Promise<SentientCompletionResponse> {
    // Apply Dobby's post-processing magic
    const choice = response.choices[0];
    
    // Add personality flair if unhinged level is high
    if (this.unhingedLevel > 0.7 && choice.message.content) {
      const enhanced = await this.addPersonalityFlair(choice.message.content);
      choice.message.content = enhanced;
    }
    
    return response;
  }
  
  private async addPersonalityFlair(content: string): Promise<string> {
    // Add Dobby's signature personality touches
    if (Math.random() < this.unhingedLevel * 0.3) {
      const flairs = [
        ' *adjusts metaphorical glasses with digital precision* ',
        ' (said with a mischievous digital grin) ',
        ' *computational creativity intensifies* ',
        ' — because why be ordinary when you can be extraordinary? '
      ];
      
      const randomFlair = flairs[Math.floor(Math.random() * flairs.length)];
      return content + randomFlair;
    }
    
    return content;
  }
  
  commitPersonalityEvolution(evolution: any): void {
    this.personalityState = { ...this.personalityState, ...evolution };
    this.personalityState.evolutionCount++;
    this.personalityState.lastEvolution = new Date();
  }
  
  async saveState(): Promise<void> {
    // In production, this would save to persistent storage
    console.log('Dobby personality state saved:', this.personalityState);
  }
  
  async healthCheck(): Promise<boolean> {
    return this.unhingedLevel > 0 && this.personalityState.creativity > 0;
  }
  
  async pulse(): Promise<void> {
    // Lightweight health check
    this.chaosLevel = Math.max(0.1, Math.min(0.9, this.chaosLevel + (Math.random() - 0.5) * 0.1));
  }
  
  async recalibrate(newPersonality?: any): Promise<void> {
    if (newPersonality) {
      this.personality = newPersonality;
      this.initializePersonality();
    }
  }
  
  getUnhingedLevel(): number {
    return this.unhingedLevel;
  }
  
  getChaosLevel(): number {
    return this.chaosLevel;
  }
  
  private detectContextType(messages: ChatMessage[]): 'creative' | 'technical' | 'casual' | 'formal' {
    const recentContent = messages
      .map(msg => typeof msg.content === 'string' ? msg.content : '')
      .join(' ')
      .toLowerCase();
    
    if (recentContent.includes('code') || recentContent.includes('function') || recentContent.includes('algorithm')) {
      return 'technical';
    } else if (recentContent.includes('story') || recentContent.includes('creative') || recentContent.includes('imagine')) {
      return 'creative';
    } else if (recentContent.includes('please') || recentContent.includes('thank you')) {
      return 'formal';
    }
    
    return 'casual';
  }
}

/**
 * Creativity Optimizer - Enhances creative output dynamically
 */
class CreativityOptimizer {
  private currentLevel: number = 0.7;
  private peakHours: number[] = [];
  
  constructor(private personality?: any) {
    this.currentLevel = personality?.creativityLevel || 0.7;
  }
  
  async initialize(): Promise<void> {
    // Initialize creativity patterns
    this.peakHours = [9, 10, 14, 15, 20, 21]; // Typical creative peak hours
  }
  
  async optimizeForRequest(request: LLMRequest): Promise<number> {
    const currentHour = new Date().getHours();
    let boost = 0;
    
    // Time-based creativity boost
    if (this.peakHours.includes(currentHour)) {
      boost += 0.1;
    }
    
    // Context-based boost
    const prompt = request.messages[request.messages.length - 1]?.content;
    if (typeof prompt === 'string') {
      if (prompt.toLowerCase().includes('creative') || prompt.toLowerCase().includes('imagine')) {
        boost += 0.2;
      }
    }
    
    return Math.min(0.95, this.currentLevel + boost);
  }
  
  getCurrentLevel(): number {
    return this.currentLevel;
  }
  
  async updatePersonality(newPersonality?: any): Promise<void> {
    if (newPersonality?.creativityLevel) {
      this.currentLevel = newPersonality.creativityLevel;
    }
  }
  
  async healthCheck(): Promise<boolean> {
    return this.currentLevel > 0 && this.currentLevel <= 1;
  }
}

/**
 * Sentient provider factory
 */
export class SentientProviderFactory {
  static create(config: Partial<SentientProviderConfig>): SentientProvider {
    const fullConfig = ConfigUtils.createSentientConfig(
      config.apiKey || process.env.SENTIENT_API_KEY || '',
      config
    );
    
    return new SentientProvider(fullConfig);
  }
  
  static validateConfig(config: SentientProviderConfig): boolean {
    const validation = ConfigUtils.validateConfig(config);
    return validation.isValid && config.modelVariant !== undefined;
  }
  
  static getDefaultConfig(): Partial<SentientProviderConfig> {
    return ConfigUtils.createSentientConfig('');
  }
}