import {
  Session,
  SessionObject,
  Interaction,
  RequestMessage,
  CapabilityRequestContent,
  AtomicCapabilitySpec,
  StreamCapabilitySpec
} from '../interface/session';
import {
  CapabilityManager,
  CapabilityManagerConfig,
  SessionCapabilityBinding
} from './capability_manager';
import {
  CapabilityVersion,
  CapabilityMetadata,
  AnyEnhancedCapabilitySpec
} from './capability_registry';
import { ValidationResult } from '../validation/schemas';
import { SessionPersistenceManager } from './session_persistence_manager';

/**
 * Enhanced Default Session with Capability Management Integration
 *
 * Provides sophisticated session management with integrated capability validation,
 * binding management, and lifecycle tracking.
 */
export class DefaultSession implements Session {
  private _sessionObject: SessionObject;
  private _capabilityManager?: CapabilityManager;
  private _sessionId: string;
  private _enableCapabilityIntegration: boolean;
  private _persistenceManager?: SessionPersistenceManager;
  private _enableAutoPersistence: boolean;
  private _persistenceSessionId?: string;

  constructor(
    sessionObject: Partial<SessionObject> = {},
    capabilityManager?: CapabilityManager,
    options: {
      enableCapabilityIntegration?: boolean;
      persistenceManager?: SessionPersistenceManager;
      enableAutoPersistence?: boolean;
      persistenceSessionId?: string;
    } = {}
  ) {
    // Ensure all required fields exist with defaults
    this._sessionObject = {
      processor_id: sessionObject.processor_id || 'default-processor',
      activity_id: sessionObject.activity_id || 'default-activity',
      request_id: sessionObject.request_id || 'default-request',
      interactions: sessionObject.interactions || []
    };
    
    this._capabilityManager = capabilityManager;
    this._sessionId = this._sessionObject.activity_id; // Use activity_id as session identifier
    this._enableCapabilityIntegration = options.enableCapabilityIntegration ?? true;
    
    // Persistence configuration
    this._persistenceManager = options.persistenceManager;
    this._enableAutoPersistence = options.enableAutoPersistence ?? false;
    this._persistenceSessionId = options.persistenceSessionId || this._sessionId;
    
    // LOG: Construction
    console.info('[DefaultSession][LOG] Created with sessionObject:', this._sessionObject);
    console.info('[DefaultSession][LOG] Capability integration enabled:', this._enableCapabilityIntegration);
    console.info('[DefaultSession][LOG] Auto-persistence enabled:', this._enableAutoPersistence);
  }

  /**
   * Get processor ID
   */
  get processor_id(): string {
    return this._sessionObject.processor_id;
  }

  /**
   * Get activity ID
   */
  get activity_id(): string {
    return this._sessionObject.activity_id;
  }

  /**
   * Get request ID
   */
  get request_id(): string {
    return this._sessionObject.request_id;
  }

  /**
   * Get interactions as AsyncIterable
   * In a stateless environment, we convert the array to an AsyncIterable
   */
  async *get_interactions(): AsyncIterable<Interaction<RequestMessage>> {
    // LOG: Access get_interactions
    console.info('[DefaultSession][LOG] Accessing get_interactions');
    
    // Convert array to AsyncIterable
    for (const interaction of this._sessionObject.interactions) {
      yield interaction;
    }
  }

  // ========================================================================
  // Capability Management Integration
  // ========================================================================

  /**
   * Set capability manager for this session
   */
  setCapabilityManager(manager: CapabilityManager): void {
    this._capabilityManager = manager;
    console.info('[DefaultSession][LOG] Capability manager set');
  }

  /**
   * Get capability manager
   */
  getCapabilityManager(): CapabilityManager | undefined {
    return this._capabilityManager;
  }

  /**
   * Enable or disable capability integration
   */
  setCapabilityIntegration(enabled: boolean): void {
    this._enableCapabilityIntegration = enabled;
    console.info('[DefaultSession][LOG] Capability integration set to:', enabled);
  }

  /**
   * Check if capability integration is enabled
   */
  isCapabilityIntegrationEnabled(): boolean {
    return this._enableCapabilityIntegration && this._capabilityManager !== undefined;
  }

  /**
   * Bind a capability to this session
   */
  async bindCapability(
    capabilityName: string,
    version?: CapabilityVersion
  ): Promise<void> {
    if (!this.isCapabilityIntegrationEnabled()) {
      throw new Error('Capability integration is not enabled for this session');
    }

    await this._capabilityManager!.bindCapabilityToSession(
      this._sessionId,
      capabilityName,
      version
    );

    console.info('[DefaultSession][LOG] Capability bound:', capabilityName);
  }

  /**
   * Unbind a capability from this session
   */
  unbindCapability(capabilityName: string): boolean {
    if (!this.isCapabilityIntegrationEnabled()) {
      return false;
    }

    const result = this._capabilityManager!.unbindCapabilityFromSession(
      this._sessionId,
      capabilityName
    );

    console.info('[DefaultSession][LOG] Capability unbound:', capabilityName, 'Result:', result);
    return result;
  }

  /**
   * Get capabilities bound to this session
   */
  getBoundCapabilities(): SessionCapabilityBinding[] {
    if (!this.isCapabilityIntegrationEnabled()) {
      return [];
    }

    return this._capabilityManager!.getSessionCapabilities(this._sessionId);
  }

  /**
   * Validate a capability request for this session
   */
  async validateCapabilityRequest<I>(
    request: CapabilityRequestContent<I>
  ): Promise<ValidationResult<I>> {
    if (!this.isCapabilityIntegrationEnabled()) {
      // If capability integration is disabled, return a simple success
      return {
        success: true,
        data: request.request_payload
      };
    }

    const result = await this._capabilityManager!.validateSessionCapabilityRequest(
      this._sessionId,
      request
    );

    console.info('[DefaultSession][LOG] Capability request validated:', request.capability, 'Success:', result.success);
    return result;
  }

  /**
   * Check if a capability is bound to this session
   */
  hasCapability(capabilityName: string): boolean {
    if (!this.isCapabilityIntegrationEnabled()) {
      return false;
    }

    const bindings = this.getBoundCapabilities();
    return bindings.some(binding => binding.capabilityName === capabilityName && binding.enabled);
  }

  /**
   * Get capability metadata for a bound capability
   */
  getCapabilityMetadata(capabilityName: string, version?: CapabilityVersion): CapabilityMetadata | null {
    if (!this.isCapabilityIntegrationEnabled()) {
      return null;
    }

    return this._capabilityManager!.getCapabilityMetadata(capabilityName, version);
  }

  /**
   * Discover available capabilities that can be bound to this session
   */
  discoverAvailableCapabilities(): AnyEnhancedCapabilitySpec[] {
    if (!this.isCapabilityIntegrationEnabled()) {
      return [];
    }

    return this._capabilityManager!.discoverCapabilities();
  }

  /**
   * Search for capabilities by pattern
   */
  searchCapabilities(pattern: string): AnyEnhancedCapabilitySpec[] {
    if (!this.isCapabilityIntegrationEnabled()) {
      return [];
    }

    return this._capabilityManager!.searchCapabilities(pattern);
  }

  /**
   * Get session statistics
   */
  getSessionStatistics(): {
    sessionId: string;
    boundCapabilities: number;
    activeCapabilities: number;
    totalRequests: number;
    capabilityIntegrationEnabled: boolean;
  } {
    const bindings = this.getBoundCapabilities();
    const activeCapabilities = bindings.filter(binding => binding.enabled).length;
    const totalRequests = bindings.reduce((sum, binding) => sum + binding.usageCount, 0);

    return {
      sessionId: this._sessionId,
      boundCapabilities: bindings.length,
      activeCapabilities,
      totalRequests,
      capabilityIntegrationEnabled: this.isCapabilityIntegrationEnabled()
    };
  }

  // ========================================================================
  // Enhanced Session Information
  // ========================================================================

  /**
   * Get enhanced session information with capability context
   */
  getEnhancedSessionInfo(): {
    sessionObject: SessionObject;
    capabilities: {
      integrationEnabled: boolean;
      boundCapabilities: SessionCapabilityBinding[];
      statistics: ReturnType<DefaultSession['getSessionStatistics']>;
    };
  } {
    return {
      sessionObject: { ...this._sessionObject },
      capabilities: {
        integrationEnabled: this.isCapabilityIntegrationEnabled(),
        boundCapabilities: this.getBoundCapabilities(),
        statistics: this.getSessionStatistics()
      }
    };
  }

  /**
   * Update session object while preserving capability bindings
   */
  updateSessionObject(updates: Partial<SessionObject>): void {
    this._sessionObject = {
      ...this._sessionObject,
      ...updates
    };

    // Update session ID if activity_id changed
    if (updates.activity_id && updates.activity_id !== this._sessionId) {
      const oldSessionId = this._sessionId;
      this._sessionId = updates.activity_id;
      
      console.info('[DefaultSession][LOG] Session ID changed from', oldSessionId, 'to', this._sessionId);
      
      // Note: In a full implementation, you might want to migrate capability bindings
      // from old session ID to new session ID, but for now we just log it
    }

    console.info('[DefaultSession][LOG] Session object updated:', updates);
    
    // Auto-persist if enabled
    if (this._enableAutoPersistence && this._persistenceManager) {
      this._persistenceManager.markSessionForPersistence(this._persistenceSessionId!);
    }
  }

  // ========================================================================
  // Session Persistence Integration
  // ========================================================================

  /**
   * Set persistence manager for this session
   */
  setPersistenceManager(manager: SessionPersistenceManager, enableAutoPersistence = false): void {
    this._persistenceManager = manager;
    this._enableAutoPersistence = enableAutoPersistence;
    console.info('[DefaultSession][LOG] Persistence manager set, auto-persistence:', enableAutoPersistence);
  }

  /**
   * Get persistence manager
   */
  getPersistenceManager(): SessionPersistenceManager | undefined {
    return this._persistenceManager;
  }

  /**
   * Enable or disable auto-persistence
   */
  setAutoPersistence(enabled: boolean): void {
    this._enableAutoPersistence = enabled;
    console.info('[DefaultSession][LOG] Auto-persistence set to:', enabled);
  }

  /**
   * Check if auto-persistence is enabled
   */
  isAutoPersistenceEnabled(): boolean {
    return this._enableAutoPersistence && this._persistenceManager !== undefined;
  }

  /**
   * Manually persist this session
   */
  async persist(): Promise<string | null> {
    if (!this._persistenceManager) {
      console.warn('[DefaultSession][WARN] No persistence manager configured');
      return null;
    }

    try {
      const sessionId = await this._persistenceManager.persistSession(this, this._persistenceSessionId);
      console.info('[DefaultSession][LOG] Session manually persisted:', sessionId);
      return sessionId;
    } catch (error) {
      console.error('[DefaultSession][ERROR] Failed to persist session:', error);
      throw error;
    }
  }

  /**
   * Load session data from persistence
   */
  async loadFromPersistence(sessionId?: string): Promise<boolean> {
    if (!this._persistenceManager) {
      console.warn('[DefaultSession][WARN] No persistence manager configured');
      return false;
    }

    const loadSessionId = sessionId || this._persistenceSessionId;
    if (!loadSessionId) {
      console.warn('[DefaultSession][WARN] No session ID specified for loading');
      return false;
    }

    try {
      const persistedSession = await this._persistenceManager.getSession(loadSessionId);
      if (!persistedSession) {
        console.info('[DefaultSession][LOG] No persisted session found:', loadSessionId);
        return false;
      }

      // Update session object with persisted data
      this.updateSessionObject({
        processor_id: persistedSession.processor_id,
        activity_id: persistedSession.activity_id,
        request_id: persistedSession.request_id,
        interactions: persistedSession.interactions
      });

      this._persistenceSessionId = loadSessionId;
      console.info('[DefaultSession][LOG] Session loaded from persistence:', loadSessionId);
      return true;
    } catch (error) {
      console.error('[DefaultSession][ERROR] Failed to load session from persistence:', error);
      return false;
    }
  }

  /**
   * Add an interaction to the session and auto-persist if enabled
   */
  addInteraction(interaction: Interaction<RequestMessage>): void {
    this._sessionObject.interactions.push(interaction);
    console.info('[DefaultSession][LOG] Interaction added, total:', this._sessionObject.interactions.length);

    // Auto-persist if enabled
    if (this._enableAutoPersistence && this._persistenceManager) {
      this._persistenceManager.markSessionForPersistence(this._persistenceSessionId!);
      console.debug('[DefaultSession][DEBUG] Session marked for auto-persistence');
    }
  }

  /**
   * Remove an interaction from the session
   */
  removeInteraction(index: number): boolean {
    if (index < 0 || index >= this._sessionObject.interactions.length) {
      return false;
    }

    this._sessionObject.interactions.splice(index, 1);
    console.info('[DefaultSession][LOG] Interaction removed, total:', this._sessionObject.interactions.length);

    // Auto-persist if enabled
    if (this._enableAutoPersistence && this._persistenceManager) {
      this._persistenceManager.markSessionForPersistence(this._persistenceSessionId!);
    }

    return true;
  }

  /**
   * Clear all interactions
   */
  clearInteractions(): void {
    const count = this._sessionObject.interactions.length;
    this._sessionObject.interactions = [];
    console.info('[DefaultSession][LOG] All interactions cleared, count:', count);

    // Auto-persist if enabled
    if (this._enableAutoPersistence && this._persistenceManager) {
      this._persistenceManager.markSessionForPersistence(this._persistenceSessionId!);
    }
  }

  /**
   * Get session metadata for persistence
   */
  getPersistenceMetadata(): Record<string, any> {
    return {
      session_type: 'DefaultSession',
      capability_integration_enabled: this._enableCapabilityIntegration,
      auto_persistence_enabled: this._enableAutoPersistence,
      bound_capabilities_count: this.getBoundCapabilities().length,
      interactions_count: this._sessionObject.interactions.length
    };
  }

  /**
   * Get persistence session ID
   */
  getPersistenceSessionId(): string | undefined {
    return this._persistenceSessionId;
  }

  /**
   * Set persistence session ID
   */
  setPersistenceSessionId(sessionId: string): void {
    this._persistenceSessionId = sessionId;
    console.info('[DefaultSession][LOG] Persistence session ID set:', sessionId);
  }

  /**
   * Check if session has unsaved changes (basic implementation)
   */
  hasUnsavedChanges(): boolean {
    // This is a simplified implementation - in a full implementation,
    // you might track modifications more precisely
    return this._enableAutoPersistence && this._persistenceManager !== undefined;
  }

  /**
   * Get enhanced session information including persistence status
   */
  getEnhancedSessionInfoWithPersistence(): {
    sessionObject: SessionObject;
    capabilities: {
      integrationEnabled: boolean;
      boundCapabilities: SessionCapabilityBinding[];
      statistics: ReturnType<DefaultSession['getSessionStatistics']>;
    };
    persistence: {
      managerConfigured: boolean;
      autoPersistenceEnabled: boolean;
      persistenceSessionId?: string;
      hasUnsavedChanges: boolean;
    };
  } {
    const basicInfo = this.getEnhancedSessionInfo();
    
    return {
      ...basicInfo,
      persistence: {
        managerConfigured: this._persistenceManager !== undefined,
        autoPersistenceEnabled: this._enableAutoPersistence,
        persistenceSessionId: this._persistenceSessionId,
        hasUnsavedChanges: this.hasUnsavedChanges()
      }
    };
  }
}