import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
// TODO: Import actual TS versions when available
import { DefaultHook } from './default_hook';
import { DefaultResponseHandler } from './default_response_handler';
import { DefaultSession } from './default_session';
import { AbstractAgent } from '../interface/agent';
import { DoneEvent } from '../interface/events';
import { Identity } from '../interface/identity';
import { Request as AgentRequest } from '../interface/request';

export class DefaultServer {
  private _agent: AbstractAgent;
  private _app: express.Express;

  constructor(agent: AbstractAgent) {
    this._agent = agent;
    this._app = express();

    // Bind endpoint
    this._app.post('/assist', this.assistEndpoint.bind(this));
    // LOG: Construction
    console.info('[DefaultServer][LOG] Created DefaultServer and bound /assist endpoint.');
  }

  run(host: string = '0.0.0.0', port: number = 8000) {
    this._app.listen(port, host, () => {
      console.info(`[DefaultServer][LOG] Server listening on http://${host}:${port}`);
    });
  }

  private async streamAgentOutput(agentReq: AgentRequest, res: ExpressResponse) {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // LOG: Streaming start
    console.info('[DefaultServer][LOG] Starting streamAgentOutput');

    // Create session, identity, queue, hook, response handler
    const session = new DefaultSession(agentReq.session);
    const identity = new Identity(session.processorId, this._agent.name);
    const responseQueue: Array<any> = []; // Replace with async queue if needed
    const hook = new DefaultHook({ queue: responseQueue });
    const responseHandler = new DefaultResponseHandler(identity, hook);

    // Start assist task (assume Promise)
    this._agent.assist(session, agentReq.query, responseHandler)
      .then(() => console.info('[DefaultServer][LOG] Agent assist completed.'))
      .catch(err => console.error('[DefaultServer][LOG] Agent assist error:', err));

    // Simulate event streaming from queue
    let done = false;
    while (!done) {
      if (responseQueue.length > 0) {
        const event = responseQueue.shift();
        res.write(`event: ${event.eventName}\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (event instanceof DoneEvent) {
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

  private async assistEndpoint(req: ExpressRequest, res: ExpressResponse) {
    // LOG: /assist endpoint hit
    console.info('[DefaultServer][LOG] /assist endpoint received request');
    // TODO: Parse AgentRequest from req.body
    const agentReq = req.body as AgentRequest;
    await this.streamAgentOutput(agentReq, res);
  }
}