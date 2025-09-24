/**
 * LLM Interface for Sentient Agent Framework
 *
 * This module defines the abstract interface for Language Learning Models (LLMs)
 * used within the Sentient Agent Framework. It provides a standardized way to
 * interact with different LLM providers and implementations.
 *
 * @module sentient-agent-framework/interface/llm
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

/**
 * Abstract base class for Language Learning Models.
 * Implementations should extend this class to provide specific LLM functionality.
 */
export abstract class LLM {
  /**
   * Generate text based on the given prompt.
   * @param prompt The input prompt to generate text for
   * @param maxTokens Maximum number of tokens to generate (optional)
   * @param temperature Temperature for controlling randomness (optional)
   * @param kwargs Additional parameters specific to the LLM implementation
   * @returns Promise resolving to the generated text
   */
  abstract generate(
    prompt: string,
    maxTokens?: number,
    temperature?: number,
    ...kwargs: any[]
  ): Promise<string>;

  /**
   * Stream generate text based on the given prompt.
   * @param prompt The input prompt to generate text for
   * @param maxTokens Maximum number of tokens to generate (optional)
   * @param temperature Temperature for controlling randomness (optional)
   * @param kwargs Additional parameters specific to the LLM implementation
   * @returns AsyncIterable of text chunks
   */
  abstract streamGenerate(
    prompt: string,
    maxTokens?: number,
    temperature?: number,
    ...kwargs: any[]
  ): AsyncIterable<string>;

  /**
   * Get information about the model.
   * @returns Object containing model information
   */
  abstract getModelInfo(): Record<string, any>;
}