#!/usr/bin/env node
"use strict";
/**
 * Sentient Agent Framework CLI
 *
 * A command-line interface for testing agents built with the Sentient Agent Framework.
 * This CLI allows you to connect to a running agent server and interact with it through
 * a simple text interface. It displays the events received from the agent, including
 * text blocks, JSON documents, streaming text, and error messages.
 *
 * Usage:
 *   pnpm run cli
 *
 * @module sentient-agent-framework/cli
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */
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
const sentient_agent_client_1 = require("./client/sentient_agent_client");
const events_1 = require("./interface/events");
const readline = __importStar(require("readline"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Type guards for event types
 */
function isTextChunkEvent(event) {
    return event.content_type === events_1.EventContentType.TEXT_STREAM;
}
function isDocumentEvent(event) {
    return event.content_type === events_1.EventContentType.JSON;
}
function isTextBlockEvent(event) {
    return event.content_type === events_1.EventContentType.TEXTBLOCK;
}
function isErrorEvent(event) {
    return event.content_type === events_1.EventContentType.ERROR;
}
/**
 * CLI client for testing the Sentient Agent Framework
 */
class SentientAgentClientCLI {
    client;
    rl;
    constructor() {
        this.client = new sentient_agent_client_1.SentientAgentClient();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    /**
     * Print the title from title.txt if it exists
     */
    printTitle() {
        try {
            const titlePath = path.join(process.cwd(), 'title.txt');
            if (fs.existsSync(titlePath)) {
                const title = fs.readFileSync(titlePath, 'utf-8');
                console.log(title);
            }
            else {
                console.log('=== Sentient Agent Framework CLI ===');
            }
            console.log();
        }
        catch (error) {
            console.log('=== Sentient Agent Framework CLI ===');
            console.log();
        }
    }
    /**
     * Print a horizontal line
     */
    printHorizontalLine() {
        console.log('-'.repeat(100));
        console.log();
    }
    /**
     * Ask a question and return the answer
     */
    async ask(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer);
            });
        });
    }
    /**
     * Start the chat
     */
    async chat() {
        // Print title
        this.printTitle();
        // Print horizontal line
        this.printHorizontalLine();
        // Print instructions
        console.log("To exit just type 'exit' and press enter.");
        console.log();
        // Get agent URL
        const url = await this.ask("Enter agent URL: ");
        if (url === 'exit') {
            this.rl.close();
            return;
        }
        console.log();
        // Print horizontal line
        this.printHorizontalLine();
        // Query agent
        while (true) {
            const prompt = await this.ask("Enter your message: ");
            if (prompt === 'exit') {
                break;
            }
            console.log();
            let streamId = null;
            try {
                // Ensure URL ends with /assist
                const assistUrl = url.endsWith('/assist') ? url : `${url}/assist`;
                console.log(`Connecting to: ${assistUrl}`);
                for await (const event of this.client.queryAgent(prompt, assistUrl)) {
                    streamId = this.handleEvent(event, streamId);
                }
            }
            catch (error) {
                console.error('Error querying agent:', error);
                console.log();
                this.printHorizontalLine();
            }
        }
        this.rl.close();
    }
    /**
     * Handle a single response event.
     * @param event The response event.
     * @param currentStreamId The current stream ID being processed.
     * @returns The updated stream ID.
     */
    handleEvent(event, currentStreamId) {
        let updatedStreamId = currentStreamId;
        switch (event.content_type) {
            case events_1.EventContentType.DONE:
                this.handleDoneEvent();
                break;
            case events_1.EventContentType.TEXT_STREAM:
                if (isTextChunkEvent(event)) {
                    updatedStreamId = this.handleTextChunkEvent(event, currentStreamId);
                }
                break;
            case events_1.EventContentType.JSON:
                if (isDocumentEvent(event)) {
                    this.handleDocumentEvent(event);
                }
                break;
            case events_1.EventContentType.TEXTBLOCK:
                if (isTextBlockEvent(event)) {
                    this.handleTextBlockEvent(event);
                }
                break;
            case events_1.EventContentType.ERROR:
                if (isErrorEvent(event)) {
                    this.handleErrorEvent(event);
                }
                break;
        }
        return updatedStreamId;
    }
    handleDoneEvent() {
        console.log();
        this.printHorizontalLine();
    }
    handleTextChunkEvent(event, currentStreamId) {
        let updatedStreamId = currentStreamId;
        if (currentStreamId !== event.stream_id) {
            updatedStreamId = event.stream_id;
            console.log(); // Start new line for new stream
            console.log(event.event_name); // Print event name once
        }
        process.stdout.write(event.content);
        if (event.is_complete) {
            console.log(); // End line after stream completion
        }
        return updatedStreamId;
    }
    handleDocumentEvent(event) {
        console.log(event.event_name);
        console.log(JSON.stringify(event.content, null, 4));
        console.log();
    }
    handleTextBlockEvent(event) {
        console.log(event.event_name);
        console.log(event.content);
        console.log();
    }
    handleErrorEvent(event) {
        console.log(event.event_name);
        console.error(`Error: ${event.content.error_message}`);
        if (event.content.details) {
            console.error(JSON.stringify(event.content.details, null, 4));
        }
        console.log();
    }
}
// Run the CLI
const cli = new SentientAgentClientCLI();
cli.chat().catch(console.error);
//# sourceMappingURL=cli.js.map