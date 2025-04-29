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

import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { DefaultHook } from './default_hook';
import { DefaultResponseHandler } from './default_response_handler';
import { DefaultSession } from './default_session';
import { AbstractAgent } from '../interface/agent';
import { EventContentType } from '../interface/events';
import { Identity } from '../interface/identity';
import { Request as AgentRequest } from '../interface/request';

/**
 * Default server implementation for Sentient Agent Framework.
 * Provides an Express server that handles agent requests and streams responses.
 * Can also be used with Next.js, Fastify, or other Node.js HTTP frameworks.
 */
export class DefaultServer {
  private _agent: AbstractAgent;
  private _app: express.Express;

  /**
   * Create a new DefaultServer.
   * @param agent The agent to serve.
   */
  constructor(agent: AbstractAgent) {
    this._agent = agent;
    this._app = express();

    // Configure middleware for parsing JSON requests
    this._app.use(express.json());
    
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
  run(host: string = '0.0.0.0', port: number = 8000) {
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
  async handleRequest(req: any, res: any): Promise<void> {
    // LOG: Handle request
    console.info('[DefaultServer][LOG] Handling request directly');
    
    // Extract body from request (handles both Express and Next.js)
    const body = req.body || {};
    
    // Create agent request
    const agentReq: AgentRequest = {
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
  private async streamAgentOutput(agentReq: AgentRequest, res: any) {
    // LOG: Streaming start
    console.info('[DefaultServer][LOG] Starting streamAgentOutput');

    // Create session, identity, queue, hook, response handler
    const session = new DefaultSession(agentReq.session || {});
    const identity = new Identity(session.processor_id, this._agent.name);
    const responseQueue: Array<any> = []; // Replace with async queue if needed
    const hook = new DefaultHook({ queue: responseQueue });
    const responseHandler = new DefaultResponseHandler(identity, hook);

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
            await responseHandler.emitError(
              err.message || 'Agent assist failed',
              err.code || 500,
              { stack: err.stack }
            );
            // Ensure stream is closed after error
            await responseHandler.complete();
          } catch (emitErr) {
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
        if (event.content_type === EventContentType.DONE) {
          done = true;
        }
      } else {
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
  private async assistEndpoint(req: ExpressRequest, res: ExpressResponse) {
    // LOG: /assist endpoint hit
    console.info('[DefaultServer][LOG] /assist endpoint received request');
    
    // Parse AgentRequest from req.body
    const agentReq = req.body as AgentRequest;
    
    await this.streamAgentOutput(agentReq, res);
  }
}