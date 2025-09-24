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

  constructor(
    sessionObject: Partial<SessionObject> = {},
    capabilityManager?: CapabilityManager,
    options: {
      enableCapabilityIntegration?: boolean;
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
    
    // LOG: Construction
    console.info('[DefaultSession][LOG] Created with sessionObject:', this._sessionObject);
    console.info('[DefaultSession][LOG] Capability integration enabled:', this._enableCapabilityIntegration);
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
  }
}