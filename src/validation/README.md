# Sentient Agent Framework - Zod Validation System

A comprehensive Zod-based validation system equivalent to Python's Pydantic functionality, providing runtime type checking, detailed error reporting, and Express middleware integration for the Sentient Agent Framework.

## Features

- ✅ **Runtime Type Checking**: Zod-based validation equivalent to Pydantic models
- ✅ **ULID Validation**: Comprehensive ULID validation patterns with timestamp verification
- ✅ **Express Middleware**: Automatic request validation for Express servers
- ✅ **Detailed Error Reporting**: Field-level validation feedback with enhanced error messages
- ✅ **Performance Monitoring**: Built-in metrics collection and performance tracking
- ✅ **Capability Validation**: Helper functions for validating capability payloads
- ✅ **Type Safety**: Full TypeScript support with inferred types
- ✅ **Modular Design**: Clean architecture with separation of concerns

## Quick Start

```typescript
import { validationSystem, validateAssistRequest } from './validation';

// 1. Validate a ULID
const ulidResult = validationSystem.validateULID('01ARZ3NDEKTSV4RRFFQ69G5FAV');
if (validationSystem.isValid(ulidResult)) {
  console.log('Valid ULID:', ulidResult.data);
}

// 2. Use Express middleware
import express from 'express';
const app = express();

app.use('/assist', validateAssistRequest);

// 3. Validate custom capability payloads
import { createCapabilityValidator } from './validation';
import { z } from 'zod';

const myCapabilityValidator = createCapabilityValidator(
  'my-capability',
  z.object({
    prompt: z.string(),
    options: z.object({
      temperature: z.number().min(0).max(2)
    })
  })
);

const result = myCapabilityValidator.validate(requestData);
```

## Core Components

### 1. ValidationPipeline

The main validation engine providing runtime type checking:

```typescript
import { ValidationPipeline, validator } from './validation';

// Singleton instance
const pipeline = ValidationPipeline.getInstance();

// Validate different types
const queryResult = pipeline.validateQuery(data);
const sessionResult = pipeline.validateSession(sessionData);
const eventResult = pipeline.validateResponseEvent(eventData);
```

### 2. Zod Schemas

Pre-built schemas for all Sentient Agent Framework interfaces:

```typescript
import {
  ULIDSchema,
  QuerySchema,
  RequestSchema,
  SessionObjectSchema,
  ResponseEventSchema
} from './validation';

// Direct schema validation
const result = ULIDSchema.safeParse('01ARZ3NDEKTSV4RRFFQ69G5FAV');
```

### 3. Express Middleware

Automatic request validation for Express applications:

```typescript
import {
  validateAssistRequest,
  validateULIDParam,
  createValidationMiddleware,
  createCapabilityValidationMiddleware
} from './validation';

// Pre-built middleware
app.use('/assist', validateAssistRequest);
app.use('/api/:id', validateULIDParam('id'));

// Custom middleware
const customValidation = createValidationMiddleware({
  body: QuerySchema,
  params: z.object({ id: ULIDSchema })
});

app.use('/custom/:id', customValidation);
```

### 4. Helper Functions

Utility functions for common validation patterns:

```typescript
import {
  isValidationSuccess,
  extractValidatedData,
  generateValidatedULID,
  validateUserInput,
  validateEmail,
  validateCapabilityRequest
} from './validation';

// Type-safe result checking
if (isValidationSuccess(result)) {
  const data = result.data; // Type-safe access
}

// Extract data or throw
const validatedData = extractValidatedData(result);

// Generate valid ULIDs
const newId = generateValidatedULID();
```

## Validation Patterns

### ULID Validation

```typescript
import { validateAndNormalizeULID, isValidULID, filterValidULIDs } from './validation';

// Validate single ULID
const result = validateAndNormalizeULID(input);

// Check without throwing
const isValid = isValidULID(input);

// Filter array of ULIDs
const validULIDs = filterValidULIDs(['01ARZ3...', 'invalid', '01BX5Z...']);
```

### Request Validation

```typescript
import { validateCompleteRequest, validateQueryParams } from './validation';

// Validate complete request with session
const requestResult = validateCompleteRequest({
  query: { id: '01ARZ3...', prompt: 'Hello' },
  session: { processor_id: 'proc1', activity_id: '01BX5Z...', ... }
});

// Validate query parameters
const paramsResult = validateQueryParams(req.query);
```

### Capability Validation

```typescript
import { 
  validateCapabilityRequest,
  validateAssistCapabilityRequest,
  createCapabilityValidator 
} from './validation';

// Validate assist capability
const assistResult = validateAssistCapabilityRequest({
  capability: 'assist',
  request_payload: {
    parts: [{ prompt: 'Hello', fileIds: [] }]
  }
});

// Custom capability validator
const weatherValidator = createCapabilityValidator(
  'weather',
  z.object({
    location: z.string(),
    units: z.enum(['celsius', 'fahrenheit'])
  })
);

const weatherResult = weatherValidator.validate(data);
```

### Event Validation

```typescript
import { validateResponseEvent, validateEventContent } from './validation';

// Validate response events
const eventResult = validateResponseEvent({
  content_type: 'atomic.json',
  event_name: 'response',
  id: '01ARZ3...',
  source: 'agent',
  content: { message: 'Hello' }
});

// Validate event content by type
const contentResult = validateEventContent(
  EventContentType.JSON,
  { message: 'Hello' }
);
```

## Error Handling

The validation system provides detailed error information:

```typescript
import { 
  isValidationError,
  getFirstErrorMessage,
  getAllErrorMessages,
  formatErrorsForLogging 
} from './validation';

const result = validator.validateQuery(invalidData);

if (isValidationError(result)) {
  console.log('First error:', getFirstErrorMessage(result));
  console.log('All errors:', getAllErrorMessages(result));
  console.log('Formatted for logs:', formatErrorsForLogging(result));
  
  // Access detailed field errors
  console.log('Field errors:', result.field_errors);
  // Example: { "prompt": ["String must be at least 1 characters long"] }
}
```

## Middleware Configuration

### Basic Middleware

```typescript
import { createValidationMiddleware } from './validation';

const middleware = createValidationMiddleware({
  body: QuerySchema,
  query: z.object({
    page: z.string().transform(Number).pipe(z.number().int().positive())
  }),
  params: z.object({
    id: ULIDSchema
  })
}, {
  errorResponseFormat: 'detailed',
  logErrors: true,
  enableMetrics: true
});
```

### Capability-Specific Middleware

```typescript
import { createCapabilityValidationMiddleware } from './validation';

const weatherMiddleware = createCapabilityValidationMiddleware(
  'weather',
  z.object({
    location: z.string().min(1),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius')
  }),
  {
    errorResponseFormat: 'simple',
    customErrorHandler: (errors, req, res) => {
      res.status(400).json({
        error: 'Weather capability validation failed',
        details: errors
      });
    }
  }
);
```

## Performance Monitoring

```typescript
import { 
  validateWithTiming,
  getValidationMetricsSummary,
  resetValidationMetrics 
} from './validation';

// Measure validation performance
const { result, duration } = validateWithTiming(QuerySchema, data, 'QueryValidation');
console.log(`Validation took ${duration}ms`);

// Get performance summary
const metrics = getValidationMetricsSummary();
console.log('Validation metrics:', metrics);
// Example: { "Query": { avgTime: 1.2, totalCalls: 150 } }

// Reset metrics
resetValidationMetrics();
```

## Advanced Features

### Batch Validation

```typescript
import { validateBatch, validateBatchStrict } from './validation';

// Validate multiple items, collect successes and failures
const { successes, failures } = validateBatch(items, QuerySchema);

// Validate strictly, throw on first failure
try {
  const validatedItems = validateBatchStrict(items, QuerySchema);
} catch (error) {
  console.error('Batch validation failed:', error.message);
}
```

### Nested Validation

```typescript
import { createNestedValidator } from './validation';

const nestedValidator = createNestedValidator(
  z.object({
    user: z.object({ id: z.string() }),
    requests: z.array(z.object({ id: z.string() }))
  }),
  {
    'user.id': (value) => validator.validateULID(value),
    'requests': (requests) => validateBatch(requests, QuerySchema)
  }
);

const result = nestedValidator(complexData);
```

### Validation with Defaults

```typescript
import { validateWithDefaults } from './validation';

const result = validateWithDefaults(
  partialData,
  QuerySchema,
  { prompt: 'Default prompt', id: generateValidatedULID() }
);
```

### Transform and Validate

```typescript
import { validateAndTransform } from './validation';

const result = validateAndTransform(
  rawData,
  z.string(),
  (data) => data.toUpperCase()
);
```

## Integration Examples

### Express Server Setup

```typescript
import express from 'express';
import {
  validateAssistRequest,
  validateULIDParam,
  validationMetricsMiddleware,
  validationErrorRecoveryMiddleware
} from './validation';

const app = express();

// Global middleware
app.use(express.json());
app.use(validationMetricsMiddleware);

// Route-specific validation
app.post('/assist', validateAssistRequest, (req, res) => {
  // req.body is now validated and type-safe
  console.log('Valid request:', req.body);
  res.json({ success: true });
});

app.get('/sessions/:id', validateULIDParam('id'), (req, res) => {
  // req.params.id is validated as ULID
  console.log('Session ID:', req.params.id);
  res.json({ sessionId: req.params.id });
});

// Error recovery
app.use(validationErrorRecoveryMiddleware);
```

### Custom Agent Integration

```typescript
import { AbstractAgent } from '../interface/agent';
import { validator, isValidationSuccess } from './validation';

class ValidatedAgent extends AbstractAgent {
  async assist(session, query, responseHandler) {
    // Validate inputs
    const sessionResult = validator.validateSession(session);
    const queryResult = validator.validateQuery(query);
    
    if (!isValidationSuccess(sessionResult)) {
      throw new Error(`Invalid session: ${sessionResult.message}`);
    }
    
    if (!isValidationSuccess(queryResult)) {
      throw new Error(`Invalid query: ${queryResult.message}`);
    }
    
    // Proceed with validated data
    const validatedSession = sessionResult.data;
    const validatedQuery = queryResult.data;
    
    // ... agent logic
  }
}
```

## Error Response Formats

### Detailed Format (default)

```json
{
  "error": "Validation failed",
  "message": "Request validation errors found",
  "errors": {
    "query.prompt": ["String must be at least 1 characters long"],
    "session.activity_id": ["Invalid ULID format"]
  },
  "errorCount": 2,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Simple Format

```json
{
  "error": "Validation failed",
  "message": "String must be at least 1 characters long, Invalid ULID format"
}
```

### Custom Format

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": {
    "query.prompt": ["String must be at least 1 characters long"]
  },
  "code": 400
}
```

## Best Practices

### 1. Use Type-Safe Validation

```typescript
// Good: Type-safe access
const result = validator.validateQuery(data);
if (isValidationSuccess(result)) {
  const query = result.data; // Type is inferred
}

// Avoid: Direct access without checking
const query = result.data; // Could be undefined
```

### 2. Handle Errors Gracefully

```typescript
// Good: Comprehensive error handling
const result = validator.validateQuery(data);
if (isValidationError(result)) {
  logger.error('Query validation failed', {
    errors: result.field_errors,
    input: data
  });
  return res.status(400).json({
    error: 'Invalid query format',
    details: result.field_errors
  });
}
```

### 3. Use Appropriate Middleware

```typescript
// Good: Specific validation per route
app.post('/assist', validateAssistRequest, handleAssist);
app.get('/session/:id', validateULIDParam('id'), getSession);

// Avoid: Generic validation for everything
app.use('*', validateEverything); // Too broad
```

### 4. Monitor Performance

```typescript
// Good: Regular monitoring
setInterval(() => {
  const metrics = getValidationMetricsSummary();
  if (metrics.Query?.avgTime > 5) {
    logger.warn('Query validation is slow', metrics);
  }
}, 60000);
```

## Troubleshooting

### Common Issues

1. **ULID Validation Fails**: Ensure ULID format is correct (26 characters, valid charset)
2. **Schema Not Found**: Import schemas from the correct path
3. **Type Errors**: Use `export type` for type-only imports
4. **Performance Issues**: Monitor metrics and consider schema optimization

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
import { validator } from './validation';

// The validation pipeline includes built-in performance monitoring
// Check metrics to identify slow validations
const metrics = validator.getPerformanceMetrics();
console.log('Validation performance:', metrics);
```

## API Reference

See the exported functions and types in `src/validation/index.ts` for the complete API reference.

## License

This validation system is part of the Sentient Agent Framework and follows the same licensing terms.