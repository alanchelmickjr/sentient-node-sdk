/**
 * Agent-LLM Bridge Implementation
 * 
 * Seamless communication bridge between Sentient agents and the LLM provider
 * system, with streaming SSE integration, conversation context management,
 * and intelligent prompt optimization.
 * 
 * @module sentient-agent-framework/implementation/llm/agent-bridge
 */

import { EventEmitter } from 'events';
import { AbstractAgent } from '../../interface/agent';
import { Query } from '../../interface/request';
import { ResponseHandler } from '../../interface/response_handler';
import { Session } from '../../interface/session';
import { 
  TextChunkEvent, 
  DoneEvent, 
  ErrorEvent, 
  EventContentType,
  DEFAULT_ERROR_CODE 
} from '../../interface/events';
import { ProductionLLMManager } from './manager';
import { 
  LLMRequest, 
  LLMStreamChunk, 
  ChatMessage, 
  ChatRole, 
  RequestUtils 
} from '../../interface/llm/request';
import { LLMResponse } from '../../interface/llm/response';
import { LLMManagerConfig, ManagerUtils } from '../../interface/llm/manager';
import { ulid } from 'ulid';

/**
 * Conversation context manager
 */
interface ConversationContext {
  sessionId: string;
  messages: ChatMessage[];
  lastInteraction: Date;
  metadata: {
    totalInteractions: number;
    avgResponseTime: number;
    preferredProvider?: string;
    personalityProfile?: any;
    conversationStyle?: 'casual' | 'formal' | 'technical' | 'creative';
  };
}

/**
 * Agent LLM configuration
 */
interface AgentLLMConfig {
  /** Default model to use */
  defaultModel: string;
  
  /** Default LLM parameters */
  defaultParameters: {
    temperature: number;
    maxTokens: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
  
  /** System prompt template */
  systemPrompt?: string;
  
  /** Context management settings */
  contextSettings: {
    maxMessages: number;
    maxTokens: number;
    trimStrategy: 'oldest' | 'summarize' | 'compress';
  };
  
  /** Streaming settings */
  streaming: {
    enabled: boolean;
    chunkSize?: number;
    bufferTimeout?: number;
  };
  
  /** Prompt optimization */
  promptOptimization: {
    enabled: boolean;
    includeContext: boolean;
    optimizeForModel: boolean;
    personalityAware: boolean;
  };
}

/**
 * Agent-LLM Bridge for seamless integration
 */
export class AgentLLMBridge extends EventEmitter {
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private promptOptimizer: PromptOptimizer;
  private streamingHandler: StreamingHandler;
  private textStream?: any; // StreamEventEmitter<string>
  
  constructor(
    private llmManager: ProductionLLMManager,
    private config: AgentLLMConfig
  ) {
    super();
    this.promptOptimizer = new PromptOptimizer(config);
    this.streamingHandler = new StreamingHandler(config.streaming);
  }
  
  /**
   * Enhanced assist method with LLM integration
   */
  async assist(
    agent: AbstractAgent,
    session: Session,
    query: Query,
    responseHandler: ResponseHandler
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get or create conversation context
      const context = this.getConversationContext(session.activity_id);
      
      // Add user message to context
      context.messages.push({
        role: ChatRole.USER,
        content: query.prompt
      });
      
      // Optimize prompt for the selected model
      const optimizedPrompt = await this.promptOptimizer.optimize(
        query.prompt,
        context,
        agent.name
      );
      
      // Create LLM request
      const llmRequest = this.createLLMRequest(optimizedPrompt, context, session, query);
      
      // Handle streaming vs non-streaming
      if (this.config.streaming.enabled) {
        await this.handleStreamingResponse(llmRequest, agent, session, responseHandler);
      } else {
        await this.handleSingleResponse(llmRequest, agent, session, responseHandler);
      }
      
      // Update context metadata
      context.metadata.totalInteractions++;
      context.metadata.avgResponseTime = 
        (context.metadata.avgResponseTime + (Date.now() - startTime)) / 2;
      context.lastInteraction = new Date();
      
      this.emit('assistCompleted', {
        agentName: agent.name,
        sessionId: session.activity_id,
        duration: Date.now() - startTime
      });
      
    } catch (error) {
      await this.handleError(error, session, responseHandler);
      
      this.emit('assistFailed', {
        agentName: agent.name,
        sessionId: session.activity_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Get conversation context for a session
   */
  getConversationContext(sessionId: string): ConversationContext {
    if (!this.conversationContexts.has(sessionId)) {
      const context: ConversationContext = {
        sessionId,
        messages: [],
        lastInteraction: new Date(),
        metadata: {
          totalInteractions: 0,
          avgResponseTime: 0,
          conversationStyle: 'casual'
        }
      };
      
      // Add system prompt if configured
      if (this.config.systemPrompt) {
        context.messages.push({
          role: ChatRole.SYSTEM,
          content: this.config.systemPrompt
        });
      }
      
      this.conversationContexts.set(sessionId, context);
    }
    
    return this.conversationContexts.get(sessionId)!;
  }
  
  /**
   * Update agent configuration
   */
  updateConfig(newConfig: Partial<AgentLLMConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.promptOptimizer.updateConfig(this.config);
    this.streamingHandler.updateConfig(this.config.streaming);
  }
  
  /**
   * Clear conversation context for a session
   */
  clearContext(sessionId: string): void {
    this.conversationContexts.delete(sessionId);
  }
  
  /**
   * Get conversation summary for a session
   */
  getConversationSummary(sessionId: string): any {
    const context = this.conversationContexts.get(sessionId);
    if (!context) return null;
    
    return {
      sessionId: context.sessionId,
      messageCount: context.messages.length,
      lastInteraction: context.lastInteraction,
      totalInteractions: context.metadata.totalInteractions,
      avgResponseTime: context.metadata.avgResponseTime,
      conversationStyle: context.metadata.conversationStyle,
      preferredProvider: context.metadata.preferredProvider
    };
  }
  
  // Private helper methods
  
  private createLLMRequest(
    optimizedPrompt: string,
    context: ConversationContext,
    session: Session,
    query: Query
  ): LLMRequest {
    // Trim context if needed
    const messages = this.trimContext(context.messages);
    
    // Replace last user message with optimized prompt
    if (messages.length > 0 && messages[messages.length - 1].role === ChatRole.USER) {
      messages[messages.length - 1].content = optimizedPrompt;
    }
    
    return {
      model: this.config.defaultModel,
      messages,
      parameters: {
        ...this.config.defaultParameters,
        // Dynamic temperature based on conversation style
        temperature: this.getTemperatureForStyle(context.metadata.conversationStyle)
      },
      metadata: {
        requestId: ulid(),
        sessionId: session.activity_id,
        timestamp: new Date(),
        priority: 'normal',
        custom: {
          agentName: 'LLM-Enhanced Agent',
          originalQuery: query.prompt,
          conversationStyle: context.metadata.conversationStyle
        }
      },
      stream: this.config.streaming.enabled
    };
  }
  
  private async handleStreamingResponse(
    llmRequest: LLMRequest,
    agent: AbstractAgent,
    session: Session,
    responseHandler: ResponseHandler
  ): Promise<void> {
    const streamId = ulid();
    let fullContent = '';
    let isFirstChunk = true;
    
    try {
      const stream = this.llmManager.streamGenerate(llmRequest);
      
      for await (const chunk of stream) {
        const event = this.createStreamEvent(chunk, streamId, isFirstChunk);
        
        // Create text stream on first chunk and emit chunks
        if (isFirstChunk) {
          this.textStream = responseHandler.createTextStream('assistant_response');
        }
        
        if (this.textStream) {
          await this.textStream.emitChunk(chunk.content);
        }
        
        // Accumulate content
        fullContent += chunk.content;
        isFirstChunk = false;
        
        this.emit('streamChunk', {
          sessionId: session.activity_id,
          chunk: chunk.content,
          metadata: chunk.metadata
        });
      }
      
      // Add assistant response to context
      const context = this.getConversationContext(session.activity_id);
      context.messages.push({
        role: ChatRole.ASSISTANT,
        content: fullContent
      });
      
      // Complete the stream
      if (this.textStream) {
        await this.textStream.complete();
      }
      await responseHandler.complete();
      
    } catch (error) {
      const err = error as any;
      await responseHandler.emitError(
        error instanceof Error ? error.message : 'Stream error occurred',
        err.statusCode || 500,
        { streamId, errorType: err.constructor?.name }
      );
    }
  }
  
  private async handleSingleResponse(
    llmRequest: LLMRequest,
    agent: AbstractAgent,
    session: Session,
    responseHandler: ResponseHandler
  ): Promise<void> {
    try {
      const response = await this.llmManager.generate(llmRequest);
      const content = response.choices[0]?.message.content || '';
      
      // Add assistant response to context
      const context = this.getConversationContext(session.activity_id);
      context.messages.push({
        role: ChatRole.ASSISTANT,
        content
      });
      
      // Emit text block response
      await responseHandler.emitTextBlock('assistant_response', content);
      await responseHandler.complete();
      
      this.emit('responseGenerated', {
        sessionId: session.activity_id,
        content,
        metadata: response.metadata
      });
      
    } catch (error) {
      throw error; // Let handleError deal with it
    }
  }
  
  private async handleError(
    error: any,
    session: Session,
    responseHandler: ResponseHandler
  ): Promise<void> {
    const errorEvent: ErrorEvent = {
      content_type: EventContentType.ERROR,
      event_name: 'error',
      schema_version: '1.0',
      id: ulid(),
      source: 'agent-llm-bridge',
      content: {
        error_message: error instanceof Error ? error.message : 'Unknown error occurred',
        error_code: error.statusCode || DEFAULT_ERROR_CODE,
        details: {
          sessionId: session.activity_id,
          timestamp: new Date().toISOString(),
          errorType: error.constructor?.name || 'UnknownError'
        }
      }
    };
    
    const err = error as any;
    await responseHandler.emitError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      err.statusCode || 500,
      {
        sessionId: session.activity_id,
        timestamp: new Date().toISOString(),
        errorType: err.constructor?.name || 'UnknownError'
      }
    );
  }
  
  private createStreamEvent(
    chunk: LLMStreamChunk,
    streamId: string,
    isFirstChunk: boolean
  ): TextChunkEvent {
    return {
      content_type: EventContentType.TEXT_STREAM,
      event_name: 'text_chunk',
      schema_version: '1.0',
      id: ulid(),
      source: 'agent-llm-bridge',
      stream_id: streamId,
      is_complete: chunk.finishReason !== null,
      content: chunk.content,
      metadata: {
        model: chunk.model,
        finishReason: chunk.finishReason?.toString() || 'unknown',
        isFirstChunk,
        chunkIndex: chunk.index || 0,
        timestamp: chunk.timestamp.toISOString(),
        ...chunk.metadata
      }
    };
  }
  
  private createTextBlockEvent(content: string, response: LLMResponse): any {
    return {
      content_type: EventContentType.TEXTBLOCK,
      event_name: 'text_block',
      schema_version: '1.0',
      id: ulid(),
      source: 'agent-llm-bridge',
      content,
      metadata: {
        model: response.model,
        usage: response.usage,
        processingTime: response.metadata?.processingTime,
        provider: response.metadata?.provider
      }
    };
  }
  
  private createDoneEvent(streamId: string): DoneEvent {
    return {
      content_type: EventContentType.DONE,
      event_name: 'done',
      schema_version: '1.0',
      id: ulid(),
      source: 'agent-llm-bridge',
      metadata: {
        streamId,
        completedAt: new Date().toISOString()
      }
    };
  }
  
  private createErrorEvent(error: any, streamId: string): ErrorEvent {
    return {
      content_type: EventContentType.ERROR,
      event_name: 'error',
      schema_version: '1.0',
      id: ulid(),
      source: 'agent-llm-bridge',
      content: {
        error_message: error instanceof Error ? error.message : 'Stream error occurred',
        error_code: error.statusCode || DEFAULT_ERROR_CODE,
        details: {
          streamId,
          errorType: error.constructor?.name || 'StreamError'
        }
      }
    };
  }
  
  private trimContext(messages: ChatMessage[]): ChatMessage[] {
    const maxMessages = this.config.contextSettings.maxMessages;
    const maxTokens = this.config.contextSettings.maxTokens;
    
    if (messages.length <= maxMessages) {
      return [...messages];
    }
    
    // Keep system message and trim from oldest
    const systemMessages = messages.filter(m => m.role === ChatRole.SYSTEM);
    const otherMessages = messages.filter(m => m.role !== ChatRole.SYSTEM);
    
    const trimmed = otherMessages.slice(-maxMessages + systemMessages.length);
    return [...systemMessages, ...trimmed];
  }
  
  private getTemperatureForStyle(style?: string): number {
    switch (style) {
      case 'creative': return 0.9;
      case 'technical': return 0.3;
      case 'formal': return 0.5;
      case 'casual':
      default: return 0.7;
    }
  }
}

/**
 * Prompt Optimizer for intelligent prompt enhancement
 */
class PromptOptimizer {
  constructor(private config: AgentLLMConfig) {}
  
  async optimize(
    prompt: string,
    context: ConversationContext,
    agentName: string
  ): Promise<string> {
    if (!this.config.promptOptimization.enabled) {
      return prompt;
    }
    
    let optimized = prompt;
    
    // Add context if enabled
    if (this.config.promptOptimization.includeContext && context.messages.length > 1) {
      const recentContext = this.getRecentContext(context);
      optimized = `Context: ${recentContext}\n\nRequest: ${prompt}`;
    }
    
    // Add personality awareness
    if (this.config.promptOptimization.personalityAware && context.metadata.personalityProfile) {
      const personality = context.metadata.personalityProfile;
      optimized = `[Personality: ${JSON.stringify(personality)}] ${optimized}`;
    }
    
    // Add agent identity
    optimized = `As ${agentName}, ${optimized}`;
    
    return optimized;
  }
  
  updateConfig(config: AgentLLMConfig): void {
    this.config = config;
  }
  
  private getRecentContext(context: ConversationContext): string {
    const recentMessages = context.messages.slice(-3).filter(m => m.role !== ChatRole.SYSTEM);
    return recentMessages
      .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : '[multimodal]'}`)
      .join('\n');
  }
}

/**
 * Streaming Handler for managing real-time responses
 */
class StreamingHandler {
  private buffers: Map<string, string> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(private config: { enabled: boolean; chunkSize?: number; bufferTimeout?: number }) {}
  
  updateConfig(config: { enabled: boolean; chunkSize?: number; bufferTimeout?: number }): void {
    this.config = config;
  }
  
  // Additional streaming optimization methods would go here
  // For now, keeping it simple as the main streaming is handled in the bridge
}

/**
 * Enhanced Agent that integrates with LLM Bridge
 */
export class LLMEnhancedAgent extends AbstractAgent {
  constructor(
    name: string,
    private bridge: AgentLLMBridge,
    private agentConfig?: Partial<AgentLLMConfig>
  ) {
    super(name);
    
    // Update bridge config if agent-specific config provided
    if (agentConfig) {
      bridge.updateConfig(agentConfig);
    }
  }
  
  async assist(
    session: Session,
    query: Query,
    responseHandler: ResponseHandler
  ): Promise<void> {
    await this.bridge.assist(this, session, query, responseHandler);
  }
  
  /**
   * Get conversation summary for this agent's sessions
   */
  getConversationSummary(sessionId: string): any {
    return this.bridge.getConversationSummary(sessionId);
  }
  
  /**
   * Clear conversation context
   */
  clearContext(sessionId: string): void {
    this.bridge.clearContext(sessionId);
  }
}

/**
 * Factory for creating LLM-enhanced agents
 */
export class LLMAgentFactory {
  constructor(
    private llmManager: ProductionLLMManager,
    private defaultConfig: AgentLLMConfig
  ) {}
  
  createAgent(
    name: string,
    config?: Partial<AgentLLMConfig>
  ): LLMEnhancedAgent {
    const bridge = new AgentLLMBridge(
      this.llmManager,
      { ...this.defaultConfig, ...config }
    );
    
    return new LLMEnhancedAgent(name, bridge, config);
  }
  
  createBridge(config?: Partial<AgentLLMConfig>): AgentLLMBridge {
    return new AgentLLMBridge(
      this.llmManager,
      { ...this.defaultConfig, ...config }
    );
  }
  
  static getDefaultConfig(): AgentLLMConfig {
    return {
      defaultModel: 'gpt-4-turbo-preview',
      defaultParameters: {
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9
      },
      contextSettings: {
        maxMessages: 20,
        maxTokens: 8000,
        trimStrategy: 'oldest'
      },
      streaming: {
        enabled: true,
        chunkSize: 50,
        bufferTimeout: 100
      },
      promptOptimization: {
        enabled: true,
        includeContext: true,
        optimizeForModel: true,
        personalityAware: true
      }
    };
  }
}