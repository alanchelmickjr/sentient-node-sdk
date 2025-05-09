"use strict";
/**
 * DefaultServer Implementation
 *
 * This module provides a default server implementation for the Sentient Agent Framework.
 * It creates an Express server that handles agent requests and streams responses using
 * Server-Sent Events (SSE). The server can be used standalone or integrated with
 * existing Express, Next.js, or Fastify applications.
 *
 * @example
 * ```typescript
 * // Create an agent
 * const agent = new MyAgent();
 *
 * // Create a server
 * const server = new DefaultServer(agent);
 *
 * // Run the server
 * server.run('0.0.0.0', 3000);
 * ```
 *
 * @module sentient-agent-framework/implementation/default-server
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultServer = void 0;
const express_1 = __importDefault(require("express"));
const default_hook_1 = require("./default_hook");
const default_response_handler_1 = require("./default_response_handler");
const default_session_1 = require("./default_session");
const events_1 = require("../interface/events");
const identity_1 = require("../interface/identity");
/**
 * Default server implementation for Sentient Agent Framework.
 * Provides an Express server that handles agent requests and streams responses.
 * Can also be used with Next.js, Fastify, or other Node.js HTTP frameworks.
 */
class DefaultServer {
    _agent;
    _app;
    /**
     * Create a new DefaultServer.
     * @param agent The agent to serve.
     */
    constructor(agent) {
        this._agent = agent;
        this._app = (0, express_1.default)();
        // Configure middleware for parsing JSON requests
        this._app.use(express_1.default.json());
        // Bind endpoint
        this._app.post('/assist', this.assistEndpoint.bind(this));
        // LOG: Construction
        console.info('[DefaultServer][LOG] Created DefaultServer and bound /assist endpoint.');
    }
    /**
     * Run the server on the specified host and port.
     * Use this method when running as a standalone Express server.
     * @param host The host to listen on.
     * @param port The port to listen on.
     */
    run(host = '0.0.0.0', port = 8000) {
        this._app.listen(port, host, () => {
            console.info(`[DefaultServer][LOG] Server listening on http://${host}:${port}`);
        });
    }
    /**
     * Handle a request directly.
     * Use this method when integrating with Next.js, Fastify, or other frameworks.
     * @param req The HTTP request object.
     * @param res The HTTP response object.
     * @returns A promise that resolves when the request is handled.
     */
    async handleRequest(req, res) {
        // LOG: Handle request
        console.info('[DefaultServer][LOG] Handling request directly');
        // Extract body from request (handles both Express and Next.js)
        const body = req.body || {};
        // Create agent request
        const agentReq = {
            query: body.query || { id: 'unknown', prompt: '' },
            session: body.session || {}
        };
        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // Stream agent output
        await this.streamAgentOutput(agentReq, res);
    }
    /**
     * Stream agent output to the client.
     * @param agentReq The agent request.
     * @param res The HTTP response object.
     */
    async streamAgentOutput(agentReq, res) {
        // LOG: Streaming start
        console.info('[DefaultServer][LOG] Starting streamAgentOutput');
        // Create session, identity, queue, hook, response handler
        const session = new default_session_1.DefaultSession(agentReq.session || {});
        const identity = new identity_1.Identity(session.processor_id, this._agent.name);
        const responseQueue = []; // Replace with async queue if needed
        const hook = new default_hook_1.DefaultHook({ queue: responseQueue });
        const responseHandler = new default_response_handler_1.DefaultResponseHandler(identity, hook);
        // Start assist task (assume Promise)
        // Start assist task and handle potential errors
        this._agent.assist(session, agentReq.query, responseHandler)
            .then(() => {
            console.info('[DefaultServer][LOG] Agent assist promise resolved.');
            // Ensure completion is signaled if agent finishes without explicitly calling complete()
            if (!responseHandler.isComplete) {
                console.warn('[DefaultServer][WARN] Agent assist promise resolved but handler not complete. Forcing completion.');
                return responseHandler.complete();
            }
        })
            .catch(async (err) => {
            console.error('[DefaultServer][ERROR] Agent assist error:', err);
            // Ensure error is emitted back to client if stream is still open
            if (!responseHandler.isComplete) {
                try {
                    await responseHandler.emitError(err.message || 'Agent assist failed', err.code || 500, { stack: err.stack });
                    // Ensure stream is closed after error
                    await responseHandler.complete();
                }
                catch (emitErr) {
                    console.error('[DefaultServer][ERROR] Failed to emit error back to client:', emitErr);
                }
            }
            // Mark as done to stop the streaming loop even on error
            done = true;
        });
        // Simulate event streaming from queue
        let done = false;
        while (!done) {
            if (responseQueue.length > 0) {
                const event = responseQueue.shift();
                res.write(`event: ${event.event_name}\n`);
                res.write(`data: ${JSON.stringify(event)}\n\n`);
                if (event.content_type === events_1.EventContentType.DONE) {
                    done = true;
                }
            }
            else {
                // If queue is empty, wait briefly
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        res.end();
        // LOG: Streaming end
        console.info('[DefaultServer][LOG] Finished streamAgentOutput');
    }
    /**
     * Handle requests to the /assist endpoint.
     * @param req The Express request.
     * @param res The Express response.
     */
    async assistEndpoint(req, res) {
        // LOG: /assist endpoint hit
        console.info('[DefaultServer][LOG] /assist endpoint received request');
        // Parse AgentRequest from req.body
        const agentReq = req.body;
        await this.streamAgentOutput(agentReq, res);
    }
}
exports.DefaultServer = DefaultServer;
//# sourceMappingURL=default_server.js.map