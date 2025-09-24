import { EventEmitter } from 'events';
import axios from 'axios';
import { ResponseEvent, EventContentType } from '../interface/events';

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export interface SSEOptions {
  enableAutoReconnect?: boolean;
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  eventTypeFilter?: EventContentType[];
}

export interface ConnectionInfo {
  state: ConnectionState;
  reconnectAttempts: number;
  lastError?: Error;
  connectedAt?: Date;
}

export class SentientAgentClient extends EventEmitter {
  private processor_id: string;
  private activity_id: string;
  private request_id: string;
  private interactions: any[];
  private defaultAgentUrl: string;
  
  // SSE-related properties
  private eventSource?: EventSource;
  private connectionState: ConnectionState;
  private reconnectAttempts: number;
  private reconnectTimer?: NodeJS.Timeout;
  private sseOptions: SSEOptions;

  constructor(defaultAgentUrl: string, sseOptions: SSEOptions = {}) {
    super();
    this.defaultAgentUrl = defaultAgentUrl;
    this.processor_id = '';
    this.activity_id = '';
    this.request_id = '';
    this.interactions = [];
    
    // Initialize SSE properties
    this.connectionState = ConnectionState.DISCONNECTED;
    this.reconnectAttempts = 0;
    this.sseOptions = {
      enableAutoReconnect: true,
      maxReconnectAttempts: 10,
      initialReconnectDelay: 1000,
      maxReconnectDelay: 30000,
      eventTypeFilter: undefined,
      ...sseOptions
    };
  }

  async queryAgent(query: string, agentUrl: string): Promise<void> {
    try {
      const response = await axios.post(agentUrl, { query });
      this.processor_id = response.data.processor_id;
      this.activity_id = response.data.activity_id;
      this.request_id = response.data.request_id;
      this.emit('querySuccess', response.data);
    } catch (error) {
      this.emit('queryError', error);
    }
  }

  async processEvents(agentUrl: string): Promise<void> {
    try {
      const response = await axios.get(`${agentUrl}/events`, {
        params: {
          processor_id: this.processor_id,
          activity_id: this.activity_id,
          request_id: this.request_id
        }
      });
      this.interactions = response.data.interactions;
      this.emit('eventsReceived', response.data);
    } catch (error) {
      this.emit('eventsError', error);
    }
  }

  public getProcessorId(): string {
    return this.processor_id;
  }

  public getActivityId(): string {
    return this.activity_id;
  }

  public getRequestId(): string {
    return this.request_id;
  }

  // SSE Connection Management Methods
  
  /**
   * Connect to the agent's SSE stream for real-time events
   */
  async connectSSE(agentUrl?: string): Promise<void> {
    if (this.connectionState === ConnectionState.CONNECTED || this.connectionState === ConnectionState.CONNECTING) {
      return;
    }

    const url = agentUrl || this.defaultAgentUrl;
    const sseUrl = this.buildSSEUrl(url);
    
    this.setConnectionState(ConnectionState.CONNECTING);
    
    try {
      this.eventSource = new EventSource(sseUrl);
      this.setupSSEEventHandlers();
    } catch (error) {
      this.handleSSEError(error as Error);
    }
  }

  /**
   * Disconnect from SSE stream
   */
  disconnectSSE(): void {
    this.clearReconnectTimer();
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.reconnectAttempts = 0;
  }

  /**
   * Get current connection information
   */
  getConnectionInfo(): ConnectionInfo {
    return {
      state: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      lastError: undefined,
      connectedAt: this.connectionState === ConnectionState.CONNECTED ? new Date() : undefined
    };
  }

  /**
   * Subscribe to specific event types (for filtering)
   */
  subscribeToEvents(eventTypes: EventContentType[]): void {
    this.sseOptions.eventTypeFilter = eventTypes;
  }

  /**
   * Unsubscribe from event filtering (receive all events)
   */
  unsubscribeFromFiltering(): void {
    this.sseOptions.eventTypeFilter = undefined;
  }

  // Private SSE Helper Methods

  private buildSSEUrl(baseUrl: string): string {
    const url = new URL(`${baseUrl}/events/stream`);
    
    if (this.processor_id) {
      url.searchParams.set('processor_id', this.processor_id);
    }
    if (this.activity_id) {
      url.searchParams.set('activity_id', this.activity_id);
    }
    if (this.request_id) {
      url.searchParams.set('request_id', this.request_id);
    }
    
    // Add event type filters if configured
    if (this.sseOptions.eventTypeFilter && this.sseOptions.eventTypeFilter.length > 0) {
      url.searchParams.set('event_types', this.sseOptions.eventTypeFilter.join(','));
    }
    
    return url.toString();
  }

  private setupSSEEventHandlers(): void {
    if (!this.eventSource) return;

    this.eventSource.onopen = () => {
      this.setConnectionState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.emit('sseConnected');
    };

    this.eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data = this.parseAndValidateEvent(event.data);
        if (data) {
          this.handleIncomingEvent(data);
        }
      } catch (error) {
        this.emit('sseError', new Error(`Failed to parse event data: ${error}`));
      }
    };

    this.eventSource.onerror = (error: Event) => {
      this.handleSSEError(new Error('SSE connection error'));
    };

    // Setup custom event listeners for different event types
    this.setupCustomEventListeners();
  }

  private setupCustomEventListeners(): void {
    if (!this.eventSource) return;

    // Listen for specific event types
    Object.values(EventContentType).forEach(eventType => {
      this.eventSource!.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data = this.parseAndValidateEvent(event.data);
          if (data && this.shouldProcessEvent(data)) {
            this.handleIncomingEvent(data);
          }
        } catch (error) {
          this.emit('sseError', new Error(`Failed to process ${eventType} event: ${error}`));
        }
      });
    });
  }

  private parseAndValidateEvent(eventData: string): ResponseEvent | null {
    try {
      const parsed = JSON.parse(eventData);
      
      // Basic validation of event structure
      if (!this.isValidEvent(parsed)) {
        throw new Error('Invalid event structure');
      }
      
      return parsed as ResponseEvent;
    } catch (error) {
      throw new Error(`Event parsing failed: ${error}`);
    }
  }

  private isValidEvent(event: any): boolean {
    return (
      event &&
      typeof event === 'object' &&
      typeof event.content_type === 'string' &&
      typeof event.event_name === 'string' &&
      typeof event.id === 'string' &&
      typeof event.source === 'string'
    );
  }

  private shouldProcessEvent(event: ResponseEvent): boolean {
    // Apply event type filtering if configured
    if (this.sseOptions.eventTypeFilter && this.sseOptions.eventTypeFilter.length > 0) {
      return this.sseOptions.eventTypeFilter.includes(event.content_type);
    }
    
    return true;
  }

  private handleIncomingEvent(event: ResponseEvent): void {
    // Emit specific event types
    this.emit('sseEvent', event);
    this.emit(`sse:${event.content_type}`, event);
    
    // Handle special events
    switch (event.content_type) {
      case EventContentType.ERROR:
        this.emit('sseEventError', event);
        break;
      case EventContentType.DONE:
        this.emit('sseEventDone', event);
        break;
      case EventContentType.TEXT_STREAM:
        this.emit('sseTextChunk', event);
        break;
      default:
        // Generic event handling
        break;
    }
  }

  private handleSSEError(error: Error): void {
    this.setConnectionState(ConnectionState.ERROR);
    this.emit('sseError', error);
    
    if (this.sseOptions.enableAutoReconnect && this.shouldAttemptReconnect()) {
      this.scheduleReconnect();
    }
  }

  private shouldAttemptReconnect(): boolean {
    return this.reconnectAttempts < (this.sseOptions.maxReconnectAttempts || 10);
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    
    const delay = this.calculateReconnectDelay();
    this.setConnectionState(ConnectionState.RECONNECTING);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.emit('sseReconnecting', { attempt: this.reconnectAttempts, delay });
      this.connectSSE();
    }, delay);
  }

  private calculateReconnectDelay(): number {
    const baseDelay = this.sseOptions.initialReconnectDelay || 1000;
    const maxDelay = this.sseOptions.maxReconnectDelay || 30000;
    
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay);
    const jitter = Math.random() * 0.3; // Add up to 30% jitter
    
    return Math.floor(exponentialDelay * (1 + jitter));
  }

  private setConnectionState(state: ConnectionState): void {
    const previousState = this.connectionState;
    this.connectionState = state;
    
    if (previousState !== state) {
      this.emit('sseConnectionStateChange', { previous: previousState, current: state });
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  // Enhanced HTTP methods for backward compatibility with SSE integration

  /**
   * Enhanced query method that can optionally establish SSE connection
   */
  async queryAgentWithSSE(query: string, agentUrl: string, enableSSE = true): Promise<void> {
    // First perform the standard HTTP query
    await this.queryAgent(query, agentUrl);
    
    // Then establish SSE connection if requested
    if (enableSSE && this.processor_id && this.activity_id && this.request_id) {
      await this.connectSSE(agentUrl);
    }
  }

  /**
   * Process events with fallback to HTTP if SSE is not connected
   */
  async processEventsHybrid(agentUrl: string): Promise<void> {
    if (this.connectionState === ConnectionState.CONNECTED) {
      // SSE is connected, events will come through the stream
      return;
    } else {
      // Fall back to HTTP polling
      return this.processEvents(agentUrl);
    }
  }

  /**
   * Clean up resources and close connections
   */
  destroy(): void {
    this.disconnectSSE();
    this.removeAllListeners();
  }
}