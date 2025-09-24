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
import { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, LLMConfig } from '../interface/llm';
/**
 * Abstract base class for LLM providers.
 * Provides common functionality that can be extended by specific providers.
 */
export declare abstract class DefaultLLMProvider implements LLMProvider {
    protected config: LLMConfig;
    constructor(config: LLMConfig);
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
    getModels(): Promise<string[]>;
    /**
     * Get provider name.
     */
    getName(): string;
    /**
     * Merge request with provider defaults.
     */
    protected mergeRequestConfig(request: LLMRequest): LLMRequest;
    /**
     * Validate request before sending to LLM.
     */
    protected validateRequest(request: LLMRequest): void;
}
/**
 * Mock LLM provider for testing and development.
 * Returns simple responses without calling any external APIs.
 */
export declare class MockLLMProvider extends DefaultLLMProvider {
    constructor(config?: Partial<LLMConfig>);
    generate(request: LLMRequest): Promise<LLMResponse>;
    generateStream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
}
