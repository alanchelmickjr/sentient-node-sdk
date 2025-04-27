import { AbstractAgent } from '../interface/agent';
/**
 * Default server implementation for Sentient Agent Framework.
 * Provides an Express server that handles agent requests and streams responses.
 */
export declare class DefaultServer {
    private _agent;
    private _app;
    /**
     * Create a new DefaultServer.
     * @param agent The agent to serve.
     */
    constructor(agent: AbstractAgent);
    /**
     * Run the server on the specified host and port.
     * @param host The host to listen on.
     * @param port The port to listen on.
     */
    run(host?: string, port?: number): void;
    /**
     * Stream agent output to the client.
     * @param agentReq The agent request.
     * @param res The Express response.
     */
    private streamAgentOutput;
    /**
     * Handle requests to the /assist endpoint.
     * @param req The Express request.
     * @param res The Express response.
     */
    private assistEndpoint;
}
