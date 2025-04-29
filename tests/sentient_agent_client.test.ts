/**
 * Tests for the SentientAgentClient.
 */

import { SentientAgentClient } from '../src/client/sentient_agent_client';
import {
  DocumentEvent,
  DoneEvent,
  ErrorEvent,
  EventContentType,
  ResponseEvent, // Added missing import
  TextBlockEvent,
  TextChunkEvent
} from '../src/interface/events';

describe('SentientAgentClient', () => {
  let client: SentientAgentClient;

  beforeEach(() => {
    client = new SentientAgentClient();
  });

  test('should create a client with default session', () => {
    const session = client.getSession();
    expect(session.processor_id).toBe('sentient-chat-client');
    expect(session.activity_id).toBeDefined();
    expect(session.request_id).toBeDefined();
    expect(session.interactions).toEqual([]);
  });

  test('should create a client with custom session', () => {
    const customSession = {
      processor_id: 'custom-processor',
      activity_id: 'custom-activity',
      request_id: 'custom-request',
      interactions: [{ type: 'test' }]
    };
    
    const client = new SentientAgentClient({ session: customSession });
    const session = client.getSession();
    
    expect(session.processor_id).toBe('custom-processor');
    expect(session.activity_id).toBe('custom-activity');
    expect(session.request_id).toBe('custom-request');
    expect(session.interactions).toEqual([{ type: 'test' }]);
  });

  test('should process document event', async () => {
    const sseEvent = {
      event: 'test',
      data: JSON.stringify({
        id: 'test-id',
        source: 'test-source',
        event_name: 'test-event',
        content_type: EventContentType.JSON,
        content: { test: 'data' }
      }),
      json: function() { return JSON.parse(this.data); }
    };

    const result = await client.processEvent(sseEvent);
    
    expect(result).toMatchObject({
      id: 'test-id',
      source: 'test-source',
      event_name: 'test-event',
      content_type: EventContentType.JSON,
      content: { test: 'data' }
    });
  });

  test('should process text block event', async () => {
    const sseEvent = {
      event: 'test',
      data: JSON.stringify({
        id: 'test-id',
        source: 'test-source',
        event_name: 'test-event',
        content_type: EventContentType.TEXTBLOCK,
        content: 'test content'
      }),
      json: function() { return JSON.parse(this.data); }
    };

    const result = await client.processEvent(sseEvent);
    
    expect(result).toMatchObject({
      id: 'test-id',
      source: 'test-source',
      event_name: 'test-event',
      content_type: EventContentType.TEXTBLOCK,
      content: 'test content'
    });
  });

  test('should process error event', async () => {
    const sseEvent = {
      event: 'error',
      data: JSON.stringify({
        id: 'test-id',
        source: 'test-source',
        event_name: 'error',
        content_type: EventContentType.ERROR,
        content: {
          error_message: 'test error',
          error_code: 500
        }
      }),
      json: function() { return JSON.parse(this.data); }
    };

    const result = await client.processEvent(sseEvent);
    
    expect(result).toMatchObject({
      id: 'test-id',
      source: 'test-source',
      event_name: 'error',
      content_type: EventContentType.ERROR,
      content: {
        error_message: 'test error',
        error_code: 500
      }
    });
  });

  test('should query agent and process events', async () => {
    // Mock the global fetch function
    const mockFetch = jest.spyOn(global, 'fetch');

    // Simulate an SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        
        // Simulate different event types
        const textChunkEvent: TextChunkEvent = {
          id: 'evt-1',
          source: 'agent',
          event_name: 'text_chunk',
          stream_id: 'stream-1', // Added stream_id as it's required by StreamEvent
          is_complete: false,    // Added is_complete as it's required by StreamEvent
          content_type: EventContentType.TEXT_STREAM, // Corrected enum value
          content: 'Hello ' // Corrected content type to string
        };
        controller.enqueue(encoder.encode(`event: text_chunk\ndata: ${JSON.stringify(textChunkEvent)}\n\n`));

        const textBlockEvent: TextBlockEvent = {
          id: 'evt-2',
          source: 'agent',
          event_name: 'text_block',
          content_type: EventContentType.TEXTBLOCK,
          content: 'World!'
        };
        controller.enqueue(encoder.encode(`event: text_block\ndata: ${JSON.stringify(textBlockEvent)}\n\n`));
        
        const doneEvent: DoneEvent = {
          id: 'evt-3',
          source: 'agent',
          event_name: 'done', // Corrected event_name
          content_type: EventContentType.DONE
          // Removed content property as it doesn't exist on DoneEvent
        };
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify(doneEvent)}\n\n`));

        controller.close();
      }
    });

    // Mock the fetch response
    mockFetch.mockResolvedValue(new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    }));

    const processedEvents: ResponseEvent[] = [];

    // Iterate over the async generator returned by queryAgent
    try {
      for await (const event of client.queryAgent('Test query')) { // Pass prompt as string
        processedEvents.push(event);
        // The generator handles stream end implicitly when the 'done' event is received.
      }
    } catch (error) {
       // Handle potential errors during iteration
       console.error("Error processing agent events:", error);
       // Fail the test if errors occur during event processing
       throw error; // Re-throw to fail the test
    }

    // Assertions
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // You might want to add more specific checks for the fetch call arguments if needed
    // expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/agent/query'), expect.objectContaining({ method: 'POST', ... }));

    expect(processedEvents.length).toBe(3);
    expect(processedEvents[0].event_name).toBe('text_chunk');
    expect(processedEvents[0].content_type).toBe(EventContentType.TEXT_STREAM);
    expect((processedEvents[0] as TextChunkEvent).content).toBe('Hello ');
    expect(processedEvents[1].event_name).toBe('text_block');
    expect(processedEvents[1].content_type).toBe(EventContentType.TEXTBLOCK);
    expect((processedEvents[1] as TextBlockEvent).content).toBe('World!');
    expect(processedEvents[2].event_name).toBe('done');
    expect(processedEvents[2].content_type).toBe(EventContentType.DONE);

    // Restore the original fetch function
    mockFetch.mockRestore();
  });
});