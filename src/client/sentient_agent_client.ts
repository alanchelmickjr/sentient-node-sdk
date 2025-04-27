/**
 * SentientAgentClient: Client for interacting with Sentient Agent Framework.
 *
 * This client provides methods for querying agents built with the Sentient Agent Framework
 * and processing the events they emit. It handles Server-Sent Events (SSE) and converts
 * them to strongly-typed response events.
 *
 * @example
 * ```typescript
 * const client = new SentientAgentClient();
 * for await (const event of client.queryAgent('What is the weather?', 'http://localhost:3000/assist')) {
 *   // Process events based on their type
 *   switch (event.content_type) {
 *     case EventContentType.TEXTBLOCK:
 *       console.log(`${event.event_name}: ${event.content}`);
 *       break;
 *     // Handle other event types...
 *   }
 * }
 * ```
 *
 * @module sentient-agent-framework/client
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

import { ulid } from 'ulid';
import { ResponseEvent } from '../interface/events';
import { ResponseEventAdapter as ResponseEventAdapterImpl } from '../implementation/response_event_adapter';

/**
 * Interface for a server-sent event.
 */
interface ServerSentEvent {
  event: string;
  data: string;
  json(): any;
}

/**
 * Options for the SentientAgentClient constructor.
 */
interface SentientAgentClientOptions {
  /**
   * Session object to use for the client.
   * If not provided, a new session will be created.
   */
  session?: {
    processor_id: string;
    activity_id: string;
    request_id: string;
    interactions: any[];
  };
}

/**
 * Client for interacting with Sentient Agent Framework.
 */
export class SentientAgentClient {
  private processor_id: string;
  private activity_id: string;
  private request_id: string;
  private interactions: any[];

  /**
   * Create a new SentientAgentClient.
   * @param options Options for the client.
   */
  constructor(options?: SentientAgentClientOptions) {
    if (options?.session) {
      this.processor_id = options.session.processor_id;
      this.activity_id = options.session.activity_id;
      this.request_id = options.session.request_id;
      this.interactions = options.session.interactions;
    } else {
      this.processor_id = "sentient-chat-client";
      this.activity_id = ulid();
      this.request_id = ulid();
      this.interactions = [];
    }
  }

  /**
   * Process a server-sent event into a response event.
   * @param event The server-sent event to process.
   * @returns The processed response event.
   */
  async processEvent(event: ServerSentEvent): Promise<ResponseEvent> {
    return ResponseEventAdapterImpl.validateJson(event.json());
  }

  /**
   * Query an agent with a prompt.
   * @param prompt The prompt to send to the agent.
   * @param url The URL of the agent server.
   * @returns An async iterator of response events.
   */
  async *queryAgent(
    prompt: string,
    url: string = "http://0.0.0.0:8000/assist"
  ): AsyncGenerator<ResponseEvent> {
    const query_id = ulid();
    const body = JSON.stringify({
      query: {
        id: query_id,
        prompt: prompt
      },
      session: {
        processor_id: this.processor_id,
        activity_id: this.activity_id,
        request_id: this.request_id,
        interactions: this.interactions
      }
    });

    const headers = {
      "Content-Type": "application/json"
    };

    // Create an EventSource for SSE
    const response = await fetch(url, {
      method: "POST",
      headers,
      body
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages
        const messages = buffer.split("\n\n");
        buffer = messages.pop() || ""; // Keep the last incomplete message in the buffer
        
        for (const message of messages) {
          if (!message.trim()) continue;
          
          const lines = message.split("\n");
          const eventType = lines[0].startsWith("event:") ? lines[0].slice(6).trim() : "";
          const data = lines[1].startsWith("data:") ? lines[1].slice(5).trim() : "";
          
          if (eventType && data) {
            const sseEvent: ServerSentEvent = {
              event: eventType,
              data,
              json: () => JSON.parse(data)
            };
            
            yield await this.processEvent(sseEvent);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get the current session object.
   * @returns The current session object.
   */
  getSession() {
    return {
      processor_id: this.processor_id,
      activity_id: this.activity_id,
      request_id: this.request_id,
      interactions: this.interactions
    };
  }
}