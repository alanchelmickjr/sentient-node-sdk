/**
 * LLM interfaces for Sentient Agent Framework
 *
 * This module defines interfaces for integrating with Large Language Models (LLMs).
 * It provides abstract base classes for LLM providers and configuration options.
 *
 * @module sentient-agent-framework/interface/llm
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

/**
 * Configuration for LLM providers
 */
export interface LLMConfig {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  [key: string]: any; // Extra parameters
}

/**
 * Abstract base class for LLM providers
 */
export abstract class LLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Generate text from a prompt
   * @param prompt The input prompt
   * @param maxTokens Maximum number of tokens to generate
   * @param temperature Sampling temperature
   * @param kwargs Additional parameters
   */
  abstract generate(
    prompt: string,
    maxTokens?: number,
    temperature?: number,
    ...kwargs: any[]
  ): Promise<string>;

  /**
   * Stream text generation from a prompt
   * @param prompt The input prompt
   * @param maxTokens Maximum number of tokens to generate
   * @param temperature Sampling temperature
   * @param kwargs Additional parameters
   */
  abstract streamGenerate(
    prompt: string,
    maxTokens?: number,
    temperature?: number,
    ...kwargs: any[]
  ): AsyncIterable<string>;
}