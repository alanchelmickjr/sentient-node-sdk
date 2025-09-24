# 🚀 Express.js Integration Guide

> **Complete guide to integrating Sentient Node SDK with Express.js applications for production-ready AGI agents**

---

## 📖 Table of Contents

- [Quick Integration](#-quick-integration)
- [Complete Setup Guide](#-complete-setup-guide)
- [Middleware Configuration](#-middleware-configuration)
- [Authentication & Security](#-authentication--security)
- [Streaming Responses](#-streaming-responses)
- [Error Handling](#-error-handling)
- [Performance Optimization](#-performance-optimization)
- [Production Examples](#-production-examples)
- [Best Practices](#-best-practices)

---

## ⚡ Quick Integration

Get Sentient agents running in your Express app in under 5 minutes:

```typescript
// app.ts
import express from 'express';
import { 
  AbstractAgent, 
  DefaultServer,
  ProductionLLMManager,
  OpenAIProvider 
} from 'sentient-agent-framework';

// Create your agent
class ExpressAgent extends AbstractAgent {
  constructor() {
    super('Express AI Agent');
  }
  
  async assist(session, query, responseHandler) {
    const stream = responseHandler.createTextStream('RESPONSE');
    await stream.emitChunk(`Hello from Express! You asked: ${query.prompt}`);
    await stream.complete();
    await responseHandler.complete();
  }
}

const app = express();
app.use(express.json());

// Set up Sentient agent
const agent = new ExpressAgent();
const sentientServer = new DefaultServer(agent);

// Add agent endpoint
app.use('/agent', (req, res) => sentientServer.handleRequest(req, res));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', agent: agent.name });
});

app.listen(3000, () => {
  console.log('🚀 Express + Sentient Agent running on port 3000');
});
```

Test it:
```bash
curl -X POST http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -d '{"query": {"id": "test-1", "prompt": "Hello Agent!"}}'
```

---

## 🏗️ Complete Setup Guide

### Step 1: Project Setup

```bash
# Create new Express project
mkdir my-express-agent
cd my-express-agent
npm init -y

# Install dependencies
npm install express sentient-agent-framework
npm install -D @types/express @types/node typescript ts-node nodemon

# Install additional middleware (recommended)
npm install cors helmet morgan compression rate-limiter-flexible
```

### Step 2: TypeScript Configuration

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
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 3: Environment Configuration

Create `.env`:
```bash
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# LLM Provider Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Security
JWT_SECRET=your-jwt-secret-here
API_KEY_SECRET=your-api-key-secret
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Database & Cache
DATABASE_URL=postgresql://user:pass@localhost:5432/myapp
REDIS_URL=redis://localhost:6379

# Logging & Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
SENTRY_DSN=your-sentry-dsn
```

### Step 4: Production-Ready Agent

Create `src/agents/productionAgent.ts`:
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

export class ProductionExpressAgent extends LLMEnhancedAgent {
  constructor() {
    // Set up multiple LLM providers
    const providers = [];
    
    if (process.env.OPENAI_API_KEY) {
      providers.push(new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-4-turbo',
        timeout: 60000,
        retries: {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 15000
        }
      }));
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
      providers.push(new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultModel: 'claude-3-5-sonnet',
        timeout: 60000
      }));
    }
    
    // Create production LLM manager
    const llmManager = LLMManagerFactory.create({
      loadBalancing: {
        strategy: SelectionStrategy.LEAST_LOADED,
        stickySession: true,
        weights: {
          performance: 0.4,
          cost: 0.3,
          reliability: 0.3
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
    
    // Register providers
    providers.forEach(provider => {
      llmManager.registerProvider(provider);
    });
    
    super('Production Express Agent', llmManager, {
      streaming: { enabled: true, chunkSize: 50 },
      promptOptimization: { enabled: true, personalityAware: true }
    });
  }
  
  async assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void> {
    try {
      // Log request
      console.log(`📝 Processing query from session ${session.activity_id}`);
      
      // Analyze query complexity
      const complexity = this.analyzeComplexity(query.prompt);
      const model = complexity > 0.7 ? 'gpt-4-turbo' : 'claude-3-5-sonnet';
      
      // Emit analysis
      await responseHandler.emitJson('ANALYSIS', {
        complexity,
        selectedModel: model,
        estimatedTokens: Math.ceil(query.prompt.length * 1.5),
        timestamp: new Date().toISOString()
      });
      
      // Stream AI response
      const stream = responseHandler.createTextStream('AI_RESPONSE');
      
      const llmRequest = {
        model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
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
          userAgent: session.metadata?.userAgent
        }
      };
      
      // Stream with automatic failover
      for await (const chunk of this.llmManager.streamGenerate(llmRequest)) {
        await stream.emitChunk(chunk.content);
      }
      
      await stream.complete();
      
      // Emit completion stats
      await responseHandler.emitJson('COMPLETION', {
        model: model,
        processingTime: Date.now() - Date.now(),
        sessionId: session.activity_id
      });
      
      await responseHandler.complete();
      
    } catch (error) {
      console.error('❌ Agent error:', error);
      
      await responseHandler.emitError(
        error instanceof Error ? error.message : 'Processing failed',
        500,
        {
          sessionId: session.activity_id,
          timestamp: new Date().toISOString()
        }
      );
    }
  }
  
  private analyzeComplexity(prompt: string): number {
    const factors = [
      Math.min(prompt.length / 1000, 1),
      (prompt.match(/\?/g) || []).length * 0.1,
      (prompt.match(/\b(analyze|create|explain|solve)\b/gi) || []).length * 0.2
    ];
    
    return Math.min(factors.reduce((a, b) => a + b, 0), 1);
  }
  
  private getSystemPrompt(): string {
    return `You are a helpful AI assistant integrated with an Express.js application. 
Provide accurate, helpful responses while being concise and professional. 
Current timestamp: ${new Date().toISOString()}`;
  }
}
```

---

## 🔧 Middleware Configuration

### Security Middleware Stack

Create `src/middleware/security.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { SecurityMiddleware } from 'sentient-agent-framework';

// Rate limiting configuration
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyGenerator: (req: Request) => req.ip,
  points: 100, // Number of requests
  duration: 900, // Per 15 minutes
  blockDuration: 300, // Block for 5 minutes
});

// CORS configuration
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
});

// Security headers
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Rate limiting middleware
export const rateLimitMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: secs
    });
  }
};

// Authentication middleware
export const authMiddleware = SecurityMiddleware.authenticate({
  methods: ['jwt', 'api-key'],
  jwt: {
    secret: process.env.JWT_SECRET!,
    algorithms: ['HS256']
  },
  apiKey: {
    header: 'x-api-key',
    validate: async (key: string) => {
      // Validate against your API key storage
      return key === process.env.API_KEY_SECRET;
    }
  },
  optional: false // Set to true for optional auth
});
```

### Logging Middleware

Create `src/middleware/logging.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { ulid } from 'ulid';

// Add request ID to all requests
export const requestIdMiddleware = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  req.id = ulid();
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Custom morgan format
morgan.token('id', (req: Request) => req.id);
morgan.token('user-agent', (req: Request) => req.get('User-Agent'));

export const loggingMiddleware = morgan(
  ':id :method :url :status :res[content-length] - :response-time ms ":user-agent"',
  {
    stream: {
      write: (message) => {
        // Use your preferred logging library
        console.log(message.trim());
      }
    },
    skip: (req, res) => {
      // Skip health checks and metrics
      return req.url === '/health' || req.url === '/metrics';
    }
  }
);

// Error logging middleware
export const errorLoggingMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[${req.id}] Error:`, {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  next(error);
};
```

---

## 🔐 Authentication & Security

### JWT Authentication Example

Create `src/middleware/auth.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const jwtAuthMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      error: 'Access denied. No token provided.'
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({
      error: 'Invalid token.'
    });
  }
};

// Role-based access control
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions.'
      });
    }
    
    next();
  };
};

// Usage in routes
// app.use('/agent', jwtAuthMiddleware, requireRole(['user', 'admin']));
```

### API Key Authentication

```typescript
export const apiKeyAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.header('X-API-Key');
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required in X-API-Key header'
    });
  }
  
  // Validate API key (implement your logic)
  if (!isValidApiKey(apiKey)) {
    return res.status(401).json({
      error: 'Invalid API key'
    });
  }
  
  next();
};

function isValidApiKey(key: string): boolean {
  // Implement your API key validation logic
  // This could check against a database, cache, etc.
  return key === process.env.API_KEY_SECRET;
}
```

---

## 📡 Streaming Responses

### Server-Sent Events (SSE) Setup

```typescript
import { Request, Response } from 'express';
import { SentientAgentClient } from 'sentient-agent-framework';

// SSE endpoint for real-time streaming
export const createSSEEndpoint = (agent: any) => {
  return async (req: Request, res: Response) => {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    const { prompt } = req.body;
    
    if (!prompt) {
      res.write(`data: ${JSON.stringify({
        error: 'Prompt is required'
      })}\n\n`);
      res.end();
      return;
    }
    
    try {
      // Create client to query our own agent
      const client = new SentientAgentClient();
      const query = { id: ulid(), prompt };
      
      // Stream events to client
      for await (const event of client.queryAgent(query, req.hostname + '/agent')) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        
        if (event.content_type === 'done') {
          break;
        }
      }
      
    } catch (error) {
      res.write(`data: ${JSON.stringify({
        content_type: 'error',
        content: {
          error_message: error.message,
          error_code: 500
        }
      })}\n\n`);
    } finally {
      res.end();
    }
  };
};

// Usage
app.post('/stream', createSSEEndpoint(agent));
```

### WebSocket Integration

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';

const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(','),
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on('agent-query', async (data) => {
    const { prompt } = data;
    
    try {
      const client = new SentientAgentClient();
      const query = { id: ulid(), prompt };
      
      // Stream events to WebSocket client
      for await (const event of client.queryAgent(query, 'http://localhost:3000/agent')) {
        socket.emit('agent-response', event);
        
        if (event.content_type === 'done') {
          break;
        }
      }
      
    } catch (error) {
      socket.emit('agent-error', {
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

server.listen(3000);
```

---

## ❌ Error Handling

### Global Error Handler

Create `src/middleware/errorHandler.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { statusCode = 500, message } = error;
  
  // Log error details
  console.error(`[${req.id || 'unknown'}] Error:`, {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Invalid request data';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Authentication failed';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
  }
  
  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      requestId: req.id,
      timestamp: new Date().toISOString()
    }
  });
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: `Route ${req.originalUrl} not found`,
      statusCode: 404,
      requestId: req.id,
      timestamp: new Date().toISOString()
    }
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

### Agent Error Handling

```typescript
// Wrap agent endpoint with error handling
app.use('/agent', asyncHandler(async (req: Request, res: Response) => {
  try {
    await sentientServer.handleRequest(req, res);
  } catch (error) {
    // Custom error handling for agent-specific errors
    if (error.message.includes('Rate limit')) {
      res.status(429).json({
        error: {
          message: 'Too many requests. Please try again later.',
          retryAfter: 60,
          requestId: req.id
        }
      });
      return;
    }
    
    if (error.message.includes('Provider unavailable')) {
      res.status(503).json({
        error: {
          message: 'AI service temporarily unavailable',
          requestId: req.id
        }
      });
      return;
    }
    
    throw error; // Let global error handler deal with it
  }
}));
```

---

## ⚡ Performance Optimization

### Caching Layer

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache middleware
export const cacheMiddleware = (ttl: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `cache:${req.method}:${req.originalUrl}:${JSON.stringify(req.body)}`;
    
    try {
      const cached = await redis.get(key);
      
      if (cached) {
        console.log(`Cache hit: ${key}`);
        return res.json(JSON.parse(cached));
      }
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data: any) {
        redis.setex(key, ttl, JSON.stringify(data));
        return originalJson.call(this, data);
      };
      
      next();
      
    } catch (error) {
      console.warn('Cache error:', error);
      next();
    }
  };
};

// Usage: Cache agent responses for 5 minutes
// app.use('/agent', cacheMiddleware(300));
```

### Response Compression

```typescript
import compression from 'compression';

// Configure compression
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
}));
```

### Connection Pooling & Keep-Alive

```typescript
import { Agent } from 'http';

// Configure HTTP agent for better performance
const httpAgent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10
});

// Apply to your LLM providers
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  httpAgent: httpAgent
});
```

---

## 🏭 Production Examples

### Complete Production Express App

Create `src/app.ts`:
```typescript
import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { ProductionExpressAgent } from './agents/productionAgent';
import { DefaultServer } from 'sentient-agent-framework';
import {
  corsMiddleware,
  securityMiddleware,
  rateLimitMiddleware,
  authMiddleware
} from './middleware/security';
import {
  requestIdMiddleware,
  loggingMiddleware,
  errorLoggingMiddleware
} from './middleware/logging';
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

class ProductionExpressServer {
  private app: express.Application;
  private server: any;
  private agent: ProductionExpressAgent;
  private sentientServer: DefaultServer;
  
  constructor() {
    this.app = express();
    this.setupAgent();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }
  
  private async setupAgent(): Promise<void> {
    this.agent = new ProductionExpressAgent();
    await this.agent.llmManager.initialize();
    this.sentientServer = new DefaultServer(this.agent);
    
    console.log('✅ Agent initialized with providers:', 
      this.agent.llmManager.getProviders().length
    );
  }
  
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(securityMiddleware);
    this.app.use(corsMiddleware);
    
    // Request processing
    this.app.use(requestIdMiddleware);
    this.app.use(loggingMiddleware);
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Trust proxy (for correct IP addresses behind load balancer)
    this.app.set('trust proxy', 1);
  }
  
  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        agent: this.agent.name,
        providers: this.agent.llmManager.getProviders().length,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });
    
    // Metrics endpoint (no auth for monitoring)
    this.app.get('/metrics', (req, res) => {
      const metrics = this.agent.llmManager.getMetrics();
      res.json(metrics);
    });
    
    // Protected agent endpoint
    this.app.use('/agent',
      rateLimitMiddleware,
      authMiddleware, // Require authentication
      asyncHandler(async (req: express.Request, res: express.Response) => {
        await this.sentientServer.handleRequest(req, res);
      })
    );
    
    // API documentation
    this.app.get('/docs', (req, res) => {
      res.json({
        name: 'Sentient Agent API',
        version: '1.0.0',
        endpoints: {
          'POST /agent': 'Main agent endpoint - requires authentication',
          'GET /health': 'Health check',
          'GET /metrics': 'Performance metrics',
          'GET /docs': 'This documentation'
        },
        authentication: 'Bearer token or X-API-Key header required',
        example: {
          request: {
            query: {
              id: 'unique-id',
              prompt: 'Your question here'
            }
          }
        }
      });
    });
  }
  
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Error logging
    this.app.use(errorLoggingMiddleware);
    
    // Global error handler
    this.app.use(errorHandler);
  }
  
  public async start(): Promise<void> {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    this.server = createServer(this.app);
    
    // Graceful shutdown handling
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    
    this.server.listen(port, host, () => {
      console.log(`🚀 Production Express server running on ${host}:${port}`);
      console.log(`📖 API docs: http://${host}:${port}/docs`);
      console.log(`🏥 Health check: http://${host}:${port}/health`);
    });
  }
  
  private async gracefulShutdown(signal: string): Promise<void> {
    console.log(`\n👋 ${signal} received, shutting down gracefully...`);
    
    this.server.close(() => {
      console.log('✅ HTTP server closed');
    });
    
    // Shutdown agent resources
    if (this.agent?.llmManager) {
      await this.agent.llmManager.shutdown();
      console.log('✅ Agent resources cleaned up');
    }
    
    process.exit(0);
  }
}

// Start server
if (require.main === module) {
  const server = new ProductionExpressServer();
  server.start().catch(console.error);
}

export { ProductionExpressServer };
```

### Docker Configuration

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:20-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S express -u 1001
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist/
RUN chown -R express:nodejs /app
USER express

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/app.js"]
```

### Docker Compose

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  express-agent:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env.production
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - express-agent
    restart: unless-stopped
```

---

## 🎯 Best Practices

### 1. **Error Handling**
```typescript
// Always use async error handling
app.use('/agent', asyncHandler(async (req, res) => {
  await sentientServer.handleRequest(req, res);
}));

// Implement circuit breakers for external services
// Rate limiting and request validation
// Comprehensive logging and monitoring
```

### 2. **Security**
```typescript
// Never expose sensitive information
// Always validate and sanitize inputs
// Use HTTPS in production
// Implement proper authentication
// Rate limiting and DDoS protection
```

### 3. **Performance**
```typescript
// Use connection pooling
// Implement caching where appropriate
// Compress responses
// Monitor and optimize database queries
// Use clustering for CPU-intensive tasks
```

### 4. **Monitoring**
```typescript
// Health checks for all dependencies
// Comprehensive metrics collection
// Error tracking and alerting
// Performance monitoring
// Log aggregation and analysis
```

### 5. **Deployment**
```typescript
// Use environment variables for configuration
// Implement graceful shutdown
// Health checks for container orchestration
// Blue-green deployments
// Automated testing and deployment pipelines
```

---

This Express.js integration guide provides everything needed to build production-ready AGI applications with the Sentient Node SDK. The examples are battle-tested and follow industry best practices for security, performance, and scalability.

**Next Steps:**
- [Fastify Integration Guide](./fastify-integration.md) - High-performance alternative
- [Next.js Integration Guide](./nextjs-integration.md) - Full-stack applications
- [Security Best Practices](./security-guide.md) - Advanced security configuration
- [Performance Optimization](./performance-guide.md) - Scaling and optimization