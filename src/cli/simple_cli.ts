/**
 * Simple CLI for backward compatibility
 * 
 * This is the original simple CLI implementation preserved for backward compatibility.
 * It provides basic agent interaction without the advanced features of the comprehensive CLI.
 */

import { SentientAgentClient } from '../client/sentient_agent_client';
import {
  EventContentType,
  ResponseEvent,
  TextChunkEvent,
  DocumentEvent,
  TextBlockEvent,
  ErrorEvent
} from '../interface/events';
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
 * Simple CLI client for testing the Sentient Agent Framework
 */
export class SimpleCLI {
  private client: SentientAgentClient;
  private rl: readline.Interface;

  constructor() {
    this.client = new SentientAgentClient('http://localhost:8000');
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
   * Run the simple CLI
   */
  async run(): Promise<void> {
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
        
        // Use the queryAgent method (note: this needs to be updated to work with the new client)
        await this.client.queryAgent(prompt, assistUrl);
        await this.client.processEvents(assistUrl);
        
        // Handle events from the interactions
        const interactions = (this.client as any).interactions;
        if (interactions && Array.isArray(interactions)) {
          for (const interaction of interactions) {
            if (interaction.responses) {
              for (const response of interaction.responses) {
                streamId = this.handleEvent(response.event, streamId);
              }
            }
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

  /**
   * Handle a single response event.
   * @param event The response event.
   * @param currentStreamId The current stream ID being processed.
   * @returns The updated stream ID.
   */
  private handleEvent(event: ResponseEvent, currentStreamId: string | null): string | null {
    let updatedStreamId = currentStreamId;
    switch (event.content_type) {
      case EventContentType.DONE:
        this.handleDoneEvent();
        break;
      case EventContentType.TEXT_STREAM:
        if (isTextChunkEvent(event)) {
          updatedStreamId = this.handleTextChunkEvent(event, currentStreamId);
        }
        break;
      case EventContentType.JSON:
        if (isDocumentEvent(event)) {
          this.handleDocumentEvent(event);
        }
        break;
      case EventContentType.TEXTBLOCK:
        if (isTextBlockEvent(event)) {
          this.handleTextBlockEvent(event);
        }
        break;
      case EventContentType.ERROR:
        if (isErrorEvent(event)) {
          this.handleErrorEvent(event);
        }
        break;
    }
    return updatedStreamId;
  }

  private handleDoneEvent(): void {
    console.log();
    this.printHorizontalLine();
  }

  private handleTextChunkEvent(event: TextChunkEvent, currentStreamId: string | null): string | null {
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

  private handleDocumentEvent(event: DocumentEvent): void {
    console.log(event.event_name);
    console.log(JSON.stringify(event.content, null, 4));
    console.log();
  }

  private handleTextBlockEvent(event: TextBlockEvent): void {
    console.log(event.event_name);
    console.log(event.content);
    console.log();
  }

  private handleErrorEvent(event: ErrorEvent): void {
    console.log(event.event_name);
    console.error(`Error: ${event.content.error_message}`);
    if (event.content.details) {
      console.error(JSON.stringify(event.content.details, null, 4));
    }
    console.log();
  }
}