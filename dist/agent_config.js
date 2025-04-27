"use strict";
// src/agent_config.ts (assuming this file path)
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentConfig = void 0;
/**
 * Configuration class for the Agent.
 * Defines which tools are enabled and potentially other settings.
 */
class AgentConfig {
    // Public properties representing configuration flags.
    // Initialized with default values here.
    // These could potentially be loaded from a config file or environment variables
    // in the constructor or a separate initialization method.
    TWITTER_ENABLED = true;
    DISCORD_ENABLED = true;
    // Add other potential configuration flags here following the same pattern
    // public SEARCH_ENABLED: boolean = false;
    // public MEMORY_ENABLED: boolean = true;
    constructor() {
        // The constructor is where you might override the defaults based on
        // external sources like environment variables or configuration files.
        // Example: Overriding from environment variables
        // (Using ?? to keep the default if the env var is not set)
        // Note: process.env values are strings, so comparison with 'true' is needed.
        // A more robust check might be needed depending on expected env var values.
        /*
        if (process.env.TWITTER_ENABLED !== undefined) {
            this.TWITTER_ENABLED = process.env.TWITTER_ENABLED.toLowerCase() === 'true';
        }
        if (process.env.DISCORD_ENABLED !== undefined) {
            this.DISCORD_ENABLED = process.env.DISCORD_ENABLED.toLowerCase() === 'true';
        }
        */
        // You could also load from a JSON/YAML file here using fs.readFileSync etc.
        // For this direct conversion, we'll stick to the defaults defined above.
        // console.log("AgentConfig initialized with defaults (or overrides if implemented).");
        // console.log(` - TWITTER_ENABLED: ${this.TWITTER_ENABLED}`);
        // console.log(` - DISCORD_ENABLED: ${this.DISCORD_ENABLED}`);
    }
}
exports.AgentConfig = AgentConfig;
//# sourceMappingURL=agent_config.js.map