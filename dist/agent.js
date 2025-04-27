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
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs/promises")); // Use promise-based fs module
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
    model; // Definite assignment assertion (!) - assigned in init()
    tools = {};
    isInitialized = false;
    constructor() {
        // Basic setup in constructor
        logger.info("[AGENT] Initializing agent...");
        dotenv.config(); // Load .env file into process.env
        this.config = new agent_config_1.AgentConfig();
    }
    /**
     * Asynchronous initialization to load model and tools.
     * Must be called after constructor and before run().
     */
    async init() {
        if (this.isInitialized) {
            logger.warn("[AGENT] Agent already initialized.");
            return;
        }
        logger.info("[AGENT] Performing async initialization...");
        // Initialize model
        try {
            // LOG: Begin dynamic model import
            logger.info("[AGENT][LOG] Importing model class from './agent_tools/model/model'...");
            const { Model: ModelClass } = await import('./agent_tools/model/model.js');
            logger.info("[AGENT][LOG] Model class imported, instantiating...");
            this.model = new ModelClass({
                apiKey: process.env.MODEL_API_KEY,
            });
            logger.info("[AGENT][LOG] Model instantiated.");
            logger.info("[AGENT] Model initialized.");
        }
        catch (error) {
            logger.error(`[AGENT] Failed to initialize Model. Error: ${error?.message || error}`);
            throw new Error("Model initialization failed"); // Rethrow or handle appropriately
        }
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
            const entries = await fs.readdir(toolsDirPath, { withFileTypes: true });
            for (const entry of entries) {
                // Look for directories inside agent_tools, excluding 'model'
                if (entry.isDirectory() && entry.name !== 'model') {
                    const toolName = entry.name;
                    const toolConfigKey = `${toolName.toUpperCase()}_ENABLED`;
                    // Check if tool is enabled in agent config
                    // Use type assertion or a safer check if necessary
                    if (!this.config[toolConfigKey]) {
                        logger.info(`[AGENT] Skipping ${toolName} tool (disabled in config).`);
                        continue;
                    }
                    try {
                        logger.info(`[AGENT] Loading ${toolName} tool...`);
                        // LOG: Begin dynamic tool import
                        logger.info(`[AGENT][LOG] Importing tool module at '${toolName}' from '${moduleRelativePath}'...`);
                        const moduleRelativePath = `./agent_tools/${toolName}/${toolName}.js`;
                        // Dynamically import the tool module
                        const module = await import(moduleRelativePath);
                        logger.info(`[AGENT][LOG] Tool module '${toolName}' imported, resolving class...`);
                        // Get the main class (assumed to be capitalized version of the module name)
                        const className = toolName.charAt(0).toUpperCase() + toolName.slice(1);
                        const ToolClass = module[className]; // Type assertion
                        if (!ToolClass || typeof ToolClass !== 'function') {
                            logger.error(`[AGENT][LOG] Tool class '${className}' not found in module '${moduleRelativePath}'.`);
                            throw new Error(`Class '${className}' not found or not a constructor in module '${moduleRelativePath}'.`);
                        }
                        // Gather required environment variables for the tool
                        const envVarPrefix = `${toolName.toUpperCase()}_`;
                        const toolEnvVars = {};
                        for (const key in process.env) {
                            if (key.startsWith(envVarPrefix)) {
                                const cleanKey = key.replace(envVarPrefix, "").toLowerCase();
                                toolEnvVars[cleanKey] = process.env[key];
                            }
                        }
                        // LOG: Instantiating tool
                        logger.info(`[AGENT][LOG] Instantiating tool '${className}' with env and model...`);
                        // Initialize tool with environment variables and model
                        this.tools[toolName] = new ToolClass({ ...toolEnvVars, model: this.model });
                        logger.info(`[AGENT][LOG] Tool '${className}' instantiated.`);
                        logger.info(`[AGENT] Loaded ${toolName} tool.`);
                    }
                    catch (e) {
                        logger.error(`[AGENT] Failed to load ${toolName} tool. Error: ${e?.message || String(e)}.`);
                        // Optional: decide if loading failure of one tool should stop the agent
                    }
                }
            }
        }
        catch (error) {
            logger.error(`[AGENT] Error reading tools directory '${toolsDirPath}'. Error: ${error?.message || String(error)}`);
            // Optional: decide if failure to read directory should stop the agent
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