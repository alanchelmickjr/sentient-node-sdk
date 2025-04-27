/**
 * Tests for the SentientAgentClient.
 */

import { SentientAgentClient } from '../src/client/sentient_agent_client';
import { 
  DocumentEvent, 
  DoneEvent, 
  ErrorEvent, 
  EventContentType, 
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

  // This test would require mocking fetch and the ReadableStream API
  // which is beyond the scope of this basic test suite
  test.skip('should query agent and process events', async () => {
    // Mock implementation would go here
  });
});