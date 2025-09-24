/**
 * Enhanced Agent Example
 *
 * This example demonstrates the new features added to the Node.js SDK,
 * including LLM integration and Python-style decorator utilities.
 */

import {
  AbstractAgent,
  Query,
  Session,
  ResponseHandler,
  MockLLMProvider,
  LLMRequest,
  streamHelper,
  withErrorHandling,
  withTimeout,
  withLogging,
  DefaultServer,
} from '../src';

/**
 * Enhanced example agent that uses LLM integration and decorator-style utilities
 */
class EnhancedExampleAgent extends AbstractAgent {
  private llmProvider: MockLLMProvider;

  constructor() {
    super('Enhanced Example Agent');
    
    // Initialize LLM provider
    this.llmProvider = new MockLLMProvider({
      provider: 'mock',
      model: 'mock-enhanced-model',
      temperature: 0.7,
      max_tokens: 150,
    });
  }

  async assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void> {
    // Use withErrorHandling to automatically handle errors
    await withErrorHandling(async () => {
      // Use withLogging to automatically log the operation
      await withLogging(async () => {
        // Use withTimeout to add timeout protection
        await withTimeout(async () => {
          await this.processQuery(query, responseHandler);
        }, 30000, responseHandler); // 30 second timeout
      }, 'EnhancedAgent.assist');
    }, responseHandler);
  }

  private async processQuery(query: Query, responseHandler: ResponseHandler): Promise<void> {
    // Emit thinking status
    await responseHandler.emitTextBlock('THINKING', 'Processing your enhanced query...');

    // Prepare LLM request
    const llmRequest: LLMRequest = {
      messages: [
        {
          role: 'system',
          content: 'You are an enhanced AI assistant that provides helpful and detailed responses.',
        },
        {
          role: 'user',
          content: query.prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    };

    // Use LLM to generate response
    const llmResponse = await this.llmProvider.generate(llmRequest);

    // Stream the response using streamHelper
    await streamHelper(responseHandler, 'RESPONSE', llmResponse.content);

    // Emit metadata about the response
    await responseHandler.emitJson('METADATA', {
      model_used: this.llmProvider.getName(),
      tokens_used: llmResponse.usage?.total_tokens || 0,
      finish_reason: llmResponse.finish_reason,
      query_id: query.id,
    });

    // Demonstrate streaming with the new text stream functionality
    const detailsStream = responseHandler.createTextStream('DETAILS');
    await detailsStream.emitChunk('Additional details: ');
    await detailsStream.emitChunk('This response was generated using the enhanced Node.js SDK ');
    await detailsStream.emitChunk('with LLM integration and Python-style utilities.');
    await detailsStream.complete();

    // Use respond with the new complete parameter
    await responseHandler.respond('SUMMARY', {
      status: 'success',
      agent: this.name,
      processing_time: Date.now(),
    }, false); // Don't auto-complete

    // Manually complete the response
    await responseHandler.complete();
  }
}

// Example usage
async function runEnhancedExample() {
  console.log('Starting Enhanced Agent Example...');

  const agent = new EnhancedExampleAgent();
  const server = new DefaultServer(agent);

  console.log('Enhanced agent server created with new functionality:');
  console.log('- LLM integration with MockLLMProvider');
  console.log('- Python-style decorator utilities');
  console.log('- Enhanced response handler with complete parameter');
  console.log('- Improved text streaming with truthy checks');
  console.log('- Flexible metadata support');
  
  console.log('\nServer ready! Try sending a POST request to http://localhost:3000/assist');
  console.log('Example request body:');
  console.log(JSON.stringify({
    query: {
      id: 'example-query-123',
      prompt: 'Tell me about the new features in this enhanced Node.js SDK'
    }
  }, null, 2));

  // Run the server
  server.run('0.0.0.0', 3000);
}

// Run the example if this file is executed directly
if (require.main === module) {
  runEnhancedExample().catch(console.error);
}

export { EnhancedExampleAgent, runEnhancedExample };