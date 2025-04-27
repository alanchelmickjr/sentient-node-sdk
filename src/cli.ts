#!/usr/bin/env node

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

import { SentientAgentClient } from './client/sentient_agent_client';
import {
  EventContentType,
  ResponseEvent,
  TextChunkEvent,
  DocumentEvent,
  TextBlockEvent,
  ErrorEvent
} from './interface/events';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Type guards for event types
 */
function isTextChunkEvent(event: ResponseEvent): event is TextChunkEvent {
  return event.content_type === EventContentType.TEXT_STREAM;
}

function isDocumentEvent(event: ResponseEvent): event is DocumentEvent {
  return event.content_type === EventContentType.JSON;
}

function isTextBlockEvent(event: ResponseEvent): event is TextBlockEvent {
  return event.content_type === EventContentType.TEXTBLOCK;
}

function isErrorEvent(event: ResponseEvent): event is ErrorEvent {
  return event.content_type === EventContentType.ERROR;
}

/**
 * CLI client for testing the Sentient Agent Framework
 */
class SentientAgentClientCLI {
  private client: SentientAgentClient;
  private rl: readline.Interface;

  constructor() {
    this.client = new SentientAgentClient();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Print the title from title.txt if it exists
   */
  printTitle(): void {
    try {
      const titlePath = path.join(process.cwd(), 'title.txt');
      if (fs.existsSync(titlePath)) {
        const title = fs.readFileSync(titlePath, 'utf-8');
        console.log(title);
      } else {
        console.log('=== Sentient Agent Framework CLI ===');
      }
      console.log();
    } catch (error) {
      console.log('=== Sentient Agent Framework CLI ===');
      console.log();
    }
  }

  /**
   * Print a horizontal line
   */
  printHorizontalLine(): void {
    console.log('-'.repeat(100));
    console.log();
  }

  /**
   * Ask a question and return the answer
   */
  async ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  /**
   * Start the chat
   */
  async chat(): Promise<void> {
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

      let streamId: string | null = null;

      try {
        // Ensure URL ends with /assist
        const assistUrl = url.endsWith('/assist') ? url : `${url}/assist`;
        console.log(`Connecting to: ${assistUrl}`);
        
        for await (const event of this.client.queryAgent(prompt, assistUrl)) {
          // Handle different event types
          switch (event.content_type) {
            case EventContentType.DONE:
              console.log();
              this.printHorizontalLine();
              break;

            case EventContentType.TEXT_STREAM:
              if (isTextChunkEvent(event)) {
                if (streamId !== event.stream_id) {
                  // Update stream id
                  streamId = event.stream_id;
                  // Print empty line
                  console.log();
                  // Print event name only once for each stream
                  console.log(event.event_name);
                }
                // Print stream
                process.stdout.write(event.content);
                if (event.is_complete) {
                  console.log();
                }
              }
              break;

            case EventContentType.JSON:
              if (isDocumentEvent(event)) {
                // Print event type
                console.log(event.event_name);
                // Pretty print event data
                console.log(JSON.stringify(event.content, null, 4));
                // Print empty line
                console.log();
              }
              break;

            case EventContentType.TEXTBLOCK:
              if (isTextBlockEvent(event)) {
                // Print event type
                console.log(event.event_name);
                // Print content
                console.log(event.content);
                // Print empty line
                console.log();
              }
              break;

            case EventContentType.ERROR:
              if (isErrorEvent(event)) {
                // Print event type
                console.log(event.event_name);
                // Print error message
                console.log(`Error: ${event.content.error_message}`);
                if (event.content.details) {
                  console.log(JSON.stringify(event.content.details, null, 4));
                }
                // Print empty line
                console.log();
              }
              break;
          }
        }
      } catch (error) {
        console.error('Error querying agent:', error);
        console.log();
        this.printHorizontalLine();
      }
    }

    this.rl.close();
  }
}

// Run the CLI
const cli = new SentientAgentClientCLI();
cli.chat().catch(console.error);