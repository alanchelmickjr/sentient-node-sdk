# 🚀 Quick Start Guide - Your First AGI Agent in 5 Minutes

> **Get your first production-ready AGI agent running with streaming responses, multiple LLM providers, and enterprise features in under 5 minutes.**

---

## 🎯 What You'll Build

By the end of this guide, you'll have:
- ✅ A production-ready AGI agent with TypeScript
- ✅ Multiple LLM providers (OpenAI + Anthropic) with automatic failover
- ✅ Real-time streaming responses via Server-Sent Events
- ✅ A working web server ready for deployment
- ✅ Built-in monitoring and error handling

---

## 📋 Prerequisites

```bash
# Ensure you have Node.js 18+ and npm/pnpm
node --version  # Should be 18.0.0 or higher
npm --version   # Latest version recommended
```

**API Keys (you'll need at least one):**
- [OpenAI API Key](https://platform.openai.com/api-keys) 
- [Anthropic API Key](https://console.anthropic.com/) (optional but recommended)

---

## 🛠️ Step 1: Installation & Setup

### Option A: Use Our CLI (Recommended)
```bash
# Create a new project with our CLI
npx create-sentient-agent my-first-agent
cd my-first-agent

# The CLI sets up everything for you!
npm start
```

### Option B: Manual Setup
```bash
# Create a new project
mkdir my-first-agent
cd my-first-agent

# Initialize npm project
npm init -y

# Install the Sentient Node SDK
npm install sentient-agent-framework

# Install TypeScript and development dependencies
npm install -D typescript @types/node ts-node nodemon
```

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Update `package.json` scripts:
```json
{
  "scripts": {
    "start": "node dist/server.js",
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "test": "npm run build && node dist/server.js"
  }
}
```

---

## 🔧 Step 2: Environment Configuration

Create `.env` file:
```bash
# Required: At least one LLM provider
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Optional: Server configuration
PORT=3000
NODE_ENV=development

# Optional: Advanced features
REDIS_URL=redis://localhost:6379  # For session storage
ENABLE_METRICS=true
LOG_LEVEL=info
```

**🔒 Security Note:** Never commit `.env` to version control. Add it to `.gitignore`:
```bash
echo ".env" >> .gitignore
echo "node_modules" >> .gitignore
echo "dist" >> .gitignore
```

---

## 🤖 Step 3: Create Your First AGI Agent

Create `src/agent.ts`:
```typescript
import { 
  LLMEnhancedAgent,
  ProductionLLMManager,
  OpenAIProvider,
  AnthropicProvider,
  LLMManagerFactory,
  SelectionStrategy,
  Session,
  Query,
  ResponseHandler
} from 'sentient-agent-framework';

export class MyFirstAGIAgent extends LLMEnhancedAgent {
  constructor() {
    // Set up multiple LLM providers for redundancy
    const providers = [];
    
    // Add OpenAI provider if API key is available
    if (process.env.OPENAI_API_KEY) {
      providers.push(new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-4-turbo',
        timeout: 30000,
        retries: {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 10000
        }
      }));
    }
    
    // Add Anthropic provider if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      providers.push(new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultModel: 'claude-3-5-sonnet',
        timeout: 30000
      }));
    }
    
    if (providers.length === 0) {
      throw new Error('At least one LLM provider API key is required (OPENAI_API_KEY or ANTHROPIC_API_KEY)');
    }
    
    // Create production-ready LLM manager
    const llmManager = LLMManagerFactory.create({
      loadBalancing: {
        strategy: SelectionStrategy.LEAST_LOADED,
        stickySession: true,
        weights: {
          performance: 0.4,  // Prioritize speed
          cost: 0.2,         // Consider cost
          reliability: 0.3,  // Value reliability
          quality: 0.1       // Quality matters too
        }
      },
      failover: {
        enabled: true,
        maxAttempts: 3,
        circuitBreaker: true
      },
      healthMonitoring: true,
      metricsEnabled: true
    });
    
    // Register all providers
    providers.forEach(provider => {
      llmManager.registerProvider(provider);
    });
    
    super('My First AGI Agent', llmManager, {
      streaming: { 
        enabled: true, 
        chunkSize: 50,
        bufferTimeout: 100 
      },
      promptOptimization: { 
        enabled: true, 
        personalityAware: true 
      }
    });
  }
  
  async assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void> {
    try {
      console.log(`🤖 Processing query: "${query.prompt}"`);
      
      // Step 1: Analyze the query
      await responseHandler.emitTextBlock(
        'THINKING', 
        'Analyzing your question and selecting the best approach...'
      );
      
      const queryAnalysis = this.analyzeQuery(query.prompt);
      
      // Step 2: Show analysis results  
      await responseHandler.emitJson('ANALYSIS', {
        type: queryAnalysis.type,
        complexity: queryAnalysis.complexity,
        estimatedTokens: queryAnalysis.estimatedTokens,
        selectedModel: queryAnalysis.recommendedModel,
        timestamp: new Date().toISOString()
      });
      
      // Step 3: Generate streaming response
      const stream = responseHandler.createTextStream('AI_RESPONSE');
      
      const llmRequest = {
        model: queryAnalysis.recommendedModel,
        messages: [
          { 
            role: 'system', 
            content: this.getSystemPrompt(queryAnalysis.type) 
          },
          { 
            role: 'user', 
            content: query.prompt 
          }
        ],
        parameters: {
          temperature: queryAnalysis.temperature,
          maxTokens: queryAnalysis.estimatedTokens,
          stream: true
        },
        metadata: {
          sessionId: session.activity_id,
          requestId: query.id,
          queryType: queryAnalysis.type
        }
      };
      
      console.log(`🔄 Streaming response using ${queryAnalysis.recommendedModel}...`);
      
      // Stream the AI response with automatic provider failover
      let chunkCount = 0;
      for await (const chunk of this.llmManager.streamGenerate(llmRequest)) {
        await stream.emitChunk(chunk.content);
        chunkCount++;
        
        // Show progress every 20 chunks
        if (chunkCount % 20 === 0) {
          console.log(`📡 Streamed ${chunkCount} chunks so far...`);
        }
      }
      
      await stream.complete();
      
      // Step 4: Provide completion metadata
      await responseHandler.emitJson('COMPLETION_STATS', {
        chunksStreamed: chunkCount,
        processingTimeMs: Date.now() - Date.now(),
        model: queryAnalysis.recommendedModel,
        provider: 'auto-selected',
        sessionId: session.activity_id
      });
      
      await responseHandler.complete();
      
      console.log(`✅ Response completed successfully (${chunkCount} chunks)`);
      
    } catch (error) {
      console.error('❌ Error processing query:', error);
      
      await responseHandler.emitError(
        error instanceof Error ? error.message : 'An unexpected error occurred',
        500,
        {
          sessionId: session.activity_id,
          queryId: query.id,
          timestamp: new Date().toISOString(),
          errorType: error instanceof Error ? error.constructor.name : 'Unknown'
        }
      );
    }
  }
  
  private analyzeQuery(prompt: string): {
    type: string;
    complexity: number;
    estimatedTokens: number;
    recommendedModel: string;
    temperature: number;
  } {
    const lowerPrompt = prompt.toLowerCase();
    
    // Detect query type
    let type = 'general';
    if (lowerPrompt.includes('code') || lowerPrompt.includes('program')) {
      type = 'coding';
    } else if (lowerPrompt.includes('create') || lowerPrompt.includes('write')) {
      type = 'creative';
    } else if (lowerPrompt.includes('analyze') || lowerPrompt.includes('explain')) {
      type = 'analytical';
    }
    
    // Calculate complexity (0-1 scale)
    const complexity = Math.min(
      (prompt.length / 1000) +           // Length factor
      (prompt.split('?').length * 0.1) + // Question complexity
      (prompt.split(' ').length / 100),  // Word count factor
      1
    );
    
    // Estimate tokens needed (rough calculation)
    const estimatedTokens = Math.max(
      Math.min(prompt.length * 2 + 500, 4000), // Response usually 2x input + buffer
      500  // Minimum response length
    );
    
    // Choose model based on complexity
    const recommendedModel = complexity > 0.7 ? 'gpt-4-turbo' : 'claude-3-5-sonnet';
    
    // Set temperature based on type
    const temperature = type === 'creative' ? 0.9 : 
                       type === 'coding' ? 0.3 : 
                       0.7; // balanced for general/analytical
    
    return {
      type,
      complexity,
      estimatedTokens,
      recommendedModel,
      temperature
    };
  }
  
  private getSystemPrompt(queryType: string): string {
    const prompts = {
      coding: "You are an expert software developer. Provide clear, well-commented code solutions with explanations.",
      creative: "You are a creative assistant. Generate imaginative, engaging content that inspires and delights.",
      analytical: "You are an analytical expert. Provide thorough, logical analysis with clear reasoning and insights.",
      general: "You are a helpful AI assistant. Provide accurate, helpful responses tailored to the user's needs."
    };
    
    return prompts[queryType as keyof typeof prompts] || prompts.general;
  }
}
```

---

## 🌐 Step 4: Create the Web Server

Create `src/server.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import { MyFirstAGIAgent } from './agent';
import { DefaultServer } from 'sentient-agent-framework';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

async function startServer() {
  console.log('🚀 Starting your first AGI agent server...');
  
  try {
    // Create your AGI agent
    const agent = new MyFirstAGIAgent();
    
    // Initialize the agent (sets up LLM providers)
    await agent.llmManager.initialize();
    
    // Create Sentient server wrapper
    const sentientServer = new DefaultServer(agent);
    
    // Create Express app
    const app = express();
    
    // Enable CORS for web clients
    app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['POST', 'GET', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    
    // Parse JSON requests
    app.use(express.json({ limit: '10mb' }));
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        agent: agent.name,
        timestamp: new Date().toISOString(),
        providers: agent.llmManager.getProviders().length
      });
    });
    
    // Main agent endpoint
    app.use('/agent', (req, res) => {
      console.log(`📝 New request from ${req.ip}`);
      return sentientServer.handleRequest(req, res);
    });
    
    // Metrics endpoint (if enabled)
    if (process.env.ENABLE_METRICS === 'true') {
      app.get('/metrics', (req, res) => {
        const metrics = agent.llmManager.getMetrics();
        res.json(metrics);
      });
    }
    
    // Start the server
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`✅ AGI Agent server running on http://localhost:${port}`);
      console.log(`🔍 Health check: http://localhost:${port}/health`);
      console.log(`🤖 Agent endpoint: http://localhost:${port}/agent`);
      if (process.env.ENABLE_METRICS === 'true') {
        console.log(`📊 Metrics: http://localhost:${port}/metrics`);
      }
      console.log('\n🎉 Ready to receive requests!');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer().catch(console.error);
```

Add missing dependencies:
```bash
npm install express cors dotenv
npm install -D @types/express @types/cors
```

---

## 🧪 Step 5: Test Your AGI Agent

### Build and Run
```bash
# Build the TypeScript code
npm run build

# Start the server
npm start

# Or run in development mode with auto-reload
npm run dev
```

You should see:
```
🚀 Starting your first AGI agent server...
✅ AGI Agent server running on http://localhost:3000
🔍 Health check: http://localhost:3000/health
🤖 Agent endpoint: http://localhost:3000/agent
🎉 Ready to receive requests!
```

### Test with curl
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test your agent
curl -X POST http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "id": "test-123",
      "prompt": "Explain quantum computing in simple terms"
    }
  }'
```

### Test with the Built-in Client
Create `src/test-client.ts`:
```typescript
import { SentientAgentClient } from 'sentient-agent-framework';

async function testAgent() {
  const client = new SentientAgentClient();
  
  console.log('🧪 Testing your AGI agent...\n');
  
  try {
    const queries = [
      "What is machine learning?",
      "Write a simple Python function to calculate fibonacci numbers",
      "Create a short story about a robot learning to paint"
    ];
    
    for (const query of queries) {
      console.log(`\n🤖 Query: "${query}"`);
      console.log('📡 Streaming response:');
      
      for await (const event of client.queryAgent(query, 'http://localhost:3000/agent')) {
        switch (event.content_type) {
          case 'textblock':
            console.log(`\n[${event.event_name}] ${event.content}`);
            break;
          case 'text_stream':
            process.stdout.write(event.content);
            if (event.is_complete) {
              console.log('\n✨ Stream complete');
            }
            break;
          case 'json':
            console.log(`\n[${event.event_name}]`, JSON.stringify(event.content, null, 2));
            break;
          case 'done':
            console.log('\n🎯 Response completed!\n' + '='.repeat(50));
            break;
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAgent();
```

Run the test:
```bash
# In another terminal (keep server running)
npx ts-node src/test-client.ts
```

---

## 🎯 Step 6: What You Just Built

Congratulations! You've created a production-ready AGI agent with:

### 🏗️ **Enterprise Architecture**
- ✅ **Multi-provider LLM support** with automatic failover
- ✅ **Intelligent provider selection** based on query complexity
- ✅ **Circuit breaker protection** against provider failures
- ✅ **Real-time streaming** via Server-Sent Events
- ✅ **TypeScript type safety** throughout the entire stack

### 🚀 **Production Features**
- ✅ **Health monitoring** and metrics collection
- ✅ **Graceful error handling** with detailed error reporting  
- ✅ **Session management** with activity tracking
- ✅ **CORS support** for web client integration
- ✅ **Environment-based configuration**

### 🔧 **Developer Experience**
- ✅ **Hot reload development** with nodemon
- ✅ **Built-in testing client** for quick validation
- ✅ **Comprehensive logging** and debugging info
- ✅ **Easy deployment** to any Node.js platform

---

## 🚀 Next Steps

### 1. **Add More Capabilities**
```typescript
// Add custom capabilities to your agent
class AdvancedAgent extends MyFirstAGIAgent {
  async assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void> {
    // Add function calling
    if (query.prompt.includes('weather')) {
      return this.handleWeatherQuery(session, query, responseHandler);
    }
    
    // Add document processing
    if (query.prompt.includes('analyze document')) {
      return this.handleDocumentAnalysis(session, query, responseHandler);
    }
    
    // Fall back to base implementation
    return super.assist(session, query, responseHandler);
  }
}
```

### 2. **Add Persistent Session Storage**
```bash
# Install Redis for session storage
npm install redis @types/redis

# Update your .env
echo "REDIS_URL=redis://localhost:6379" >> .env
```

### 3. **Deploy to Production**
```bash
# Build for production
npm run build

# Deploy to Vercel (Next.js style)
npx vercel

# Or deploy to Railway
npx @railway/cli deploy

# Or use Docker
docker build -t my-agi-agent .
docker run -p 3000:3000 my-agi-agent
```

### 4. **Add Authentication & Security**
```typescript
import { SecurityMiddleware } from 'sentient-agent-framework';

app.use(SecurityMiddleware.authenticate({
  methods: ['api-key'],
  apiKey: {
    header: 'x-api-key',
    validate: async (key) => key === process.env.API_KEY
  }
}));
```

### 5. **Monitor in Production**
```typescript
// Add comprehensive monitoring
import { MetricsCollector, PrometheusExporter } from 'sentient-agent-framework';

const metrics = new MetricsCollector({
  exporters: [new PrometheusExporter()]
});
```

---

## 📚 Learn More

- **[API Reference](./api-reference.md)** - Complete TypeScript API documentation
- **[Framework Integration](./framework-integration.md)** - Express, Fastify, Next.js guides
- **[Production Deployment](./production-deployment.md)** - Scaling and deployment best practices
- **[Security Guide](./security-guide.md)** - Authentication, validation, and security
- **[Examples Repository](../examples/)** - More advanced agent implementations

---

## 🆘 Need Help?

- **[Discord Community](https://discord.gg/sentientfoundation)** - Get help from the community
- **[GitHub Issues](https://github.com/alanchelmickjr/sentient-node-sdk/issues)** - Report bugs or request features  
- **[Stack Overflow](https://stackoverflow.com/questions/tagged/sentient-sdk)** - Technical questions

---

## 🎉 Success!

You've successfully built your first production-ready AGI agent! Your agent now has:

- 🤖 **Multi-model AI capabilities** with automatic provider selection
- 📡 **Real-time streaming responses** for great user experience  
- 🛡️ **Production-grade error handling** and monitoring
- 🚀 **Scalable architecture** ready for enterprise deployment
- 💻 **Full TypeScript support** with excellent developer experience

**The Python version can't do this.** You've just built something more powerful, more reliable, and more production-ready than what's available in Python.

Welcome to the future of AGI development with Node.js! 🚀