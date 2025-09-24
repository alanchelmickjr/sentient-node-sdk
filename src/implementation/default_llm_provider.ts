/**
 * Default LLM Provider Implementation
 *
 * This module provides a default implementation of the LLMProvider interface
 * that can be used with various LLM services. It serves as a base class
 * that can be extended for specific providers like OpenAI, Anthropic, etc.
 *
 * @module sentient-agent-framework/implementation/default-llm-provider
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

import { 
  LLMProvider, 
  LLMRequest, 
  LLMResponse, 
  LLMStreamChunk, 
  LLMConfig 
} from '../interface/llm';

/**
 * Abstract base class for LLM providers.
 * Provides common functionality that can be extended by specific providers.
 */
export abstract class DefaultLLMProvider implements LLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Generate a response from the LLM.
   * Must be implemented by concrete providers.
   */
  abstract generate(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Generate a streaming response from the LLM.
   * Must be implemented by concrete providers.
   */
  abstract generateStream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;

  /**
   * Get available models for this provider.
   * Default implementation returns configured model or empty array.
   */
  async getModels(): Promise<string[]> {
    return this.config.model ? [this.config.model] : [];
  }

  /**
   * Get provider name.
   */
  getName(): string {
    return this.config.provider;
  }

  /**
   * Merge request with provider defaults.
   */
  protected mergeRequestConfig(request: LLMRequest): LLMRequest {
    return {
      model: this.config.model,
      max_tokens: this.config.max_tokens,
      temperature: this.config.temperature,
      top_p: this.config.top_p,
      ...request,
      metadata: {
        ...this.config.metadata,
        ...request.metadata,
      },
    };
  }

  /**
   * Validate request before sending to LLM.
   */
  protected validateRequest(request: LLMRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw new Error('Request must include at least one message');
    }

    for (const message of request.messages) {
      if (!message.role || !message.content) {
        throw new Error('Each message must have a role and content');
      }
      
      if (!['system', 'user', 'assistant'].includes(message.role)) {
        throw new Error(`Invalid message role: ${message.role}`);
      }
    }
  }
}

/**
 * Mock LLM provider for testing and development.
 * Returns simple responses without calling any external APIs.
 */
export class MockLLMProvider extends DefaultLLMProvider {
  constructor(config: Partial<LLMConfig> = {}) {
    super({
      provider: 'mock',
      model: 'mock-model',
      ...config,
    });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    this.validateRequest(request);
    
    const mergedRequest = this.mergeRequestConfig(request);
    const lastMessage = request.messages[request.messages.length - 1];
    
    // Simple mock response
    const mockResponse = `This is a mock response to: "${lastMessage.content}"`;
    
    return {
      content: mockResponse,
      finish_reason: 'stop',
      usage: {
        prompt_tokens: lastMessage.content.length,
        completion_tokens: mockResponse.length,
        total_tokens: lastMessage.content.length + mockResponse.length,
      },
      metadata: {
        model: mergedRequest.model,
        provider: this.config.provider,
      },
    };
  }

  async* generateStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    this.validateRequest(request);
    
    const response = await this.generate(request);
    const words = response.content.split(' ');
    
    // Stream words one by one
    for (let i = 0; i < words.length; i++) {
      const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
      const isLast = i === words.length - 1;
      
      yield {
        content: chunk,
        finish_reason: isLast ? 'stop' : undefined,
        metadata: {
          chunk_index: i,
          total_chunks: words.length,
        },
      };
      
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}