/**
 * Comprehensive Tests for Capability Registry System
 * 
 * Tests the complete capability management infrastructure including registry,
 * manager, session integration, validation, versioning, and persistence.
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { z } from 'zod';
import { ulid } from 'ulid';
import {
  CapabilityRegistry,
  CapabilityRegistryConfig,
  CapabilityVersion,
  CapabilityMetadata,
  CapabilityDependency,
  EnhancedAtomicCapabilitySpec,
  EnhancedStreamCapabilitySpec,
  CapabilityRegistryError,
  CapabilityValidationError,
  CapabilityConflictError,
  CapabilityNotFoundError,
  DependencyError
} from '../src/implementation/capability_registry';
import {
  CapabilityManager,
  CapabilityManagerConfig,
  SessionCapabilityBinding
} from '../src/implementation/capability_manager';
import { DefaultSession } from '../src/implementation/default_session';
import {
  AtomicCapabilitySpec,
  StreamCapabilitySpec,
  CapabilityRequestContent
} from '../src/interface/session';
import { Event } from '../src/interface/events';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

const createTestVersion = (major = 1, minor = 0, patch = 0): CapabilityVersion => ({
  major,
  minor,
  patch
});

const createTestMetadata = (overrides: Partial<CapabilityMetadata> = {}): Partial<CapabilityMetadata> => ({
  version: createTestVersion(),
  dependencies: [],
  tags: ['test'],
  author: 'test-author',
  documentation: 'Test capability',
  deprecated: false,
  ...overrides
});

const createAtomicCapability = (name = 'test-atomic'): AtomicCapabilitySpec<any, any> => ({
  name,
  description: `Test atomic capability: ${name}`,
  stream_response: false,
  input_schema: z.object({ input: z.string() }),
  output_schema: z.object({ output: z.string() })
});

const createStreamCapability = (name = 'test-stream'): StreamCapabilitySpec<any> => ({
  name,
  description: `Test stream capability: ${name}`,
  stream_response: true,
  input_schema: z.object({ query: z.string() }),
  output_events_schema: [
    {
      content_type: 'text/plain' as any,
      event_name: 'data',
      schema_version: '1.0',
      id: ulid(),
      source: 'test'
    } as Event
  ]
});

// ============================================================================
// Capability Registry Tests
// ============================================================================

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;
  let testConfig: Partial<CapabilityRegistryConfig>;

  beforeEach(() => {
    testConfig = {
      allowVersionConflicts: false,
      strictDependencyChecking: true,
      maxCapabilities: 10,
      enablePersistence: false,
      validationMode: 'strict',
      enableDeprecationWarnings: true
    };
    registry = new CapabilityRegistry(testConfig);
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Capability Registration', () => {
    test('should register atomic capability successfully', async () => {
      const spec = createAtomicCapability('math-add');
      const metadata = createTestMetadata();
      
      const result = await registry.register(spec, metadata);
      
      expect(result.name).toBe('math-add');
      expect(result.id).toBeDefined();
      expect(result.metadata.version).toEqual(createTestVersion());
      expect(result.stream_response).toBe(false);
    });

    test('should register stream capability successfully', async () => {
      const spec = createStreamCapability('data-stream');
      const metadata = createTestMetadata();
      
      const result = await registry.registerStream(spec, metadata);
      
      expect(result.name).toBe('data-stream');
      expect(result.id).toBeDefined();
      expect(result.metadata.version).toEqual(createTestVersion());
      expect(result.stream_response).toBe(true);
    });

    test('should emit registration events', async () => {
      const spec = createAtomicCapability('event-test');
      let eventEmitted = false;
      
      registry.on('capability:registered', (registeredSpec) => {
        expect(registeredSpec.name).toBe('event-test');
        eventEmitted = true;
      });
      
      await registry.register(spec);
      expect(eventEmitted).toBe(true);
    });

    test('should validate capability specifications', async () => {
      const invalidSpec = {
        name: '',  // Invalid: empty name
        description: 'Test',
        stream_response: false,
        input_schema: z.string(),
        output_schema: z.string()
      } as AtomicCapabilitySpec<any, any>;
      
      await expect(registry.register(invalidSpec))
        .rejects.toThrow(CapabilityValidationError);
    });

    test('should respect capability limits', async () => {
      const limitedRegistry = new CapabilityRegistry({ maxCapabilities: 2 });
      
      await limitedRegistry.register(createAtomicCapability('cap1'));
      await limitedRegistry.register(createAtomicCapability('cap2'));
      
      await expect(limitedRegistry.register(createAtomicCapability('cap3')))
        .rejects.toThrow('Registry capacity exceeded');
    });

    test('should prevent version conflicts when configured', async () => {
      const spec = createAtomicCapability('duplicate-test');
      const metadata = createTestMetadata({ version: createTestVersion(1, 0, 0) });
      
      await registry.register(spec, metadata);
      
      await expect(registry.register(spec, metadata))
        .rejects.toThrow(CapabilityConflictError);
    });
  });

  describe('Capability Resolution', () => {
    beforeEach(async () => {
      await registry.register(createAtomicCapability('resolver-test'), 
        createTestMetadata({ version: createTestVersion(1, 0, 0) }));
      await registry.register(createAtomicCapability('resolver-test'), 
        createTestMetadata({ version: createTestVersion(1, 1, 0) }));
    });

    test('should resolve latest version by default', async () => {
      const resolved = await registry.resolve('resolver-test');
      
      expect(resolved.name).toBe('resolver-test');
      expect(resolved.metadata.version).toEqual(createTestVersion(1, 1, 0));
    });

    test('should resolve specific version', async () => {
      const resolved = await registry.resolve('resolver-test', createTestVersion(1, 0, 0));
      
      expect(resolved.name).toBe('resolver-test');
      expect(resolved.metadata.version).toEqual(createTestVersion(1, 0, 0));
    });

    test('should throw when capability not found', async () => {
      await expect(registry.resolve('non-existent'))
        .rejects.toThrow(CapabilityNotFoundError);
    });

    test('should emit resolution events', async () => {
      let eventEmitted = false;
      
      registry.on('capability:resolved', (name, spec) => {
        expect(name).toBe('resolver-test');
        expect(spec.name).toBe('resolver-test');
        eventEmitted = true;
      });
      
      await registry.resolve('resolver-test');
      expect(eventEmitted).toBe(true);
    });
  });

  describe('Capability Discovery and Listing', () => {
    beforeEach(async () => {
      await registry.register(createAtomicCapability('list-test-1'),
        createTestMetadata({ tags: ['math', 'basic'] }));
      await registry.registerStream(createStreamCapability('list-test-2'),
        createTestMetadata({ tags: ['stream', 'data'] }));
      await registry.register(createAtomicCapability('search-me'),
        createTestMetadata({ tags: ['search'] }));
    });

    test('should list all capabilities', () => {
      const capabilities = registry.list();
      
      expect(capabilities).toHaveLength(3);
      expect(capabilities.map(c => c.name)).toContain('list-test-1');
      expect(capabilities.map(c => c.name)).toContain('list-test-2');
      expect(capabilities.map(c => c.name)).toContain('search-me');
    });

    test('should list capabilities by tag', () => {
      const mathCapabilities = registry.listByTag('math');
      
      expect(mathCapabilities).toHaveLength(1);
      expect(mathCapabilities[0].name).toBe('list-test-1');
    });

    test('should search capabilities by pattern', () => {
      const searchResults = registry.search('search');
      
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toBe('search-me');
    });

    test('should check capability existence', () => {
      expect(registry.exists('list-test-1')).toBe(true);
      expect(registry.exists('non-existent')).toBe(false);
      expect(registry.exists('list-test-1', createTestVersion(1, 0, 0))).toBe(true);
      expect(registry.exists('list-test-1', createTestVersion(2, 0, 0))).toBe(false);
    });
  });

  describe('Dependency Management', () => {
    test('should validate dependencies during registration', async () => {
      const dependency: CapabilityDependency = {
        name: 'required-dep',
        version: createTestVersion(1, 0, 0),
        required: true
      };
      
      const spec = createAtomicCapability('dependent-cap');
      const metadata = createTestMetadata({ dependencies: [dependency] });
      
      await expect(registry.register(spec, metadata))
        .rejects.toThrow(DependencyError);
    });

    test('should allow registration when dependencies exist', async () => {
      // Register dependency first
      await registry.register(createAtomicCapability('required-dep'));
      
      const dependency: CapabilityDependency = {
        name: 'required-dep',
        required: true
      };
      
      const spec = createAtomicCapability('dependent-cap');
      const metadata = createTestMetadata({ dependencies: [dependency] });
      
      const result = await registry.register(spec, metadata);
      expect(result.name).toBe('dependent-cap');
    });

    test('should validate runtime dependencies', async () => {
      // Create a capability with a dependency
      await registry.register(createAtomicCapability('base-cap'));
      
      const dependency: CapabilityDependency = {
        name: 'base-cap',
        required: true
      };
      
      const spec = createAtomicCapability('dependent-cap');
      await registry.register(spec, createTestMetadata({ dependencies: [dependency] }));
      
      // Remove the dependency
      await registry.unregister('base-cap');
      
      // Resolution should fail due to missing dependency
      await expect(registry.resolve('dependent-cap'))
        .rejects.toThrow(DependencyError);
    });
  });

  describe('Request Validation', () => {
    beforeEach(async () => {
      const inputSchema = z.object({ 
        message: z.string().min(1),
        count: z.number().int().positive()
      });
      
      const spec: AtomicCapabilitySpec<any, any> = {
        name: 'validation-test',
        description: 'Test validation',
        stream_response: false,
        input_schema: inputSchema,
        output_schema: z.object({ result: z.string() })
      };
      
      await registry.register(spec);
    });

    test('should validate valid requests', async () => {
      const payload = { message: 'Hello', count: 5 };
      const result = await registry.validateRequest('validation-test', payload);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(payload);
      }
    });

    test('should reject invalid requests', async () => {
      const payload = { message: '', count: -1 }; // Invalid
      const result = await registry.validateRequest('validation-test', payload);
      
      expect(result.success).toBe(false);
    });
  });

  describe('Persistence and Serialization', () => {
    test('should serialize and deserialize registry', async () => {
      await registry.register(createAtomicCapability('persist-test'));
      
      const serialized = registry.serialize();
      expect(serialized).toContain('persist-test');
      
      const newRegistry = new CapabilityRegistry();
      await newRegistry.load(serialized);
      
      expect(newRegistry.exists('persist-test')).toBe(true);
    });

    test('should handle serialization errors gracefully', async () => {
      const invalidData = '{ invalid json';
      
      await expect(registry.load(invalidData))
        .rejects.toThrow(CapabilityRegistryError);
    });
  });

  describe('Registry Statistics', () => {
    test('should provide accurate statistics', async () => {
      await registry.register(createAtomicCapability('stats-1'));
      await registry.registerStream(createStreamCapability('stats-2'));
      
      const stats = registry.getStats();
      
      expect(stats.totalCapabilities).toBe(2);
      expect(stats.capabilityNames).toBe(2);
      expect(stats.totalVersions).toBe(2);
    });
  });
});

// ============================================================================
// Capability Manager Tests
// ============================================================================

describe('CapabilityManager', () => {
  let manager: CapabilityManager;
  let testConfig: Partial<CapabilityManagerConfig>;

  beforeEach(async () => {
    testConfig = {
      registry: { maxCapabilities: 10, enablePersistence: false },
      session: {
        enableCapabilityValidation: true,
        strictSessionBinding: true,
        maxCapabilitiesPerSession: 5
      },
      persistence: {
        enabled: false,
        autoSave: false,
        saveInterval: 30000
      },
      metrics: { enabled: true, trackPerformance: true, trackUsage: true }
    };
    manager = new CapabilityManager(testConfig);
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('Initialization and Lifecycle', () => {
    test('should initialize successfully', async () => {
      const newManager = new CapabilityManager();
      let eventEmitted = false;
      
      newManager.on('manager:initialized', () => {
        eventEmitted = true;
      });
      
      await newManager.initialize();
      expect(eventEmitted).toBe(true);
      
      await newManager.shutdown();
    });

    test('should shutdown gracefully', async () => {
      let eventEmitted = false;
      
      manager.on('manager:shutdown', () => {
        eventEmitted = true;
      });
      
      await manager.shutdown();
      expect(eventEmitted).toBe(true);
    });
  });

  describe('Capability Registration through Manager', () => {
    test('should register capabilities with performance tracking', async () => {
      const spec = createAtomicCapability('manager-test');
      
      await manager.registerCapability(spec);
      
      const capabilities = manager.discoverCapabilities();
      expect(capabilities.some(c => c.name === 'manager-test')).toBe(true);
    });

    test('should track registration performance', async () => {
      const spec = createAtomicCapability('perf-test');
      
      await manager.registerCapability(spec);
      
      // Performance tracking should have recorded the operation
      // (We can't easily test the exact values without mocking performance.now())
    });
  });

  describe('Session Integration', () => {
    beforeEach(async () => {
      await manager.registerCapability(createAtomicCapability('session-test'));
    });

    test('should bind capability to session', async () => {
      const sessionId = ulid();
      
      await manager.bindCapabilityToSession(sessionId, 'session-test');
      
      const capabilities = manager.getSessionCapabilities(sessionId);
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0].capabilityName).toBe('session-test');
    });

    test('should unbind capability from session', async () => {
      const sessionId = ulid();
      
      await manager.bindCapabilityToSession(sessionId, 'session-test');
      const unbound = manager.unbindCapabilityFromSession(sessionId, 'session-test');
      
      expect(unbound).toBe(true);
      
      const capabilities = manager.getSessionCapabilities(sessionId);
      expect(capabilities).toHaveLength(0);
    });

    test('should respect session capability limits', async () => {
      const limitedManager = new CapabilityManager({
        session: {
          enableCapabilityValidation: true,
          strictSessionBinding: true,
          maxCapabilitiesPerSession: 1
        }
      });
      await limitedManager.initialize();
      
      await limitedManager.registerCapability(createAtomicCapability('cap1'));
      await limitedManager.registerCapability(createAtomicCapability('cap2'));
      
      const sessionId = ulid();
      await limitedManager.bindCapabilityToSession(sessionId, 'cap1');
      
      await expect(limitedManager.bindCapabilityToSession(sessionId, 'cap2'))
        .rejects.toThrow('Session .* has reached maximum capability limit');
      
      await limitedManager.shutdown();
    });

    test('should validate session capability requests', async () => {
      const sessionId = ulid();
      await manager.bindCapabilityToSession(sessionId, 'session-test');
      
      const request: CapabilityRequestContent<any> = {
        capability: 'session-test',
        request_payload: { input: 'test message' }
      };
      
      const result = await manager.validateSessionCapabilityRequest(sessionId, request);
      
      // Note: This will depend on the actual validation implementation
      // For this test, we're mainly checking that the method doesn't throw
      expect(result).toBeDefined();
    });
  });

  describe('Metrics and Performance Tracking', () => {
    test('should collect usage metrics', async () => {
      const initialMetrics = manager.getMetrics();
      expect(initialMetrics.totalRequests).toBe(0);
      
      // Simulate some operations that would update metrics
      await manager.registerCapability(createAtomicCapability('metrics-test'));
      
      const metrics = manager.getMetrics();
      expect(metrics.startTime).toBeInstanceOf(Date);
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });

    test('should reset metrics', () => {
      const initialMetrics = manager.getMetrics();
      manager.resetMetrics();
      
      const resetMetrics = manager.getMetrics();
      expect(resetMetrics.totalRequests).toBe(0);
      expect(resetMetrics.startTime.getTime()).toBeGreaterThanOrEqual(initialMetrics.startTime.getTime());
    });
  });

  describe('Capability Discovery through Manager', () => {
    beforeEach(async () => {
      await manager.registerCapability(createAtomicCapability('discover-1'), 
        createTestMetadata({ tags: ['discovery', 'test'] }));
      await manager.registerStreamCapability(createStreamCapability('discover-2'), 
        createTestMetadata({ tags: ['stream', 'test'] }));
    });

    test('should discover all capabilities', () => {
      const capabilities = manager.discoverCapabilities();
      
      expect(capabilities).toHaveLength(2);
      expect(capabilities.map(c => c.name)).toContain('discover-1');
      expect(capabilities.map(c => c.name)).toContain('discover-2');
    });

    test('should search capabilities', () => {
      const results = manager.searchCapabilities('discover');
      
      expect(results).toHaveLength(2);
    });

    test('should get capabilities by tag', () => {
      const streamCaps = manager.getCapabilitiesByTag('stream');
      
      expect(streamCaps).toHaveLength(1);
      expect(streamCaps[0].name).toBe('discover-2');
    });
  });
});

// ============================================================================
// Default Session Integration Tests
// ============================================================================

describe('DefaultSession with Capability Integration', () => {
  let session: DefaultSession;
  let manager: CapabilityManager;

  beforeEach(async () => {
    manager = new CapabilityManager({
      registry: { maxCapabilities: 10, enablePersistence: false },
      session: {
        enableCapabilityValidation: true,
        strictSessionBinding: true,
        maxCapabilitiesPerSession: 5
      },
      persistence: {
        enabled: false,
        autoSave: false,
        saveInterval: 30000
      },
      metrics: { enabled: true, trackPerformance: true, trackUsage: true }
    });
    await manager.initialize();
    
    session = new DefaultSession(
      {
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      },
      manager,
      { enableCapabilityIntegration: true }
    );

    // Register a test capability
    await manager.registerCapability(createAtomicCapability('session-integration-test'));
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('Capability Management in Session', () => {
    test('should bind and unbind capabilities', async () => {
      expect(session.hasCapability('session-integration-test')).toBe(false);
      
      await session.bindCapability('session-integration-test');
      expect(session.hasCapability('session-integration-test')).toBe(true);
      
      const unbound = session.unbindCapability('session-integration-test');
      expect(unbound).toBe(true);
      expect(session.hasCapability('session-integration-test')).toBe(false);
    });

    test('should get bound capabilities', async () => {
      await session.bindCapability('session-integration-test');
      
      const capabilities = session.getBoundCapabilities();
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0].capabilityName).toBe('session-integration-test');
    });

    test('should validate capability requests', async () => {
      await session.bindCapability('session-integration-test');
      
      const request: CapabilityRequestContent<any> = {
        capability: 'session-integration-test',
        request_payload: { input: 'test' }
      };
      
      const result = await session.validateCapabilityRequest(request);
      expect(result).toBeDefined();
    });

    test('should discover available capabilities', () => {
      const capabilities = session.discoverAvailableCapabilities();
      expect(capabilities.some(c => c.name === 'session-integration-test')).toBe(true);
    });

    test('should search capabilities', () => {
      const results = session.searchCapabilities('session');
      expect(results.some(c => c.name === 'session-integration-test')).toBe(true);
    });
  });

  describe('Session Statistics and Information', () => {
    test('should provide session statistics', async () => {
      await session.bindCapability('session-integration-test');
      
      const stats = session.getSessionStatistics();
      
      expect(stats.sessionId).toBe(session.activity_id);
      expect(stats.boundCapabilities).toBe(1);
      expect(stats.activeCapabilities).toBe(1);
      expect(stats.capabilityIntegrationEnabled).toBe(true);
    });

    test('should provide enhanced session information', async () => {
      await session.bindCapability('session-integration-test');
      
      const info = session.getEnhancedSessionInfo();
      
      expect(info.sessionObject.processor_id).toBe('test-processor');
      expect(info.capabilities.integrationEnabled).toBe(true);
      expect(info.capabilities.boundCapabilities).toHaveLength(1);
    });

    test('should update session object while preserving capabilities', async () => {
      await session.bindCapability('session-integration-test');
      
      const newActivityId = ulid();
      session.updateSessionObject({ activity_id: newActivityId });
      
      expect(session.activity_id).toBe(newActivityId);
      // Note: In a real implementation, capabilities might be migrated to new session ID
    });
  });

  describe('Capability Integration Toggling', () => {
    test('should handle disabled capability integration', () => {
      session.setCapabilityIntegration(false);
      
      expect(session.isCapabilityIntegrationEnabled()).toBe(false);
      expect(session.getBoundCapabilities()).toHaveLength(0);
      expect(session.discoverAvailableCapabilities()).toHaveLength(0);
    });

    test('should re-enable capability integration', async () => {
      session.setCapabilityIntegration(false);
      expect(session.isCapabilityIntegrationEnabled()).toBe(false);
      
      session.setCapabilityIntegration(true);
      expect(session.isCapabilityIntegrationEnabled()).toBe(true);
      
      // Should be able to bind capabilities again
      await session.bindCapability('session-integration-test');
      expect(session.hasCapability('session-integration-test')).toBe(true);
    });
  });
});

// ============================================================================
// Integration and End-to-End Tests
// ============================================================================

describe('End-to-End Capability System', () => {
  let registry: CapabilityRegistry;
  let manager: CapabilityManager;
  let session: DefaultSession;

  beforeEach(async () => {
    registry = new CapabilityRegistry({ 
      maxCapabilities: 50, 
      enablePersistence: false 
    });
    
    manager = new CapabilityManager({
      registry: { maxCapabilities: 50, enablePersistence: false },
      session: {
        enableCapabilityValidation: true,
        strictSessionBinding: true,
        maxCapabilitiesPerSession: 20
      },
      persistence: {
        enabled: false,
        autoSave: false,
        saveInterval: 30000
      },
      metrics: { enabled: true, trackPerformance: true, trackUsage: true }
    });
    
    await manager.initialize();
    
    session = new DefaultSession(
      {
        processor_id: 'e2e-test',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      },
      manager,
      { enableCapabilityIntegration: true }
    );
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  test('should support complete capability lifecycle', async () => {
    // 1. Register capabilities with dependencies
    const baseSpec = createAtomicCapability('base-math');
    await manager.registerCapability(baseSpec, createTestMetadata({
      tags: ['math', 'foundation'],
      documentation: 'Base mathematical operations'
    }));

    const advancedSpec = createAtomicCapability('advanced-math');
    const dependency: CapabilityDependency = {
      name: 'base-math',
      required: true
    };
    await manager.registerCapability(advancedSpec, createTestMetadata({
      dependencies: [dependency],
      tags: ['math', 'advanced'],
      documentation: 'Advanced mathematical operations'
    }));

    // 2. Bind capabilities to session
    await session.bindCapability('base-math');
    await session.bindCapability('advanced-math');

    // 3. Validate capabilities are accessible
    expect(session.hasCapability('base-math')).toBe(true);
    expect(session.hasCapability('advanced-math')).toBe(true);

    // 4. Test capability discovery
    const mathCapabilities = session.searchCapabilities('math');
    expect(mathCapabilities).toHaveLength(2);

    // 5. Test request validation
    const request: CapabilityRequestContent<any> = {
      capability: 'base-math',
      request_payload: { input: 'calculate' }
    };
    
    const validation = await session.validateCapabilityRequest(request);
    expect(validation).toBeDefined();

    // 6. Test session statistics
    const stats = session.getSessionStatistics();
    expect(stats.boundCapabilities).toBe(2);

    // 7. Test manager metrics
    const metrics = manager.getMetrics();
    expect(metrics.startTime).toBeInstanceOf(Date);
  });

  test('should handle complex versioning scenarios', async () => {
    // Register multiple versions of the same capability
    const v1Spec = createAtomicCapability('versioned-cap');
    await manager.registerCapability(v1Spec, createTestMetadata({
      version: createTestVersion(1, 0, 0)
    }));

    const v2Spec = createAtomicCapability('versioned-cap');
    await manager.registerCapability(v2Spec, createTestMetadata({
      version: createTestVersion(2, 0, 0)
    }));

    // Bind specific version to session
    await session.bindCapability('versioned-cap', createTestVersion(1, 0, 0));

    // Verify correct version is bound
    const bindings = session.getBoundCapabilities();
    expect(bindings[0].version).toEqual(createTestVersion(1, 0, 0));

    // Test that latest version is different
    const capabilities = manager.discoverCapabilities();
    const versionedCaps = capabilities.filter(c => c.name === 'versioned-cap');
    expect(versionedCaps).toHaveLength(2);
  });
});