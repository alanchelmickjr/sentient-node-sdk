import { ulid } from 'ulid';
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
  SessionConflictError,
  TransactionError
} from '../interface/session_store';
import { SessionObject, Interaction, RequestMessage } from '../interface/session';
import { DefaultIdGenerator } from './default_id_generator';

/**
 * In-memory transaction implementation
 */
class InMemoryTransaction implements SessionTransaction {
  private _isActive = true;
  private _operations: Array<() => void> = [];
  private _rollbackOperations: Array<() => void> = [];

  constructor(
    public readonly transaction_id: string,
    public readonly started_at: Date
  ) {}

  addOperation(operation: () => void, rollback: () => void): void {
    if (!this._isActive) {
      throw new TransactionError(this.transaction_id, 'Transaction is not active');
    }
    this._operations.push(operation);
    this._rollbackOperations.unshift(rollback); // LIFO for rollback
  }

  async commit(): Promise<void> {
    if (!this._isActive) {
      throw new TransactionError(this.transaction_id, 'Transaction already completed');
    }
    
    try {
      // Execute all operations
      for (const operation of this._operations) {
        operation();
      }
      this._isActive = false;
    } catch (error) {
      // Rollback on failure
      await this.rollback();
      throw new TransactionError(
        this.transaction_id, 
        `Commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async rollback(): Promise<void> {
    if (!this._isActive) {
      return; // Already completed
    }
    
    try {
      // Execute rollback operations in reverse order
      for (const rollback of this._rollbackOperations) {
        rollback();
      }
    } finally {
      this._isActive = false;
    }
  }

  isActive(): boolean {
    return this._isActive;
  }
}

/**
 * In-memory implementation of SessionStore for development and testing
 */
export class InMemorySessionStore implements SessionStore {
  private _sessions: Map<string, PersistedSession> = new Map();
  private _config: SessionStoreConfig = {};
  private _idGenerator: DefaultIdGenerator;
  private _initialized = false;
  private _cleanupInterval?: NodeJS.Timeout;
  private _backupInterval?: NodeJS.Timeout;
  private _backups: Map<string, SessionBackup> = new Map();

  // Event listeners
  private _sessionCreatedListeners: Array<(session: PersistedSession) => void> = [];
  private _sessionUpdatedListeners: Array<(session: PersistedSession, oldSession: PersistedSession) => void> = [];
  private _sessionDeletedListeners: Array<(sessionId: string) => void> = [];
  private _sessionExpiredListeners: Array<(session: PersistedSession) => void> = [];
  private _backupCreatedListeners: Array<(backup: SessionBackup) => void> = [];

  constructor(idGenerator?: DefaultIdGenerator) {
    this._idGenerator = idGenerator || new DefaultIdGenerator();
  }

  // ========================================================================
  // Initialization and Configuration
  // ========================================================================

  async initialize(config: SessionStoreConfig = {}): Promise<void> {
    if (this._initialized) {
      return;
    }

    this._config = {
      auto_cleanup_enabled: true,
      cleanup_interval_ms: 60000, // 1 minute
      default_session_ttl_ms: 3600000, // 1 hour
      max_sessions: 10000,
      compression_enabled: false,
      encryption_enabled: false,
      backup_enabled: false,
      backup_interval_ms: 300000, // 5 minutes
      max_backups: 10,
      ...config
    };

    // Start cleanup interval if enabled
    if (this._config.auto_cleanup_enabled && this._config.cleanup_interval_ms) {
      this._cleanupInterval = setInterval(() => {
        this.cleanupExpiredSessions().catch(console.error);
      }, this._config.cleanup_interval_ms);
    }

    // Start backup interval if enabled
    if (this._config.backup_enabled && this._config.backup_interval_ms) {
      this._backupInterval = setInterval(() => {
        this.createBackup().catch(console.error);
      }, this._config.backup_interval_ms);
    }

    this._initialized = true;
    console.info('[InMemorySessionStore][LOG] Initialized with config:', this._config);
  }

  async shutdown(): Promise<void> {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = undefined;
    }
    
    if (this._backupInterval) {
      clearInterval(this._backupInterval);
      this._backupInterval = undefined;
    }

    this._sessions.clear();
    this._backups.clear();
    this._initialized = false;
    console.info('[InMemorySessionStore][LOG] Shutdown complete');
  }

  getConfig(): SessionStoreConfig {
    return { ...this._config };
  }

  async updateConfig(config: Partial<SessionStoreConfig>): Promise<void> {
    this._config = { ...this._config, ...config };
    console.info('[InMemorySessionStore][LOG] Config updated:', config);
  }

  // ========================================================================
  // CRUD Operations
  // ========================================================================

  async createSession(
    sessionObject: SessionObject,
    options: {
      expires_at?: Date;
      metadata?: Record<string, any>;
      tags?: string[];
    } = {}
  ): Promise<PersistedSession> {
    const sessionId = await this._idGenerator.getNextId();
    const now = new Date();
    const expiresAt = options.expires_at || (
      this._config.default_session_ttl_ms ? 
      new Date(now.getTime() + this._config.default_session_ttl_ms) : 
      undefined
    );

    // Check session limit
    if (this._config.max_sessions && this._sessions.size >= this._config.max_sessions) {
      // Try to cleanup expired sessions first
      await this.cleanupExpiredSessions();
      if (this._sessions.size >= this._config.max_sessions) {
        throw new Error(`Session limit reached: ${this._config.max_sessions}`);
      }
    }

    const persistedSession: PersistedSession = {
      session_id: sessionId,
      processor_id: sessionObject.processor_id,
      activity_id: sessionObject.activity_id,
      request_id: sessionObject.request_id,
      interactions: [...sessionObject.interactions],
      created_at: now,
      updated_at: now,
      expires_at: expiresAt,
      metadata: options.metadata || {},
      tags: options.tags || [],
      version: 1
    };

    this._sessions.set(sessionId, persistedSession);
    
    // Notify listeners
    for (const listener of this._sessionCreatedListeners) {
      try {
        listener(persistedSession);
      } catch (error) {
        console.error('[InMemorySessionStore][ERROR] Session created listener error:', error);
      }
    }

    console.info('[InMemorySessionStore][LOG] Session created:', sessionId);
    return persistedSession;
  }

  async getSession(sessionId: string): Promise<PersistedSession | null> {
    const session = this._sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expires_at && session.expires_at <= new Date()) {
      return null;
    }

    return { ...session, interactions: [...session.interactions] };
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Pick<PersistedSession, 'interactions' | 'metadata' | 'tags' | 'expires_at'>>,
    options: { expected_version?: number } = {}
  ): Promise<PersistedSession> {
    const existingSession = this._sessions.get(sessionId);
    if (!existingSession) {
      throw new SessionNotFoundError(sessionId);
    }

    // Check version for optimistic locking
    if (options.expected_version !== undefined && existingSession.version !== options.expected_version) {
      throw new SessionConflictError(
        sessionId,
        `Version mismatch. Expected ${options.expected_version}, got ${existingSession.version}`
      );
    }

    const oldSession = { ...existingSession };
    const updatedSession: PersistedSession = {
      ...existingSession,
      ...updates,
      updated_at: new Date(),
      version: existingSession.version + 1
    };

    // Deep copy interactions if provided
    if (updates.interactions) {
      updatedSession.interactions = [...updates.interactions];
    }

    this._sessions.set(sessionId, updatedSession);
    
    // Notify listeners
    for (const listener of this._sessionUpdatedListeners) {
      try {
        listener(updatedSession, oldSession);
      } catch (error) {
        console.error('[InMemorySessionStore][ERROR] Session updated listener error:', error);
      }
    }

    console.info('[InMemorySessionStore][LOG] Session updated:', sessionId);
    return updatedSession;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const existed = this._sessions.delete(sessionId);
    
    if (existed) {
      // Notify listeners
      for (const listener of this._sessionDeletedListeners) {
        try {
          listener(sessionId);
        } catch (error) {
          console.error('[InMemorySessionStore][ERROR] Session deleted listener error:', error);
        }
      }
      
      console.info('[InMemorySessionStore][LOG] Session deleted:', sessionId);
    }
    
    return existed;
  }

  async hasSession(sessionId: string): Promise<boolean> {
    const session = this._sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Check if session is expired
    if (session.expires_at && session.expires_at <= new Date()) {
      return false;
    }

    return true;
  }

  // ========================================================================
  // Query Operations
  // ========================================================================

  async listSessions(
    filter: SessionFilter = {},
    options: SessionQueryOptions = {}
  ): Promise<PersistedSession[]> {
    let sessions = Array.from(this._sessions.values());
    
    // Apply filters
    sessions = this._applyFilter(sessions, filter);
    
    // Apply sorting
    sessions = this._applySorting(sessions, options);
    
    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit;
    
    if (limit !== undefined) {
      sessions = sessions.slice(offset, offset + limit);
    } else if (offset > 0) {
      sessions = sessions.slice(offset);
    }
    
    // Deep copy to prevent mutations
    return sessions.map(session => ({
      ...session,
      interactions: [...session.interactions]
    }));
  }

  async countSessions(filter: SessionFilter = {}): Promise<number> {
    const sessions = Array.from(this._sessions.values());
    return this._applyFilter(sessions, filter).length;
  }

  async searchSessions(
    query: string,
    options: SessionQueryOptions = {}
  ): Promise<PersistedSession[]> {
    const searchTerm = query.toLowerCase();
    let sessions = Array.from(this._sessions.values()).filter(session => {
      return (
        session.processor_id.toLowerCase().includes(searchTerm) ||
        session.activity_id.toLowerCase().includes(searchTerm) ||
        session.request_id.toLowerCase().includes(searchTerm) ||
        session.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
        Object.values(session.metadata).some(value => 
          String(value).toLowerCase().includes(searchTerm)
        )
      );
    });
    
    // Apply sorting
    sessions = this._applySorting(sessions, options);
    
    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit;
    
    if (limit !== undefined) {
      sessions = sessions.slice(offset, offset + limit);
    } else if (offset > 0) {
      sessions = sessions.slice(offset);
    }
    
    return sessions.map(session => ({
      ...session,
      interactions: [...session.interactions]
    }));
  }

  async getSessionsByProcessor(
    processorId: string,
    options: SessionQueryOptions = {}
  ): Promise<PersistedSession[]> {
    return this.listSessions({ processor_id: processorId }, options);
  }

  async getActiveSessions(options: SessionQueryOptions = {}): Promise<PersistedSession[]> {
    const now = new Date();
    let sessions = Array.from(this._sessions.values()).filter(session => 
      !session.expires_at || session.expires_at > now
    );
    
    sessions = this._applySorting(sessions, options);
    
    const offset = options.offset || 0;
    const limit = options.limit;
    
    if (limit !== undefined) {
      sessions = sessions.slice(offset, offset + limit);
    } else if (offset > 0) {
      sessions = sessions.slice(offset);
    }
    
    return sessions.map(session => ({
      ...session,
      interactions: [...session.interactions]
    }));
  }

  async getExpiredSessions(options: SessionQueryOptions = {}): Promise<PersistedSession[]> {
    const now = new Date();
    let sessions = Array.from(this._sessions.values()).filter(session => 
      session.expires_at && session.expires_at <= now
    );
    
    sessions = this._applySorting(sessions, options);
    
    const offset = options.offset || 0;
    const limit = options.limit;
    
    if (limit !== undefined) {
      sessions = sessions.slice(offset, offset + limit);
    } else if (offset > 0) {
      sessions = sessions.slice(offset);
    }
    
    return sessions.map(session => ({
      ...session,
      interactions: [...session.interactions]
    }));
  }

  // ========================================================================
  // Session Lifecycle Management
  // ========================================================================

  async setSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    session.expires_at = expiresAt;
    session.updated_at = new Date();
    session.version++;
    
    console.info('[InMemorySessionStore][LOG] Session expiration set:', sessionId, expiresAt);
  }

  async extendSessionExpiration(sessionId: string, durationMs: number): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const currentExpiry = session.expires_at || new Date();
    session.expires_at = new Date(currentExpiry.getTime() + durationMs);
    session.updated_at = new Date();
    session.version++;
    
    console.info('[InMemorySessionStore][LOG] Session expiration extended:', sessionId, durationMs);
  }

  async refreshSession(sessionId: string): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    session.updated_at = new Date();
    console.info('[InMemorySessionStore][LOG] Session refreshed:', sessionId);
  }

  async expireSessions(): Promise<string[]> {
    const now = new Date();
    const expiredSessionIds: string[] = [];
    
    for (const [sessionId, session] of this._sessions) {
      if (session.expires_at && session.expires_at <= now) {
        expiredSessionIds.push(sessionId);
        
        // Notify listeners
        for (const listener of this._sessionExpiredListeners) {
          try {
            listener(session);
          } catch (error) {
            console.error('[InMemorySessionStore][ERROR] Session expired listener error:', error);
          }
        }
      }
    }
    
    console.info('[InMemorySessionStore][LOG] Sessions expired:', expiredSessionIds.length);
    return expiredSessionIds;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const expiredIds = await this.expireSessions();
    let cleanedCount = 0;
    
    for (const sessionId of expiredIds) {
      if (await this.deleteSession(sessionId)) {
        cleanedCount++;
      }
    }
    
    console.info('[InMemorySessionStore][LOG] Expired sessions cleaned:', cleanedCount);
    return cleanedCount;
  }

  // ========================================================================
  // Transaction Support
  // ========================================================================

  async beginTransaction(): Promise<SessionTransaction> {
    const transactionId = await this._idGenerator.getNextId();
    const transaction = new InMemoryTransaction(transactionId, new Date());
    
    console.info('[InMemorySessionStore][LOG] Transaction started:', transactionId);
    return transaction;
  }

  async withTransaction<T>(
    operation: (transaction: SessionTransaction) => Promise<T>
  ): Promise<T> {
    const transaction = await this.beginTransaction();
    
    try {
      const result = await operation(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // ========================================================================
  // Backup and Restore
  // ========================================================================

  async createBackup(
    options: {
      include_expired?: boolean;
      filter?: SessionFilter;
    } = {}
  ): Promise<SessionBackup> {
    const backupId = await this._idGenerator.getNextId();
    const now = new Date();
    
    let sessions = Array.from(this._sessions.values());
    
    // Filter out expired sessions if requested
    if (!options.include_expired) {
      sessions = sessions.filter(session => 
        !session.expires_at || session.expires_at > now
      );
    }
    
    // Apply additional filter if provided
    if (options.filter) {
      sessions = this._applyFilter(sessions, options.filter);
    }
    
    // Deep copy sessions for backup
    const backupSessions = sessions.map(session => ({
      ...session,
      interactions: [...session.interactions]
    }));
    
    const backup: SessionBackup = {
      backup_id: backupId,
      created_at: now,
      sessions: backupSessions,
      metadata: {
        total_sessions: backupSessions.length,
        backup_format_version: '1.0',
        source_store_type: 'in-memory'
      }
    };
    
    this._backups.set(backupId, backup);
    
    // Cleanup old backups if limit exceeded
    if (this._config.max_backups && this._backups.size > this._config.max_backups) {
      const sortedBackups = Array.from(this._backups.entries())
        .sort(([, a], [, b]) => a.created_at.getTime() - b.created_at.getTime());
      
      const toDelete = sortedBackups.slice(0, this._backups.size - this._config.max_backups);
      for (const [backupId] of toDelete) {
        this._backups.delete(backupId);
      }
    }
    
    // Notify listeners
    for (const listener of this._backupCreatedListeners) {
      try {
        listener(backup);
      } catch (error) {
        console.error('[InMemorySessionStore][ERROR] Backup created listener error:', error);
      }
    }
    
    console.info('[InMemorySessionStore][LOG] Backup created:', backupId, backupSessions.length, 'sessions');
    return backup;
  }

  async restoreFromBackup(
    backup: SessionBackup,
    options: {
      merge_strategy?: 'overwrite' | 'skip_existing' | 'update_newer';
      dry_run?: boolean;
    } = {}
  ): Promise<{
    restored_count: number;
    skipped_count: number;
    errors: string[];
  }> {
    const { merge_strategy = 'skip_existing', dry_run = false } = options;
    const errors: string[] = [];
    let restored_count = 0;
    let skipped_count = 0;
    
    for (const session of backup.sessions) {
      try {
        const existing = this._sessions.get(session.session_id);
        
        if (existing) {
          switch (merge_strategy) {
            case 'skip_existing':
              skipped_count++;
              continue;
            case 'update_newer':
              if (existing.updated_at >= session.updated_at) {
                skipped_count++;
                continue;
              }
              break;
            case 'overwrite':
              // Will overwrite
              break;
          }
        }
        
        if (!dry_run) {
          this._sessions.set(session.session_id, {
            ...session,
            interactions: [...session.interactions]
          });
        }
        
        restored_count++;
      } catch (error) {
        const errorMsg = `Failed to restore session ${session.session_id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        errors.push(errorMsg);
        console.error('[InMemorySessionStore][ERROR]', errorMsg);
      }
    }
    
    const result = { restored_count, skipped_count, errors };
    console.info('[InMemorySessionStore][LOG] Backup restore completed:', result);
    return result;
  }

  async listBackups(): Promise<Array<{
    backup_id: string;
    created_at: Date;
    session_count: number;
    size_bytes?: number;
  }>> {
    return Array.from(this._backups.values()).map(backup => ({
      backup_id: backup.backup_id,
      created_at: backup.created_at,
      session_count: backup.sessions.length,
      size_bytes: JSON.stringify(backup).length
    }));
  }

  async deleteBackup(backupId: string): Promise<boolean> {
    const deleted = this._backups.delete(backupId);
    if (deleted) {
      console.info('[InMemorySessionStore][LOG] Backup deleted:', backupId);
    }
    return deleted;
  }

  // ========================================================================
  // Statistics and Monitoring
  // ========================================================================

  async getStats(): Promise<SessionStoreStats> {
    const sessions = Array.from(this._sessions.values());
    const now = new Date();
    const activeSessions = sessions.filter(s => !s.expires_at || s.expires_at > now);
    const expiredSessions = sessions.filter(s => s.expires_at && s.expires_at <= now);
    
    const sessionsByProcessor: Record<string, number> = {};
    for (const session of sessions) {
      sessionsByProcessor[session.processor_id] = 
        (sessionsByProcessor[session.processor_id] || 0) + 1;
    }
    
    const createdTimes = sessions.map(s => s.created_at);
    const oldestSession = createdTimes.length > 0 ? new Date(Math.min(...createdTimes.map(d => d.getTime()))) : undefined;
    const newestSession = createdTimes.length > 0 ? new Date(Math.max(...createdTimes.map(d => d.getTime()))) : undefined;
    
    return {
      total_sessions: sessions.length,
      active_sessions: activeSessions.length,
      expired_sessions: expiredSessions.length,
      sessions_by_processor: sessionsByProcessor,
      storage_size_bytes: JSON.stringify(sessions).length,
      oldest_session: oldestSession,
      newest_session: newestSession
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    last_check: Date;
  }> {
    const issues: string[] = [];
    const now = new Date();
    
    // Check if initialized
    if (!this._initialized) {
      issues.push('Store not initialized');
    }
    
    // Check session limit
    if (this._config.max_sessions && this._sessions.size >= this._config.max_sessions) {
      issues.push(`Session limit reached: ${this._sessions.size}/${this._config.max_sessions}`);
    }
    
    // Check for memory usage (basic check)
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
      issues.push(`High memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      last_check: now
    };
  }

  async optimize(): Promise<{
    operations_performed: string[];
    performance_impact: string;
  }> {
    const operations: string[] = [];
    
    // Clean up expired sessions
    const cleanedCount = await this.cleanupExpiredSessions();
    if (cleanedCount > 0) {
      operations.push(`Cleaned up ${cleanedCount} expired sessions`);
    }
    
    // Cleanup old backups
    const maxBackups = this._config.max_backups || 10;
    if (this._backups.size > maxBackups) {
      const toDelete = this._backups.size - maxBackups;
      const sortedBackups = Array.from(this._backups.entries())
        .sort(([, a], [, b]) => a.created_at.getTime() - b.created_at.getTime())
        .slice(0, toDelete);
      
      for (const [backupId] of sortedBackups) {
        this._backups.delete(backupId);
      }
      operations.push(`Cleaned up ${toDelete} old backups`);
    }
    
    return {
      operations_performed: operations,
      performance_impact: operations.length > 0 ? 'Minor improvement' : 'No changes needed'
    };
  }

  // ========================================================================
  // Event Hooks
  // ========================================================================

  onSessionCreated(callback: (session: PersistedSession) => void): void {
    this._sessionCreatedListeners.push(callback);
  }

  onSessionUpdated(callback: (session: PersistedSession, oldSession: PersistedSession) => void): void {
    this._sessionUpdatedListeners.push(callback);
  }

  onSessionDeleted(callback: (sessionId: string) => void): void {
    this._sessionDeletedListeners.push(callback);
  }

  onSessionExpired(callback: (session: PersistedSession) => void): void {
    this._sessionExpiredListeners.push(callback);
  }

  onBackupCreated(callback: (backup: SessionBackup) => void): void {
    this._backupCreatedListeners.push(callback);
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private _applyFilter(sessions: PersistedSession[], filter: SessionFilter): PersistedSession[] {
    return sessions.filter(session => {
      // Processor ID filter
      if (filter.processor_id !== undefined) {
        const processorIds = Array.isArray(filter.processor_id) ? filter.processor_id : [filter.processor_id];
        if (!processorIds.includes(session.processor_id)) {
          return false;
        }
      }
      
      // Activity ID filter
      if (filter.activity_id !== undefined) {
        const activityIds = Array.isArray(filter.activity_id) ? filter.activity_id : [filter.activity_id];
        if (!activityIds.includes(session.activity_id)) {
          return false;
        }
      }
      
      // Request ID filter
      if (filter.request_id !== undefined) {
        const requestIds = Array.isArray(filter.request_id) ? filter.request_id : [filter.request_id];
        if (!requestIds.includes(session.request_id)) {
          return false;
        }
      }
      
      // Date filters
      if (filter.created_after && session.created_at <= filter.created_after) {
        return false;
      }
      if (filter.created_before && session.created_at >= filter.created_before) {
        return false;
      }
      if (filter.updated_after && session.updated_at <= filter.updated_after) {
        return false;
      }
      if (filter.updated_before && session.updated_at >= filter.updated_before) {
        return false;
      }
      
      // Expiration filters
      if (filter.expires_after && (!session.expires_at || session.expires_at <= filter.expires_after)) {
        return false;
      }
      if (filter.expires_before && (!session.expires_at || session.expires_at >= filter.expires_before)) {
        return false;
      }
      
      // Interactions filter
      if (filter.has_interactions !== undefined) {
        const hasInteractions = session.interactions.length > 0;
        if (filter.has_interactions !== hasInteractions) {
          return false;
        }
      }
      
      if (filter.interaction_count_min !== undefined && session.interactions.length < filter.interaction_count_min) {
        return false;
      }
      if (filter.interaction_count_max !== undefined && session.interactions.length > filter.interaction_count_max) {
        return false;
      }
      
      // Metadata filter
      if (filter.metadata) {
        for (const [key, value] of Object.entries(filter.metadata)) {
          if (session.metadata[key] !== value) {
            return false;
          }
        }
      }
      
      // Tags filter
      if (filter.tags && filter.tags.length > 0) {
        const sessionTags = new Set(session.tags);
        if (!filter.tags.some(tag => sessionTags.has(tag))) {
          return false;
        }
      }
      
      return true;
    });
  }

  private _applySorting(sessions: PersistedSession[], options: SessionQueryOptions): PersistedSession[] {
    const { sort_by = 'created_at', sort_order = 'desc' } = options;
    
    return sessions.sort((a, b) => {
      let comparison = 0;
      
      switch (sort_by) {
        case 'created_at':
          comparison = a.created_at.getTime() - b.created_at.getTime();
          break;
        case 'updated_at':
          comparison = a.updated_at.getTime() - b.updated_at.getTime();
          break;
        case 'expires_at':
          const aExpires = a.expires_at?.getTime() ?? Infinity;
          const bExpires = b.expires_at?.getTime() ?? Infinity;
          comparison = aExpires - bExpires;
          break;
        case 'activity_id':
          comparison = a.activity_id.localeCompare(b.activity_id);
          break;
        default:
          comparison = 0;
      }
      
      return sort_order === 'asc' ? comparison : -comparison;
    });
  }
}