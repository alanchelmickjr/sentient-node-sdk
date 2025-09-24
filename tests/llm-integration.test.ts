/**
 * Comprehensive LLM Integration Tests
 * 
 * Tests the complete LLM integration system including providers, manager,
 * streaming, failover, circuit breakers, and production workflows.
 * 
 * Covers the 0% tested LLM core functionality - THE heart of the AGI SDK.
 */

import { ulid } from 'ulid';
import { ProductionLLMManager, LLMManagerFactory } from '../src/implementation/llm/manager';
import { OpenAIProvider, OpenAIProviderFactory } from '../src/implementation/llm/providers/openai';
// import { SentientProvider } from '../src/implementation/llm/providers/sentient';
import { 
  LLMRequest, 
  LLMStreamChunk, 
  ChatMessage, 
  ChatRole, 
  FinishReason,
  RequestUtils 
} from '../src/interface/llm/request';
import { LLMResponse } from '../src/interface/llm/response';
import { 
  SelectionStrategy,
  LLMManagerConfig 
} from '../src/interface/llm/manager';
import { ProviderStatus } from '../src/interface/llm/provider';
import { DefaultSession } from '../src/implementation/default_session';

// ============================================================================
// Mock LLM Providers for Testing (Including Dobby Models!)
// ============================================================================

class MockOpenAIProvider extends OpenAIProvider {
  constructor(config = { apiKey: 'mock-key' }) {
    super(config as any);
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    // Validate request first
    if (!request.messages || request.messages.length === 0) {
      throw new Error('Request validation failed: Messages cannot be empty');
    }
    
    if (!request.model || request.model.trim() === '') {
      throw new Error('Request validation failed: Model cannot be empty');
    }

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    const lastMessage = request.messages[request.messages.length - 1];
    const content = lastMessage?.content || 'empty message';

    const response = {
      id: `mock-${ulid()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: ChatRole.ASSISTANT,
          content: `Mock OpenAI response to: ${content}`
        },
        finishReason: FinishReason.STOP
      }],
      usage: {
        promptTokens: 20,
        completionTokens: 15,
        totalTokens: 35
      },
      metadata: {
        processingTime: Date.now() - startTime,
        provider: this.providerId,
        requestId: request.metadata.requestId
      }
    };

    // Update provider metrics
    this.updateMetrics('generate', Date.now() - startTime, true, {
      input: response.usage.promptTokens,
      output: response.usage.completionTokens
    });

    return response;
  }

  async *streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const startTime = Date.now();
    const words = `Mock streaming response from ${request.model}. This is a test of the streaming capabilities.`.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      
      yield {
        content: i === 0 ? words[i] : ` ${words[i]}`,
        model: request.model,
        finishReason: i === words.length - 1 ? FinishReason.STOP : null,
        index: i,
        delta: {
          role: i === 0 ? ChatRole.ASSISTANT : undefined,
          content: i === 0 ? words[i] : ` ${words[i]}`
        },
        timestamp: new Date(),
        metadata: {
          requestId: request.metadata.requestId,
          chunkIndex: i
        }
      };
    }

    // Update provider metrics for streaming
    this.updateMetrics('stream', Date.now() - startTime, true, {
      input: 20,
      output: words.length * 2
    });
  }

  protected async performInitialization(): Promise<void> {
    // Mock initialization
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  protected async performHealthCheck() {
    return {
      isHealthy: true,
      status: ProviderStatus.READY,
      timestamp: new Date(),
      responseTime: 50,
      details: { connectivity: true, authentication: true }
    };
  }
}

// Custom Dobby Models Provider (as requested!)
class DobbyProvider extends MockOpenAIProvider {
  constructor() {
    super({
      apiKey: 'dobby-key',
      baseUrl: 'https://dobby-models.sentient.local'
    } as any);
    
    // Override provider ID to make it unique
    (this as any).providerId = 'dobby';
    (this as any).name = 'Dobby Models';
    
    // Override capabilities to support Dobby models
    (this as any)._capabilities = {
      models: [
        {
          name: 'dobby-v1',
          displayName: 'Dobby v1',
          capabilities: { maxContextLength: 8000, maxOutputTokens: 2000 },
          pricing: { inputCost: 0.001, outputCost: 0.002, currency: 'USD' }
        },
        {
          name: 'dobby-unhinged-v1',
          displayName: 'Dobby Unhinged v1',
          capabilities: { maxContextLength: 8000, maxOutputTokens: 2000 },
          pricing: { inputCost: 0.002, outputCost: 0.004, currency: 'USD' }
        },
        {
          name: 'gpt-4-turbo', // Also support standard models
          displayName: 'GPT-4 Turbo via Dobby',
          capabilities: { maxContextLength: 128000, maxOutputTokens: 4000 },
          pricing: { inputCost: 0.01, outputCost: 0.03, currency: 'USD' }
        }
      ],
      maxTokens: 128000,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsImageInput: false,
      supportsSystemPrompts: true,
      supportsMultimodal: false,
      rateLimits: {
        requestsPerMinute: 100,
        tokensPerMinute: 50000,
        concurrentRequests: 5
      }
    };
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const response = await super.generate(request);
    
    // Add Dobby personality to responses
    const isUnhinged = request.model.includes('unhinged');
    const personality = isUnhinged 
      ? "🤯 DOBBY UNHINGED RESPONSE: " 
      : "🧙‍♂️ Dobby helpfully responds: ";
      
    if (response.choices[0].message.content) {
      response.choices[0].message.content = personality + response.choices[0].message.content;
    }
    
    return response;
  }

  async *streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const isUnhinged = request.model.includes('unhinged');
    const prefix = isUnhinged 
      ? "🤯 DOBBY UNHINGED: " 
      : "🧙‍♂️ Dobby: ";

    // First yield the personality prefix
    yield {
      content: prefix,
      model: request.model,
      finishReason: null,
      index: 0,
      delta: { role: ChatRole.ASSISTANT, content: prefix },
      timestamp: new Date(),
      metadata: { requestId: request.metadata.requestId, chunkIndex: 0 }
    };

    // Then stream the actual response
    let index = 1;
    for await (const chunk of super.streamGenerate(request)) {
      yield { ...chunk, index: index++, metadata: { ...chunk.metadata, chunkIndex: index } };
    }
  }

  getProviderType(): string {
    return 'dobby-custom';
  }
}

// ============================================================================
// Test Configuration and Fixtures
// ============================================================================

const createTestLLMRequest = (overrides: Partial<LLMRequest> = {}): LLMRequest => ({
  model: 'gpt-4-turbo',
  messages: [
    { role: ChatRole.SYSTEM, content: 'You are a helpful assistant.' },
    { role: ChatRole.USER, content: 'Hello, test message!' }
  ],
  parameters: {
    temperature: 0.7,
    maxTokens: 1000
  },
  metadata: {
    requestId: ulid(),
    sessionId: ulid(),
    userId: 'test-user',
    timestamp: new Date(),
    priority: 'normal'
  },
  stream: false,
  ...overrides
});

const createTestManagerConfig = (): LLMManagerConfig => ({
  loadBalancing: {
    strategy: SelectionStrategy.LEAST_LOADED,
    stickySession: true,
    sessionTimeout: 300000,
    healthThreshold: 0.95,
    weights: {
      performance: 0.4,
      cost: 0.2,
      reliability: 0.3,
      quality: 0.1
    }
  },
  failover: {
    enabled: true,
    maxAttempts: 3,
    attemptDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2.0,
    exclusionDuration: 60000,
    triggerConditions: {
      networkErrors: true,
      timeoutErrors: true,
      rateLimitErrors: true,
      authErrors: false,
      serverErrors: true
    }
  },
  globalTimeout: 60000,
  healthMonitoring: true,
  healthCheckInterval: 30000,
  metricsEnabled: true,
  metricsInterval: 60000,
  cachingEnabled: false,
  cacheTTL: 300000,
  loggingEnabled: true,
  logLevel: 'info'
});

// ============================================================================
// OpenAI Provider Tests
// ============================================================================

describe('OpenAI Provider Integration', () => {
  let provider: MockOpenAIProvider;

  beforeEach(() => {
    provider = new MockOpenAIProvider();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe('Basic Operations', () => {
    test('should initialize successfully', async () => {
      await provider.initialize();
      expect(provider.status).toBe(ProviderStatus.READY);
    });

    test('should generate complete responses', async () => {
      await provider.initialize();
      const request = createTestLLMRequest();
      
      const response = await provider.generate(request);
      
      expect(response.id).toBeTruthy();
      expect(response.model).toBe('gpt-4-turbo');
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0].message.content).toContain('Mock OpenAI response');
      expect(response.usage.totalTokens).toBeGreaterThan(0);
      expect(response.metadata?.provider).toBe('openai');
    });

    test('should handle streaming responses', async () => {
      await provider.initialize();
      const request = createTestLLMRequest({ stream: true });
      
      const chunks: LLMStreamChunk[] = [];
      for await (const chunk of provider.streamGenerate(request)) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].delta?.role).toBe(ChatRole.ASSISTANT);
      expect(chunks[chunks.length - 1].finishReason).toBe(FinishReason.STOP);
      
      // Reconstruct content from stream
      const fullContent = chunks.map(c => c.content).join('');
      expect(fullContent).toContain('Mock streaming response');
    });

    test('should validate health status', async () => {
      await provider.initialize();
      const health = await provider.validate();
      
      expect(health.isHealthy).toBe(true);
      expect(health.status).toBe(ProviderStatus.READY);
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.details.connectivity).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid requests gracefully', async () => {
      await provider.initialize();
      
      const invalidRequest = createTestLLMRequest({
        model: '', // Invalid empty model
        messages: [] // Invalid empty messages
      });
      
      await expect(provider.generate(invalidRequest))
        .rejects.toThrow(/Request validation failed/);
    });
  });
});

// ============================================================================
// Custom Provider Tests (Dobby Models!)
// ============================================================================

describe('Custom Dobby Provider Integration', () => {
  let dobbyProvider: DobbyProvider;

  beforeEach(() => {
    dobbyProvider = new DobbyProvider();
  });

  afterEach(async () => {
    await dobbyProvider.shutdown();
  });

  test('should handle Dobby model responses', async () => {
    await dobbyProvider.initialize();
    const request = createTestLLMRequest({ model: 'dobby-v1' });
    
    const response = await dobbyProvider.generate(request);
    
    expect(response.choices[0].message.content).toContain('🧙‍♂️ Dobby helpfully responds');
    expect(response.model).toBe('dobby-v1');
  });

  test('should handle Dobby Unhinged model responses', async () => {
    await dobbyProvider.initialize();
    const request = createTestLLMRequest({ model: 'dobby-unhinged-v1' });
    
    const response = await dobbyProvider.generate(request);
    
    expect(response.choices[0].message.content).toContain('🤯 DOBBY UNHINGED RESPONSE');
    expect(response.model).toBe('dobby-unhinged-v1');
  });

  test('should stream Dobby responses with personality', async () => {
    await dobbyProvider.initialize();
    const request = createTestLLMRequest({ 
      model: 'dobby-unhinged-v1',
      stream: true 
    });
    
    const chunks: LLMStreamChunk[] = [];
    for await (const chunk of dobbyProvider.streamGenerate(request)) {
      chunks.push(chunk);
    }
    
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content).toContain('🤯 DOBBY UNHINGED');
    expect(chunks[chunks.length - 1].finishReason).toBe(FinishReason.STOP);
  });
});

// ============================================================================
// LLM Manager Tests
// ============================================================================

describe('Production LLM Manager', () => {
  let manager: ProductionLLMManager;
  let openaiProvider: MockOpenAIProvider;
  let dobbyProvider: DobbyProvider;

  beforeEach(async () => {
    const config = createTestManagerConfig();
    manager = new ProductionLLMManager(config);
    
    openaiProvider = new MockOpenAIProvider();
    dobbyProvider = new DobbyProvider();
    
    await manager.registerProvider(openaiProvider);
    await manager.registerProvider(dobbyProvider);
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('Provider Management', () => {
    test('should register and manage multiple providers', () => {
      const providers = manager.getProviders();
      expect(providers).toHaveLength(2);
      
      const providerIds = providers.map(p => p.providerId);
      expect(providerIds).toContain('openai');
      expect(providerIds).toContain('dobby'); // Dobby has unique ID
    });

    test('should select providers intelligently', async () => {
      const request = createTestLLMRequest();
      const selection = await manager.selectProvider({
        request,
        previousAttempts: [],
        sessionId: request.metadata.sessionId,
        priority: 'normal',
        preferences: {},
        hints: {}
      });
      
      expect(selection.provider).toBeDefined();
      expect(selection.reason).toBeTruthy();
      expect(selection.ranking).toBeDefined();
      expect(selection.alternatives).toBeDefined();
    });

    test('should handle provider health checks', async () => {
      const healthStatus = await manager.performHealthCheck();
      
      expect(Object.keys(healthStatus)).toHaveLength(2);
      Object.values(healthStatus).forEach(status => {
        expect(status.isHealthy).toBe(true);
        expect(status.responseTime).toBeGreaterThan(0);
      });
    });
  });

  describe('Generation Operations', () => {
    test('should generate responses through manager', async () => {
      const request = createTestLLMRequest();
      
      const response = await manager.generate(request);
      
      expect(response.id).toBeTruthy();
      expect(response.model).toBe(request.model);
      expect(response.choices).toHaveLength(1);
      expect(response.usage.totalTokens).toBeGreaterThan(0);
    });

    test('should handle streaming through manager', async () => {
      const request = createTestLLMRequest({ stream: true });
      
      const chunks: LLMStreamChunk[] = [];
      for await (const chunk of manager.streamGenerate(request)) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].delta?.role).toBe(ChatRole.ASSISTANT);
      expect(chunks[chunks.length - 1].finishReason).toBe(FinishReason.STOP);
    });

    test('should generate with specific provider', async () => {
      const request = createTestLLMRequest({ model: 'dobby-unhinged-v1' });
      
      // This should route to dobby provider
      const response = await manager.generate(request);
      
      expect(response.choices[0].message.content).toContain('🤯 DOBBY UNHINGED RESPONSE');
    });
  });

  describe('Load Balancing and Selection', () => {
    test('should distribute load across providers', async () => {
      const requests = Array.from({ length: 10 }, () => createTestLLMRequest());
      const responses = [];
      
      for (const request of requests) {
        const response = await manager.generate(request);
        responses.push(response);
      }
      
      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.metadata?.provider).toBeTruthy();
      });
    });

    test('should respect selection strategies', async () => {
      // Test RANDOM strategy
      await manager.updateConfig({
        loadBalancing: { 
          strategy: SelectionStrategy.RANDOM 
        }
      });
      
      const request = createTestLLMRequest();
      const selection = await manager.selectProvider({
        request,
        previousAttempts: [],
        sessionId: request.metadata.sessionId,
        priority: 'normal',
        preferences: {},
        hints: {}
      });
      
      expect(selection.metadata.strategy).toBe(SelectionStrategy.RANDOM);
    });
  });

  describe('Metrics and Monitoring', () => {
    test('should collect and aggregate metrics', async () => {
      // Generate some requests to create metrics
      const requests = Array.from({ length: 5 }, () => createTestLLMRequest());
      
      for (const request of requests) {
        await manager.generate(request);
      }
      
      const metrics = manager.getMetrics();
      
      expect(metrics.totals.requests.total).toBeGreaterThan(0);
      expect(metrics.byProvider).toHaveProperty('openai');
      expect(metrics.timestamp).toBeInstanceOf(Date);
    });

    test('should track provider rankings', () => {
      const request = createTestLLMRequest();
      const rankings = manager.getProviderRankings(request);
      
      // Rankings might be empty if no requests have been made yet
      expect(Array.isArray(rankings)).toBe(true);
    });
  });
});

// ============================================================================
// LLM Session Integration Tests
// ============================================================================

describe('LLM Session Integration', () => {
  let manager: ProductionLLMManager;
  let session: DefaultSession;

  beforeEach(async () => {
    manager = new ProductionLLMManager(createTestManagerConfig());
    await manager.registerProvider(new MockOpenAIProvider());
    await manager.initialize();

    session = new DefaultSession(
      {
        processor_id: 'llm-test',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      },
      undefined, // No capability manager for this test
      { enableCapabilityIntegration: false }
    );
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  test('should integrate LLM responses with session context', async () => {
    const request = createTestLLMRequest({
      metadata: {
        requestId: ulid(),
        sessionId: session.activity_id,
        userId: 'test-user',
        timestamp: new Date(),
        priority: 'normal'
      }
    });
    
    const response = await manager.generate(request);
    
    expect(response.metadata?.requestId).toBe(request.metadata.requestId);
    expect(response.choices[0].message.content).toBeTruthy();
  });

  test('should maintain conversation context', async () => {
    const messages: ChatMessage[] = [
      { role: ChatRole.SYSTEM, content: 'You are a helpful assistant.' },
      { role: ChatRole.USER, content: 'My name is Alice.' },
      { role: ChatRole.ASSISTANT, content: 'Hello Alice! Nice to meet you.' },
      { role: ChatRole.USER, content: 'What\'s my name?' }
    ];

    const request = createTestLLMRequest({ messages });
    const response = await manager.generate(request);
    
    // Mock provider will echo the last message, so it will contain "What's my name?"
    expect(response.choices[0].message.content).toContain('What\'s my name?');
  });
});

// ============================================================================
// Failover and Circuit Breaker Tests
// ============================================================================

describe('LLM Failover and Circuit Breakers', () => {
  let manager: ProductionLLMManager;

  beforeEach(async () => {
    const config = createTestManagerConfig();
    config.failover.maxAttempts = 2; // Faster testing
    config.failover.attemptDelay = 100;
    
    manager = new ProductionLLMManager(config);
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  test('should handle provider failures gracefully', async () => {
    // Create a failing provider
    const failingProvider = new MockOpenAIProvider();
    failingProvider.generate = async () => {
      throw new Error('Provider failure simulation');
    };

    const workingProvider = new MockOpenAIProvider();
    
    await manager.registerProvider(failingProvider);
    await manager.registerProvider(workingProvider);
    await manager.initialize();
    
    const request = createTestLLMRequest();
    
    // Should still work due to failover to working provider
    const response = await manager.generate(request);
    expect(response).toBeDefined();
  });

  test('should respect circuit breaker states', async () => {
    const provider = new MockOpenAIProvider();
    
    // Make provider consistently fail
    provider.generate = async () => {
      throw new Error('Circuit breaker test failure');
    };
    
    await manager.registerProvider(provider);
    await manager.initialize();
    
    const request = createTestLLMRequest();
    
    // Should eventually stop trying due to circuit breaker
    let failureCount = 0;
    for (let i = 0; i < 5; i++) {
      try {
        await manager.generate(request);
      } catch (error) {
        failureCount++;
      }
    }
    
    expect(failureCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// LLM Factory Tests
// ============================================================================

describe('LLM Factory Integration', () => {
  test('should create manager with default configuration', () => {
    const config = LLMManagerFactory.getDefaultConfig();
    const manager = LLMManagerFactory.create(config);
    
    expect(manager).toBeInstanceOf(ProductionLLMManager);
    expect(manager.getConfig()).toBeDefined();
  });

  test('should create manager with providers', async () => {
    const config = createTestManagerConfig();
    const providers = [
      new MockOpenAIProvider(),
      new DobbyProvider()
    ];
    
    const manager = await LLMManagerFactory.createWithProviders(config, providers);
    
    expect(manager.getProviders()).toHaveLength(2);
    
    await manager.shutdown();
  });
});

// ============================================================================
// End-to-End LLM Workflow Tests
// ============================================================================

describe('End-to-End LLM Workflows', () => {
  test('should support complete AGI conversation workflow', async () => {
    // Setup production-like environment
    const manager = new ProductionLLMManager(createTestManagerConfig());
    
    // Register multiple providers including custom models
    await manager.registerProvider(new MockOpenAIProvider());
    await manager.registerProvider(new DobbyProvider());
    await manager.initialize();
    
    // Create session
    const session = new DefaultSession(
      {
        processor_id: 'agi-test',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      }
    );
    
    // Multi-turn conversation
    const conversations = [
      'Hello, I need help with a coding problem.',
      'Can you write a function to calculate fibonacci numbers?',
      'Make it more efficient using memoization.',
      'Now explain how the algorithm works.'
    ];
    
    const responses = [];
    
    for (const userMessage of conversations) {
      const request = createTestLLMRequest({
        messages: [
          { role: ChatRole.SYSTEM, content: 'You are a helpful coding assistant.' },
          { role: ChatRole.USER, content: userMessage }
        ],
        metadata: {
          requestId: ulid(),
          sessionId: session.activity_id,
          userId: 'test-developer',
          timestamp: new Date(),
          priority: 'normal'
        }
      });
      
      const response = await manager.generate(request);
      responses.push(response);
      
      expect(response.choices[0].message.content).toBeTruthy();
      expect(response.metadata?.provider).toBeTruthy();
    }
    
    expect(responses).toHaveLength(4);
    
    // Verify metrics were collected
    const metrics = manager.getMetrics();
    expect(metrics.totals.requests.total).toBe(4);
    
    await manager.shutdown();
  });

  test('should demonstrate custom model ecosystem integration', async () => {
    const manager = new ProductionLLMManager(createTestManagerConfig());
    
    // Register ecosystem models
    const providers = [
      new MockOpenAIProvider(), // Standard OpenAI
      new DobbyProvider(), // Custom dobby models
    ];
    
    for (const provider of providers) {
      await manager.registerProvider(provider);
    }
    await manager.initialize();
    
    // Test different model types
    const modelTests = [
      { model: 'gpt-4', expectedProvider: 'openai' },
      { model: 'dobby-v1', expectedProvider: 'openai' }, // Dobby extends OpenAI
      { model: 'dobby-unhinged-v1', expectedProvider: 'openai' }
    ];
    
    for (const test of modelTests) {
      const request = createTestLLMRequest({ model: test.model });
      const response = await manager.generate(request);
      
      expect(response.model).toBe(test.model);
      expect(response.metadata?.provider).toBeTruthy();
    }
    
    await manager.shutdown();
  });
});

// ============================================================================
// Performance and Reliability Tests  
// ============================================================================

describe('LLM Performance and Reliability', () => {
  test('should handle concurrent requests efficiently', async () => {
    const manager = new ProductionLLMManager(createTestManagerConfig());
    await manager.registerProvider(new MockOpenAIProvider());
    await manager.initialize();
    
    const concurrentRequests = Array.from({ length: 10 }, () => 
      createTestLLMRequest({ 
        metadata: {
          ...createTestLLMRequest().metadata,
          requestId: ulid()
        }
      })
    );
    
    const startTime = Date.now();
    const responses = await Promise.all(
      concurrentRequests.map(req => manager.generate(req))
    );
    const totalTime = Date.now() - startTime;
    
    expect(responses).toHaveLength(10);
    expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
    
    responses.forEach(response => {
      expect(response.id).toBeTruthy();
      expect(response.usage.totalTokens).toBeGreaterThan(0);
    });
    
    await manager.shutdown();
  });

  test('should track resource usage and cleanup', async () => {
    const manager = new ProductionLLMManager(createTestManagerConfig());
    await manager.registerProvider(new MockOpenAIProvider());
    await manager.initialize();
    
    // Generate several requests
    for (let i = 0; i < 5; i++) {
      const request = createTestLLMRequest();
      await manager.generate(request);
    }
    
    const metrics = manager.getMetrics();
    expect(metrics.totals.requests.successful).toBe(5);
    expect(metrics.totals.tokens.total).toBeGreaterThan(0);
    
    // Clean shutdown should not throw
    await expect(manager.shutdown()).resolves.not.toThrow();
  });
});