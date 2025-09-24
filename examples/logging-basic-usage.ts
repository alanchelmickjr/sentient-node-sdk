/**
 * Basic Logging Usage Examples
 * 
 * Demonstrates fundamental logging operations with the Sentient Agent Framework
 * structured logging system.
 */

import { 
  getLogger, 
  LogLevel, 
  setupDevelopmentLogging,
  setupProductionLogging,
  configureLogging 
} from '../src/logging';

// ============================================================================
// Basic Logger Usage
// ============================================================================

// Get a logger instance
const logger = getLogger('example-app');

// Basic logging at different levels
logger.trace('Detailed debug information');
logger.debug('Debug information');
logger.info('General information', { userId: 'user-123', action: 'login' });
logger.warn('Warning message', { threshold: 85, current: 90 });
logger.error('Error occurred', new Error('Database connection failed'));
logger.fatal('Critical system failure', new Error('Out of memory'));

// ============================================================================
// Structured Logging with Context
// ============================================================================

// Log with rich contextual information
logger.info('User registration completed', {
  userId: 'user-456',
  email: 'user@example.com',
  source: 'web',
  timestamp: new Date().toISOString(),
  metadata: {
    referrer: 'google',
    campaign: 'summer-sale'
  }
});

// Log business events
logger.info('Purchase completed', {
  transactionId: 'txn-789',
  userId: 'user-123',
  amount: 99.99,
  currency: 'USD',
  items: [
    { id: 'item-1', name: 'Product A', price: 59.99 },
    { id: 'item-2', name: 'Product B', price: 39.99 }
  ],
  paymentMethod: 'credit_card',
  shippingAddress: {
    country: 'US',
    state: 'CA',
    city: 'San Francisco'
  }
});

// ============================================================================
// Error Logging with Full Context
// ============================================================================

async function processPayment(paymentData: any) {
  const paymentLogger = logger.child({
    operation: 'payment_processing',
    paymentId: paymentData.id
  });

  try {
    paymentLogger.info('Processing payment', { amount: paymentData.amount });
    
    // Simulate payment processing
    await simulatePaymentProcessing(paymentData);
    
    paymentLogger.info('Payment processed successfully');
    
  } catch (error) {
    paymentLogger.error('Payment processing failed', error as Error, {
      amount: paymentData.amount,
      paymentMethod: paymentData.method,
      retryCount: paymentData.retryCount || 0,
      errorCode: (error as any).code,
      context: {
        gateway: 'stripe',
        environment: process.env.NODE_ENV
      }
    });
    
    throw error;
  }
}

async function simulatePaymentProcessing(paymentData: any): Promise<void> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simulate random failure
  if (Math.random() > 0.8) {
    const error = new Error('Payment gateway timeout');
    (error as any).code = 'GATEWAY_TIMEOUT';
    throw error;
  }
}

// ============================================================================
// Performance Monitoring
// ============================================================================

async function performDatabaseOperation() {
  const dbLogger = logger.child({ component: 'database' });
  
  // Method 1: Using timer API
  const timer = dbLogger.time('user_query');
  
  try {
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 200));
    const users = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
    
    timer.done('Database query completed', LogLevel.INFO, {
      resultCount: users.length,
      query: 'SELECT * FROM users WHERE active = true'
    });
    
    return users;
    
  } catch (error) {
    timer.done('Database query failed', LogLevel.ERROR);
    throw error;
  }
}

// Method 2: Using profiling API
async function complexOperation() {
  logger.profile('complex-operation');
  
  // Simulate complex processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  logger.profile('complex-operation'); // Ends profiling
}

// ============================================================================
// Child Loggers with Context Inheritance
// ============================================================================

// Create service-level logger
const serviceLogger = getLogger('user-service');

// Create operation-specific child logger
function processUserRegistration(userData: any) {
  const registrationLogger = serviceLogger.child({
    operation: 'user_registration',
    userId: userData.id,
    email: userData.email
  });

  registrationLogger.info('Starting user registration');
  
  // Create request-specific child logger
  const validationLogger = registrationLogger.child({
    step: 'validation'
  });
  
  validationLogger.debug('Validating user data', {
    fields: Object.keys(userData)
  });
  
  // All logs from child loggers automatically include parent context
  validationLogger.info('User data validation completed');
  registrationLogger.info('User registration completed successfully');
}

// ============================================================================
// Environment-Specific Setup
// ============================================================================

async function initializeLogging() {
  const environment = process.env.NODE_ENV || 'development';
  
  switch (environment) {
    case 'development':
      // Development setup with verbose logging
      const devLogger = setupDevelopmentLogging(LogLevel.DEBUG);
      devLogger.info('Development logging initialized');
      break;
      
    case 'production':
      // Production setup with file and HTTP logging
      const prodLogger = setupProductionLogging({
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
      prodLogger.info('Production logging initialized');
      break;
      
    case 'test':
      // Test setup with minimal logging
      configureLogging({
        environment: 'test',
        defaultLevel: LogLevel.WARN
      });
      break;
  }
}

// ============================================================================
// Custom Configuration Example
// ============================================================================

function setupCustomLogging() {
  configureLogging({
    environment: 'production',
    defaultLevel: LogLevel.INFO,
    globalContext: {
      service: 'user-api',
      version: '2.1.0',
      datacenter: 'us-west-1'
    },
    performance: {
      enableMetrics: true,
      metricsInterval: 300000, // 5 minutes
      slowThreshold: 2000 // 2 seconds
    },
    correlation: {
      enabled: true,
      headerName: 'x-trace-id',
      generateIds: true
    },
    sampling: {
      enabled: true,
      rules: [
        {
          logger: 'debug-service',
          level: LogLevel.DEBUG,
          rate: 0.1 // Sample 10% of debug logs
        },
        {
          logger: 'high-volume-api',
          level: LogLevel.INFO,
          rate: 0.5 // Sample 50% of info logs
        }
      ]
    }
  });
}

// ============================================================================
// Example Usage
// ============================================================================

async function runExamples() {
  console.log('🚀 Running logging examples...\n');
  
  // Initialize logging
  await initializeLogging();
  
  // Basic logging examples
  console.log('📝 Basic logging examples:');
  logger.info('Application started', { 
    version: '1.0.0',
    environment: process.env.NODE_ENV 
  });
  
  // Performance monitoring examples
  console.log('⏱️  Performance monitoring examples:');
  await performDatabaseOperation();
  await complexOperation();
  
  // Error handling examples
  console.log('❌ Error handling examples:');
  try {
    await processPayment({
      id: 'pay-123',
      amount: 99.99,
      method: 'credit_card'
    });
  } catch (error) {
    // Error already logged in processPayment
  }
  
  // Child logger examples
  console.log('👶 Child logger examples:');
  processUserRegistration({
    id: 'user-789',
    email: 'newuser@example.com',
    name: 'New User'
  });
  
  console.log('\n✅ Examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  runExamples,
  processPayment,
  performDatabaseOperation,
  complexOperation,
  processUserRegistration,
  initializeLogging,
  setupCustomLogging
};