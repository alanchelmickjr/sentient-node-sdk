import { AbstractAgent } from '../interface/agent';
/**
 * Default server implementation for Sentient Agent Framework.
 * Provides an Express server that handles agent requests and streams responses.
 * Can also be used with Next.js, Fastify, or other Node.js HTTP frameworks.
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
     * Use this method when running as a standalone Express server.
     * @param host The host to listen on.
     * @param port The port to listen on.
     */
    run(host?: string, port?: number): void;
    /**
     * Handle a request directly.
     * Use this method when integrating with Next.js, Fastify, or other frameworks.
     * @param req The HTTP request object.
     * @param res The HTTP response object.
     * @returns A promise that resolves when the request is handled.
     */
    handleRequest(req: any, res: any): Promise<void>;
    /**
     * Stream agent output to the client.
     * @param agentReq The agent request.
     * @param res The HTTP response object.
     */
    private streamAgentOutput;
    /**
     * Handle requests to the /assist endpoint.
     * @param req The Express request.
     * @param res The Express response.
     */
    private assistEndpoint;
}
