# 🚀 Sentient Node SDK - API Reference

> **Complete TypeScript API reference with examples for building production-ready AGI agents**

---

## 📖 Table of Contents

- [Core Agent System](#-core-agent-system)
- [LLM Provider System](#-llm-provider-system)
- [Session Management](#-session-management)
- [Event System & Streaming](#-event-system--streaming)
- [Validation & Schemas](#-validation--schemas)
- [Client & Server](#-client--server)
- [Security & Middleware](#-security--middleware)
- [Monitoring & Metrics](#-monitoring--metrics)

---

## 🤖 Core Agent System

### AbstractAgent

The base class for all Sentient agents providing the core interface.

```typescript
import { AbstractAgent, Session, Query, ResponseHandler } from 'sentient-agent-framework';

abstract class AbstractAgent {
  readonly name: string;
  
  constructor(name: string);
  
  // Core method that all agents must implement
  abstract assist(
    session: Session,
    query: Query,
    responseHandler: ResponseHandler
  ): Promise<void>;
  
  // Optional capability management
  getCapabilities?(): CapabilitySpec[];
  validateQuery?(query: Query): ValidationResult<Query>;
}
```

#### Example: Basic Agent Implementation

```typescript
import { AbstractAgent, Session, Query, ResponseHandler } from 'sentient-agent-framework';

class MyBasicAgent extends AbstractAgent {
  constructor() {
    super('Basic Assistant');
  }
  
  async assist(
    session: Session,
    query: Query,
    responseHandler: ResponseHandler
  ): Promise<void> {
    // Emit a thinking step
    await responseHandler.emitTextBlock(
      'THINKING', 
      'Processing your request...'
    );
    
    // Create a streaming response
    const stream = responseHandler.createTextStream('RESPONSE');
    
    // Simulate streaming response
    const words = `Hello! You asked: "${query.prompt}". Here's my response.`.split(' ');
    
    for (const word of words) {
      await stream.emitChunk(word + ' ');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await stream.complete();
    await responseHandler.complete();
  }
}
```

### LLMEnhancedAgent

Enhanced agent with built-in LLM integration and advanced capabilities.

```typescript
import { 
  LLMEnhancedAgent, 
  ProductionLLMManager,
  OpenAIProvider 
} from 'sentient-agent-framework';

class LLMEnhancedAgent extends AbstractAgent {
  constructor(
    name: string,
    protected llmManager: ProductionLLMManager,
    protected config?: LLMAgentConfig
  );
  
  // Enhanced assist method with LLM integration
  async assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void>;
  
  // LLM-specific methods
  async generateResponse(request: LLMRequest): Promise<LLMResponse>;
  async streamResponse(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  
  // Configuration management
  updateConfig(config: Partial<LLMAgentConfig>): void;
  getMetrics(): AgentMetrics;
}
```

#### Example: Production LLM Agent

```typescript
import { 
  LLMEnhancedAgent,
  ProductionLLMManager,
  OpenAIProvider,
  AnthropicProvider,
  SelectionStrategy
} from 'sentient-agent-framework';

class ProductionChatAgent extends LLMEnhancedAgent {
  constructor() {
    // Set up multiple LLM providers
    const openaiProvider = new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY!,
      defaultModel: 'gpt-4-turbo',
      timeout: 30000
    });
    
    const anthropicProvider = new AnthropicProvider({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      defaultModel: 'claude-3-5-sonnet',
      timeout: 30000
    });
    
    // Create production LLM manager
    const llmManager = new ProductionLLMManager({
      loadBalancing: {
        strategy: SelectionStrategy.LEAST_LOADED,
        weights: { performance: 0.4, cost: 0.3, reliability: 0.3 }
      },
      failover: {
        enabled: true,
        maxAttempts: 3,
        circuitBreaker: true
      }
    });
    
    // Register providers
    llmManager.registerProvider(openaiProvider);
    llmManager.registerProvider(anthropicProvider);
    
    super('Production Chat Agent', llmManager, {
      streaming: { enabled: true, chunkSize: 50 },
      promptOptimization: { enabled: true, personalityAware: true }
    });
  }
  
  async assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void> {
    try {
      // Analyze query complexity to choose appropriate model
      const complexity = this.analyzeComplexity(query.prompt);
      const model = complexity > 0.7 ? 'gpt-4-turbo' : 'claude-3-5-sonnet';
      
      // Emit analysis results
      await responseHandler.emitJson('ANALYSIS', {
        complexity,
        selectedModel: model,
        timestamp: new Date().toISOString()
      });
      
      // Stream LLM response
      const stream = responseHandler.createTextStream('AI_RESPONSE');
      
      const llmRequest = {
        model,
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant.' },
          { role: 'user', content: query.prompt }
        ],
        parameters: {
          temperature: 0.7,
          maxTokens: 2000,
          stream: true
        },
        metadata: {
          sessionId: session.activity_id,
          requestId: query.id,
          complexity
        }
      };
      
      // Stream response with automatic failover
      for await (const chunk of this.llmManager.streamGenerate(llmRequest)) {
        await stream.emitChunk(chunk.content);
      }
      
      await stream.complete();
      await responseHandler.complete();
      
    } catch (error) {
      await responseHandler.emitError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        500,
        { sessionId: session.activity_id, queryId: query.id }
      );
    }
  }
  
  private analyzeComplexity(prompt: string): number {
    // Simple complexity analysis
    const factors = {
      length: Math.min(prompt.length / 1000, 1),
      questionMarks: (prompt.match(/\?/g) || []).length * 0.1,
      technicalTerms: (prompt.match(/\b(API|database|algorithm|function)\b/gi) || []).length * 0.2
    };
    
    return Math.min(factors.length + factors.questionMarks + factors.technicalTerms, 1);
  }
}
```

---

## 🧠 LLM Provider System

### LLMProvider Interface

Base interface for all LLM providers with comprehensive capabilities.

```typescript
interface LLMProvider {
  readonly providerId: string;
  readonly capabilities: ProviderCapabilities;
  readonly config: LLMProviderConfig;
  
  // Core generation methods
  generate(request: LLMRequest): Promise<LLMResponse>;
  streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  
  // Provider lifecycle
  initialize(): Promise<void>;
  validate(): Promise<ProviderHealthStatus>;
  shutdown(): Promise<void>;
  
  // Dynamic configuration
  updateConfig(config: Partial<LLMProviderConfig>): Promise<void>;
  
  // Monitoring
  getMetrics(): ProviderMetrics;
  getHealthStatus(): ProviderHealthStatus;
  isHealthy(): boolean;
}

interface ProviderCapabilities {
  models: ModelInfo[];
  maxTokens: number;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsMultimodal: boolean;
  supportsSystemPrompts: boolean;
  rateLimits: RateLimitInfo;
}
```

### OpenAIProvider

Production-ready OpenAI provider with advanced features.

```typescript
import { OpenAIProvider, ConfigUtils } from 'sentient-agent-framework';

const provider = new OpenAIProvider(
  ConfigUtils.createOpenAIConfig(
    process.env.OPENAI_API_KEY!,
    {
      defaultModel: 'gpt-4-turbo',
      timeout: 60000,
      retries: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
      },
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 90000
      }
    }
  )
);

// Example usage
const response = await provider.generate({
  model: 'gpt-4-turbo',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing.' }
  ],
  parameters: {
    temperature: 0.7,
    maxTokens: 1000,
    functions: [
      {
        name: 'search_web',
        description: 'Search the web for information',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' }
          }
        }
      }
    ]
  },
  metadata: { requestId: 'unique-id-123' }
});
```

### AnthropicProvider

Claude integration with Anthropic-specific optimizations.

```typescript
import { AnthropicProvider, ConfigUtils } from 'sentient-agent-framework';

const provider = new AnthropicProvider(
  ConfigUtils.createAnthropicConfig(
    process.env.ANTHROPIC_API_KEY!,
    {
      defaultModel: 'claude-3-5-sonnet',
      personality: {
        creativityLevel: 0.8,
        formalityLevel: 0.6,
        verbosityLevel: 0.5
      },
      contentFilter: {
        enabled: true,
        strictness: 'medium'
      }
    }
  )
);

// Streaming example
for await (const chunk of provider.streamGenerate({
  model: 'claude-3-5-sonnet',
  messages: [
    { role: 'user', content: 'Write a creative story about AI.' }
  ],
  parameters: {
    temperature: 0.9,
    maxTokens: 2000
  }
})) {
  console.log(chunk.content);
  if (chunk.finishReason) {
    console.log(`Stream finished: ${chunk.finishReason}`);
    break;
  }
}
```

### ProductionLLMManager

Central orchestrator for managing multiple LLM providers with advanced features.

```typescript
import { 
  ProductionLLMManager,
  LLMManagerFactory,
  SelectionStrategy 
} from 'sentient-agent-framework';

const manager = new ProductionLLMManager({
  loadBalancing: {
    strategy: SelectionStrategy.LEAST_LOADED,
    stickySession: true,
    sessionTimeout: 300000,
    weights: {
      performance: 0.3,
      cost: 0.2,
      reliability: 0.4,
      quality: 0.1
    }
  },
  
  failover: {
    enabled: true,
    maxAttempts: 3,
    attemptDelay: 1000,
    backoffMultiplier: 2,
    exclusionDuration: 60000,
    triggerConditions: {
      networkErrors: true,
      timeoutErrors: true,
      rateLimitErrors: true,
      authErrors: false,
      serverErrors: true
    }
  },
  
  healthMonitoring: true,
  healthCheckInterval: 30000,
  metricsEnabled: true,
  metricsInterval: 10000
});

// Register providers
await manager.registerProvider(openaiProvider);
await manager.registerProvider(anthropicProvider);
await manager.initialize();

// Generate with automatic provider selection
const response = await manager.generate({
  model: 'gpt-4-turbo',  // Manager will find the best provider
  messages: [{ role: 'user', content: 'Hello!' }],
  parameters: { temperature: 0.7 }
});

// Stream with intelligent failover
for await (const chunk of manager.streamGenerate(request)) {
  console.log(chunk.content);
}

// Monitor performance
const metrics = manager.getMetrics();
console.log(`Success rate: ${(metrics.totals.requests.successful / metrics.totals.requests.total * 100).toFixed(2)}%`);

const healthStatus = manager.getHealthStatus();
Object.entries(healthStatus).forEach(([providerId, status]) => {
  console.log(`${providerId}: ${status.isHealthy ? 'Healthy' : 'Unhealthy'} (${status.responseTime}ms)`);
});
```

---

## 💾 Session Management

### Session Interface

Core session management for maintaining conversation state.

```typescript
interface Session {
  readonly processor_id: string;
  readonly activity_id: string;
  readonly request_id: string;
  readonly interactions?: Interaction[];
}

interface SessionStore {
  get(sessionId: string): Promise<Session | null>;
  set(sessionId: string, session: Session): Promise<void>;
  delete(sessionId: string): Promise<void>;
  exists(sessionId: string): Promise<boolean>;
  clear(): Promise<void>;
  
  // Advanced features
  expire(sessionId: string, ttlSeconds: number): Promise<void>;
  getMany(sessionIds: string[]): Promise<(Session | null)[]>;
  keys(): Promise<string[]>;
}
```

#### Example: Custom Session Store

```typescript
import { 
  SessionStore, 
  Session,
  RedisSessionStore,
  InMemorySessionStore 
} from 'sentient-agent-framework';

// Redis-based session store for production
class ProductionSessionStore implements SessionStore {
  private redis: RedisClient;
  private defaultTTL = 3600; // 1 hour
  
  constructor(redisUrl: string) {
    this.redis = new RedisClient({ url: redisUrl });
  }
  
  async get(sessionId: string): Promise<Session | null> {
    try {
      const data = await this.redis.get(`session:${sessionId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Session fetch failed:', error);
      return null;
    }
  }
  
  async set(sessionId: string, session: Session): Promise<void> {
    try {
      await this.redis.setex(
        `session:${sessionId}`,
        this.defaultTTL,
        JSON.stringify(session)
      );
    } catch (error) {
      console.error('Session save failed:', error);
      throw new Error('Failed to save session');
    }
  }
  
  async expire(sessionId: string, ttlSeconds: number): Promise<void> {
    await this.redis.expire(`session:${sessionId}`, ttlSeconds);
  }
  
  async delete(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }
  
  async exists(sessionId: string): Promise<boolean> {
    return (await this.redis.exists(`session:${sessionId}`)) === 1;
  }
  
  async clear(): Promise<void> {
    const keys = await this.redis.keys('session:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  async getMany(sessionIds: string[]): Promise<(Session | null)[]> {
    const keys = sessionIds.map(id => `session:${id}`);
    const results = await this.redis.mget(...keys);
    return results.map(data => data ? JSON.parse(data) : null);
  }
  
  async keys(): Promise<string[]> {
    const keys = await this.redis.keys('session:*');
    return keys.map(key => key.replace('session:', ''));
  }
}

// Usage with agent
const sessionStore = new ProductionSessionStore(process.env.REDIS_URL!);

class SessionAwareAgent extends AbstractAgent {
  constructor(private sessionStore: SessionStore) {
    super('Session Aware Agent');
  }
  
  async assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void> {
    // Load previous conversation context
    const existingSession = await this.sessionStore.get(session.activity_id);
    
    if (existingSession?.interactions) {
      await responseHandler.emitJson('CONTEXT_LOADED', {
        previousInteractions: existingSession.interactions.length,
        sessionAge: Date.now() - new Date(existingSession.interactions[0]?.request.event.content.request_payload.parts[0]?.timestamp || 0).getTime()
      });
    }
    
    // Process current request
    const stream = responseHandler.createTextStream('RESPONSE');
    await stream.emitChunk(`Processing your query: ${query.prompt}`);
    await stream.complete();
    
    // Update session with new interaction
    const updatedSession: Session = {
      ...session,
      interactions: [
        ...(existingSession?.interactions || []),
        {
          request: {
            event: {
              id: query.id,
              chatId: session.activity_id,
              content: {
                capability: 'assist',
                request_payload: {
                  parts: [{ prompt: query.prompt, fileIds: [] }]
                }
              },
              parent_request_id: null,
              root_request_id: null
            }
          },
          responses: []
        }
      ]
    };
    
    await this.sessionStore.set(session.activity_id, updatedSession);
    await this.sessionStore.expire(session.activity_id, 7200); // 2 hours
    
    await responseHandler.complete();
  }
}
```

---

## 📡 Event System & Streaming

### Event Types

Comprehensive event system for real-time communication.

```typescript
// Base event interface
interface BaseEvent {
  content_type: EventContentType;
  event_name: string;
  schema_version: string;
  id: string;
  source: string;
  metadata?: Record<string, any>;
}

// Streaming text events
interface TextChunkEvent extends BaseEvent {
  content_type: EventContentType.TEXT_STREAM;
  stream_id: string;
  is_complete: boolean;
  content: string;
}

// Document/JSON events
interface DocumentEvent extends BaseEvent {
  content_type: EventContentType.JSON;
  content: Record<string, any>;
}

// Text block events
interface TextBlockEvent extends BaseEvent {
  content_type: EventContentType.TEXTBLOCK;
  content: string;
}

// Error events
interface ErrorEvent extends BaseEvent {
  content_type: EventContentType.ERROR;
  event_name: 'error';
  content: {
    error_message: string;
    error_code: number;
    details?: Record<string, any>;
  };
}

// Completion events
interface DoneEvent extends BaseEvent {
  content_type: EventContentType.DONE;
  event_name: 'done';
}
```

### ResponseHandler

Central system for managing agent responses with streaming support.

```typescript
import { ResponseHandler, TextStream } from 'sentient-agent-framework';

class ProductionResponseHandler implements ResponseHandler {
  // Emit structured JSON data
  async emitJson(eventName: string, data: Record<string, any>): Promise<void>;
  
  // Emit text blocks for non-streaming content
  async emitTextBlock(eventName: string, content: string): Promise<void>;
  
  // Create streaming text responses
  createTextStream(eventName: string): TextStream;
  
  // Error handling
  async emitError(
    errorMessage: string, 
    errorCode?: number, 
    details?: Record<string, any>
  ): Promise<void>;
  
  // Complete the response
  async complete(): Promise<void>;
  
  // Response state
  get isComplete(): boolean;
}

// TextStream for real-time streaming
interface TextStream {
  readonly id: string;
  readonly isComplete: boolean;
  
  emitChunk(content: string): Promise<TextStream>;
  complete(): Promise<void>;
}
```

#### Example: Advanced Response Handling

```typescript
import { AbstractAgent, ResponseHandler } from 'sentient-agent-framework';

class MultiModalAgent extends AbstractAgent {
  constructor() {
    super('Multi Modal Agent');
  }
  
  async assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void> {
    try {
      // Emit processing status
      await responseHandler.emitTextBlock('STATUS', 'Analyzing your request...');
      
      // Emit analysis results
      await responseHandler.emitJson('ANALYSIS', {
        queryType: this.detectQueryType(query.prompt),
        complexity: this.analyzeComplexity(query.prompt),
        estimatedResponseTime: this.estimateResponseTime(query.prompt),
        timestamp: new Date().toISOString()
      });
      
      // Stream the main response
      const mainStream = responseHandler.createTextStream('MAIN_RESPONSE');
      
      // Simulate processing chunks
      const response = await this.generateResponse(query.prompt);
      const chunks = this.chunkResponse(response, 50);
      
      for (let i = 0; i < chunks.length; i++) {
        await mainStream.emitChunk(chunks[i]);
        
        // Emit progress updates
        if (i % 10 === 0) {
          await responseHandler.emitJson('PROGRESS', {
            completed: i + 1,
            total: chunks.length,
            percentage: Math.round((i + 1) / chunks.length * 100)
          });
        }
        
        // Small delay for realistic streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      await mainStream.complete();
      
      // Emit final metadata
      await responseHandler.emitJson('COMPLETION_STATS', {
        wordsGenerated: response.split(' ').length,
        processingTime: Date.now() - Date.now(),
        model: 'gpt-4-turbo',
        sessionId: session.activity_id
      });
      
      await responseHandler.complete();
      
    } catch (error) {
      await responseHandler.emitError(
        error instanceof Error ? error.message : 'Processing failed',
        500,
        {
          sessionId: session.activity_id,
          queryId: query.id,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          timestamp: new Date().toISOString()
        }
      );
    }
  }
  
  private detectQueryType(prompt: string): string {
    if (prompt.includes('?')) return 'question';
    if (prompt.toLowerCase().includes('create') || prompt.toLowerCase().includes('generate')) return 'creation';
    if (prompt.toLowerCase().includes('analyze') || prompt.toLowerCase().includes('review')) return 'analysis';
    return 'general';
  }
  
  private analyzeComplexity(prompt: string): number {
    // Simple complexity scoring
    const factors = {
      length: Math.min(prompt.length / 500, 1),
      words: Math.min(prompt.split(' ').length / 100, 1),
      questions: (prompt.match(/\?/g) || []).length * 0.1
    };
    return Math.min(Object.values(factors).reduce((a, b) => a + b, 0), 1);
  }
  
  private estimateResponseTime(prompt: string): number {
    const complexity = this.analyzeComplexity(prompt);
    return Math.round(1000 + (complexity * 4000)); // 1-5 seconds
  }
  
  private async generateResponse(prompt: string): Promise<string> {
    // Simulate LLM response generation
    return `This is a detailed response to: "${prompt}". The response includes comprehensive analysis and actionable insights based on the query complexity and context.`;
  }
  
  private chunkResponse(text: string, chunkSize: number): string[] {
    const words = text.split(' ');
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' ') + ' ');
    }
    
    return chunks;
  }
}
```

---

## ✅ Validation & Schemas

### Zod-Based Validation

Comprehensive runtime type checking and validation using Zod.

```typescript
import { 
  ValidationResult,
  RequestSchema,
  SessionSchema,
  QuerySchema,
  ResponseEventSchema,
  LLMRequestSchema 
} from 'sentient-agent-framework';

// Validate request data
function validateRequest(data: unknown): ValidationResult<Request> {
  try {
    const validData = RequestSchema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error,
        message: 'Validation failed',
        field_errors: formatZodErrors(error)
      };
    }
    throw error;
  }
}

// Custom validation schemas
import { z } from 'zod';

const CustomAgentConfigSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  capabilities: z.array(z.string()),
  settings: z.object({
    maxTokens: z.number().min(1).max(100000).default(2000),
    temperature: z.number().min(0).max(2).default(0.7),
    timeout: z.number().min(1000).max(300000).default(30000)
  }),
  providers: z.array(z.enum(['openai', 'anthropic', 'custom'])).min(1)
});

type CustomAgentConfig = z.infer<typeof CustomAgentConfigSchema>;

// Usage in agent
class ValidatedAgent extends AbstractAgent {
  private config: CustomAgentConfig;
  
  constructor(config: unknown) {
    super('Validated Agent');
    
    const validation = this.validateConfig(config);
    if (!validation.success) {
      throw new Error(`Invalid configuration: ${validation.message}`);
    }
    
    this.config = validation.data;
  }
  
  private validateConfig(config: unknown): ValidationResult<CustomAgentConfig> {
    try {
      const validConfig = CustomAgentConfigSchema.parse(config);
      return { success: true, data: validConfig };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error,
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          field_errors: error.errors.reduce((acc, e) => {
            const key = e.path.join('.');
            acc[key] = acc[key] || [];
            acc[key].push(e.message);
            return acc;
          }, {} as Record<string, string[]>)
        };
      }
      throw error;
    }
  }
  
  async assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void> {
    // Validate query
    const queryValidation = this.validateQuery(query);
    if (!queryValidation.success) {
      await responseHandler.emitError(
        'Invalid query format',
        400,
        { validationErrors: queryValidation.field_errors }
      );
      return;
    }
    
    // Use validated config
    await responseHandler.emitJson('CONFIG', {
      agentName: this.config.name,
      version: this.config.version,
      maxTokens: this.config.settings.maxTokens,
      providers: this.config.providers
    });
    
    const stream = responseHandler.createTextStream('RESPONSE');
    await stream.emitChunk(`Hello! I'm ${this.config.name} v${this.config.version}`);
    await stream.complete();
    await responseHandler.complete();
  }
  
  private validateQuery(query: Query): ValidationResult<Query> {
    try {
      const validQuery = QuerySchema.parse(query);
      return { success: true, data: validQuery };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error,
          message: 'Invalid query',
          field_errors: formatZodErrors(error)
        };
      }
      throw error;
    }
  }
}

function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  return error.errors.reduce((acc, e) => {
    const key = e.path.join('.');
    acc[key] = acc[key] || [];
    acc[key].push(e.message);
    return acc;
  }, {} as Record<string, string[]>);
}
```

---

## 🌐 Client & Server

### SentientAgentClient

Production-ready client for consuming Sentient agent APIs.

```typescript
import { 
  SentientAgentClient,
  ResponseEvent,
  EventContentType 
} from 'sentient-agent-framework';

const client = new SentientAgentClient({
  timeout: 30000,
  retries: 3,
  baseHeaders: {
    'Authorization': 'Bearer your-token',
    'User-Agent': 'MyApp/1.0.0'
  }
});

// Stream responses with full type safety
async function handleStreamingResponse(query: string, endpoint: string) {
  try {
    for await (const event of client.queryAgent(query, endpoint)) {
      switch (event.content_type) {
        case EventContentType.TEXTBLOCK:
          console.log(`[${event.event_name}] ${event.content}`);
          break;
          
        case EventContentType.TEXT_STREAM:
          process.stdout.write(event.content);
          if (event.is_complete) {
            console.log('\n--- Stream Complete ---');
          }
          break;
          
        case EventContentType.JSON:
          console.log(`[${event.event_name}]`, JSON.stringify(event.content, null, 2));
          break;
          
        case EventContentType.ERROR:
          console.error(`Error: ${event.content.error_message}`);
          if (event.content.details) {
            console.error('Details:', event.content.details);
          }
          break;
          
        case EventContentType.DONE:
          console.log('🎉 Response completed successfully');
          break;
      }
    }
  } catch (error) {
    console.error('Client error:', error);
  }
}

// Batch queries with concurrent processing
async function batchQueries(queries: string[], endpoint: string, maxConcurrency = 3) {
  const results: Array<{ query: string; responses: ResponseEvent[] }> = [];
  
  // Process queries in batches
  for (let i = 0; i < queries.length; i += maxConcurrency) {
    const batch = queries.slice(i, i + maxConcurrency);
    
    const batchPromises = batch.map(async (query) => {
      const responses: ResponseEvent[] = [];
      
      try {
        for await (const event of client.queryAgent(query, endpoint)) {
          responses.push(event);
        }
        return { query, responses };
      } catch (error) {
        console.error(`Failed to process query "${query}":`, error);
        return { query, responses: [] };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}
```

### DefaultServer

High-performance server implementation with middleware support.

```typescript
import { 
  DefaultServer,
  SecurityMiddleware,
  MonitoringMiddleware,
  ValidationMiddleware 
} from 'sentient-agent-framework';

class ProductionServer extends DefaultServer {
  constructor(agent: AbstractAgent) {
    super(agent, {
      cors: {
        enabled: true,
        origins: ['https://yourdomain.com', 'https://app.yourdomain.com'],
        methods: ['POST', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization']
      },
      security: {
        helmet: true,
        rateLimit: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100 // limit each IP to 100 requests per windowMs
        }
      },
      monitoring: {
        enabled: true,
        includeBody: false, // Don't log request bodies for privacy
        includeHeaders: ['user-agent', 'authorization']
      }
    });
    
    this.setupMiddleware();
  }
  
  private setupMiddleware(): void {
    // Security middleware
    this.use(SecurityMiddleware.authenticate({
      methods: ['jwt', 'api-key'],
      required: true,
      skipPaths: ['/health', '/metrics']
    }));
    
    // Request validation
    this.use(ValidationMiddleware.validateRequest({
      schema: RequestSchema,
      sanitize: true,
      stripUnknown: true
    }));
    
    // Monitoring and metrics
    this.use(MonitoringMiddleware.track({
      includeResponseTime: true,
      includeMemoryUsage: true,
      sampleRate: 1.0
    }));
  }
  
  // Custom error handling
  protected async handleError(error: Error, req: any, res: any): Promise<void> {
    const errorId = ulid();
    
    // Log error with context
    console.error(`[${errorId}] Error:`, {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });
    
    // Return sanitized error response
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    const message = statusCode === 400 ? error.message : 'Internal server error';
    
    res.status(statusCode).json({
      error: {
        message,
        code: statusCode,
        id: errorId,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Usage with Express
import express from 'express';

const app = express();
const agent = new MyProductionAgent();
const server = new ProductionServer(agent);

app.use('/api/agent', (req, res) => server.handleRequest(req, res));

app.listen(3000, () => {
  console.log('🚀 Production server running on port 3000');
});
```

---

## 🔒 Security & Middleware

### SecurityMiddleware

Enterprise-grade security middleware for production deployments.

```typescript
import { 
  SecurityMiddleware,
  AuthConfig,
  RateLimitConfig 
} from 'sentient-agent-framework';

// Authentication configuration
const authConfig: AuthConfig = {
  methods: ['jwt', 'oauth2', 'api-key'],
  jwt: {
    secret: process.env.JWT_SECRET!,
    algorithms: ['HS256'],
    issuer: 'your-app',
    audience: 'sentient-agents'
  },
  oauth2: {
    introspectionEndpoint: 'https://auth.yourservice.com/oauth/introspect',
    clientId: process.env.OAUTH_CLIENT_ID!,
    clientSecret: process.env.OAUTH_CLIENT_SECRET!
  },
  apiKey: {
    header: 'x-api-key',
    validate: async (key: string) => {
      // Custom API key validation logic
      return await validateApiKey(key);
    }
  },
  rbac: {
    enabled: true,
    roles: {
      admin: ['*'],
      user: ['agent:query', 'session:read'],
      readonly: ['session:read']
    }
  }
};

// Rate limiting configuration
const rateLimitConfig: RateLimitConfig = {
  strategy: 'sliding-window',
  limits: {
    global: { requests: 1000, window: '1h' },
    perUser: { requests: 100, window: '15m' },
    perIP: { requests: 50, window: '15m' }
  },
  tiers: {
    free: { requests: 10, window: '1h' },
    premium: { requests: 1000, window: '1h' },
    enterprise: { requests: 10000, window: '1h' }
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
};

// Apply security middleware
app.use(SecurityMiddleware.authenticate(authConfig));
app.use(SecurityMiddleware.rateLimit(rateLimitConfig));
app.use(SecurityMiddleware.validateInput({
  sanitize: true,
  maxBodySize: '10mb',
  allowedContentTypes: ['application/json']
}));
```

---

## 📊 Monitoring & Metrics

### MetricsCollector

Comprehensive monitoring and observability for production systems.

```typescript
import { 
  MetricsCollector,
  PrometheusExporter,
  HealthChecker 
} from 'sentient-agent-framework';

// Set up metrics collection
const metrics = new MetricsCollector({
  namespace: 'sentient_agent',
  defaultLabels: {
    service: 'chat-agent',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  exporters: [
    new PrometheusExporter({
      endpoint: '/metrics',
      port: 9090
    })
  ]
});

// Custom metrics
const requestCounter = metrics.counter('requests_total', {
  help: 'Total number of requests',
  labelNames: ['method', 'status', 'agent']
});

const responseTime = metrics.histogram('response_duration_seconds', {
  help: 'Response duration in seconds',
  labelNames: ['agent', 'complexity'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const activeConnections = metrics.gauge('active_connections', {
  help: 'Number of active connections'
});

// Agent with metrics integration
class MonitoredAgent extends AbstractAgent {
  constructor(name: string, private metrics: MetricsCollector) {
    super(name);
  }
  
  async assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void> {
    const startTime = Date.now();
    const complexity = this.analyzeComplexity(query.prompt);
    
    // Increment active connections
    this.metrics.gauge('active_connections').inc();
    
    try {
      // Your agent logic here
      await this.processQuery(query, responseHandler);
      
      // Record successful request
      this.metrics.counter('requests_total').inc({
        method: 'assist',
        status: 'success',
        agent: this.name
      });
      
    } catch (error) {
      // Record failed request
      this.metrics.counter('requests_total').inc({
        method: 'assist',
        status: 'error',
        agent: this.name
      });
      
      throw error;
    } finally {
      // Record response time
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.histogram('response_duration_seconds').observe(
        { agent: this.name, complexity: complexity > 0.5 ? 'high' : 'low' },
        duration
      );
      
      // Decrement active connections
      this.metrics.gauge('active_connections').dec();
    }
  }
  
  private async processQuery(query: Query, responseHandler: ResponseHandler): Promise<void> {
    const stream = responseHandler.createTextStream('RESPONSE');
    await stream.emitChunk(`Processing: ${query.prompt}`);
    await stream.complete();
    await responseHandler.complete();
  }
  
  private analyzeComplexity(prompt: string): number {
    return Math.min(prompt.length / 1000, 1);
  }
}

// Health checks
const healthChecker = new HealthChecker({
  checks: {
    database: async () => {
      try {
        await db.ping();
        return { healthy: true };
      } catch (error) {
        return { healthy: false, error: error.message };
      }
    },
    
    llmProviders: async () => {
      const results = await Promise.allSettled([
        openaiProvider.validate(),
        anthropicProvider.validate()
      ]);
      
      const healthy = results.every(result => 
        result.status === 'fulfilled' && result.value.isHealthy
      );
      
      return { healthy, details: results };
    },
    
    memory: async () => {
      const usage = process.memoryUsage();
      const healthy = usage.heapUsed < 500 * 1024 * 1024; // 500MB limit
      return { healthy, usage };
    }
  },
  interval: 30000 // Check every 30 seconds
});

// Expose metrics and health endpoints
app.get('/metrics', metrics.getPrometheusMetrics());
app.get('/health', healthChecker.getHealthStatus());
app.get('/health/live', healthChecker.getLivenessProbe());
app.get('/health/ready', healthChecker.getReadinessProbe());
```

---

This comprehensive API reference provides production-ready examples for building enterprise-grade AGI agents with the Sentient Node SDK. Each example includes full TypeScript type safety, error handling, and best practices for scalable deployments.

For more specific use cases and advanced patterns, see our [Examples Repository](../examples/) and [Integration Guides](./integrations/).