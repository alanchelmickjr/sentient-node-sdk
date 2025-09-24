"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockLLMProvider = exports.DefaultLLMProvider = void 0;
/**
 * Abstract base class for LLM providers.
 * Provides common functionality that can be extended by specific providers.
 */
class DefaultLLMProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Get available models for this provider.
     * Default implementation returns configured model or empty array.
     */
    async getModels() {
        return this.config.model ? [this.config.model] : [];
    }
    /**
     * Get provider name.
     */
    getName() {
        return this.config.provider;
    }
    /**
     * Merge request with provider defaults.
     */
    mergeRequestConfig(request) {
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
    validateRequest(request) {
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
exports.DefaultLLMProvider = DefaultLLMProvider;
/**
 * Mock LLM provider for testing and development.
 * Returns simple responses without calling any external APIs.
 */
class MockLLMProvider extends DefaultLLMProvider {
    constructor(config = {}) {
        super({
            provider: 'mock',
            model: 'mock-model',
            ...config,
        });
    }
    async generate(request) {
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
    async *generateStream(request) {
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
exports.MockLLMProvider = MockLLMProvider;
//# sourceMappingURL=default_llm_provider.js.map