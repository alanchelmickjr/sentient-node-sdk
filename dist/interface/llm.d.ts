/**
 * LLM (Large Language Model) Interface
 *
 * This module defines interfaces and types for interacting with Large Language Models.
 * It provides a standardized way to communicate with different LLM providers and models.
 *
 * @module sentient-agent-framework/interface/llm
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    metadata?: Record<string, any>;
}
export interface LLMRequest {
    messages: LLMMessage[];
    model?: string;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    stop?: string | string[];
    stream?: boolean;
    metadata?: Record<string, any>;
}
export interface LLMResponse {
    content: string;
    finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    metadata?: Record<string, any>;
}
export interface LLMStreamChunk {
    content: string;
    finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
    metadata?: Record<string, any>;
}
/**
 * Abstract interface for LLM providers
 */
export interface LLMProvider {
    /**
     * Generate a response from the LLM
     */
    generate(request: LLMRequest): Promise<LLMResponse>;
    /**
     * Generate a streaming response from the LLM
     */
    generateStream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
    /**
     * Get available models for this provider
     */
    getModels?(): Promise<string[]>;
    /**
     * Get provider name
     */
    getName(): string;
}
/**
 * Configuration for LLM providers
 */
export interface LLMConfig {
    provider: string;
    model?: string;
    api_key?: string;
    base_url?: string;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    metadata?: Record<string, any>;
}
