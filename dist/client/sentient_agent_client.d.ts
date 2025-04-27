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
import { ResponseEvent } from '../interface/events';
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
export declare class SentientAgentClient {
    private processor_id;
    private activity_id;
    private request_id;
    private interactions;
    /**
     * Create a new SentientAgentClient.
     * @param options Options for the client.
     */
    constructor(options?: SentientAgentClientOptions);
    /**
     * Process a server-sent event into a response event.
     * @param event The server-sent event to process.
     * @returns The processed response event.
     */
    processEvent(event: ServerSentEvent): Promise<ResponseEvent>;
    /**
     * Query an agent with a prompt.
     * @param prompt The prompt to send to the agent.
     * @param url The URL of the agent server.
     * @returns An async iterator of response events.
     */
    queryAgent(prompt: string, url?: string): AsyncGenerator<ResponseEvent>;
    /**
     * Get the current session object.
     * @returns The current session object.
     */
    getSession(): {
        processor_id: string;
        activity_id: string;
        request_id: string;
        interactions: any[];
    };
}
export {};
