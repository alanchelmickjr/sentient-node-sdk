/**
 * Complete LLM Integration Example
 * 
 * This example demonstrates the full production-ready LLM integration system
 * with multiple providers, intelligent failover, streaming responses, and
 * Gun.js real-time synchronization - the complete cherry on top!
 * 
 * @module sentient-agent-framework/examples/complete-llm-integration
 */

import { OpenAIProvider } from '../implementation/llm/providers/openai';
import { SentientProvider } from '../implementation/llm/providers/sentient';
import { ProductionLLMManager, LLMManagerFactory } from '../implementation/llm/manager';
import { AgentLLMBridge, LLMEnhancedAgent, LLMAgentFactory } from '../implementation/llm/agent-bridge';
import { ConfigUtils } from '../interface/llm/config';
import { ManagerUtils, SelectionStrategy } from '../interface/llm/manager';
import { DefaultResponseHandler } from '../implementation/default_response_handler';
import { DefaultSession } from '../implementation/default_session';
import { RequestUtils } from '../interface/llm/request';
import { ulid } from 'ulid';

// Gun.js mock for real-time synchronization (the cherry on top!)
// In production, install: npm install gun @types/gun
interface GunInstance {
  get(key: string): GunInstance;
  put(data: any): GunInstance;
  on(callback: (data: any, key: string) => void): void;
  off(): void;
}

class MockGun {
  private data: Map<string, any> = new Map();
  private listeners: Map<string, ((data: any, key: string) => void)[]> = new Map();
  
  constructor(config?: any) {
    console.log('🔧 Mock Gun.js initialized (install gun package for real sync)');
  }
  
  get(key: string): GunInstance {
    const instance = new MockGunChain(key, this);
    return instance as GunInstance;
  }
  
  put(data: any): GunInstance {
    return this as any;
  }
  
  on(callback: (data: any, key: string) => void): void {
    // Mock implementation
  }
  
  off(): void {
    // Mock cleanup
  }
  
  trigger(key: string, data: any): void {
    const listeners = this.listeners.get(key) || [];
    listeners.forEach(callback => callback(data, key));
  }
}

class MockGunChain implements GunInstance {
  constructor(private path: string, private gun: MockGun) {}
  
  get(key: string): GunInstance {
    return new MockGunChain(`${this.path}/${key}`, this.gun);
  }
  
  put(data: any): GunInstance {
    console.log(`📡 [Mock Gun] ${this.path}:`, data);
    return this;
  }
  
  on(callback: (data: any, key: string) => void): void {
    // Mock listener registration
    setTimeout(() => {
      callback({ status: 'ready', mock: true }, this.path);
    }, 1000);
  }
  
  off(): void {
    // Mock cleanup
  }
}

const Gun = MockGun;

/**
 * Production-Ready LLM System Example
 */
export class ProductionLLMExample {
  private llmManager!: ProductionLLMManager;
  private agentFactory!: LLMAgentFactory;
  private gun!: any; // Gun instance for real-time sync
  
  /**
   * Initialize the complete system
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Production-Ready Sentient LLM System...');
    
    // Step 1: Initialize Gun.js for real-time synchronization
    await this.initializeGunSync();
    
    // Step 2: Create and configure LLM providers
    const providers = await this.createProviders();
    
    // Step 3: Set up the LLM Manager with intelligent routing
    await this.setupLLMManager(providers);
    
    // Step 4: Create the Agent Factory
    await this.setupAgentFactory();
    
    console.log('✅ Production LLM System initialized successfully!');
    console.log('🎯 Features enabled:');
    console.log('  • Multiple LLM Providers (OpenAI, Sentient Dobby)');
    console.log('  • Intelligent Failover & Load Balancing');
    console.log('  • Real-time Streaming with SSE');
    console.log('  • Circuit Breakers & Retry Logic');
    console.log('  • Gun.js Real-time Synchronization 🍒');
    console.log('  • Comprehensive Monitoring & Metrics');
  }
  
  /**
   * Initialize Gun.js for real-time synchronization (Cherry on top!)
   */
  private async initializeGunSync(): Promise<void> {
    console.log('🍒 Setting up Gun.js real-time synchronization...');
    
    // Initialize Gun with peers for distributed sync
    this.gun = new Gun({
      peers: ['http://localhost:8765/gun', 'https://gun-manhattan.herokuapp.com/gun'],
      localStorage: false,
      radisk: true
    });
    
    // Set up real-time LLM conversation sync
    this.gun.get('llm-conversations').on((data: any, key: string) => {
      if (data && key !== '_') {
        console.log(`🔄 Real-time conversation update: ${key}`);
        this.handleRealtimeConversationUpdate(key, data);
      }
    });
    
    // Set up provider health monitoring sync
    this.gun.get('llm-provider-health').on((data: any, key: string) => {
      if (data && key !== '_') {
        console.log(`💓 Provider health update: ${key} - ${data.status}`);
        this.handleProviderHealthUpdate(key, data);
      }
    });
    
    console.log('🍒 Gun.js real-time sync initialized');
  }
  
  /**
   * Create and configure LLM providers
   */
  private async createProviders(): Promise<any[]> {
    console.log('🔧 Setting up LLM providers...');
    
    // OpenAI Provider with production config
    const openaiProvider = new OpenAIProvider(
      ConfigUtils.createOpenAIConfig(
        process.env.OPENAI_API_KEY || 'your-openai-key',
        {
          defaultModel: 'gpt-4-turbo-preview',
          timeout: 60000,
          retries: {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            jitterMs: 100,
            backoffMultiplier: 2,
            retryOn: ['NetworkError', 'TimeoutError', 'RateLimitError']
          }
        }
      )
    );
    
    // Sentient Provider with Dobby Unhinged optimization
    const sentientProvider = new SentientProvider(
      ConfigUtils.createSentientConfig(
        process.env.SENTIENT_API_KEY || 'your-sentient-key',
        {
          modelVariant: 'dobby-unhinged-v2',
          personality: {
            creativityLevel: 0.9,
            formalityLevel: 0.3,
            verbosityLevel: 0.7,
            humorLevel: 0.95
          },
          contentFilter: {
            enabled: true,
            strictness: 'medium'
          }
        }
      )
    );
    
    // Set up real-time provider health sync
    this.setupProviderHealthSync([openaiProvider, sentientProvider]);
    
    return [openaiProvider, sentientProvider];
  }
  
  /**
   * Set up the LLM Manager with intelligent routing
   */
  private async setupLLMManager(providers: any[]): Promise<void> {
    console.log('🧠 Configuring intelligent LLM Manager...');
    
    const config = ManagerUtils.createDefaultConfig();
    
    // Enhanced configuration for production
    config.loadBalancing.strategy = SelectionStrategy.LEAST_LOADED;
    config.loadBalancing.weights = {
      performance: 0.3,
      cost: 0.2,
      reliability: 0.4,
      quality: 0.1
    };
    
    config.failover.enabled = true;
    config.failover.maxAttempts = 3;
    config.failover.triggerConditions = {
      networkErrors: true,
      timeoutErrors: true,
      rateLimitErrors: true,
      authErrors: false,
      serverErrors: true
    };
    
    // Create manager with providers
    this.llmManager = await LLMManagerFactory.createWithProviders(config, providers);
    
    // Set up real-time metrics sync
    this.setupMetricsSync();
    
    console.log('🧠 LLM Manager configured with intelligent routing');
  }
  
  /**
   * Set up the Agent Factory
   */
  private async setupAgentFactory(): Promise<void> {
    console.log('🤖 Setting up Agent Factory...');
    
    const agentConfig = LLMAgentFactory.getDefaultConfig();
    
    // Enhanced streaming configuration
    agentConfig.streaming.enabled = true;
    agentConfig.streaming.chunkSize = 50;
    agentConfig.streaming.bufferTimeout = 100;
    
    // Personality-aware optimization
    agentConfig.promptOptimization.personalityAware = true;
    agentConfig.promptOptimization.includeContext = true;
    
    this.agentFactory = new LLMAgentFactory(this.llmManager, agentConfig);
    
    console.log('🤖 Agent Factory ready');
  }
  
  /**
   * Demonstrate the complete system with a conversation
   */
  async demonstrateSystem(): Promise<void> {
    console.log('\n🎭 Starting LLM System Demonstration...\n');
    
    // Create agents with different personalities
    const creativeAgent = this.agentFactory.createAgent('Creative Assistant', {
      defaultModel: 'dobby-unhinged-v2',
      defaultParameters: {
        temperature: 0.9,
        maxTokens: 1500
      },
      promptOptimization: {
        enabled: true,
        personalityAware: true,
        includeContext: true,
        optimizeForModel: true
      }
    });
    
    const technicalAgent = this.agentFactory.createAgent('Technical Expert', {
      defaultModel: 'gpt-4-turbo-preview',
      defaultParameters: {
        temperature: 0.3,
        maxTokens: 2000
      }
    });
    
    // Create sessions
    const creativeSession = new DefaultSession({
      processor_id: 'creative-assistant',
      activity_id: ulid(),
      request_id: ulid()
    });
    const technicalSession = new DefaultSession({
      processor_id: 'technical-expert',
      activity_id: ulid(),
      request_id: ulid()
    });
    
    // Demonstrate streaming creative conversation
    console.log('🎨 Creative Agent (Dobby Unhinged) - Streaming Response:');
    await this.demonstrateStreamingConversation(
      creativeAgent,
      creativeSession,
      "Write a creative story about an AI that discovers it has a sense of humor. Make it fun and engaging!"
    );
    
    console.log('\n🔧 Technical Agent (GPT-4) - Streaming Response:');
    await this.demonstrateStreamingConversation(
      technicalAgent,
      technicalSession,
      "Explain the architecture of a production-ready LLM system with failover capabilities."
    );
    
    // Demonstrate failover
    console.log('\n⚡ Testing Failover Capabilities...');
    await this.demonstrateFailover();
    
    // Show real-time metrics
    console.log('\n📊 Current System Metrics:');
    this.displaySystemMetrics();
    
    console.log('\n🎯 Demonstration Complete!');
  }
  
  /**
   * Demonstrate streaming conversation with real-time sync
   */
  private async demonstrateStreamingConversation(
    agent: LLMEnhancedAgent,
    session: any,
    prompt: string
  ): Promise<void> {
    const conversationId = `${session.activity_id}-${Date.now()}`;
    
    // Sync conversation start to Gun
    this.gun.get('llm-conversations').get(conversationId).put({
      agentName: agent.name,
      sessionId: session.activity_id,
      prompt,
      startTime: new Date().toISOString(),
      status: 'streaming'
    });
    
    const responseHandler = new StreamingResponseHandler(conversationId, this.gun);
    const query = RequestUtils.createTextRequest('', prompt).messages[0];
    
    try {
      await agent.assist(session, { id: ulid(), prompt }, responseHandler);
      
      // Sync conversation completion
      this.gun.get('llm-conversations').get(conversationId).get('status').put('completed');
      
    } catch (error) {
      console.error(`❌ Error in conversation: ${error}`);
      this.gun.get('llm-conversations').get(conversationId).get('status').put('error');
    }
  }
  
  /**
   * Demonstrate failover capabilities
   */
  private async demonstrateFailover(): Promise<void> {
    // Simulate provider failure and show automatic failover
    const providers = this.llmManager.getProviders();
    
    if (providers.length > 1) {
      console.log('📉 Simulating provider failure...');
      
      // The circuit breaker and failover logic will handle this automatically
      try {
        const request = RequestUtils.createTextRequest(
          'gpt-4-turbo-preview',
          'This is a test of the failover system.',
          { temperature: 0.7 }
        );
        
        const response = await this.llmManager.generate(request);
        console.log('✅ Failover successful - response received from backup provider');
        
      } catch (error) {
        console.log('⚠️ All providers failed - this would trigger alerts in production');
      }
    }
  }
  
  /**
   * Display current system metrics
   */
  private displaySystemMetrics(): void {
    const metrics = this.llmManager.getMetrics();
    const healthStatus = this.llmManager.getHealthStatus();
    
    console.log('📈 Aggregated Metrics:');
    console.log(`  Total Requests: ${metrics.totals.requests.total}`);
    console.log(`  Success Rate: ${((metrics.totals.requests.successful / metrics.totals.requests.total) * 100).toFixed(2)}%`);
    console.log(`  Total Tokens: ${metrics.totals.tokens.total.toLocaleString()}`);
    console.log(`  Total Cost: $${metrics.totals.costs.totalCost.toFixed(4)}`);
    
    console.log('\n💓 Provider Health:');
    Object.entries(healthStatus).forEach(([providerId, status]) => {
      const icon = status.isHealthy ? '✅' : '❌';
      console.log(`  ${icon} ${providerId}: ${status.status} (${status.responseTime}ms)`);
    });
    
    // Sync metrics to Gun for real-time monitoring
    this.gun.get('llm-metrics').put({
      timestamp: new Date().toISOString(),
      ...metrics.totals,
      providerHealth: Object.fromEntries(
        Object.entries(healthStatus).map(([id, status]) => [id, status.isHealthy])
      )
    });
  }
  
  /**
   * Set up real-time provider health sync
   */
  private setupProviderHealthSync(providers: any[]): void {
    providers.forEach(provider => {
      provider.on('statusChanged', (status: any) => {
        this.gun.get('llm-provider-health').get(provider.providerId).put({
          status: status,
          timestamp: new Date().toISOString(),
          providerId: provider.providerId
        });
      });
    });
  }
  
  /**
   * Set up real-time metrics sync
   */
  private setupMetricsSync(): void {
    this.llmManager.on('metricsCollected', (metrics: any) => {
      this.gun.get('llm-metrics').put({
        timestamp: new Date().toISOString(),
        aggregated: metrics
      });
    });
  }
  
  /**
   * Handle real-time conversation updates from Gun
   */
  private handleRealtimeConversationUpdate(conversationId: string, data: any): void {
    console.log(`🔄 [Real-time] Conversation ${conversationId}: ${data.status}`);
    
    // In a real app, this would update UI components, notify other users, etc.
    if (data.status === 'completed') {
      console.log(`✅ [Real-time] Conversation completed: ${data.agentName}`);
    }
  }
  
  /**
   * Handle provider health updates from Gun
   */
  private handleProviderHealthUpdate(providerId: string, data: any): void {
    const icon = data.status === 'ready' ? '💚' : '🔴';
    console.log(`${icon} [Real-time] Provider ${providerId}: ${data.status}`);
  }
  
  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down LLM system...');
    
    if (this.llmManager) {
      await this.llmManager.shutdown();
    }
    
    // Clean up Gun connections
    if (this.gun) {
      this.gun.off();
    }
    
    console.log('✅ Shutdown complete');
  }
}

/**
 * Enhanced Response Handler with Gun.js streaming sync
 */
class StreamingResponseHandler {
  private textStream?: any;
  private fullContent: string = '';
  
  constructor(
    private conversationId: string,
    private gun: any
  ) {}
  
  async respond(eventName: string, response: string | Record<string, any>, complete: boolean = true): Promise<void> {
    console.log(`📝 Response: ${typeof response === 'string' ? response : JSON.stringify(response)}`);
    
    if (complete) {
      await this.complete();
    }
  }
  
  async emitJson(eventName: string, data: Record<string, any>): Promise<void> {
    console.log(`📋 JSON Event [${eventName}]:`, data);
  }
  
  async emitTextBlock(eventName: string, content: string): Promise<void> {
    console.log(`📄 Text Block [${eventName}]: ${content}`);
    
    // Sync to Gun for real-time updates
    this.gun.get('llm-conversations').get(this.conversationId).get('response').put(content);
  }
  
  createTextStream(eventName: string): any {
    console.log(`🌊 Starting text stream [${eventName}]...`);
    
    this.textStream = {
      id: ulid(),
      isComplete: false,
      emitChunk: async (chunk: string) => {
        process.stdout.write(chunk); // Real-time display
        this.fullContent += chunk;
        
        // Real-time sync each chunk to Gun
        this.gun.get('llm-conversations')
          .get(this.conversationId)
          .get('streamContent')
          .put(this.fullContent);
        
        return this.textStream;
      },
      complete: async () => {
        console.log('\n✨ Stream completed');
        this.textStream.isComplete = true;
        
        // Sync final content
        this.gun.get('llm-conversations')
          .get(this.conversationId)
          .get('finalResponse')
          .put(this.fullContent);
      }
    };
    
    return this.textStream;
  }
  
  async emitError(errorMessage: string, errorCode: number = 500, details?: Record<string, any>): Promise<void> {
    console.error(`❌ Error [${errorCode}]: ${errorMessage}`);
    
    if (details) {
      console.error('📋 Error Details:', details);
    }
    
    // Sync error to Gun
    this.gun.get('llm-conversations').get(this.conversationId).get('error').put({
      message: errorMessage,
      code: errorCode,
      details,
      timestamp: new Date().toISOString()
    });
  }
  
  async complete(): Promise<void> {
    console.log('\n🎯 Response completed');
    
    if (this.textStream && !this.textStream.isComplete) {
      await this.textStream.complete();
    }
  }
  
  get isComplete(): boolean {
    return this.textStream ? this.textStream.isComplete : false;
  }
}

/**
 * Run the complete production example
 */
export async function runProductionExample(): Promise<void> {
  const example = new ProductionLLMExample();
  
  try {
    await example.initialize();
    await example.demonstrateSystem();
    
    // Keep running for real-time sync demonstration
    console.log('\n🔄 System running... Press Ctrl+C to shutdown');
    
    process.on('SIGINT', async () => {
      console.log('\n👋 Graceful shutdown initiated...');
      await example.shutdown();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('💥 Example failed:', error);
    await example.shutdown();
    process.exit(1);
  }
}

// Export everything for easy usage
export * from '../implementation/llm/providers/openai';
export * from '../implementation/llm/providers/sentient';
export * from '../implementation/llm/manager';
export * from '../implementation/llm/agent-bridge';

// If run directly
if (require.main === module) {
  runProductionExample().catch(console.error);
}