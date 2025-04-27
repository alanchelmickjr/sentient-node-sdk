/**
* NOTE: This file requires @types/node for process and __dirname.
* Run: npm i --save-dev @types/node
*/
// src/agent.ts

// Import only what's needed for the SDK
import * as path from 'path';
import { AgentConfig } from './agent_config'; // Assuming this exists

// Define a common interface for all tools
// Tools should implement this interface
interface ToolInterface {
    run(): Promise<void>; // Assume run is async
}

// Define the expected constructor signature for Tool classes
// Allows passing env vars and the model instance
interface ToolConstructor {
    new (options: { [key: string]: any }): ToolInterface;
}

// Simple logger replacement (use Pino/Winston in production)
const logger = {
    info: (msg: string) => console.info(msg),
    error: (msg: string) => console.error(msg),
    warn: (msg: string) => console.warn(msg),
};

export class Agent {
    public readonly config: AgentConfig;
    private tools: Record<string, ToolInterface> = {};
    private isInitialized = false;

    constructor() {
        // Basic setup in constructor
        logger.info("[AGENT] Initializing agent...");
        this.config = new AgentConfig();
    }

    /**
     * Asynchronous initialization to load tools.
     * Must be called after constructor and before run().
     */
    async init(): Promise<void> {
        if (this.isInitialized) {
            logger.warn("[AGENT] Agent already initialized.");
            return;
        }

        logger.info("[AGENT] Performing async initialization...");

        // Load tools
        await this.loadTools();

        this.isInitialized = true;
        logger.info("[AGENT] Agent initialization complete.");
    }

    private async loadTools(): Promise<void> {
        logger.info(`[AGENT] Loading agent tools...`);
        // Resolve path relative to the current file's directory
        const toolsDirPath = path.resolve(__dirname, 'agent_tools');

        try {
            // In the SDK version, we don't need to dynamically load tools
            // This is a placeholder for future tool loading logic
            logger.info(`[AGENT] Tool loading is not implemented in the SDK version.`);
        } catch (error: any) {
            logger.error(`[AGENT] Error loading tools. Error: ${error?.message || String(error)}`);
        }
    }

    /**
     * Run the agent and all enabled tools concurrently.
     * Make sure init() has been called successfully before calling run().
     */
    async run(): Promise<void> {
        if (!this.isInitialized) {
            logger.error("[AGENT] Agent not initialized. Call init() before run().");
            throw new Error("Agent not initialized");
        }

        logger.info("[AGENT] Running agent...");

        const toolPromises: Promise<void>[] = [];
        const toolNames = Object.keys(this.tools);

        if (toolNames.length === 0) {
            logger.warn("[AGENT] No tools loaded or enabled to run.");
            return;
        }

        logger.info(`[AGENT] Starting ${toolNames.length} enabled tools...`);

        for (const name of toolNames) {
            const tool = this.tools[name];
            logger.info(`[AGENT][LOG] Preparing to run tool '${name}'...`);
            logger.info(`[AGENT] Starting ${name} tool run...`);
            // Wrap tool.run() in a promise chain for better error context
            const runPromise = tool.run()
                .then(() => {
                    logger.info(`[AGENT][LOG] Tool '${name}' run resolved.`);
                    logger.info(`[AGENT] ${name} tool finished successfully.`);
                })
                .catch(err => {
                    // Log error here, it will also be caught by Promise.allSettled
                    logger.error(`[AGENT][LOG] Tool '${name}' run rejected.`);
                    logger.error(`[AGENT] ${name} tool failed during execution. Error: ${err?.message || String(err)}`);
                    // Re-throw to ensure Promise.allSettled sees it as rejected
                    throw err;
                });
            toolPromises.push(runPromise);
        }

        // Wait for all tool promises to settle (either resolve or reject)
        const results = await Promise.allSettled(toolPromises);

        logger.info("[AGENT] All tool runs initiated. Waiting for completion...");

        let allSucceeded = true;
        results.forEach((result, index) => {
            const toolName = toolNames[index];
            if (result.status === 'rejected') {
                allSucceeded = false;
                // Error already logged in the catch block above
                logger.error(`[AGENT] Tool ${toolName} run ended with failure.`);
            } else {
                logger.info(`[AGENT] Tool ${toolName} run ended successfully.`);
            }
        });

        if (allSucceeded) {
            logger.info("[AGENT] All tools completed successfully.");
        } else {
            logger.warn("[AGENT] Some tools failed during execution. Check logs for details.");
        }
    }
}

// Example Usage (in another file, e.g., main.ts)
/*
import { Agent } from './agent';

async function main() {
    const agent = new Agent();
    try {
        await agent.init(); // Initialize model and load tools
        await agent.run();  // Run all loaded tools
        console.log("Agent run finished.");
    } catch (error) {
        console.error("Agent failed:", error);
        process.exit(1);
    }
}

main();
*/