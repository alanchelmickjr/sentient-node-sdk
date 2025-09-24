/**
 * Express Server with Comprehensive Logging Example
 * 
 * Demonstrates how to integrate the Sentient Agent Framework logging system
 * with an Express.js application for production-ready request/response logging.
 */

import express from 'express';
import { 
  getLogger,
  createLoggingMiddlewareStack,
  createErrorLoggingMiddleware,
  setupProductionLogging,
  LogLevel,
  LogHelpers,
  addGlobalTransport,
  createFileTransport
} from '../src/logging';

// ============================================================================
// Application Setup
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize logging system
const logger = setupProductionLogging({
  logLevel: LogLevel.INFO,
  fileLogging: {
    filename: 'logs/application.log',
    maxSize: '10MB',
    maxFiles: 5
  }
});

// Add audit logging
addGlobalTransport(createFileTransport('audit-log', 'logs/audit.log'));

// ============================================================================
// Express Middleware Setup
// ============================================================================

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Add comprehensive logging middleware stack
const loggingMiddlewares = createLoggingMiddlewareStack({
  logger,
  environment: 'production',
  customConfig: {
    logLevel: LogLevel.INFO,
    logRequestBody: true,
    logResponseBody: false,
    maxBodySize: 1024,
    skipPaths: ['/health', '/metrics'],
    includeHeaders: ['user-agent', 'content-type', 'x-api-key'],
    excludeHeaders: ['authorization', 'cookie'],
    slowThreshold: 2000
  }
});

loggingMiddlewares.forEach(middleware => app.use(middleware));

// ============================================================================
// Custom Business Logic Middleware
// ============================================================================

// API Key validation middleware with logging
app.use('/api', (req, res, next) => {
  const apiKey = req.get('x-api-key');
  const requestLogger = req.logger || logger;

  if (!apiKey) {
    requestLogger.warn('API request without API key', {
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      securityEvent: 'missing_api_key'
    });
    
    return res.status(401).json({ 
      error: 'API key required',
      code: 'MISSING_API_KEY'
    });
  }

  // Validate API key (simplified)
  if (!isValidApiKey(apiKey)) {
    requestLogger.warn('Invalid API key used', {
      path: req.path,
      ip: req.ip,
      apiKeyPrefix: apiKey.substring(0, 8) + '***',
      securityEvent: 'invalid_api_key'
    });
    
    return res.status(401).json({ 
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  // Add user context to logger
  const userContext = getUserContextFromApiKey(apiKey);
  req.logger = requestLogger.child({
    userId: userContext.userId,
    apiKeyId: userContext.keyId
  });

  next();
});

// Rate limiting middleware with logging
app.use('/api', (req, res, next) => {
  const requestLogger = req.logger || logger;
  const clientId = req.get('x-api-key') || req.ip || 'unknown';
  
  if (isRateLimited(clientId)) {
    requestLogger.warn('Rate limit exceeded', {
      clientId: clientId.length > 8 ? clientId.substring(0, 8) + '***' : clientId,
      path: req.path,
      securityEvent: 'rate_limit_exceeded'
    });
    
    return res.status(429).json({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
  
  next();
});

// ============================================================================
// API Routes with Structured Logging
// ============================================================================

// Health check endpoint (skipped from logging)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Metrics endpoint (skipped from logging)
app.get('/metrics', (req, res) => {
  const manager = require('../src/logging').getGlobalLoggerManager();
  const metrics = manager.getMetrics();
  res.json(metrics);
});

// Users API
app.get('/api/users', async (req, res) => {
  const requestLogger = req.logger || logger;
  const timer = requestLogger.time('users.list');

  try {
    requestLogger.info('Fetching users list', {
      filters: req.query,
      operation: 'users.list'
    });

    // Simulate database operation
    const users = await fetchUsers(req.query, requestLogger);
    
    timer.done('Users fetched successfully', LogLevel.INFO, {
      resultCount: users.length,
      hasFilters: Object.keys(req.query).length > 0
    });

    res.json({
      users,
      count: users.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    timer.done('Failed to fetch users', LogLevel.ERROR);
    
    requestLogger.error('Database error while fetching users', error as Error, {
      operation: 'users.list',
      filters: req.query
    });

    res.status(500).json({
      error: 'Internal server error',
      code: 'DATABASE_ERROR'
    });
  }
});

// Create user endpoint
app.post('/api/users', async (req, res) => {
  const requestLogger = req.logger || logger;
  const timer = requestLogger.time('users.create');

  try {
    // Validate request data
    const validationResult = validateUserData(req.body);
    if (!validationResult.valid) {
      requestLogger.warn('Invalid user data provided', {
        errors: validationResult.errors,
        operation: 'users.create'
      });

      timer.done('User creation failed - validation error', LogLevel.WARN);
      
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationResult.errors
      });
    }

    requestLogger.info('Creating new user', {
      email: req.body.email,
      operation: 'users.create'
    });

    // Create user
    const user = await createUser(req.body, requestLogger);
    
    timer.done('User created successfully', LogLevel.INFO, {
      userId: user.id,
      email: user.email
    });

    // Log business event
    requestLogger.info('User registration completed', {
      userId: user.id,
      email: user.email,
      source: req.get('user-agent'),
      businessEvent: 'user_registered'
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    timer.done('User creation failed', LogLevel.ERROR);
    
    if ((error as any).code === 'DUPLICATE_EMAIL') {
      requestLogger.warn('Attempt to create user with existing email', {
        email: req.body.email,
        operation: 'users.create'
      });
      
      return res.status(409).json({
        error: 'Email already exists',
        code: 'DUPLICATE_EMAIL'
      });
    }

    requestLogger.error('Unexpected error during user creation', error as Error, {
      operation: 'users.create',
      email: req.body.email
    });

    res.status(500).json({
      error: 'Internal server error',
      code: 'USER_CREATION_ERROR'
    });
  }
});

// User profile endpoint
app.get('/api/users/:userId', async (req, res) => {
  const requestLogger = req.logger || logger;
  const userId = req.params.userId;
  const timer = requestLogger.time('users.get');

  try {
    requestLogger.info('Fetching user profile', {
      userId,
      operation: 'users.get'
    });

    const user = await getUserById(userId, requestLogger);
    
    if (!user) {
      timer.done('User not found', LogLevel.INFO);
      
      requestLogger.info('User not found', {
        userId,
        operation: 'users.get'
      });
      
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    timer.done('User profile fetched successfully', LogLevel.INFO);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }
    });

  } catch (error) {
    timer.done('Failed to fetch user profile', LogLevel.ERROR);
    
    requestLogger.error('Error fetching user profile', error as Error, {
      userId,
      operation: 'users.get'
    });

    res.status(500).json({
      error: 'Internal server error',
      code: 'USER_FETCH_ERROR'
    });
  }
});

// ============================================================================
// Error Handling Middleware
// ============================================================================

// Custom error logging middleware
app.use(createErrorLoggingMiddleware(logger));

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestLogger = req.logger || logger;

  // Log different types of errors differently
  if (error.type === 'entity.parse.failed') {
    requestLogger.warn('Invalid JSON in request body', {
      error: error.message,
      body: error.body,
      operation: 'json_parse'
    });
    
    return res.status(400).json({
      error: 'Invalid JSON',
      code: 'JSON_PARSE_ERROR'
    });
  }

  if (error.type === 'entity.too.large') {
    requestLogger.warn('Request entity too large', {
      limit: error.limit,
      length: error.length,
      operation: 'request_size_check'
    });
    
    return res.status(413).json({
      error: 'Request too large',
      code: 'REQUEST_TOO_LARGE'
    });
  }

  // Log unexpected errors
  requestLogger.error('Unhandled error', error, LogHelpers.errorContext(error, {
    url: req.url,
    method: req.method,
    userAgent: req.get('user-agent')
  }));

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use('*', (req, res) => {
  const requestLogger = req.logger || logger;
  
  requestLogger.info('Route not found', {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('user-agent'),
    ip: req.ip
  });

  res.status(404).json({
    error: 'Not found',
    code: 'ROUTE_NOT_FOUND'
  });
});

// ============================================================================
// Business Logic Functions (with logging)
// ============================================================================

async function fetchUsers(filters: any, logger: any): Promise<any[]> {
  logger.debug('Executing database query', {
    table: 'users',
    filters,
    operation: 'database.select'
  });

  // Simulate database operation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const users = [
    { id: '1', email: 'user1@example.com', createdAt: new Date() },
    { id: '2', email: 'user2@example.com', createdAt: new Date() }
  ].filter(user => {
    if (filters.email) {
      return user.email.includes(filters.email);
    }
    return true;
  });

  logger.debug('Database query completed', {
    resultCount: users.length,
    operation: 'database.select'
  });

  return users;
}

async function createUser(userData: any, logger: any): Promise<any> {
  logger.debug('Creating user in database', {
    email: userData.email,
    operation: 'database.insert'
  });

  // Simulate validation and creation
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Simulate duplicate email check
  if (userData.email === 'existing@example.com') {
    const error = new Error('Email already exists');
    (error as any).code = 'DUPLICATE_EMAIL';
    throw error;
  }

  const user = {
    id: `user-${Date.now()}`,
    email: userData.email,
    createdAt: new Date(),
    lastLoginAt: null
  };

  logger.debug('User created in database', {
    userId: user.id,
    operation: 'database.insert'
  });

  return user;
}

async function getUserById(userId: string, logger: any): Promise<any | null> {
  logger.debug('Fetching user from database', {
    userId,
    operation: 'database.select'
  });

  // Simulate database lookup
  await new Promise(resolve => setTimeout(resolve, 50));
  
  if (userId === 'nonexistent') {
    return null;
  }

  const user = {
    id: userId,
    email: `user${userId}@example.com`,
    createdAt: new Date(Date.now() - 86400000), // 1 day ago
    lastLoginAt: new Date()
  };

  logger.debug('User found in database', {
    userId,
    operation: 'database.select'
  });

  return user;
}

// ============================================================================
// Utility Functions
// ============================================================================

function isValidApiKey(apiKey: string): boolean {
  // Simplified API key validation
  return apiKey.startsWith('ak_') && apiKey.length > 20;
}

function getUserContextFromApiKey(apiKey: string): { userId: string; keyId: string } {
  // Simplified user context extraction
  return {
    userId: `user-${apiKey.substring(3, 10)}`,
    keyId: apiKey.substring(0, 16)
  };
}

function isRateLimited(clientId: string): boolean {
  // Simplified rate limiting (in production, use Redis or similar)
  return false;
}

function validateUserData(userData: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  if (!userData.email) {
    errors.push('Email is required');
  } else if (!/\S+@\S+\.\S+/.test(userData.email)) {
    errors.push('Invalid email format');
  }
  
  if (!userData.name || userData.name.length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

// ============================================================================
// Server Startup
// ============================================================================

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, starting graceful shutdown');
  
  const { shutdownLogging } = require('../src/logging');
  await shutdownLogging();
  
  logger.info('Logging system shut down, exiting');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, starting graceful shutdown');
  
  const { shutdownLogging } = require('../src/logging');
  await shutdownLogging();
  
  logger.info('Logging system shut down, exiting');
  process.exit(0);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    pid: process.pid
  });
});

// Handle server errors
server.on('error', (error) => {
  logger.fatal('Server startup failed', error);
  process.exit(1);
});

export default app;