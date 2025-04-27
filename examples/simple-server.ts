import express from 'express';
import { 
  AbstractAgent, 
  DefaultServer, 
  Session, 
  Query, 
  ResponseHandler 
} from '../src';

/**
 * Simple example agent that responds with a greeting
 */
class SimpleAgent extends AbstractAgent {
  constructor() {
    super('Simple Agent');
  }

  async assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void> {
    console.log(`[SimpleAgent] Received query: ${query.prompt}`);

    // Emit a thinking text block
    await responseHandler.emitTextBlock('THINKING', 'Processing your query...');
    
    // Wait a bit to simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Emit a JSON document with the query details
    await responseHandler.emitJson('QUERY_DETAILS', {
      query: query.prompt,
      timestamp: new Date().toISOString(),
      session_id: session.processor_id
    });
    
    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Create a text stream for the response
    const stream = responseHandler.createTextStream('RESPONSE');
    
    // Stream the response word by word
    const words = `Hello! You said: "${query.prompt}". This is a streaming response from the Simple Agent.`.split(' ');
    
    for (const word of words) {
      await stream.emitChunk(word + ' ');
      // Small delay between words
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Complete the stream
    await stream.complete();
    
    // Wait a bit before completing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Complete the response
    await responseHandler.complete();
  }
}

// Create the agent and server
const agent = new SimpleAgent();
const server = new DefaultServer(agent);

// Start the server
const PORT = process.env.PORT || 3000;
server.run('0.0.0.0', Number(PORT));
console.log(`Server running at http://localhost:${PORT}`);
console.log('Use the CLI to test: pnpm run cli');