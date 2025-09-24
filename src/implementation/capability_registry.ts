/**
 * Sophisticated Capability Registry System for Advanced Session Management
 * 
 * Provides comprehensive capability management including registration, resolution,
 * validation, versioning, and lifecycle management for both AtomicCapabilitySpec
 * and StreamCapabilitySpec types.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { ulid } from 'ulid';
import {
  CapabilitySpec,
  AtomicCapabilitySpec,
  StreamCapabilitySpec
} from '../interface/session';
import {
  CapabilitySpecSchema,
  AtomicCapabilitySpecSchema,
  StreamCapabilitySpecSchema,
  ValidationResult
} from '../validation/schemas';
import { validator } from '../validation/pipeline';

// ============================================================================
// Enhanced Capability Types
// ============================================================================

export interface CapabilityVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface CapabilityDependency {
  name: string;
  version?: CapabilityVersion;
  required: boolean;
}

export interface CapabilityMetadata {
  version: CapabilityVersion;
  dependencies: CapabilityDependency[];
  tags: string[];
  author?: string;
  documentation?: string;
  deprecated?: boolean;
  deprecationMessage?: string;
  created_at: Date;
  updated_at: Date;
}

export interface EnhancedCapabilitySpec extends CapabilitySpec {
  id: string; // ULID
  metadata: CapabilityMetadata;
}

export interface EnhancedAtomicCapabilitySpec<I, O> extends AtomicCapabilitySpec<I, O> {
  id: string;
  metadata: CapabilityMetadata;
}

export interface EnhancedStreamCapabilitySpec<I> extends StreamCapabilitySpec<I> {
  id: string;
  metadata: CapabilityMetadata;
}

export type AnyEnhancedCapabilitySpec = 
  | EnhancedAtomicCapabilitySpec<any, any> 
  | EnhancedStreamCapabilitySpec<any>;

// ============================================================================
// Registry Events
// ============================================================================

export interface CapabilityRegistryEvents {
  'capability:registered': (spec: AnyEnhancedCapabilitySpec) => void;
  'capability:unregistered': (name: string, version?: CapabilityVersion) => void;
  'capability:resolved': (name: string, spec: AnyEnhancedCapabilitySpec) => void;
  'capability:validation_failed': (name: string, error: z.ZodError) => void;
  'capability:dependency_missing': (name: string, dependency: string) => void;
  'capability:version_conflict': (name: string, existing: CapabilityVersion, requested: CapabilityVersion) => void;
  'registry:loaded': (count: number) => void;
  'registry:persisted': (count: number) => void;
  'registry:cleared': () => void;
}

// ============================================================================
// Registry Errors
// ============================================================================

export class CapabilityRegistryError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CapabilityRegistryError';
  }
}

export class CapabilityValidationError extends CapabilityRegistryError {
  constructor(message: string, public validationErrors: z.ZodError) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class CapabilityConflictError extends CapabilityRegistryError {
  constructor(message: string) {
    super(message, 'CONFLICT_ERROR');
  }
}

export class CapabilityNotFoundError extends CapabilityRegistryError {
  constructor(message: string) {
    super(message, 'NOT_FOUND_ERROR');
  }
}

export class DependencyError extends CapabilityRegistryError {
  constructor(message: string) {
    super(message, 'DEPENDENCY_ERROR');
  }
}

// ============================================================================
// Registry Configuration
// ============================================================================

export interface CapabilityRegistryConfig {
  allowVersionConflicts: boolean;
  strictDependencyChecking: boolean;
  maxCapabilities: number;
  enablePersistence: boolean;
  persistencePath?: string;
  validationMode: 'strict' | 'permissive';
  enableDeprecationWarnings: boolean;
}

export const DEFAULT_REGISTRY_CONFIG: CapabilityRegistryConfig = {
  allowVersionConflicts: false,
  strictDependencyChecking: true,
  maxCapabilities: 1000,
  enablePersistence: true,
  validationMode: 'strict',
  enableDeprecationWarnings: true
};

// ============================================================================
// Capability Registry Implementation
// ============================================================================

export class CapabilityRegistry extends EventEmitter {
  private capabilities = new Map<string, Map<string, AnyEnhancedCapabilitySpec>>();
  private nameIndex = new Map<string, string[]>(); // name -> versions
  private tagIndex = new Map<string, string[]>(); // tag -> capability names
  private dependencyGraph = new Map<string, Set<string>>(); // capability -> dependents
  private config: CapabilityRegistryConfig;

  constructor(config: Partial<CapabilityRegistryConfig> = {}) {
    super();
    this.config = { ...DEFAULT_REGISTRY_CONFIG, ...config };
  }

  // ========================================================================
  // Registration Methods
  // ========================================================================

  /**
   * Register an atomic capability specification
   */
  async register<I, O>(
    spec: AtomicCapabilitySpec<I, O>,
    metadata?: Partial<CapabilityMetadata>
  ): Promise<EnhancedAtomicCapabilitySpec<I, O>> {
    return this.registerCapability(spec, metadata) as Promise<EnhancedAtomicCapabilitySpec<I, O>>;
  }

  /**
   * Register a streaming capability specification
   */
  async registerStream<I>(
    spec: StreamCapabilitySpec<I>,
    metadata?: Partial<CapabilityMetadata>
  ): Promise<EnhancedStreamCapabilitySpec<I>> {
    return this.registerCapability(spec, metadata) as Promise<EnhancedStreamCapabilitySpec<I>>;
  }

  /**
   * Internal capability registration with comprehensive validation
   */
  private async registerCapability(
    spec: CapabilitySpec,
    metadata?: Partial<CapabilityMetadata>
  ): Promise<AnyEnhancedCapabilitySpec> {
    // Validate capability specification
    const validation = this.validateCapabilitySpec(spec);
    if (!validation.success) {
      const error = new CapabilityValidationError(
        `Invalid capability specification for '${spec.name}': ${validation.message}`,
        validation.error
      );
      this.emit('capability:validation_failed', spec.name, validation.error);
      throw error;
    }

    // Check capacity limits
    const totalCapabilities = Array.from(this.capabilities.values())
      .reduce((total, versionMap) => total + versionMap.size, 0);
    
    if (totalCapabilities >= this.config.maxCapabilities) {
      throw new CapabilityRegistryError(
        `Registry capacity exceeded. Maximum ${this.config.maxCapabilities} capabilities allowed.`,
        'CAPACITY_EXCEEDED'
      );
    }

    // Create enhanced capability specification
    const enhancedSpec = this.createEnhancedSpec(spec, metadata);

    // Check for conflicts
    await this.checkForConflicts(enhancedSpec);

    // Validate dependencies
    await this.validateDependencies(enhancedSpec);

    // Register the capability
    this.storeCapability(enhancedSpec);

    // Update indices
    this.updateIndices(enhancedSpec);

    // Update dependency graph
    this.updateDependencyGraph(enhancedSpec);

    // Emit registration event
    this.emit('capability:registered', enhancedSpec);

    return enhancedSpec;
  }

  // ========================================================================
  // Resolution Methods
  // ========================================================================

  /**
   * Resolve a capability by name (returns latest version by default)
   */
  async resolve(name: string, version?: CapabilityVersion): Promise<AnyEnhancedCapabilitySpec> {
    const versionKey = version ? this.versionToString(version) : this.getLatestVersion(name);
    
    if (!versionKey) {
      throw new CapabilityNotFoundError(`Capability '${name}' not found`);
    }

    const versionMap = this.capabilities.get(name);
    const spec = versionMap?.get(versionKey);

    if (!spec) {
      const versionStr = version ? ` version ${this.versionToString(version)}` : '';
      throw new CapabilityNotFoundError(`Capability '${name}'${versionStr} not found`);
    }

    // Check if deprecated
    if (spec.metadata.deprecated && this.config.enableDeprecationWarnings) {
      console.warn(
        `Warning: Capability '${name}' is deprecated. ${spec.metadata.deprecationMessage || ''}`
      );
    }

    // Validate dependencies are available
    await this.validateRuntimeDependencies(spec);

    this.emit('capability:resolved', name, spec);
    return spec;
  }

  /**
   * Get capability metadata
   */
  getCapabilityMetadata(name: string, version?: CapabilityVersion): CapabilityMetadata | null {
    const versionKey = version ? this.versionToString(version) : this.getLatestVersion(name);
    
    if (!versionKey) {
      return null;
    }

    const versionMap = this.capabilities.get(name);
    const spec = versionMap?.get(versionKey);
    
    return spec?.metadata || null;
  }

  /**
   * List all registered capabilities
   */
  list(): AnyEnhancedCapabilitySpec[] {
    const specs: AnyEnhancedCapabilitySpec[] = [];
    
    for (const versionMap of this.capabilities.values()) {
      for (const spec of versionMap.values()) {
        specs.push(spec);
      }
    }
    
    return specs.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * List capabilities by tag
   */
  listByTag(tag: string): AnyEnhancedCapabilitySpec[] {
    const names = this.tagIndex.get(tag) || [];
    const specs: AnyEnhancedCapabilitySpec[] = [];
    
    for (const name of names) {
      const latestVersion = this.getLatestVersion(name);
      if (latestVersion) {
        const spec = this.capabilities.get(name)?.get(latestVersion);
        if (spec) {
          specs.push(spec);
        }
      }
    }
    
    return specs.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Search capabilities by name pattern
   */
  search(pattern: string): AnyEnhancedCapabilitySpec[] {
    const regex = new RegExp(pattern, 'i');
    return this.list().filter(spec => 
      regex.test(spec.name) || 
      regex.test(spec.description) ||
      spec.metadata.tags.some(tag => regex.test(tag))
    );
  }

  // ========================================================================
  // Unregistration and Management
  // ========================================================================

  /**
   * Unregister a capability
   */
  async unregister(name: string, version?: CapabilityVersion): Promise<boolean> {
    const versionKey = version ? this.versionToString(version) : null;
    const versionMap = this.capabilities.get(name);
    
    if (!versionMap) {
      return false;
    }

    if (versionKey) {
      // Remove specific version
      const removed = versionMap.delete(versionKey);
      if (versionMap.size === 0) {
        this.capabilities.delete(name);
        this.cleanupIndices(name);
      }
      
      if (removed) {
        this.emit('capability:unregistered', name, version);
      }
      
      return removed;
    } else {
      // Remove all versions
      this.capabilities.delete(name);
      this.cleanupIndices(name);
      this.emit('capability:unregistered', name);
      return true;
    }
  }

  /**
   * Clear all capabilities
   */
  clear(): void {
    this.capabilities.clear();
    this.nameIndex.clear();
    this.tagIndex.clear();
    this.dependencyGraph.clear();
    this.emit('registry:cleared');
  }

  /**
   * Check if capability exists
   */
  exists(name: string, version?: CapabilityVersion): boolean {
    const versionMap = this.capabilities.get(name);
    if (!versionMap) return false;
    
    if (version) {
      return versionMap.has(this.versionToString(version));
    }
    
    return versionMap.size > 0;
  }

  // ========================================================================
  // Validation Methods
  // ========================================================================

  /**
   * Validate capability request against registered spec
   */
  async validateRequest<I>(
    capabilityName: string, 
    payload: I, 
    version?: CapabilityVersion
  ): Promise<ValidationResult<I>> {
    try {
      const spec = await this.resolve(capabilityName, version);
      
      // For now, we assume input_schema is a Zod schema or compatible
      if ('input_schema' in spec && spec.input_schema) {
        return validator.validate(spec.input_schema as z.ZodSchema, payload, 'CapabilityRequestPayload');
      }
      
      // If no schema validation is available, return success
      return {
        success: true,
        data: payload
      };
    } catch (error) {
      return {
        success: false,
        error: error as z.ZodError,
        message: `Capability validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        field_errors: {}
      };
    }
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private validateCapabilitySpec(spec: CapabilitySpec): ValidationResult<CapabilitySpec> {
    if (spec.stream_response) {
      return validator.validate(StreamCapabilitySpecSchema, spec, 'StreamCapabilitySpec');
    } else {
      return validator.validate(AtomicCapabilitySpecSchema, spec, 'AtomicCapabilitySpec');
    }
  }

  private createEnhancedSpec(
    spec: CapabilitySpec,
    metadata?: Partial<CapabilityMetadata>
  ): AnyEnhancedCapabilitySpec {
    const id = ulid();
    const now = new Date();
    
    const defaultMetadata: CapabilityMetadata = {
      version: { major: 1, minor: 0, patch: 0 },
      dependencies: [],
      tags: [],
      created_at: now,
      updated_at: now,
      deprecated: false,
      ...metadata
    };

    const enhancedSpec = {
      ...spec,
      id,
      metadata: defaultMetadata
    } as AnyEnhancedCapabilitySpec;

    return enhancedSpec;
  }

  private async checkForConflicts(spec: AnyEnhancedCapabilitySpec): Promise<void> {
    const existing = this.capabilities.get(spec.name);
    const versionKey = this.versionToString(spec.metadata.version);
    
    if (existing?.has(versionKey)) {
      if (!this.config.allowVersionConflicts) {
        throw new CapabilityConflictError(
          `Capability '${spec.name}' version ${versionKey} already exists`
        );
      }
      
      this.emit('capability:version_conflict', spec.name, existing.get(versionKey)!.metadata.version, spec.metadata.version);
    }
  }

  private async validateDependencies(spec: AnyEnhancedCapabilitySpec): Promise<void> {
    if (!this.config.strictDependencyChecking) return;

    for (const dep of spec.metadata.dependencies) {
      if (dep.required && !this.exists(dep.name, dep.version)) {
        const error = new DependencyError(
          `Required dependency '${dep.name}' not found for capability '${spec.name}'`
        );
        this.emit('capability:dependency_missing', spec.name, dep.name);
        throw error;
      }
    }
  }

  private async validateRuntimeDependencies(spec: AnyEnhancedCapabilitySpec): Promise<void> {
    for (const dep of spec.metadata.dependencies) {
      if (dep.required && !this.exists(dep.name, dep.version)) {
        this.emit('capability:dependency_missing', spec.name, dep.name);
        throw new DependencyError(
          `Runtime dependency '${dep.name}' not available for capability '${spec.name}'`
        );
      }
    }
  }

  private storeCapability(spec: AnyEnhancedCapabilitySpec): void {
    const versionKey = this.versionToString(spec.metadata.version);
    
    if (!this.capabilities.has(spec.name)) {
      this.capabilities.set(spec.name, new Map());
    }
    
    this.capabilities.get(spec.name)!.set(versionKey, spec);
  }

  private updateIndices(spec: AnyEnhancedCapabilitySpec): void {
    // Update name index
    const versionKey = this.versionToString(spec.metadata.version);
    const versions = this.nameIndex.get(spec.name) || [];
    if (!versions.includes(versionKey)) {
      versions.push(versionKey);
      versions.sort(this.compareVersionStrings.bind(this));
      this.nameIndex.set(spec.name, versions);
    }

    // Update tag index
    for (const tag of spec.metadata.tags) {
      const taggedCapabilities = this.tagIndex.get(tag) || [];
      if (!taggedCapabilities.includes(spec.name)) {
        taggedCapabilities.push(spec.name);
        this.tagIndex.set(tag, taggedCapabilities);
      }
    }
  }

  private updateDependencyGraph(spec: AnyEnhancedCapabilitySpec): void {
    for (const dep of spec.metadata.dependencies) {
      if (!this.dependencyGraph.has(dep.name)) {
        this.dependencyGraph.set(dep.name, new Set());
      }
      this.dependencyGraph.get(dep.name)!.add(spec.name);
    }
  }

  private cleanupIndices(name: string): void {
    // Remove from name index
    this.nameIndex.delete(name);
    
    // Remove from tag index
    for (const [tag, names] of this.tagIndex.entries()) {
      const index = names.indexOf(name);
      if (index !== -1) {
        names.splice(index, 1);
        if (names.length === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
    
    // Remove from dependency graph
    this.dependencyGraph.delete(name);
    for (const dependents of this.dependencyGraph.values()) {
      dependents.delete(name);
    }
  }

  private getLatestVersion(name: string): string | null {
    const versions = this.nameIndex.get(name);
    return versions && versions.length > 0 ? versions[versions.length - 1] : null;
  }

  private versionToString(version: CapabilityVersion): string {
    return `${version.major}.${version.minor}.${version.patch}`;
  }

  private compareVersionStrings(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (aParts[i] !== bParts[i]) {
        return aParts[i] - bParts[i];
      }
    }
    
    return 0;
  }

  // ========================================================================
  // Persistence Methods (will be implemented next)
  // ========================================================================

  /**
   * Serialize registry for persistence
   */
  serialize(): string {
    const data = {
      capabilities: Array.from(this.capabilities.entries()).map(([name, versionMap]) => [
        name,
        Array.from(versionMap.entries())
      ]),
      config: this.config,
      timestamp: new Date().toISOString()
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Load registry from serialized data
   */
  async load(serializedData: string): Promise<void> {
    try {
      const data = JSON.parse(serializedData) as {
        capabilities: Array<[string, Array<[string, AnyEnhancedCapabilitySpec]>]>;
        config: CapabilityRegistryConfig;
        timestamp: string;
      };
      
      // Clear existing data
      this.clear();
      
      // Restore capabilities
      for (const [name, versionEntries] of data.capabilities) {
        const versionMap = new Map<string, AnyEnhancedCapabilitySpec>(
          versionEntries as Array<[string, AnyEnhancedCapabilitySpec]>
        );
        this.capabilities.set(name, versionMap);
        
        // Rebuild indices
        for (const spec of versionMap.values()) {
          this.updateIndices(spec);
          this.updateDependencyGraph(spec);
        }
      }
      
      this.emit('registry:loaded', this.capabilities.size);
    } catch (error) {
      throw new CapabilityRegistryError(
        `Failed to load registry data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOAD_ERROR'
      );
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalCapabilities: number;
    capabilityNames: number;
    totalVersions: number;
    tags: number;
    dependencies: number;
  } {
    const totalVersions = Array.from(this.capabilities.values())
      .reduce((total, versionMap) => total + versionMap.size, 0);
    
    return {
      totalCapabilities: this.capabilities.size,
      capabilityNames: this.capabilities.size,
      totalVersions,
      tags: this.tagIndex.size,
      dependencies: this.dependencyGraph.size
    };
  }
}