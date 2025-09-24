# Sentient Agent Framework - Comprehensive Structured Logging System

A production-ready, structured logging system with multiple transport support, centralized management, Express middleware integration, and comprehensive monitoring capabilities.

## Features

- 🏗️ **Structured JSON Logging** - Consistent, searchable log format with contextual metadata
- 🚀 **Multiple Transports** - Console, File (with rotation), HTTP/HTTPS endpoints
- 🎯 **Centralized Management** - Single configuration point for all loggers
- 🔗 **Express Integration** - Automatic request/response logging with correlation IDs
- 📊 **Performance Monitoring** - Built-in metrics collection and slow request detection  
- 🎛️ **Log Filtering & Sampling** - Configurable filtering rules for high-volume environments
- 🔄 **Log Rotation** - Automatic file rotation with compression and archival
- 🏷️ **Correlation IDs** - Distributed tracing support across requests
- ⚡ **Production Ready** - Designed for high-performance production environments
- 🛡️ **Error Tracking** - Comprehensive error logging with stack traces

## Quick Start

### Basic Usage

```typescript
import { getLogger, LogLevel } from './logging';

// Get a logger instance
const logger = getLogger('my-app');

// Basic logging
logger.info('Application started', { port: 3000, environment: 'production' });
logger.warn('High memory usage detected', { usage: '85%' });
logger.error('Database connection failed', new Error('Connection timeout'));

// Structured logging with context
logger.info('User action completed', {
  userId: 'user-123',
  action: 'purchase',
  amount: 99.99,
  currency: 'USD'
});
```

### Express Integration

```typescript
import express from 'express';
import { createLoggingMiddlewareStack, getLogger } from './logging';

const app = express();
const logger = getLogger('web-server');

// Add comprehensive logging middleware
const loggingMiddlewares = createLoggingMiddlewareStack({
  logger,
  environment: 'production'
});

loggingMiddlewares.forEach(middleware => app.use(middleware));

app.get('/api/users', (req, res) => {
  // Logger is automatically attached to request
  req.logger?.info('Fetching users', { limit: req.query.limit });
  
  // Your business logic here
  res.json({ users: [] });
});

app.listen(3000, () => {
  logger.info('Server started', { port: 3000 });
});
```

### Environment-Specific Setup

```typescript
import { setupDevelopmentLogging, setupProductionLogging } from './logging';

// Development environment
if (process.env.NODE_ENV === 'development') {
  const logger = setupDevelopmentLogging();
  logger.debug('Development mode enabled');
}

// Production environment
if (process.env.NODE_ENV === 'production') {
  const logger = setupProductionLogging({
    logLevel: LogLevel.INFO,
    fileLogging: {
      filename: '/var/log/app/application.log',
      maxSize: '50MB',
      maxFiles: 10
    },
    httpLogging: {
      host: 'logs.example.com',
      token: process.env.LOG_AGGREGATION_TOKEN,
      ssl: true
    }
  });
}
```

## Configuration

### Logger Configuration

```typescript
import { configureLogging, LogLevel, addGlobalTransport, createFileTransport } from './logging';

// Configure global logging system
configureLogging({
  environment: 'production',
  defaultLevel: LogLevel.INFO,
  globalContext: {
    service: 'my-service',
    version: '1.0.0',
    environment: process.env.NODE_ENV
  },
  performance: {
    enableMetrics: true,
    metricsInterval: 60000,
    slowThreshold: 2000
  },
  correlation: {
    enabled: true,
    headerName: 'x-correlation-id',
    generateIds: true
  },
  sampling: {
    enabled: true,
    rules: [
      {
        logger: '*',
        level: LogLevel.DEBUG,
        rate: 0.1 // Sample 10% of debug logs
      }
    ]
  }
});

// Add custom transport
addGlobalTransport(createFileTransport(
  'audit-log',
  '/var/log/audit.log'
));
```

### Transport Configuration

#### Console Transport

```typescript
import { createConsoleTransport, LogLevel } from './logging';

const consoleTransport = createConsoleTransport('console', {
  level: LogLevel.DEBUG,
  colors: true,
  timestamp: true,
  enabled: true
});
```

#### File Transport with Rotation

```typescript
import { createRotatingFileTransport } from './logging';

const fileTransport = createRotatingFileTransport(
  'app-logs',
  '/var/log/app.log',
  '10MB',  // Rotate when file reaches 10MB
  5        // Keep 5 rotated files
);
```

#### HTTP Transport for Log Aggregation

```typescript
import { createHTTPSTransport, createElasticsearchTransport } from './logging';

// Generic HTTPS endpoint
const httpsTransport = createHTTPSTransport(
  'log-service',
  'logs.example.com',
  'your-api-token'
);

// Elasticsearch integration
const elasticTransport = createElasticsearchTransport(
  'elasticsearch',
  'elasticsearch.example.com',
  'app-logs'
);
```

## Advanced Usage

### Performance Monitoring

```typescript
const logger = getLogger('performance');

// Method 1: Timer API
const timer = logger.time('database-query');
const users = await db.users.findMany();
timer.done('Database query completed', LogLevel.INFO, { 
  resultCount: users.length 
});

// Method 2: Profiling API
logger.profile('complex-operation');
await performComplexOperation();
logger.profile('complex-operation'); // Ends profiling

// Method 3: Performance helper
import { PerformanceLogger } from './logging';

const perfLogger = new PerformanceLogger(logger);
const result = await perfLogger.measure('api-call', async () => {
  return await fetch('/api/data');
}, { endpoint: '/api/data' });
```

### Error Tracking

```typescript
const logger = getLogger('error-handler');

try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error, {
    operation: 'riskyOperation',
    userId: 'user-123',
    context: 'payment-processing'
  });
  
  // Error context helper
  logger.error('Payment processing failed', LogHelpers.errorContext(error, {
    paymentId: 'pay-456',
    amount: 100.00
  }));
}
```

### Child Loggers with Context

```typescript
const baseLogger = getLogger('service');

// Create child logger with inherited context
const userLogger = baseLogger.child({
  userId: 'user-123',
  sessionId: 'sess-456'
});

// Create request-specific logger
const requestLogger = userLogger.child({
  requestId: 'req-789',
  correlationId: 'corr-abc'
});

requestLogger.info('Processing user request'); 
// Automatically includes userId, sessionId, requestId, correlationId
```

### Custom Transports

```typescript
import { LogTransport, LogEntry, LogLevel } from './logging';

class DatabaseTransport implements LogTransport {
  constructor(
    public readonly name: string,
    public readonly type: string = 'database',
    public level: LogLevel = LogLevel.ERROR,
    public enabled: boolean = true
  ) {}

  async log(entry: LogEntry): Promise<void> {
    if (!this.enabled || entry.level < this.level) {
      return;
    }

    await db.logs.create({
      data: {
        timestamp: entry.timestamp,
        level: entry.levelName,
        logger: entry.logger,
        message: entry.message,
        context: JSON.stringify(entry.context),
        error: entry.error ? JSON.stringify(entry.error) : null
      }
    });
  }

  async close(): Promise<void> {
    // Cleanup resources
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

// Use custom transport
addGlobalTransport(new DatabaseTransport('database-logs'));
```

## Express Middleware

### Complete Middleware Stack

```typescript
import { createLoggingMiddlewareStack } from './logging';

// Development environment - verbose logging
const devMiddlewares = createLoggingMiddlewareStack({
  environment: 'development',
  customConfig: {
    logLevel: LogLevel.DEBUG,
    logRequestBody: true,
    logResponseBody: true,
    slowThreshold: 500
  }
});

// Production environment - optimized logging
const prodMiddlewares = createLoggingMiddlewareStack({
  environment: 'production',
  customConfig: {
    logLevel: LogLevel.INFO,
    logRequestBody: false,
    logResponseBody: false,
    skipPaths: ['/health', '/metrics', '/favicon.ico'],
    slowThreshold: 2000
  }
});

// Security-focused logging
const securityMiddlewares = createLoggingMiddlewareStack({
  environment: 'security',
  customConfig: {
    logLevel: LogLevel.INFO,
    logRequestBody: true,
    includeHeaders: ['user-agent', 'x-forwarded-for', 'authorization'],
    skipPaths: [] // Log everything for security analysis
  }
});
```

### Custom Middleware Configuration

```typescript
import { createLoggingMiddleware, createErrorLoggingMiddleware } from './logging';

const customLoggingMiddleware = createLoggingMiddleware(logger, {
  skipPaths: ['/health', '/metrics'],
  skipMethods: ['OPTIONS'],
  logLevel: LogLevel.INFO,
  logRequestBody: true,
  logResponseBody: false,
  maxBodySize: 2048,
  requestIdHeader: 'x-request-id',
  correlationIdHeader: 'x-correlation-id',
  includeHeaders: ['user-agent', 'content-type', 'accept'],
  excludeHeaders: ['authorization', 'cookie'],
  logSlowRequests: true,
  slowThreshold: 1000
});

app.use(customLoggingMiddleware);
app.use(createErrorLoggingMiddleware(logger));
```

## Correlation IDs and Distributed Tracing

```typescript
import { createRequestIdMiddleware } from './logging';

// Add correlation ID support
app.use(createRequestIdMiddleware());

app.get('/api/data', async (req, res) => {
  const logger = req.logger || getLogger('api');
  
  // Correlation ID is automatically included in logs
  logger.info('Fetching data from external service');
  
  // Pass correlation ID to external services
  const response = await fetch('https://external-api.com/data', {
    headers: {
      'x-correlation-id': req.correlationId
    }
  });
  
  logger.info('External service response received', { 
    statusCode: response.status 
  });
  
  res.json(await response.json());
});
```

## Metrics and Monitoring

```typescript
import { getGlobalLoggerManager } from './logging';

// Get system metrics
const manager = getGlobalLoggerManager();
const metrics = manager.getMetrics();

console.log('Logging System Metrics:', {
  totalLogs: metrics.totalLogs,
  errorRate: (metrics.errorCount / metrics.totalLogs) * 100,
  logsByLevel: metrics.logsByLevel,
  averageProcessingTime: metrics.averageProcessingTime,
  memoryUsage: metrics.memoryUsage
});

// Reset metrics (useful for periodic reporting)
manager.resetMetrics();
```

## Log Filtering and Sampling

```typescript
import { configureLogging, LogLevel } from './logging';

configureLogging({
  sampling: {
    enabled: true,
    rules: [
      {
        logger: 'debug-heavy-service',
        level: LogLevel.DEBUG,
        rate: 0.05 // Sample only 5% of debug logs
      },
      {
        logger: 'high-volume-api',
        level: LogLevel.INFO,
        rate: 0.5  // Sample 50% of info logs
      },
      {
        // Custom condition-based sampling
        condition: (entry) => entry.context?.userId === 'debug-user',
        rate: 1.0  // Always log for debug user
      }
    ]
  }
});
```

## Best Practices

### 1. Structured Logging

Always provide structured context instead of string interpolation:

```typescript
// ❌ Avoid string interpolation
logger.info(`User ${userId} performed action ${action}`);

// ✅ Use structured logging
logger.info('User action performed', { 
  userId, 
  action,
  timestamp: new Date().toISOString()
});
```

### 2. Error Handling

Include full error context and stack traces:

```typescript
// ❌ Minimal error logging
logger.error('Error occurred');

// ✅ Comprehensive error logging
logger.error('Database operation failed', error, {
  operation: 'user.create',
  userId: newUser.id,
  database: 'postgresql',
  table: 'users',
  retryCount: 3
});
```

### 3. Performance Monitoring

Monitor critical operations:

```typescript
const logger = getLogger('database');

async function fetchUsers(filters: UserFilters) {
  const timer = logger.time('users.fetch');
  
  try {
    const users = await db.users.findMany({ where: filters });
    
    timer.done('Users fetched successfully', LogLevel.INFO, {
      filterCount: Object.keys(filters).length,
      resultCount: users.length
    });
    
    return users;
  } catch (error) {
    timer.done('User fetch failed', LogLevel.ERROR, { 
      error: error.message 
    });
    throw error;
  }
}
```

### 4. Environment-Specific Configuration

Configure logging appropriately for each environment:

```typescript
// config/logging.ts
const loggingConfig = {
  development: {
    level: LogLevel.DEBUG,
    transports: ['console'],
    colors: true,
    logBodies: true
  },
  staging: {
    level: LogLevel.INFO,
    transports: ['console', 'file'],
    colors: false,
    logBodies: false
  },
  production: {
    level: LogLevel.WARN,
    transports: ['console', 'file', 'http'],
    sampling: true,
    compression: true
  }
};
```

### 5. Security Considerations

Be careful with sensitive data in logs:

```typescript
// ❌ Logging sensitive data
logger.info('User login', { 
  username, 
  password, // Never log passwords!
  creditCard: user.creditCard // Never log PII!
});

// ✅ Safe logging
logger.info('User login attempt', {
  username: username.substring(0, 3) + '***', // Masked
  userId: user.id,
  loginMethod: 'password',
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});
```

## Integration Examples

### Next.js Integration

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getLogger } from './lib/logging';

const logger = getLogger('middleware');

export function middleware(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  
  logger.info('Request received', {
    method: request.method,
    url: request.url,
    correlationId,
    userAgent: request.headers.get('user-agent')
  });

  const response = NextResponse.next();
  response.headers.set('x-correlation-id', correlationId);
  
  return response;
}
```

### NestJS Integration

```typescript
// logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { getLogger } from './logging';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger = getLogger('nest-app');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const timer = this.logger.time(`${request.method} ${request.url}`);

    return next
      .handle()
      .pipe(
        tap(() => {
          timer.done('Request completed successfully');
        }),
        tap({
          error: (error) => {
            this.logger.error('Request failed', error, {
              method: request.method,
              url: request.url,
              correlationId: request.correlationId
            });
          }
        })
      );
  }
}
```

### Docker Integration

```dockerfile
# Dockerfile
FROM node:18-alpine

# Create log directory
RUN mkdir -p /var/log/app

# Set up log volume
VOLUME ["/var/log/app"]

# Environment variables for logging
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV LOG_FILE=/var/log/app/application.log

COPY . .
RUN npm ci --production

CMD ["node", "dist/server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    environment:
      - LOG_AGGREGATION_URL=http://logstash:5000
      - LOG_AGGREGATION_TOKEN=${LOG_TOKEN}
    volumes:
      - ./logs:/var/log/app
    depends_on:
      - logstash

  logstash:
    image: elastic/logstash:7.15.0
    ports:
      - "5000:5000"
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
```

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check transport configuration and log levels
2. **High memory usage**: Enable log sampling for high-volume applications
3. **Performance issues**: Use async transports and appropriate batch sizes
4. **Missing correlation IDs**: Ensure middleware is properly configured

### Debug Mode

```typescript
// Enable debug logging for troubleshooting
const logger = getLogger('debug');
logger.setLevel(LogLevel.TRACE);

// Check transport status
const manager = getGlobalLoggerManager();
console.log('Active transports:', manager.listTransports());
console.log('Metrics:', manager.getMetrics());
```

## API Reference

For complete API documentation, see the TypeScript definitions in the source files:

- [`LogLevel`](../interface/logging.ts) - Log level enumeration
- [`Logger`](../interface/logging.ts) - Main logger interface
- [`LogTransport`](../interface/logging.ts) - Transport interface
- [`LoggerManager`](../interface/logging.ts) - Manager interface
- [`LoggingMiddlewareConfig`](../interface/logging.ts) - Middleware configuration

## License

MIT License - see LICENSE file for details.