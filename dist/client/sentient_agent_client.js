"use strict";
/**
 * SentientAgentClient: Client for interacting with Sentient Agent Framework.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentientAgentClient = void 0;
const ulid_1 = require("ulid");
const response_event_adapter_1 = require("../implementation/response_event_adapter");
/**
 * Client for interacting with Sentient Agent Framework.
 */
class SentientAgentClient {
    processor_id;
    activity_id;
    request_id;
    interactions;
    /**
     * Create a new SentientAgentClient.
     * @param options Options for the client.
     */
    constructor(options) {
        if (options?.session) {
            this.processor_id = options.session.processor_id;
            this.activity_id = options.session.activity_id;
            this.request_id = options.session.request_id;
            this.interactions = options.session.interactions;
        }
        else {
            this.processor_id = "sentient-chat-client";
            this.activity_id = (0, ulid_1.ulid)();
            this.request_id = (0, ulid_1.ulid)();
            this.interactions = [];
        }
    }
    /**
     * Process a server-sent event into a response event.
     * @param event The server-sent event to process.
     * @returns The processed response event.
     */
    async processEvent(event) {
        return response_event_adapter_1.ResponseEventAdapter.validateJson(event.json());
    }
    /**
     * Query an agent with a prompt.
     * @param prompt The prompt to send to the agent.
     * @param url The URL of the agent server.
     * @returns An async iterator of response events.
     */
    async *queryAgent(prompt, url = "http://0.0.0.0:8000/assist") {
        const query_id = (0, ulid_1.ulid)();
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
                    if (!message.trim())
                        continue;
                    const lines = message.split("\n");
                    const eventType = lines[0].startsWith("event:") ? lines[0].slice(6).trim() : "";
                    const data = lines[1].startsWith("data:") ? lines[1].slice(5).trim() : "";
                    if (eventType && data) {
                        const sseEvent = {
                            event: eventType,
                            data,
                            json: () => JSON.parse(data)
                        };
                        yield await this.processEvent(sseEvent);
                    }
                }
            }
        }
        finally {
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
exports.SentientAgentClient = SentientAgentClient;
//# sourceMappingURL=sentient_agent_client.js.map