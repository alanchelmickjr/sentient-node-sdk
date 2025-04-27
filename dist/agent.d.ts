/**
* NOTE: This file requires @types/node for process and __dirname.
* Run: npm i --save-dev @types/node
*/
import { AgentConfig } from './agent_config';
import { Model } from './agent_tools/model/model';
export declare class Agent {
    readonly config: AgentConfig;
    model: Model;
    private tools;
    private isInitialized;
    constructor();
    /**
     * Asynchronous initialization to load model and tools.
     * Must be called after constructor and before run().
     */
    init(): Promise<void>;
    private loadTools;
    /**
     * Run the agent and all enabled tools concurrently.
     * Make sure init() has been called successfully before calling run().
     */
    run(): Promise<void>;
}
