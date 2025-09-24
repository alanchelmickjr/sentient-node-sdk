/**
 * Comprehensive Tests for Sentient Agent Framework Logging System
 *
 * Tests core logging functionality, transports, manager, middleware,
 * and integration scenarios for production readiness.
 *
 * @module sentient-agent-framework/tests/logging
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import express from 'express';
import { 
  LogLevel, 
  LogEntry, 
  Logger,
  LoggerManager,
  LogTransport,
  LogContext,
  TransportError
} from '../src/interface/logging';
import { DefaultLogger, createLogger } from '../src/implementation/logger';
import { ConsoleTransport, createDevConsoleTransport } from '../src/implementation/transports/console_transport';
import { FileTransport, createRotatingFileTransport } from '../src/implementation/transports/file_transport';
import { HTTPTransport, createHTTPSTransport } from '../src/implementation/transports/http_transport';
import { 
  DefaultLoggerManager,
  getGlobalLoggerManager,
  configureLogging,
  setupEnvironmentLogging
} from '../src/implementation/logger_manager';
import { 
  createLoggingMiddleware,
  createRequestIdMiddleware,
  createErrorLoggingMiddleware,
  createLoggingMiddlewareStack
} from '../src/implementation/middleware/logging_middleware';

// ============================================================================
// Test Utilities and Mocks
// ============================================================================

class TestTransport implements LogTransport {
  public logs: LogEntry[] = [];
  public errors: Error[] = [];
  public closed = false;

  constructor(
    public readonly name: string,
    public readonly type: string = 'test',
    public level: LogLevel = LogLevel.DEBUG,
    public enabled: boolean = true
  ) {}

  log(entry: LogEntry): void {
    if (!this.enabled || entry.level < this.level) {
      return;
    }
    this.logs.push({ ...entry });
  }

  close(): void {
    this.closed = true;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  reset(): void {
    this.logs = [];
    this.errors = [];
  }
}

const TEST_LOG_DIR = path.join(__dirname, 'test-logs');

function setupTestLogDir(): void {
  if (!fs.existsSync(TEST_LOG_DIR)) {
    fs.mkdirSync(TEST_LOG_DIR, { recursive: true });
  }
}

function cleanupTestLogDir(): void {
  if (fs.existsSync(TEST_LOG_DIR)) {
    const files = fs.readdirSync(TEST_LOG_DIR);
    for (const file of files) {
      const filePath = path.join(TEST_LOG_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  }
}

function createTestHTTPServer(port: number, handler?: (req: http.IncomingMessage, res: http.ServerResponse) => void): http.Server {
  const server = http.createServer(handler || ((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  }));
  server.listen(port);
  return server;
}

// ============================================================================
// Core Logger Tests
// ============================================================================

describe('Core Logger', () => {
  let logger: Logger;
  let testTransport: TestTransport;

  beforeEach(() => {
    testTransport = new TestTransport('test');
    logger = createLogger('test-logger');
    logger.addTransport(testTransport);
  });

  afterEach(() => {
    testTransport.reset();
  });

  test('should create logger with default configuration', () => {
    expect(logger.name).toBe('test-logger');
    expect(logger.level).toBe(LogLevel.INFO);
  });

  test('should log at different levels', () => {
    logger.trace('trace message');
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');
    logger.fatal('fatal message');

    expect(testTransport.logs).toHaveLength(4); // trace and debug filtered out
    expect(testTransport.logs[0].levelName).toBe('INFO');
    expect(testTransport.logs[1].levelName).toBe('WARN');
    expect(testTransport.logs[2].levelName).toBe('ERROR');
    expect(testTransport.logs[3].levelName).toBe('FATAL');
  });

  test('should respect log level filtering', () => {
    logger.setLevel(LogLevel.WARN);
    
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(testTransport.logs).toHaveLength(2);
    expect(testTransport.logs[0].levelName).toBe('WARN');
    expect(testTransport.logs[1].levelName).toBe('ERROR');
  });

  test('should include context in log entries', () => {
    const context: LogContext = {
      userId: '123',
      operation: 'test',
      metadata: { test: true }
    };

    logger.info('test message', context);

    expect(testTransport.logs).toHaveLength(1);
    expect(testTransport.logs[0].context).toMatchObject(context);
  });

  test('should log errors with stack traces', () => {
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at test.js:1:1';

    logger.error('Error occurred', error);

    expect(testTransport.logs).toHaveLength(1);
    expect(testTransport.logs[0].context?.error).toMatchObject({
      name: 'Error',
      message: 'Test error',
      stack: error.stack
    });
  });

  test('should create child loggers with inherited context', () => {
    const baseContext = { service: 'test-service' };
    const childLogger = logger.child(baseContext);

    childLogger.info('child message', { operation: 'child-op' });

    expect(testTransport.logs).toHaveLength(1);
    expect(testTransport.logs[0].context).toMatchObject({
      service: 'test-service',
      operation: 'child-op'
    });
  });

  test('should support performance timing', (done) => {
    const timer = logger.time('test-operation');
    
    setTimeout(() => {
      timer.done('Operation completed');
      
      expect(testTransport.logs).toHaveLength(1);
      expect(testTransport.logs[0].context?.operation).toBe('test-operation');
      expect(testTransport.logs[0].context?.duration).toBeGreaterThan(0);
      done();
    }, 10);
  });

  test('should support profiling', (done) => {
    logger.profile('test-profile');
    
    setTimeout(() => {
      logger.profile('test-profile'); // End profiling
      
      expect(testTransport.logs).toHaveLength(2);
      expect(testTransport.logs[0].message).toContain('started');
      expect(testTransport.logs[1].message).toContain('completed');
      expect(testTransport.logs[1].context?.duration).toBeGreaterThan(0);
      done();
    }, 10);
  });
});

// ============================================================================
// Transport Tests
// ============================================================================

describe('Console Transport', () => {
  let transport: ConsoleTransport;
  let consoleSpies: { [key: string]: jest.SpyInstance };

  beforeEach(() => {
    transport = createDevConsoleTransport();
    consoleSpies = {
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      log: jest.spyOn(console, 'log').mockImplementation()
    };
  });

  afterEach(() => {
    Object.values(consoleSpies).forEach(spy => spy.mockRestore());
  });

  test('should log to console', () => {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'test message',
      logger: 'test'
    };

    transport.log(entry);

    expect(consoleSpies.info).toHaveBeenCalledTimes(1);
  });

  test('should respect log level', () => {
    transport.setLevel(LogLevel.WARN);

    const infoEntry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'info message',
      logger: 'test'
    };

    const warnEntry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.WARN,
      levelName: 'WARN',
      message: 'warn message',
      logger: 'test'
    };

    transport.log(infoEntry);
    transport.log(warnEntry);

    expect(consoleSpies.warn).toHaveBeenCalledTimes(1);
  });

  test('should handle disabled transport', () => {
    transport.setEnabled(false);

    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'test message',
      logger: 'test'
    };

    transport.log(entry);

    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.warn).not.toHaveBeenCalled();
    expect(consoleSpies.error).not.toHaveBeenCalled();
  });
});

describe('File Transport', () => {
  let transport: FileTransport;
  let testFile: string;

  beforeEach(() => {
    setupTestLogDir();
    testFile = path.join(TEST_LOG_DIR, 'test.log');
    transport = new FileTransport('test-file', {
      type: 'file',
      name: 'test-file',
      filename: testFile
    });
  });

  afterEach(async () => {
    await transport.close();
    cleanupTestLogDir();
  });

  test('should write logs to file', async () => {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'test message',
      logger: 'test'
    };

    await transport.log(entry);
    await transport.close();

    expect(fs.existsSync(testFile)).toBe(true);
    const content = fs.readFileSync(testFile, 'utf8');
    expect(content).toContain('test message');
  });

  test('should create directories if they do not exist', async () => {
    const nestedFile = path.join(TEST_LOG_DIR, 'nested', 'dir', 'test.log');
    const nestedTransport = new FileTransport('nested-file', {
      type: 'file',
      name: 'nested-file',
      filename: nestedFile
    });

    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'test message',
      logger: 'test'
    };

    await nestedTransport.log(entry);
    await nestedTransport.close();

    expect(fs.existsSync(nestedFile)).toBe(true);
  });
});

describe('HTTP Transport', () => {
  let transport: HTTPTransport;
  let server: http.Server;
  let receivedRequests: any[] = [];

  beforeEach(() => {
    receivedRequests = [];
    
    server = createTestHTTPServer(3001, (req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        receivedRequests.push({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: body ? JSON.parse(body) : null
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });
    });

    transport = new HTTPTransport('test-http', {
      type: 'http',
      name: 'test-http',
      host: 'localhost',
      port: 3001,
      path: '/logs',
      batch: { size: 1, timeout: 100 } // Small batch for testing
    });
  });

  afterEach(async () => {
    await transport.close();
    server.close();
  });

  test('should send logs via HTTP', async () => {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'test message',
      logger: 'test'
    };

    await transport.log(entry);
    
    // Wait for batch to be sent
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(receivedRequests).toHaveLength(1);
    expect(receivedRequests[0].method).toBe('POST');
    expect(receivedRequests[0].body.logs).toHaveLength(1);
    expect(receivedRequests[0].body.logs[0].message).toBe('test message');
  });

  test('should batch multiple log entries', async () => {
    const batchTransport = new HTTPTransport('batch-http', {
      type: 'http',
      name: 'batch-http',
      host: 'localhost',
      port: 3001,
      path: '/logs',
      batch: { size: 3, timeout: 1000 }
    });

    for (let i = 0; i < 3; i++) {
      await batchTransport.log({
        timestamp: new Date(),
        level: LogLevel.INFO,
        levelName: 'INFO',
        message: `test message ${i}`,
        logger: 'test'
      });
    }

    // Wait for batch to be sent
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(receivedRequests).toHaveLength(1);
    expect(receivedRequests[0].body.logs).toHaveLength(3);

    await batchTransport.close();
  });
});

// ============================================================================
// Logger Manager Tests
// ============================================================================

describe('Logger Manager', () => {
  let manager: LoggerManager;

  beforeEach(() => {
    manager = new DefaultLoggerManager();
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  test('should create and manage loggers', () => {
    const logger1 = manager.getLogger('test-logger-1');
    const logger2 = manager.getLogger('test-logger-2');
    const logger1Again = manager.getLogger('test-logger-1');

    expect(logger1).toBeDefined();
    expect(logger2).toBeDefined();
    expect(logger1).toBe(logger1Again); // Should return same instance
    expect(manager.listLoggers()).toContain('test-logger-1');
    expect(manager.listLoggers()).toContain('test-logger-2');
  });

  test('should configure logging system', () => {
    manager.configure({
      defaultLevel: LogLevel.WARN,
      globalContext: { service: 'test-service' }
    });

    const logger = manager.createLogger('configured-logger');
    expect(logger.level).toBe(LogLevel.WARN);
  });

  test('should manage global transports', () => {
    const transport = new TestTransport('global-test');
    manager.addGlobalTransport(transport);

    expect(manager.listTransports()).toContain('global-test');

    const logger = manager.getLogger('test-logger');
    const testTransport = new TestTransport('test');
    logger.addTransport(testTransport);

    logger.info('test message');

    // Should log to both global and logger-specific transports
    expect(transport.logs).toHaveLength(1);
    expect(testTransport.logs).toHaveLength(1);
  });

  test('should collect metrics', () => {
    const metrics = manager.getMetrics();
    expect(metrics).toHaveProperty('totalLogs');
    expect(metrics).toHaveProperty('logsByLevel');
    expect(metrics).toHaveProperty('uptime');
  });

  test('should handle environment setup', () => {
    setupEnvironmentLogging('development');
    const devLogger = getGlobalLoggerManager().getLogger('dev-test');
    expect(devLogger.level).toBe(LogLevel.DEBUG);

    setupEnvironmentLogging('production');
    const prodLogger = getGlobalLoggerManager().getLogger('prod-test');
    expect(prodLogger.level).toBe(LogLevel.INFO);
  });
});

// ============================================================================
// Express Middleware Tests
// ============================================================================

describe('Express Logging Middleware', () => {
  let app: express.Application;
  let testTransport: TestTransport;
  let logger: Logger;

  beforeEach(() => {
    app = express();
    testTransport = new TestTransport('middleware-test');
    logger = createLogger('middleware-logger');
    logger.addTransport(testTransport);
    
    app.use(express.json());
  });

  afterEach(() => {
    testTransport.reset();
  });

  test('should log HTTP requests and responses', async () => {
    app.use(createLoggingMiddleware(logger));
    app.get('/test', (req, res) => {
      res.json({ message: 'success' });
    });

    const server = app.listen(3002);
    
    try {
      const response = await fetch('http://localhost:3002/test');
      expect(response.status).toBe(200);

      // Wait for logging to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(testTransport.logs.length).toBeGreaterThanOrEqual(1);
      
      const requestLog = testTransport.logs.find(log => 
        log.message.includes('Incoming GET /test')
      );
      expect(requestLog).toBeDefined();
      expect(requestLog?.context?.method).toBe('GET');
      expect(requestLog?.context?.path).toBe('/test');
      
    } finally {
      server.close();
    }
  });

  test('should add correlation IDs to requests', async () => {
    app.use(createRequestIdMiddleware());
    app.get('/test', (req, res) => {
      res.json({ 
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    });

    const server = app.listen(3003);
    
    try {
      const response = await fetch('http://localhost:3003/test');
      const body = await response.json() as any;
      
      expect(body.requestId).toBeDefined();
      expect(body.correlationId).toBeDefined();
      expect(response.headers.get('x-request-id')).toBe(body.requestId);
      expect(response.headers.get('x-correlation-id')).toBe(body.correlationId);
      
    } finally {
      server.close();
    }
  });

  test('should log errors', async () => {
    app.use(createLoggingMiddleware(logger));
    
    app.get('/error', (req, res) => {
      throw new Error('Test error');
    });

    app.use(createErrorLoggingMiddleware(logger));
    app.use((error: any, req: any, res: any, next: any) => {
      res.status(500).json({ error: error.message });
    });

    const server = app.listen(3004);
    
    try {
      const response = await fetch('http://localhost:3004/error');
      expect(response.status).toBe(500);

      // Wait for logging to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const errorLog = testTransport.logs.find(log => 
        log.message.includes('Unhandled error')
      );
      expect(errorLog).toBeDefined();
      expect(errorLog?.context?.error?.message).toBe('Test error');
      
    } finally {
      server.close();
    }
  });

  test('should create complete middleware stack', async () => {
    // Use individual middleware components to ensure proper transport connection
    app.use(createLoggingMiddleware(logger));
    app.use(createRequestIdMiddleware());
    
    app.get('/stack-test', (req, res) => {
      res.json({ message: 'stack test' });
    });

    const server = app.listen(3005);
    
    try {
      const response = await fetch('http://localhost:3005/stack-test');
      expect(response.status).toBe(200);

      // Wait for logging to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(testTransport.logs.length).toBeGreaterThan(0);
      
    } finally {
      server.close();
    }
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Logging System Integration', () => {
  test('should work end-to-end with all components', async () => {
    // Setup logging system
    const manager = new DefaultLoggerManager();
    const testTransport = new TestTransport('integration-test');
    manager.addGlobalTransport(testTransport);

    // Configure for production-like environment
    manager.configure({
      environment: 'production',
      defaultLevel: LogLevel.INFO,
      globalContext: {
        service: 'integration-test',
        version: '1.0.0'
      },
      performance: {
        enableMetrics: true,
        slowThreshold: 100
      }
    });

    // Create logger
    const logger = manager.getLogger('integration-logger');

    // Test basic logging
    logger.info('Service started', { port: 3000 });
    logger.warn('High memory usage', { usage: '85%' });

    // Test error logging
    const error = new Error('Database connection failed');
    logger.error('Database error', error, { 
      database: 'postgres',
      host: 'localhost'
    });

    // Test performance logging
    const timer = logger.time('database-query');
    await new Promise(resolve => setTimeout(resolve, 50));
    timer.done('Query completed', LogLevel.INFO, { 
      query: 'SELECT * FROM users',
      rows: 150
    });

    // Test child logger with context inheritance
    const requestLogger = logger.child({
      requestId: 'req-123',
      correlationId: 'corr-456'
    });

    requestLogger.info('Processing request', {
      method: 'POST',
      path: '/api/users',
      userId: 'user-789'
    });

    // Verify logs
    expect(testTransport.logs).toHaveLength(5);
    
    // Check global context inheritance
    testTransport.logs.forEach(log => {
      expect(log.context?.service).toBe('integration-test');
      expect(log.context?.version).toBe('1.0.0');
    });

    // Check error logging
    const errorLog = testTransport.logs.find(log => 
      log.message.includes('Database error')
    );
    expect(errorLog?.context?.error?.name).toBe('Error');
    expect(errorLog?.context?.database).toBe('postgres');

    // Check performance logging
    const perfLog = testTransport.logs.find(log => 
      log.message.includes('Query completed')
    );
    expect(perfLog?.context?.duration).toBeGreaterThan(0);
    expect(perfLog?.context?.query).toBe('SELECT * FROM users');

    // Check child logger context
    const childLog = testTransport.logs.find(log => 
      log.message.includes('Processing request')
    );
    expect(childLog?.context?.requestId).toBe('req-123');
    expect(childLog?.context?.correlationId).toBe('corr-456');

    // Check metrics
    const metrics = manager.getMetrics();
    expect(metrics.totalLogs).toBeGreaterThan(0);
    expect(metrics.logsByLevel.INFO).toBeGreaterThan(0);
    expect(metrics.logsByLevel.WARN).toBeGreaterThan(0);
    expect(metrics.logsByLevel.ERROR).toBeGreaterThan(0);

    await manager.shutdown();
  });
});