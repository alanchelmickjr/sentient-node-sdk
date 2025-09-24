import { SentientAgentClient, ConnectionState, SSEOptions } from '../src/client/sentient_agent_client';
import { EventContentType } from '../src/interface/events';
import axios from 'axios';

jest.mock('axios');

// Mock EventSource for Node.js environment
global.EventSource = class MockEventSource {
  url: string;
  onopen?: (event: Event) => void;
  onmessage?: (event: MessageEvent) => void;
  onerror?: (event: Event) => void;
  readyState: number = 0;
  
  constructor(url: string) {
    this.url = url;
    this.readyState = 1;
    
    // Simulate connection opening after a short delay
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }
  
  close() {
    this.readyState = 2;
  }
  
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    // Mock implementation for custom event listeners
  }
} as any;

describe('SentientAgentClient', () => {
  let client: SentientAgentClient;

  beforeEach(() => {
    client = new SentientAgentClient('http://localhost:3000');
  });

  afterEach(() => {
    client.destroy();
  });

  describe('HTTP Methods (Backward Compatibility)', () => {
    it('should query the agent and emit querySuccess event', async () => {
      const mockResponse = {
        data: {
          processor_id: '123',
          activity_id: '456',
          request_id: '789'
        }
      };

      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      const query = 'What is the weather?';
      const agentUrl = 'http://localhost:3000/assist';

      await expect(client.queryAgent(query, agentUrl)).resolves.not.toThrow();
      expect(client.getProcessorId()).toBe('123');
      expect(client.getActivityId()).toBe('456');
      expect(client.getRequestId()).toBe('789');
    });

    it('should process events via HTTP polling', async () => {
      const mockEventsResponse = {
        data: {
          interactions: [
            { type: 'text', content: 'Hello' },
            { type: 'json', content: { data: 'test' } }
          ]
        }
      };

      (axios.get as jest.Mock).mockResolvedValue(mockEventsResponse);

      await expect(client.processEvents('http://localhost:3000/assist')).resolves.not.toThrow();
    });
  });

  describe('SSE Functionality', () => {
    it('should initialize with default SSE options', () => {
      const defaultClient = new SentientAgentClient('http://localhost:3000');
      const connectionInfo = defaultClient.getConnectionInfo();
      
      expect(connectionInfo.state).toBe(ConnectionState.DISCONNECTED);
      expect(connectionInfo.reconnectAttempts).toBe(0);
    });

    it('should initialize with custom SSE options', () => {
      const customOptions: SSEOptions = {
        enableAutoReconnect: false,
        maxReconnectAttempts: 5,
        initialReconnectDelay: 2000,
        eventTypeFilter: [EventContentType.TEXT_STREAM]
      };

      const customClient = new SentientAgentClient('http://localhost:3000', customOptions);
      expect(customClient).toBeInstanceOf(SentientAgentClient);
    });

    it('should connect to SSE stream', async () => {
      // Set up client with session data
      client['processor_id'] = '123';
      client['activity_id'] = '456';
      client['request_id'] = '789';

      const connectionStateChangeSpy = jest.fn();
      client.on('sseConnectionStateChange', connectionStateChangeSpy);

      await client.connectSSE('http://localhost:3000/assist');

      // Wait for connection to establish
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(connectionStateChangeSpy).toHaveBeenCalledWith({
        previous: ConnectionState.DISCONNECTED,
        current: ConnectionState.CONNECTING
      });
    });

    it('should handle SSE connection events', (done) => {
      client.on('sseConnected', () => {
        expect(client.getConnectionInfo().state).toBe(ConnectionState.CONNECTED);
        done();
      });

      client.connectSSE('http://localhost:3000/assist');
    });

    it('should disconnect SSE stream', async () => {
      await client.connectSSE('http://localhost:3000/assist');
      
      client.disconnectSSE();
      
      const connectionInfo = client.getConnectionInfo();
      expect(connectionInfo.state).toBe(ConnectionState.DISCONNECTED);
      expect(connectionInfo.reconnectAttempts).toBe(0);
    });

    it('should subscribe to specific event types', () => {
      const eventTypes = [EventContentType.TEXT_STREAM, EventContentType.JSON];
      
      client.subscribeToEvents(eventTypes);
      
      // Verify the internal filter is set (we'd need to expose this for testing)
      expect(() => client.subscribeToEvents(eventTypes)).not.toThrow();
    });

    it('should unsubscribe from event filtering', () => {
      client.subscribeToEvents([EventContentType.TEXT_STREAM]);
      client.unsubscribeFromFiltering();
      
      expect(() => client.unsubscribeFromFiltering()).not.toThrow();
    });
  });

  describe('Enhanced HTTP Methods with SSE', () => {
    it('should query agent and optionally connect SSE', async () => {
      const mockResponse = {
        data: {
          processor_id: '123',
          activity_id: '456',
          request_id: '789'
        }
      };

      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      const sseConnectedSpy = jest.fn();
      client.on('sseConnected', sseConnectedSpy);

      await client.queryAgentWithSSE('test query', 'http://localhost:3000/assist', true);

      expect(client.getProcessorId()).toBe('123');
      // SSE connection would be attempted after HTTP query succeeds
    });

    it('should process events hybrid mode - fallback to HTTP when SSE not connected', async () => {
      const mockEventsResponse = {
        data: {
          interactions: []
        }
      };

      (axios.get as jest.Mock).mockResolvedValue(mockEventsResponse);

      // Should fall back to HTTP when SSE not connected
      await expect(client.processEventsHybrid('http://localhost:3000/assist')).resolves.not.toThrow();
    });

    it('should process events hybrid mode - use SSE when connected', async () => {
      // Connect SSE first
      await client.connectSSE('http://localhost:3000/assist');
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should not make HTTP request when SSE is connected
      await expect(client.processEventsHybrid('http://localhost:3000/assist')).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP query errors', async () => {
      const errorSpy = jest.fn();
      client.on('queryError', errorSpy);

      (axios.post as jest.Mock).mockRejectedValue(new Error('Network error'));

      await client.queryAgent('test', 'http://localhost:3000/assist');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle HTTP events errors', async () => {
      const errorSpy = jest.fn();
      client.on('eventsError', errorSpy);

      (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      await client.processEvents('http://localhost:3000/assist');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle SSE errors', (done) => {
      client.on('sseError', (error) => {
        expect(error).toBeInstanceOf(Error);
        done();
      });

      // Mock EventSource to trigger error
      const originalEventSource = global.EventSource;
      global.EventSource = class extends originalEventSource {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Event('error'));
            }
          }, 10);
        }
      } as any;

      client.connectSSE('http://localhost:3000/assist');
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const removeAllListenersSpy = jest.spyOn(client, 'removeAllListeners');
      
      client.destroy();
      
      expect(removeAllListenersSpy).toHaveBeenCalled();
      expect(client.getConnectionInfo().state).toBe(ConnectionState.DISCONNECTED);
    });
  });
});