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
  /**
   * Default URL for the agent server.
   */
  defaultAgentUrl?: string;
}

/**
 * Client for interacting with Sentient Agent Framework.
 */
export class SentientAgentClient {
  private processor_id: string;
  private activity_id: string;
  private request_id: string;
  private interactions: any[];
  private defaultAgentUrl: string;

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
    // Use provided default URL or a sensible default
    this.defaultAgentUrl = options?.defaultAgentUrl || "http://localhost:8000/assist";
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
    url?: string // Make URL optional
  ): AsyncGenerator<ResponseEvent> {
    const targetUrl = url || this.defaultAgentUrl; // Use default if not provided
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
    const response = await fetch(targetUrl, {
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
      yield* this.parseSSEStream(reader, decoder);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parses the SSE stream from the response body.
   * @param reader The ReadableStreamDefaultReader for the response body.
   * @param decoder The TextDecoder instance.
   * @returns An async generator yielding ResponseEvent objects.
   */
  private async *parseSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder
  ): AsyncGenerator<ResponseEvent> {
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining data in the buffer after the stream ends
        if (buffer.trim()) {
           const sseEvent = this.parseSSEMessage(buffer);
           if (sseEvent) {
             yield await this.processEvent(sseEvent);
           }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const messages = buffer.split("\n\n");
      buffer = messages.pop() || ""; // Keep the last incomplete message

      for (const message of messages) {
         const sseEvent = this.parseSSEMessage(message);
         if (sseEvent) {
           yield await this.processEvent(sseEvent);
         }
      }
    }
  }

  /**
   * Parses a single SSE message string into a ServerSentEvent object.
   * @param message The raw SSE message string.
   * @returns A ServerSentEvent object or null if parsing fails.
   */
  private parseSSEMessage(message: string): ServerSentEvent | null {
    if (!message.trim()) return null;

    const lines = message.split("\n");
    let eventType = "";
    let data = "";

    for (const line of lines) {
        if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
            // Accumulate data lines if they exist
            data += (data ? "\n" : "") + line.slice(5).trim();
        }
        // Ignore other lines like id:, retry:, comments (:)
    }

    if (eventType && data) {
      try {
        // Attempt to parse immediately to catch errors early
        const jsonData = JSON.parse(data);
        return {
          event: eventType,
          data,
          json: () => jsonData // Return pre-parsed JSON
        };
      } catch (e) {
         console.error("Failed to parse SSE data as JSON:", data, e);
         return null; // Or handle error appropriately
      }
    }
    return null;
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