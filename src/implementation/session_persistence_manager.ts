import { 
  SessionStore,
  SessionStoreConfig,
  PersistedSession,
  SessionFilter,
  SessionQueryOptions,
  SessionBackup,
  SessionTransaction,
  SessionStoreStats,
  SessionNotFoundError,
  SessionStoreError
} from '../interface/session_store';
import { SessionObject, Session } from '../interface/session';
import { DefaultSession } from './default_session';
import { InMemorySessionStore } from './in_memory_session_store';
import { FileSystemSessionStore } from './filesystem_session_store';
import { DefaultIdGenerator } from './default_id_generator';

/**
 * Session persistence configuration
 */
export interface SessionPersistenceConfig {
  // Store configuration
  store_type: 'memory' | 'filesystem' | 'custom';
  store_config?: SessionStoreConfig;
  
  // Filesystem-specific options
  filesystem_base_dir?: string;
  
  // Custom store instance
  custom_store?: SessionStore;
  
  // Auto-persistence settings
  auto_persist_enabled?: boolean;
  auto_persist_interval_ms?: number;
  auto_persist_on_interaction?: boolean;
  
  // Session lifecycle settings
  default_session_ttl_ms?: number;
  auto_cleanup_enabled?: boolean;
  cleanup_interval_ms?: number;
  
  // Event handling
  enable_event_listeners?: boolean;
  
  // ID generation
  id_generator?: DefaultIdGenerator;
}

/**
 * Session persistence statistics
 */
export interface SessionPersistenceStats extends SessionStoreStats {
  auto_persist_enabled: boolean;
  last_persist_time?: Date;
  persist_count: number;
  error_count: number;
  store_type: string;
}

/**
 * Session persistence manager that provides high-level operations
 * over different storage backends and integrates with DefaultSession
 */
export class SessionPersistenceManager {
  private _store!: SessionStore;
  private _config: Omit<Required<SessionPersistenceConfig>, 'custom_store' | 'id_generator'> & {
    custom_store?: SessionStore;
    id_generator?: DefaultIdGenerator;
  };
  private _initialized = false;
  private _persistInterval?: NodeJS.Timeout;
  private _idGenerator: DefaultIdGenerator;
  
  // Statistics
  private _persistCount = 0;
  private _errorCount = 0;
  private _lastPersistTime?: Date;
  
  // Session tracking for auto-persistence
  private _activeSessions = new Map<string, DefaultSession>();
  private _sessionUpdateQueue = new Set<string>();

  constructor(config: SessionPersistenceConfig) {
    this._config = this._normalizeConfig(config);
    this._idGenerator = config.id_generator || new DefaultIdGenerator();
  }

  // ========================================================================
  // Initialization and Configuration
  // ========================================================================

  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    // Create store based on configuration
    this._store = await this._createStore();
    
    // Initialize the store
    await this._store.initialize(this._config.store_config);

    // Setup auto-persistence if enabled
    if (this._config.auto_persist_enabled && this._config.auto_persist_interval_ms) {
      this._persistInterval = setInterval(() => {
        this._performAutoPersist().catch(error => {
          this._errorCount++;
          console.error('[SessionPersistenceManager][ERROR] Auto-persist failed:', error);
        });
      }, this._config.auto_persist_interval_ms);
    }

    // Setup event listeners if enabled
    if (this._config.enable_event_listeners) {
      this._setupEventListeners();
    }

    this._initialized = true;
    console.info('[SessionPersistenceManager][LOG] Initialized with store type:', this._config.store_type);
  }

  async shutdown(): Promise<void> {
    if (this._persistInterval) {
      clearInterval(this._persistInterval);
      this._persistInterval = undefined;
    }

    // Perform final auto-persist
    if (this._config.auto_persist_enabled) {
      await this._performAutoPersist();
    }

    await this._store.shutdown();
    this._activeSessions.clear();
    this._sessionUpdateQueue.clear();
    this._initialized = false;
    
    console.info('[SessionPersistenceManager][LOG] Shutdown complete');
  }

  getConfig(): SessionPersistenceConfig {
    return { ...this._config };
  }

  async updateConfig(config: Partial<SessionPersistenceConfig>): Promise<void> {
    const newConfig = { ...this._config, ...config };
    
    // If store type changed, we need to recreate the store
    if (config.store_type && config.store_type !== this._config.store_type) {
      // Perform backup before switching
      if (this._initialized) {
        const backup = await this.createBackup();
        console.info('[SessionPersistenceManager][LOG] Created backup before store switch:', backup.backup_id);
        
        // Shutdown current store
        await this._store.shutdown();
        
        // Create and initialize new store
        this._config = this._normalizeConfig(newConfig);
        this._store = await this._createStore();
        await this._store.initialize(this._config.store_config);
        
        // Restore from backup
        await this.restoreFromBackup(backup);
        console.info('[SessionPersistenceManager][LOG] Restored data to new store');
      }
    } else {
      this._config = this._normalizeConfig(newConfig);
      if (this._initialized && config.store_config) {
        await this._store.updateConfig(config.store_config);
      }
    }

    console.info('[SessionPersistenceManager][LOG] Configuration updated');
  }

  // ========================================================================
  // Session Management Integration
  // ========================================================================

  /**
   * Create a new session with automatic persistence
   */
  async createManagedSession(
    sessionObject: Partial<SessionObject> = {},
    options: {
      expires_at?: Date;
      metadata?: Record<string, any>;
      tags?: string[];
      enable_auto_persist?: boolean;
    } = {}
  ): Promise<DefaultSession> {
    // Ensure required fields
    const completeSessionObject: SessionObject = {
      processor_id: sessionObject.processor_id || await this._idGenerator.getNextId(),
      activity_id: sessionObject.activity_id || await this._idGenerator.getNextId(),
      request_id: sessionObject.request_id || await this._idGenerator.getNextId(),
      interactions: sessionObject.interactions || []
    };

    // Create persisted session
    const persistedSession = await this._store.createSession(completeSessionObject, options);
    
    // Create DefaultSession instance with persistence configuration
    const defaultSession = new DefaultSession(completeSessionObject, undefined, {
      persistenceManager: this,
      enableAutoPersistence: options.enable_auto_persist !== false && this._config.auto_persist_enabled,
      persistenceSessionId: persistedSession.session_id
    });
    
    // Track session for auto-persistence
    if (options.enable_auto_persist !== false && this._config.auto_persist_enabled) {
      this._activeSessions.set(persistedSession.session_id, defaultSession);
    }

    console.info('[SessionPersistenceManager][LOG] Created managed session:', persistedSession.session_id);
    return defaultSession;
  }

  /**
   * Load an existing session and make it managed
   */
  async loadManagedSession(sessionId: string): Promise<DefaultSession | null> {
    const persistedSession = await this._store.getSession(sessionId);
    if (!persistedSession) {
      return null;
    }

    const sessionObject: SessionObject = {
      processor_id: persistedSession.processor_id,
      activity_id: persistedSession.activity_id,
      request_id: persistedSession.request_id,
      interactions: persistedSession.interactions
    };

    const defaultSession = new DefaultSession(sessionObject, undefined, {
      persistenceManager: this,
      enableAutoPersistence: this._config.auto_persist_enabled,
      persistenceSessionId: sessionId
    });
    
    // Track session for auto-persistence
    if (this._config.auto_persist_enabled) {
      this._activeSessions.set(sessionId, defaultSession);
    }

    console.info('[SessionPersistenceManager][LOG] Loaded managed session:', sessionId);
    return defaultSession;
  }

  /**
   * Save session changes to storage
   */
  async persistSession(session: DefaultSession, sessionId?: string): Promise<string> {
    if (!sessionId) {
      // Use the persistence session ID from the session
      sessionId = session.getPersistenceSessionId();
    }
    
    if (!sessionId) {
      // Fallback to activity_id if no persistence session ID is set
      sessionId = session.activity_id;
    }

    const sessionObject: SessionObject = {
      processor_id: session.processor_id,
      activity_id: session.activity_id,
      request_id: session.request_id,
      interactions: []
    };

    // Collect all interactions
    for await (const interaction of session.get_interactions()) {
      sessionObject.interactions.push(interaction);
    }

    try {
      // Check if session exists
      const existing = await this._store.getSession(sessionId);
      
      if (existing) {
        // Update existing session
        await this._store.updateSession(sessionId, {
          interactions: sessionObject.interactions
        });
      } else {
        // Create new session
        const created = await this._store.createSession(sessionObject);
        // Return the actual session ID created by the store
        sessionId = created.session_id;
      }

      this._persistCount++;
      this._lastPersistTime = new Date();
      
      console.info('[SessionPersistenceManager][LOG] Session persisted:', sessionId);
      return sessionId;
    } catch (error) {
      this._errorCount++;
      console.error('[SessionPersistenceManager][ERROR] Failed to persist session:', sessionId, error);
      throw error;
    }
  }

  /**
   * Mark session for auto-persistence
   */
  markSessionForPersistence(sessionId: string): void {
    if (this._config.auto_persist_enabled) {
      this._sessionUpdateQueue.add(sessionId);
    }
  }

  /**
   * Remove session from management
   */
  async unmanageSession(sessionId: string, deleteFromStore = false): Promise<void> {
    this._activeSessions.delete(sessionId);
    this._sessionUpdateQueue.delete(sessionId);

    if (deleteFromStore) {
      await this._store.deleteSession(sessionId);
    }

    console.info('[SessionPersistenceManager][LOG] Session unmanaged:', sessionId);
  }

  // ========================================================================
  // Store Operations Delegation
  // ========================================================================

  async getSession(sessionId: string): Promise<PersistedSession | null> {
    return this._store.getSession(sessionId);
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Pick<PersistedSession, 'interactions' | 'metadata' | 'tags' | 'expires_at'>>,
    options?: { expected_version?: number }
  ): Promise<PersistedSession> {
    return this._store.updateSession(sessionId, updates, options);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    this._activeSessions.delete(sessionId);
    this._sessionUpdateQueue.delete(sessionId);
    return this._store.deleteSession(sessionId);
  }

  async hasSession(sessionId: string): Promise<boolean> {
    return this._store.hasSession(sessionId);
  }

  async listSessions(
    filter?: SessionFilter,
    options?: SessionQueryOptions
  ): Promise<PersistedSession[]> {
    return this._store.listSessions(filter, options);
  }

  async countSessions(filter?: SessionFilter): Promise<number> {
    return this._store.countSessions(filter);
  }

  async searchSessions(
    query: string,
    options?: SessionQueryOptions
  ): Promise<PersistedSession[]> {
    return this._store.searchSessions(query, options);
  }

  async getSessionsByProcessor(
    processorId: string,
    options?: SessionQueryOptions
  ): Promise<PersistedSession[]> {
    return this._store.getSessionsByProcessor(processorId, options);
  }

  async getActiveSessions(options?: SessionQueryOptions): Promise<PersistedSession[]> {
    return this._store.getActiveSessions(options);
  }

  async getExpiredSessions(options?: SessionQueryOptions): Promise<PersistedSession[]> {
    return this._store.getExpiredSessions(options);
  }

  // ========================================================================
  // Session Lifecycle Management
  // ========================================================================

  async setSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
    return this._store.setSessionExpiration(sessionId, expiresAt);
  }

  async extendSessionExpiration(sessionId: string, durationMs: number): Promise<void> {
    return this._store.extendSessionExpiration(sessionId, durationMs);
  }

  async refreshSession(sessionId: string): Promise<void> {
    return this._store.refreshSession(sessionId);
  }

  async expireSessions(): Promise<string[]> {
    const expiredIds = await this._store.expireSessions();
    
    // Remove expired sessions from management
    for (const sessionId of expiredIds) {
      this._activeSessions.delete(sessionId);
      this._sessionUpdateQueue.delete(sessionId);
    }
    
    return expiredIds;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const count = await this._store.cleanupExpiredSessions();
    console.info('[SessionPersistenceManager][LOG] Cleaned up expired sessions:', count);
    return count;
  }

  // ========================================================================
  // Transaction Support
  // ========================================================================

  async beginTransaction(): Promise<SessionTransaction> {
    return this._store.beginTransaction();
  }

  async withTransaction<T>(
    operation: (transaction: SessionTransaction) => Promise<T>
  ): Promise<T> {
    return this._store.withTransaction(operation);
  }

  // ========================================================================
  // Backup and Restore
  // ========================================================================

  async createBackup(
    options?: {
      include_expired?: boolean;
      filter?: SessionFilter;
    }
  ): Promise<SessionBackup> {
    return this._store.createBackup(options);
  }

  async restoreFromBackup(
    backup: SessionBackup,
    options?: {
      merge_strategy?: 'overwrite' | 'skip_existing' | 'update_newer';
      dry_run?: boolean;
    }
  ): Promise<{
    restored_count: number;
    skipped_count: number;
    errors: string[];
  }> {
    return this._store.restoreFromBackup(backup, options);
  }

  async listBackups(): Promise<Array<{
    backup_id: string;
    created_at: Date;
    session_count: number;
    size_bytes?: number;
  }>> {
    return this._store.listBackups();
  }

  async deleteBackup(backupId: string): Promise<boolean> {
    return this._store.deleteBackup(backupId);
  }

  // ========================================================================
  // Statistics and Monitoring
  // ========================================================================

  async getStats(): Promise<SessionPersistenceStats> {
    const storeStats = await this._store.getStats();
    
    return {
      ...storeStats,
      auto_persist_enabled: this._config.auto_persist_enabled,
      last_persist_time: this._lastPersistTime,
      persist_count: this._persistCount,
      error_count: this._errorCount,
      store_type: this._config.store_type
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    last_check: Date;
  }> {
    const storeHealth = await this._store.healthCheck();
    const issues = [...storeHealth.issues];
    
    // Check manager-specific health
    if (!this._initialized) {
      issues.push('Persistence manager not initialized');
    }
    
    if (this._config.auto_persist_enabled && !this._persistInterval) {
      issues.push('Auto-persist enabled but interval not running');
    }
    
    if (this._errorCount > 0) {
      issues.push(`Persistence errors detected: ${this._errorCount}`);
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      last_check: new Date()
    };
  }

  async optimize(): Promise<{
    operations_performed: string[];
    performance_impact: string;
  }> {
    const storeResult = await this._store.optimize();
    const operations = [...storeResult.operations_performed];
    
    // Perform manager-specific optimizations
    if (this._sessionUpdateQueue.size > 0) {
      await this._performAutoPersist();
      operations.push(`Flushed ${this._sessionUpdateQueue.size} pending session updates`);
    }
    
    // Clean up inactive managed sessions
    let cleanedSessions = 0;
    for (const [sessionId, session] of this._activeSessions) {
      const exists = await this._store.hasSession(sessionId);
      if (!exists) {
        this._activeSessions.delete(sessionId);
        cleanedSessions++;
      }
    }
    
    if (cleanedSessions > 0) {
      operations.push(`Cleaned up ${cleanedSessions} inactive managed sessions`);
    }
    
    return {
      operations_performed: operations,
      performance_impact: operations.length > storeResult.operations_performed.length ? 'Improved' : storeResult.performance_impact
    };
  }

  // ========================================================================
  // High-Level Convenience Methods
  // ========================================================================

  /**
   * Find sessions by criteria with convenience filtering
   */
  async findSessions(criteria: {
    processor_id?: string;
    since?: Date;
    until?: Date;
    has_interactions?: boolean;
    tags?: string[];
    limit?: number;
  }): Promise<PersistedSession[]> {
    const filter: SessionFilter = {
      processor_id: criteria.processor_id,
      created_after: criteria.since,
      created_before: criteria.until,
      has_interactions: criteria.has_interactions,
      tags: criteria.tags
    };
    
    const options: SessionQueryOptions = {
      limit: criteria.limit,
      sort_by: 'created_at',
      sort_order: 'desc'
    };
    
    return this.listSessions(filter, options);
  }

  /**
   * Get session summary with basic statistics
   */
  async getSessionSummary(sessionId: string): Promise<{
    session: PersistedSession;
    interaction_count: number;
    age_ms: number;
    time_since_update_ms: number;
    is_expired: boolean;
    is_managed: boolean;
  } | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }
    
    const now = Date.now();
    
    return {
      session,
      interaction_count: session.interactions.length,
      age_ms: now - session.created_at.getTime(),
      time_since_update_ms: now - session.updated_at.getTime(),
      is_expired: session.expires_at ? session.expires_at <= new Date() : false,
      is_managed: this._activeSessions.has(sessionId)
    };
  }

  /**
   * Bulk update sessions matching criteria
   */
  async bulkUpdateSessions(
    filter: SessionFilter,
    updates: Partial<Pick<PersistedSession, 'metadata' | 'tags' | 'expires_at'>>
  ): Promise<{
    updated_count: number;
    errors: string[];
  }> {
    const sessions = await this.listSessions(filter);
    let updated_count = 0;
    const errors: string[] = [];
    
    for (const session of sessions) {
      try {
        await this.updateSession(session.session_id, updates);
        updated_count++;
      } catch (error) {
        const errorMsg = `Failed to update session ${session.session_id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        errors.push(errorMsg);
      }
    }
    
    console.info('[SessionPersistenceManager][LOG] Bulk update completed:', { updated_count, error_count: errors.length });
    return { updated_count, errors };
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private _normalizeConfig(config: SessionPersistenceConfig): Omit<Required<SessionPersistenceConfig>, 'custom_store' | 'id_generator'> & {
    custom_store?: SessionStore;
    id_generator?: DefaultIdGenerator;
  } {
    return {
      store_type: config.store_type,
      store_config: config.store_config || {},
      filesystem_base_dir: config.filesystem_base_dir || './session_data',
      custom_store: config.custom_store,
      auto_persist_enabled: config.auto_persist_enabled ?? true,
      auto_persist_interval_ms: config.auto_persist_interval_ms ?? 30000, // 30 seconds
      auto_persist_on_interaction: config.auto_persist_on_interaction ?? true,
      default_session_ttl_ms: config.default_session_ttl_ms ?? 3600000, // 1 hour
      auto_cleanup_enabled: config.auto_cleanup_enabled ?? true,
      cleanup_interval_ms: config.cleanup_interval_ms ?? 300000, // 5 minutes
      enable_event_listeners: config.enable_event_listeners ?? true,
      id_generator: config.id_generator
    };
  }

  private async _createStore(): Promise<SessionStore> {
    switch (this._config.store_type) {
      case 'memory':
        return new InMemorySessionStore(this._idGenerator);
      
      case 'filesystem':
        return new FileSystemSessionStore(this._config.filesystem_base_dir, this._idGenerator);
      
      case 'custom':
        if (!this._config.custom_store) {
          throw new SessionStoreError('Custom store type specified but no custom_store provided', 'INVALID_CONFIG');
        }
        return this._config.custom_store;
      
      default:
        throw new SessionStoreError(`Unknown store type: ${this._config.store_type}`, 'INVALID_CONFIG');
    }
  }

  private _setupEventListeners(): void {
    // Set up store event listeners for monitoring and logging
    if (this._store.onSessionCreated) {
      this._store.onSessionCreated((session) => {
        console.info('[SessionPersistenceManager][EVENT] Session created:', session.session_id);
      });
    }

    if (this._store.onSessionUpdated) {
      this._store.onSessionUpdated((session, oldSession) => {
        console.info('[SessionPersistenceManager][EVENT] Session updated:', session.session_id);
      });
    }

    if (this._store.onSessionDeleted) {
      this._store.onSessionDeleted((sessionId) => {
        console.info('[SessionPersistenceManager][EVENT] Session deleted:', sessionId);
        this._activeSessions.delete(sessionId);
        this._sessionUpdateQueue.delete(sessionId);
      });
    }

    if (this._store.onSessionExpired) {
      this._store.onSessionExpired((session) => {
        console.info('[SessionPersistenceManager][EVENT] Session expired:', session.session_id);
        this._activeSessions.delete(session.session_id);
        this._sessionUpdateQueue.delete(session.session_id);
      });
    }

    if (this._store.onBackupCreated) {
      this._store.onBackupCreated((backup) => {
        console.info('[SessionPersistenceManager][EVENT] Backup created:', backup.backup_id);
      });
    }
  }

  private async _performAutoPersist(): Promise<void> {
    if (this._sessionUpdateQueue.size === 0) {
      return;
    }

    const sessionIds = Array.from(this._sessionUpdateQueue);
    this._sessionUpdateQueue.clear();
    
    let persistedCount = 0;
    
    for (const sessionId of sessionIds) {
      const session = this._activeSessions.get(sessionId);
      if (!session) {
        continue;
      }
      
      try {
        await this.persistSession(session, sessionId);
        persistedCount++;
      } catch (error) {
        console.error('[SessionPersistenceManager][ERROR] Auto-persist failed for session:', sessionId, error);
        // Re-queue for next attempt
        this._sessionUpdateQueue.add(sessionId);
      }
    }
    
    if (persistedCount > 0) {
      console.info('[SessionPersistenceManager][LOG] Auto-persist completed:', persistedCount, 'sessions');
    }
  }
}