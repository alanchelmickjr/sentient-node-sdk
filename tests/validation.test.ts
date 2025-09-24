/**
 * Comprehensive tests for the Sentient Agent Framework Validation System
 * 
 * Tests all major validation components including schemas, pipeline, middleware,
 * and helper functions to ensure Pydantic-equivalent functionality.
 */

import { ulid } from 'ulid';
import {
  validator,
  validationSystem,
  isValidationSuccess,
  isValidationError,
  generateValidatedULID,
  validateUserInput,
  validateCapabilityRequest,
  validateCompleteRequest,
  ULIDSchema,
  QuerySchema,
  AssistRequestSchema,
  EventContentType
} from '../src/validation';

describe('Sentient Agent Validation System', () => {
  
  beforeEach(() => {
    // Reset metrics before each test
    validator.resetMetrics();
  });

  // ============================================================================
  // ULID Validation Tests
  // ============================================================================

  describe('ULID Validation', () => {
    test('validates correct ULID', () => {
      const validULID = ulid();
      const result = validator.validateULID(validULID);
      
      expect(isValidationSuccess(result)).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.data).toBe(validULID);
      }
    });

    test('rejects invalid ULID format', () => {
      const invalidULID = 'not-a-valid-ulid';
      const result = validator.validateULID(invalidULID);
      
      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        expect(result.field_errors.root).toContain('ULID must be exactly 26 characters');
      }
    });

    test('rejects ULID with invalid characters', () => {
      const invalidULID = 'OOOOOOOOOOOOOOOOOOOOOOOOOO'; // Contains 'O' which is invalid
      const result = validator.validateULID(invalidULID);
      
      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        expect(result.field_errors.root[0]).toContain('ULID contains invalid characters');
      }
    });

    test('generates valid ULID', () => {
      const newULID = generateValidatedULID();
      const result = validator.validateULID(newULID);
      
      expect(isValidationSuccess(result)).toBe(true);
      expect(newULID).toHaveLength(26);
    });
  });

  // ============================================================================
  // Query Validation Tests
  // ============================================================================

  describe('Query Validation', () => {
    test('validates correct query', () => {
      const query = {
        id: ulid(),
        prompt: 'Hello, world!'
      };
      
      const result = validator.validateQuery(query);
      
      expect(isValidationSuccess(result)).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.data.id).toBe(query.id);
        expect(result.data.prompt).toBe(query.prompt);
      }
    });

    test('rejects query with invalid ULID', () => {
      const query = {
        id: 'invalid-ulid',
        prompt: 'Hello, world!'
      };
      
      const result = validator.validateQuery(query);
      
      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        expect(result.field_errors.id).toBeDefined();
      }
    });

    test('rejects query with empty prompt', () => {
      const query = {
        id: ulid(),
        prompt: ''
      };
      
      const result = validator.validateQuery(query);
      
      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        expect(result.field_errors.prompt).toContain('Query prompt cannot be empty');
      }
    });
  });

  // ============================================================================
  // Assist Request Validation Tests
  // ============================================================================

  describe('Assist Request Validation', () => {
    test('validates correct assist request', () => {
      const assistRequest = {
        id: ulid(),
        chatId: ulid(),
        content: {
          capability: 'assist',
          request_payload: {
            parts: [{
              prompt: 'Hello, world!',
              fileIds: []
            }]
          }
        },
        parent_request_id: null,
        root_request_id: null
      };
      
      const result = validator.validateAssistRequest(assistRequest);
      
      expect(isValidationSuccess(result)).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.data.content.capability).toBe('assist');
      }
    });

    test('rejects assist request with invalid capability', () => {
      const assistRequest = {
        id: ulid(),
        chatId: ulid(),
        content: {
          capability: 'invalid-capability',
          request_payload: {
            parts: [{
              prompt: 'Hello, world!',
              fileIds: []
            }]
          }
        }
      };
      
      const result = validator.validateAssistRequest(assistRequest);
      
      expect(isValidationError(result)).toBe(true);
    });

    test('validates request with parent and root IDs', () => {
      const assistRequest = {
        id: ulid(),
        chatId: ulid(),
        content: {
          capability: 'assist',
          request_payload: {
            parts: [{
              prompt: 'Hello, world!',
              fileIds: ['file1', 'file2']
            }]
          }
        },
        parent_request_id: ulid(),
        root_request_id: ulid()
      };
      
      const result = validator.validateAssistRequest(assistRequest);
      
      expect(isValidationSuccess(result)).toBe(true);
    });
  });

  // ============================================================================
  // Session Validation Tests
  // ============================================================================

  describe('Session Validation', () => {
    test('validates session object', () => {
      const session = {
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      };
      
      const result = validator.validateSessionObject(session);
      
      expect(isValidationSuccess(result)).toBe(true);
    });

    test('validates session with interactions', () => {
      const session = {
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: [{
          request: {
            event: {
              id: ulid(),
              chatId: ulid(),
              content: {
                capability: 'assist',
                request_payload: {
                  parts: [{
                    prompt: 'Test',
                    fileIds: []
                  }]
                }
              }
            }
          },
          responses: []
        }]
      };
      
      const result = validator.validateSessionObject(session);
      
      expect(isValidationSuccess(result)).toBe(true);
    });
  });

  // ============================================================================
  // Response Event Validation Tests
  // ============================================================================

  describe('Response Event Validation', () => {
    test('validates JSON document event', () => {
      const event = {
        content_type: EventContentType.JSON,
        event_name: 'test-event',
        id: ulid(),
        source: 'test-agent',
        content: { message: 'Hello' }
      };
      
      const result = validator.validateResponseEvent(event);
      
      expect(isValidationSuccess(result)).toBe(true);
    });

    test('validates text block event', () => {
      const event = {
        content_type: EventContentType.TEXTBLOCK,
        event_name: 'text-response',
        id: ulid(),
        source: 'test-agent',
        content: 'Hello, world!'
      };
      
      const result = validator.validateResponseEvent(event);
      
      expect(isValidationSuccess(result)).toBe(true);
    });

    test('validates error event', () => {
      const event = {
        content_type: EventContentType.ERROR,
        event_name: 'error',
        id: ulid(),
        source: 'test-agent',
        content: {
          error_message: 'Something went wrong',
          error_code: 500,
          details: { context: 'test' }
        }
      };
      
      const result = validator.validateResponseEvent(event);
      
      expect(isValidationSuccess(result)).toBe(true);
    });
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe('Helper Functions', () => {
    test('validates user input with requirements', () => {
      const result = validateUserInput('Valid input', 100, true);
      
      expect(isValidationSuccess(result)).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.data).toBe('Valid input');
      }
    });

    test('handles optional user input', () => {
      const result = validateUserInput('', 100, false);
      
      expect(isValidationSuccess(result)).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.data).toBe('');
      }
    });

    test('validates capability request', () => {
      const capabilityData = {
        capability: 'test-capability',
        request_payload: {
          id: ulid(),
          prompt: 'Test prompt for capability validation'
        }
      };
      
      const result = validateCapabilityRequest(
        'test-capability',
        QuerySchema, // Using QuerySchema with correct payload structure
        capabilityData
      );
      
      expect(isValidationSuccess(result)).toBe(true);
    });

    test('validates complete request with session', () => {
      const completeRequest = {
        query: {
          id: ulid(),
          prompt: 'Test query'
        },
        session: {
          processor_id: 'test-processor',
          activity_id: ulid(),
          request_id: ulid(),
          interactions: []
        }
      };
      
      const result = validateCompleteRequest(completeRequest);
      
      expect(isValidationSuccess(result)).toBe(true);
    });
  });

  // ============================================================================
  // Validation System Integration Tests
  // ============================================================================

  describe('Validation System Integration', () => {
    test('creates validation system instance', () => {
      expect(validationSystem).toBeDefined();
      expect(validationSystem.pipeline).toBeDefined();
      expect(validationSystem.validateULID).toBeDefined();
      expect(validationSystem.validateQuery).toBeDefined();
    });

    test('validation system methods work', () => {
      const validULID = ulid();
      const result = validationSystem.validateULID(validULID);
      
      expect(validationSystem.isValid(result)).toBe(true);
    });

    test('validation system tracks metrics', () => {
      const validULID = ulid();
      validationSystem.validateULID(validULID);
      
      const metrics = validationSystem.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });

    test('validation system can reset metrics', () => {
      const validULID = ulid();
      validationSystem.validateULID(validULID);
      
      validationSystem.resetMetrics();
      const metrics = validationSystem.getMetrics();
      
      // After reset, metrics should be empty or reset
      expect(Object.keys(metrics)).toHaveLength(0);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance Tests', () => {
    test('ULID validation is performant', () => {
      const validULIDs = Array.from({ length: 1000 }, () => ulid());
      
      const startTime = performance.now();
      
      validULIDs.forEach(id => {
        const result = validator.validateULID(id);
        expect(isValidationSuccess(result)).toBe(true);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should validate 1000 ULIDs in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    test('query validation is performant', () => {
      const queries = Array.from({ length: 100 }, () => ({
        id: ulid(),
        prompt: `Test query ${Math.random()}`
      }));
      
      const startTime = performance.now();
      
      queries.forEach(query => {
        const result = validator.validateQuery(query);
        expect(isValidationSuccess(result)).toBe(true);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should validate 100 queries in less than 50ms
      expect(duration).toBeLessThan(50);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    test('provides detailed error information', () => {
      const invalidQuery = {
        id: 'invalid-ulid',
        prompt: '' // Empty prompt
      };
      
      const result = validator.validateQuery(invalidQuery);
      
      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        expect(result.field_errors.id).toBeDefined();
        expect(result.field_errors.prompt).toBeDefined();
        expect(result.message).toContain('Validation failed');
        expect(Object.keys(result.field_errors).length).toBeGreaterThan(0);
      }
    });

    test('handles nested validation errors', () => {
      const invalidAssistRequest = {
        id: 'invalid',
        chatId: 'invalid',
        content: {
          capability: 'assist',
          request_payload: {
            parts: [] // Empty parts array should fail
          }
        }
      };
      
      const result = validator.validateAssistRequest(invalidAssistRequest);
      
      expect(isValidationError(result)).toBe(true);
      if (isValidationError(result)) {
        // Should have errors for multiple fields
        expect(Object.keys(result.field_errors).length).toBeGreaterThan(0);
      }
    });
  });
});

// ============================================================================
// Integration Test with Mock Express Request
// ============================================================================

describe('Express Integration Tests', () => {
  test('middleware validation concepts', () => {
    // Mock Express request/response objects
    const mockReq = {
      body: {
        query: {
          id: ulid(),
          prompt: 'Test prompt'
        }
      },
      params: {
        id: ulid()
      },
      query: {
        page: '1'
      }
    };

    // Test body validation
    const bodyResult = validator.validateQuery(mockReq.body.query);
    expect(isValidationSuccess(bodyResult)).toBe(true);

    // Test param validation
    const paramResult = validator.validateULID(mockReq.params.id);
    expect(isValidationSuccess(paramResult)).toBe(true);
  });
});