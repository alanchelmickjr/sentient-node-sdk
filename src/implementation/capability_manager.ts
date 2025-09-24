/**
 * Capability Manager for High-Level Capability Operations
 * 
 * Provides a high-level interface for managing capabilities, integrating with
 * session management, and orchestrating capability lifecycle operations.
 */

import { EventEmitter } from 'events';
import { ulid } from 'ulid';
import {
  CapabilityRegistry,
  CapabilityRegistryConfig,
  CapabilityMetadata,
  CapabilityVersion,
  CapabilityDependency,
  AnyEnhancedCapabilitySpec,
  CapabilityRegistryError,
  CapabilityNotFoundError,
  DependencyError
} from './capability_registry';
import {
  CapabilitySpec,
  AtomicCapabilitySpec,
  StreamCapabilitySpec,
  CapabilityRequestContent,
  Session
} from '../interface/session';
import { ValidationResult } from '../validation/schemas';
import { validator } from '../validation/pipeline';
import { isValidationSuccess } from '../validation/helpers';

// ============================================================================
// Manager Configuration and Types
// ============================================================================

export interface CapabilityManagerConfig {
  registry: Partial<CapabilityRegistryConfig>;
  session: {
    enableCapabilityValidation: boolean;
    strictSessionBinding: boolean;
    maxCapabilitiesPerSession: number;
  };
  persistence: {
    enabled: boolean;
    autoSave: boolean;
    saveInterval: number; // milliseconds
    filePath?: string;
  };
  metrics: {
    enabled: boolean;
    trackPerformance: boolean;
    trackUsage: boolean;
  };
}

export const DEFAULT_MANAGER_CONFIG: CapabilityManagerConfig = {
  registry: {
    allowVersionConflicts: false,
    strictDependencyChecking: true,
    maxCapabilities: 1000,
    enablePersistence: true,
    validationMode: 'strict',
    enableDeprecationWarnings: true
  },
  session: {
    enableCapabilityValidation: true,
    strictSessionBinding: true,
    maxCapabilitiesPerSession: 50
  },
  persistence: {
    enabled: true,
    autoSave: true,
    saveInterval: 30000, // 30 seconds
    filePath: './capabilities.json'
  },
  metrics: {
    enabled: true,
    trackPerformance: true,
    trackUsage: true
  }
};

// ============================================================================
// Manager Events
// ============================================================================

export interface CapabilityManagerEvents {
  // High-level lifecycle events
  'manager:initialized': () => void;
  'manager:shutdown': () => void;
  'manager:config_updated': (config: CapabilityManagerConfig) => void;
  
  // Session integration events  
  'session:capability_bound': (sessionId: string, capabilityName: string) => void;
  'session:capability_unbound': (sessionId: string, capabilityName: string) => void;
  'session:validation_performed': (sessionId: string, capabilityName: string, success: boolean) => void;
  
  // Persistence events
  'persistence:saved': (filePath: string, capabilityCount: number) => void;
  'persistence:loaded': (filePath: string, capabilityCount: number) => void;
  'persistence:failed': (error: Error) => void;
  
  // Metrics events
  'metrics:updated': (metrics: CapabilityUsageMetrics) => void;
  'performance:measured': (operation: string, duration: number) => void;
}

// ============================================================================
// Metrics and Performance Types
// ============================================================================

export interface CapabilityUsageMetrics {
  totalRequests: number;
  requestsByCapability: Record<string, number>;
  errorsByCapability: Record<string, number>;
  averageResponseTime: number;
  responseTimesByCapability: Record<string, number>;
  lastUsedByCapability: Record<string, Date>;
  totalErrors: number;
  uptime: number;
  startTime: Date;
}

export interface PerformanceSnapshot {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: Error;
}

// ============================================================================
// Session Capability Binding
// ============================================================================

export interface SessionCapabilityBinding {
  sessionId: string;
  capabilityName: string;
  version?: CapabilityVersion;
  bindingTime: Date;
  lastUsed: Date;
  usageCount: number;
  enabled: boolean;
}

// ============================================================================
// Capability Manager Implementation
// ============================================================================

export class CapabilityManager extends EventEmitter {
  private registry: CapabilityRegistry;
  private config: CapabilityManagerConfig;
  private sessionBindings = new Map<string, Set<SessionCapabilityBinding>>();
  private globalBindings = new Map<string, SessionCapabilityBinding>();
  private metrics: CapabilityUsageMetrics;
  private performanceSnapshots = new Map<string, PerformanceSnapshot>();
  private saveTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: Partial<CapabilityManagerConfig> = {}) {
    super();
    this.config = this.mergeConfig(config);
    this.registry = new CapabilityRegistry(this.config.registry);
    this.metrics = this.initializeMetrics();
    
    // Setup registry event forwarding
    this.setupRegistryEventForwarding();
  }

  // ========================================================================
  // Initialization and Lifecycle
  // ========================================================================

  /**
   * Initialize the capability manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load persisted capabilities if enabled
      if (this.config.persistence.enabled && this.config.persistence.filePath) {
        await this.loadFromFile(this.config.persistence.filePath);
      }

      // Setup auto-save if enabled
      if (this.config.persistence.autoSave && this.config.persistence.enabled) {
        this.setupAutoSave();
      }

      this.isInitialized = true;
      this.emit('manager:initialized');
    } catch (error) {
      console.error('CapabilityManager initialization error:', error);
      throw new CapabilityRegistryError(
        `Failed to initialize capability manager: ${error instanceof Error ? error.message : String(error)}`,
        'INITIALIZATION_ERROR'
      );
    }
  }

  /**
   * Shutdown the capability manager
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Clear auto-save timer
      if (this.saveTimer) {
        clearInterval(this.saveTimer);
        this.saveTimer = undefined;
      }

      // Save current state if persistence is enabled
      if (this.config.persistence.enabled && this.config.persistence.filePath) {
        await this.saveToFile(this.config.persistence.filePath);
      }

      // Clear all data
      this.sessionBindings.clear();
      this.globalBindings.clear();
      this.performanceSnapshots.clear();
      this.registry.clear();

      this.isInitialized = false;
      this.emit('manager:shutdown');
    } catch (error) {
      throw new CapabilityRegistryError(
        `Failed to shutdown capability manager: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SHUTDOWN_ERROR'
      );
    }
  }

  /**
   * Update manager configuration
   */
  updateConfig(newConfig: Partial<CapabilityManagerConfig>): void {
    this.config = this.mergeConfig(newConfig);
    this.emit('manager:config_updated', this.config);
  }

  // ========================================================================
  // Capability Registration (Delegated to Registry)
  // ========================================================================

  /**
   * Register an atomic capability
   */
  async registerCapability<I, O>(
    spec: AtomicCapabilitySpec<I, O>,
    metadata?: Partial<CapabilityMetadata>
  ): Promise<void> {
    const startTime = this.startPerformanceTracking('register_capability');
    
    try {
      await this.registry.register(spec, metadata);
      this.endPerformanceTracking('register_capability', startTime, true);
    } catch (error) {
      this.endPerformanceTracking('register_capability', startTime, false, error as Error);
      throw error;
    }
  }

  /**
   * Register a streaming capability
   */
  async registerStreamCapability<I>(
    spec: StreamCapabilitySpec<I>,
    metadata?: Partial<CapabilityMetadata>
  ): Promise<void> {
    const startTime = this.startPerformanceTracking('register_stream_capability');
    
    try {
      await this.registry.registerStream(spec, metadata);
      this.endPerformanceTracking('register_stream_capability', startTime, true);
    } catch (error) {
      this.endPerformanceTracking('register_stream_capability', startTime, false, error as Error);
      throw error;
    }
  }

  // ========================================================================
  // Session Integration
  // ========================================================================

  /**
   * Bind a capability to a session
   */
  async bindCapabilityToSession(
    sessionId: string,
    capabilityName: string,
    version?: CapabilityVersion
  ): Promise<void> {
    // Validate session binding limits
    const sessionBindingSet = this.sessionBindings.get(sessionId) || new Set();
    if (sessionBindingSet.size >= this.config.session.maxCapabilitiesPerSession) {
      throw new CapabilityRegistryError(
        `Session ${sessionId} has reached maximum capability limit of ${this.config.session.maxCapabilitiesPerSession}`,
        'SESSION_LIMIT_EXCEEDED'
      );
    }

    // Verify capability exists
    try {
      await this.registry.resolve(capabilityName, version);
    } catch (error) {
      throw new CapabilityNotFoundError(
        `Cannot bind non-existent capability '${capabilityName}' to session '${sessionId}'`
      );
    }

    // Create binding
    const binding: SessionCapabilityBinding = {
      sessionId,
      capabilityName,
      version,
      bindingTime: new Date(),
      lastUsed: new Date(),
      usageCount: 0,
      enabled: true
    };

    // Add to session bindings
    if (!this.sessionBindings.has(sessionId)) {
      this.sessionBindings.set(sessionId, new Set());
    }
    this.sessionBindings.get(sessionId)!.add(binding);

    // Add to global bindings for quick lookup
    const bindingKey = `${sessionId}:${capabilityName}`;
    this.globalBindings.set(bindingKey, binding);

    this.emit('session:capability_bound', sessionId, capabilityName);
  }

  /**
   * Unbind a capability from a session
   */
  unbindCapabilityFromSession(sessionId: string, capabilityName: string): boolean {
    const bindingKey = `${sessionId}:${capabilityName}`;
    const binding = this.globalBindings.get(bindingKey);
    
    if (!binding) {
      return false;
    }

    // Remove from session bindings
    const sessionBindingSet = this.sessionBindings.get(sessionId);
    if (sessionBindingSet) {
      sessionBindingSet.delete(binding);
      if (sessionBindingSet.size === 0) {
        this.sessionBindings.delete(sessionId);
      }
    }

    // Remove from global bindings
    this.globalBindings.delete(bindingKey);

    this.emit('session:capability_unbound', sessionId, capabilityName);
    return true;
  }

  /**
   * Get capabilities bound to a session
   */
  getSessionCapabilities(sessionId: string): SessionCapabilityBinding[] {
    const bindings = this.sessionBindings.get(sessionId);
    return bindings ? Array.from(bindings) : [];
  }

  /**
   * Validate capability request for a session
   */
  async validateSessionCapabilityRequest<I>(
    sessionId: string,
    request: CapabilityRequestContent<I>
  ): Promise<ValidationResult<I>> {
    const startTime = this.startPerformanceTracking('validate_session_request');
    
    try {
      // Check if capability is bound to session
      if (this.config.session.strictSessionBinding) {
        const bindingKey = `${sessionId}:${request.capability}`;
        const binding = this.globalBindings.get(bindingKey);
        
        if (!binding || !binding.enabled) {
          const result: ValidationResult<I> = {
            success: false,
            error: new Error('Capability not bound to session') as any,
            message: `Capability '${request.capability}' is not bound to session '${sessionId}'`,
            field_errors: { capability: ['Not bound to session'] }
          };
          
          this.endPerformanceTracking('validate_session_request', startTime, false);
          this.emit('session:validation_performed', sessionId, request.capability, false);
          return result;
        }

        // Update usage tracking
        binding.lastUsed = new Date();
        binding.usageCount++;
      }

      // Validate against capability schema
      const result = await this.registry.validateRequest(
        request.capability,
        request.request_payload,
        undefined // version can be added later
      );

      this.endPerformanceTracking('validate_session_request', startTime, result.success);
      this.emit('session:validation_performed', sessionId, request.capability, result.success);
      
      // Update metrics
      this.updateUsageMetrics(request.capability, result.success);
      
      return result;
    } catch (error) {
      this.endPerformanceTracking('validate_session_request', startTime, false, error as Error);
      this.emit('session:validation_performed', sessionId, request.capability, false);
      throw error;
    }
  }

  // ========================================================================
  // Capability Discovery and Management
  // ========================================================================

  /**
   * Discover available capabilities
   */
  discoverCapabilities(): AnyEnhancedCapabilitySpec[] {
    return this.registry.list();
  }

  /**
   * Search capabilities by criteria
   */
  searchCapabilities(pattern: string): AnyEnhancedCapabilitySpec[] {
    return this.registry.search(pattern);
  }

  /**
   * Get capabilities by tag
   */
  getCapabilitiesByTag(tag: string): AnyEnhancedCapabilitySpec[] {
    return this.registry.listByTag(tag);
  }

  /**
   * Get capability metadata
   */
  getCapabilityMetadata(name: string, version?: CapabilityVersion): CapabilityMetadata | null {
    return this.registry.getCapabilityMetadata(name, version);
  }

  // ========================================================================
  // Metrics and Performance
  // ========================================================================

  /**
   * Get current usage metrics
   */
  getMetrics(): CapabilityUsageMetrics {
    // Update uptime
    this.metrics.uptime = Date.now() - this.metrics.startTime.getTime();
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.emit('metrics:updated', this.metrics);
  }

  /**
   * Get performance snapshot for an operation
   */
  getPerformanceSnapshot(operationId: string): PerformanceSnapshot | undefined {
    return this.performanceSnapshots.get(operationId);
  }

  // ========================================================================
  // Persistence Operations
  // ========================================================================

  /**
   * Save capabilities to file
   */
  async saveToFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const registryData = this.registry.serialize();
      const managerData = {
        registry: JSON.parse(registryData),
        sessionBindings: this.serializeSessionBindings(),
        metrics: this.metrics,
        timestamp: new Date().toISOString()
      };
      
      await fs.writeFile(filePath, JSON.stringify(managerData, null, 2));
      
      const capabilityCount = this.registry.list().length;
      this.emit('persistence:saved', filePath, capabilityCount);
    } catch (error) {
      this.emit('persistence:failed', error as Error);
      throw new CapabilityRegistryError(
        `Failed to save to file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PERSISTENCE_SAVE_ERROR'
      );
    }
  }

  /**
   * Load capabilities from file
   */
  async loadFromFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const managerData = JSON.parse(fileContent);
      
      // Load registry data
      if (managerData.registry) {
        await this.registry.load(JSON.stringify(managerData.registry));
      }
      
      // Load session bindings
      if (managerData.sessionBindings) {
        this.deserializeSessionBindings(managerData.sessionBindings);
      }
      
      // Load metrics (optional)
      if (managerData.metrics) {
        this.metrics = { ...this.metrics, ...managerData.metrics };
      }
      
      const capabilityCount = this.registry.list().length;
      this.emit('persistence:loaded', filePath, capabilityCount);
    } catch (error) {
      // Handle file not found gracefully - just start with empty state
      if ((error as any)?.code === 'ENOENT') {
        // File doesn't exist, which is fine for first run
        this.emit('persistence:loaded', filePath, 0);
        return;
      }
      
      // Other errors are genuine failures
      this.emit('persistence:failed', error as Error);
      throw new CapabilityRegistryError(
        `Failed to load from file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PERSISTENCE_LOAD_ERROR'
      );
    }
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private mergeConfig(partialConfig: Partial<CapabilityManagerConfig>): CapabilityManagerConfig {
    return {
      registry: { ...DEFAULT_MANAGER_CONFIG.registry, ...partialConfig.registry },
      session: { ...DEFAULT_MANAGER_CONFIG.session, ...partialConfig.session },
      persistence: { ...DEFAULT_MANAGER_CONFIG.persistence, ...partialConfig.persistence },
      metrics: { ...DEFAULT_MANAGER_CONFIG.metrics, ...partialConfig.metrics }
    };
  }

  private initializeMetrics(): CapabilityUsageMetrics {
    return {
      totalRequests: 0,
      requestsByCapability: {},
      errorsByCapability: {},
      averageResponseTime: 0,
      responseTimesByCapability: {},
      lastUsedByCapability: {},
      totalErrors: 0,
      uptime: 0,
      startTime: new Date()
    };
  }

  private setupRegistryEventForwarding(): void {
    // Forward relevant registry events
    this.registry.on('capability:registered', (spec) => {
      this.emit('capability:registered', spec);
    });
    
    this.registry.on('capability:unregistered', (name, version) => {
      this.emit('capability:unregistered', name, version);
    });
  }

  private setupAutoSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
    
    this.saveTimer = setInterval(async () => {
      if (this.config.persistence.filePath) {
        try {
          await this.saveToFile(this.config.persistence.filePath);
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    }, this.config.persistence.saveInterval);
  }

  private startPerformanceTracking(operation: string): number {
    if (!this.config.metrics.trackPerformance) return 0;
    
    const startTime = performance.now();
    const snapshot: PerformanceSnapshot = {
      operation,
      startTime,
      success: false
    };
    
    this.performanceSnapshots.set(`${operation}_${startTime}`, snapshot);
    return startTime;
  }

  private endPerformanceTracking(operation: string, startTime: number, success: boolean, error?: Error): void {
    if (!this.config.metrics.trackPerformance || startTime === 0) return;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const snapshotKey = `${operation}_${startTime}`;
    const snapshot = this.performanceSnapshots.get(snapshotKey);
    
    if (snapshot) {
      snapshot.endTime = endTime;
      snapshot.duration = duration;
      snapshot.success = success;
      snapshot.error = error;
    }
    
    this.emit('performance:measured', operation, duration);
  }

  private updateUsageMetrics(capabilityName: string, success: boolean): void {
    if (!this.config.metrics.trackUsage) return;
    
    this.metrics.totalRequests++;
    
    if (!this.metrics.requestsByCapability[capabilityName]) {
      this.metrics.requestsByCapability[capabilityName] = 0;
    }
    this.metrics.requestsByCapability[capabilityName]++;
    
    if (!success) {
      this.metrics.totalErrors++;
      if (!this.metrics.errorsByCapability[capabilityName]) {
        this.metrics.errorsByCapability[capabilityName] = 0;
      }
      this.metrics.errorsByCapability[capabilityName]++;
    }
    
    this.metrics.lastUsedByCapability[capabilityName] = new Date();
    this.emit('metrics:updated', this.metrics);
  }

  private serializeSessionBindings(): any {
    const bindings: any = {};
    
    for (const [sessionId, bindingSet] of this.sessionBindings.entries()) {
      bindings[sessionId] = Array.from(bindingSet).map(binding => ({
        ...binding,
        bindingTime: binding.bindingTime.toISOString(),
        lastUsed: binding.lastUsed.toISOString()
      }));
    }
    
    return bindings;
  }

  private deserializeSessionBindings(serializedBindings: any): void {
    this.sessionBindings.clear();
    this.globalBindings.clear();
    
    for (const [sessionId, bindings] of Object.entries(serializedBindings)) {
      const bindingSet = new Set<SessionCapabilityBinding>();
      
      for (const bindingData of bindings as any[]) {
        const binding: SessionCapabilityBinding = {
          ...bindingData,
          bindingTime: new Date(bindingData.bindingTime),
          lastUsed: new Date(bindingData.lastUsed)
        };
        
        bindingSet.add(binding);
        
        const bindingKey = `${sessionId}:${binding.capabilityName}`;
        this.globalBindings.set(bindingKey, binding);
      }
      
      this.sessionBindings.set(sessionId, bindingSet);
    }
  }
}