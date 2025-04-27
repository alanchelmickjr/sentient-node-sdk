"use strict";
/**
* NOTE: This file requires @types/node for process and __dirname.
* Run: npm i --save-dev @types/node
*/
// src/agent.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
// Import only what's needed for the SDK
const path = __importStar(require("path"));
const agent_config_1 = require("./agent_config"); // Assuming this exists
// Simple logger replacement (use Pino/Winston in production)
const logger = {
    info: (msg) => console.info(msg),
    error: (msg) => console.error(msg),
    warn: (msg) => console.warn(msg),
};
class Agent {
    config;
    tools = {};
    isInitialized = false;
    constructor() {
        // Basic setup in constructor
        logger.info("[AGENT] Initializing agent...");
        this.config = new agent_config_1.AgentConfig();
    }
    /**
     * Asynchronous initialization to load tools.
     * Must be called after constructor and before run().
     */
    async init() {
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
    async loadTools() {
        logger.info(`[AGENT] Loading agent tools...`);
        // Resolve path relative to the current file's directory
        const toolsDirPath = path.resolve(__dirname, 'agent_tools');
        try {
            // In the SDK version, we don't need to dynamically load tools
            // This is a placeholder for future tool loading logic
            logger.info(`[AGENT] Tool loading is not implemented in the SDK version.`);
        }
        catch (error) {
            logger.error(`[AGENT] Error loading tools. Error: ${error?.message || String(error)}`);
        }
    }
    /**
     * Run the agent and all enabled tools concurrently.
     * Make sure init() has been called successfully before calling run().
     */
    async run() {
        if (!this.isInitialized) {
            logger.error("[AGENT] Agent not initialized. Call init() before run().");
            throw new Error("Agent not initialized");
        }
        logger.info("[AGENT] Running agent...");
        const toolPromises = [];
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
            }
            else {
                logger.info(`[AGENT] Tool ${toolName} run ended successfully.`);
            }
        });
        if (allSucceeded) {
            logger.info("[AGENT] All tools completed successfully.");
        }
        else {
            logger.warn("[AGENT] Some tools failed during execution. Check logs for details.");
        }
    }
}
exports.Agent = Agent;
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
//# sourceMappingURL=agent.js.map