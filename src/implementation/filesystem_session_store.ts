import * as fs from 'fs/promises';
import * as path from 'path';
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
import { SessionObject } from '../interface/session';
import { DefaultIdGenerator } from './default_id_generator';
import { SessionSerializer, SessionDataUtils } from './session_serialization';

/**
 * Filesystem-based transaction implementation
 */
class FileSystemTransaction implements SessionTransaction {
  private _isActive = true;
  private _operations: Array<() => Promise<void>> = [];
  private _rollbackOperations: Array<() => Promise<void>> = [];

  constructor(
    public readonly transaction_id: string,
    public readonly started_at: Date
  ) {}

  addOperation(operation: () => Promise<void>, rollback: () => Promise<void>): void {
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
        await operation();
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
        try {
          await rollback();
        } catch (rollbackError) {
          console.error('[FileSystemTransaction][ERROR] Rollback operation failed:', rollbackError);
        }
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
 * Filesystem-based implementation of SessionStore
 */
export class FileSystemSessionStore implements SessionStore {
  private _config: SessionStoreConfig = {};
  private _idGenerator: DefaultIdGenerator;
  private _initialized = false;
  private _cleanupInterval?: NodeJS.Timeout;
  private _backupInterval?: NodeJS.Timeout;
  
  // Directory structure
  private _sessionsDir!: string;
  private _backupsDir!: string;
  private _indexDir!: string;
  private _tempDir!: string;

  // Event listeners
  private _sessionCreatedListeners: Array<(session: PersistedSession) => void> = [];
  private _sessionUpdatedListeners: Array<(session: PersistedSession, oldSession: PersistedSession) => void> = [];
  private _sessionDeletedListeners: Array<(sessionId: string) => void> = [];
  private _sessionExpiredListeners: Array<(session: PersistedSession) => void> = [];
  private _backupCreatedListeners: Array<(backup: SessionBackup) => void> = [];

  constructor(
    private _baseDir: string = './session_data',
    idGenerator?: DefaultIdGenerator
  ) {
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
      max_sessions: 100000,
      compression_enabled: false,
      encryption_enabled: false,
      backup_enabled: true,
      backup_interval_ms: 300000, // 5 minutes
      max_backups: 10,
      ...config
    };

    // Setup directory structure
    this._sessionsDir = path.join(this._baseDir, 'sessions');
    this._backupsDir = path.join(this._baseDir, 'backups');
    this._indexDir = path.join(this._baseDir, 'indexes');
    this._tempDir = path.join(this._baseDir, 'temp');

    // Create directories
    await this._ensureDirectories();

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
    console.info('[FileSystemSessionStore][LOG] Initialized with base directory:', this._baseDir);
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

    this._initialized = false;
    console.info('[FileSystemSessionStore][LOG] Shutdown complete');
  }

  getConfig(): SessionStoreConfig {
    return { ...this._config };
  }

  async updateConfig(config: Partial<SessionStoreConfig>): Promise<void> {
    this._config = { ...this._config, ...config };
    console.info('[FileSystemSessionStore][LOG] Config updated:', config);
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
    if (this._config.max_sessions) {
      const currentCount = await this._countSessionFiles();
      if (currentCount >= this._config.max_sessions) {
        // Try to cleanup expired sessions first
        await this.cleanupExpiredSessions();
        const updatedCount = await this._countSessionFiles();
        if (updatedCount >= this._config.max_sessions) {
          throw new Error(`Session limit reached: ${this._config.max_sessions}`);
        }
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

    // Write session to file
    await this._writeSessionFile(sessionId, persistedSession);
    
    // Update indexes
    await this._updateIndexes(persistedSession, 'create');

    // Notify listeners
    for (const listener of this._sessionCreatedListeners) {
      try {
        listener(persistedSession);
      } catch (error) {
        console.error('[FileSystemSessionStore][ERROR] Session created listener error:', error);
      }
    }

    console.info('[FileSystemSessionStore][LOG] Session created:', sessionId);
    return persistedSession;
  }

  async getSession(sessionId: string): Promise<PersistedSession | null> {
    try {
      const session = await this._readSessionFile(sessionId);
      if (!session) {
        return null;
      }

      // Check if session is expired
      if (session.expires_at && session.expires_at <= new Date()) {
        return null;
      }

      return session;
    } catch (error) {
      if (this._isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Pick<PersistedSession, 'interactions' | 'metadata' | 'tags' | 'expires_at'>>,
    options: { expected_version?: number } = {}
  ): Promise<PersistedSession> {
    const existingSession = await this._readSessionFile(sessionId);
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

    // Write updated session to file
    await this._writeSessionFile(sessionId, updatedSession);
    
    // Update indexes
    await this._updateIndexes(updatedSession, 'update', oldSession);

    // Notify listeners
    for (const listener of this._sessionUpdatedListeners) {
      try {
        listener(updatedSession, oldSession);
      } catch (error) {
        console.error('[FileSystemSessionStore][ERROR] Session updated listener error:', error);
      }
    }

    console.info('[FileSystemSessionStore][LOG] Session updated:', sessionId);
    return updatedSession;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this._readSessionFile(sessionId);
      if (!session) {
        return false;
      }

      // Delete session file
      await this._deleteSessionFile(sessionId);
      
      // Update indexes
      await this._updateIndexes(session, 'delete');

      // Notify listeners
      for (const listener of this._sessionDeletedListeners) {
        try {
          listener(sessionId);
        } catch (error) {
          console.error('[FileSystemSessionStore][ERROR] Session deleted listener error:', error);
        }
      }
      
      console.info('[FileSystemSessionStore][LOG] Session deleted:', sessionId);
      return true;
    } catch (error) {
      if (this._isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  async hasSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this._readSessionFile(sessionId);
      if (!session) {
        return false;
      }

      // Check if session is expired
      if (session.expires_at && session.expires_at <= new Date()) {
        return false;
      }

      return true;
    } catch (error) {
      if (this._isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  // ========================================================================
  // Query Operations
  // ========================================================================

  async listSessions(
    filter: SessionFilter = {},
    options: SessionQueryOptions = {}
  ): Promise<PersistedSession[]> {
    const sessionFiles = await this._getAllSessionFiles();
    const sessions: PersistedSession[] = [];

    // Read and filter sessions
    for (const filename of sessionFiles) {
      try {
        const session = await this._readSessionFile(this._extractSessionId(filename));
        if (session && this._matchesFilter(session, filter)) {
          sessions.push(session);
        }
      } catch (error) {
        console.warn('[FileSystemSessionStore][WARN] Failed to read session file:', filename, error);
      }
    }

    // Apply sorting
    this._applySorting(sessions, options);
    
    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit;
    
    if (limit !== undefined) {
      return sessions.slice(offset, offset + limit);
    } else if (offset > 0) {
      return sessions.slice(offset);
    }
    
    return sessions;
  }

  async countSessions(filter: SessionFilter = {}): Promise<number> {
    const sessions = await this.listSessions(filter);
    return sessions.length;
  }

  async searchSessions(
    query: string,
    options: SessionQueryOptions = {}
  ): Promise<PersistedSession[]> {
    const searchTerm = query.toLowerCase();
    const sessionFiles = await this._getAllSessionFiles();
    const sessions: PersistedSession[] = [];

    // Read and search sessions
    for (const filename of sessionFiles) {
      try {
        const session = await this._readSessionFile(this._extractSessionId(filename));
        if (session && this._matchesSearchTerm(session, searchTerm)) {
          sessions.push(session);
        }
      } catch (error) {
        console.warn('[FileSystemSessionStore][WARN] Failed to read session file:', filename, error);
      }
    }
    
    // Apply sorting
    this._applySorting(sessions, options);
    
    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit;
    
    if (limit !== undefined) {
      return sessions.slice(offset, offset + limit);
    } else if (offset > 0) {
      return sessions.slice(offset);
    }
    
    return sessions;
  }

  async getSessionsByProcessor(
    processorId: string,
    options: SessionQueryOptions = {}
  ): Promise<PersistedSession[]> {
    return this.listSessions({ processor_id: processorId }, options);
  }

  async getActiveSessions(options: SessionQueryOptions = {}): Promise<PersistedSession[]> {
    const now = new Date();
    const sessionFiles = await this._getAllSessionFiles();
    const sessions: PersistedSession[] = [];

    for (const filename of sessionFiles) {
      try {
        const session = await this._readSessionFile(this._extractSessionId(filename));
        if (session && (!session.expires_at || session.expires_at > now)) {
          sessions.push(session);
        }
      } catch (error) {
        console.warn('[FileSystemSessionStore][WARN] Failed to read session file:', filename, error);
      }
    }
    
    this._applySorting(sessions, options);
    
    const offset = options.offset || 0;
    const limit = options.limit;
    
    if (limit !== undefined) {
      return sessions.slice(offset, offset + limit);
    } else if (offset > 0) {
      return sessions.slice(offset);
    }
    
    return sessions;
  }

  async getExpiredSessions(options: SessionQueryOptions = {}): Promise<PersistedSession[]> {
    const now = new Date();
    const sessionFiles = await this._getAllSessionFiles();
    const sessions: PersistedSession[] = [];

    for (const filename of sessionFiles) {
      try {
        const session = await this._readSessionFile(this._extractSessionId(filename));
        if (session && session.expires_at && session.expires_at <= now) {
          sessions.push(session);
        }
      } catch (error) {
        console.warn('[FileSystemSessionStore][WARN] Failed to read session file:', filename, error);
      }
    }
    
    this._applySorting(sessions, options);
    
    const offset = options.offset || 0;
    const limit = options.limit;
    
    if (limit !== undefined) {
      return sessions.slice(offset, offset + limit);
    } else if (offset > 0) {
      return sessions.slice(offset);
    }
    
    return sessions;
  }

  // ========================================================================
  // Session Lifecycle Management
  // ========================================================================

  async setSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
    await this.updateSession(sessionId, { expires_at: expiresAt });
    console.info('[FileSystemSessionStore][LOG] Session expiration set:', sessionId, expiresAt);
  }

  async extendSessionExpiration(sessionId: string, durationMs: number): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const currentExpiry = session.expires_at || new Date();
    const newExpiry = new Date(currentExpiry.getTime() + durationMs);
    
    await this.updateSession(sessionId, { expires_at: newExpiry });
    console.info('[FileSystemSessionStore][LOG] Session expiration extended:', sessionId, durationMs);
  }

  async refreshSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Just update the session to refresh updated_at timestamp
    await this.updateSession(sessionId, {});
    console.info('[FileSystemSessionStore][LOG] Session refreshed:', sessionId);
  }

  async expireSessions(): Promise<string[]> {
    const now = new Date();
    const expiredSessions = await this.getExpiredSessions();
    const expiredSessionIds: string[] = [];
    
    for (const session of expiredSessions) {
      expiredSessionIds.push(session.session_id);
      
      // Notify listeners
      for (const listener of this._sessionExpiredListeners) {
        try {
          listener(session);
        } catch (error) {
          console.error('[FileSystemSessionStore][ERROR] Session expired listener error:', error);
        }
      }
    }
    
    console.info('[FileSystemSessionStore][LOG] Sessions expired:', expiredSessionIds.length);
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
    
    console.info('[FileSystemSessionStore][LOG] Expired sessions cleaned:', cleanedCount);
    return cleanedCount;
  }

  // ========================================================================
  // Transaction Support
  // ========================================================================

  async beginTransaction(): Promise<SessionTransaction> {
    const transactionId = await this._idGenerator.getNextId();
    const transaction = new FileSystemTransaction(transactionId, new Date());
    
    console.info('[FileSystemSessionStore][LOG] Transaction started:', transactionId);
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
    
    let sessions: PersistedSession[];
    
    // Get sessions based on options
    if (options.filter) {
      sessions = await this.listSessions(options.filter);
    } else if (!options.include_expired) {
      sessions = await this.getActiveSessions();
    } else {
      sessions = await this.listSessions();
    }
    
    const backup: SessionBackup = {
      backup_id: backupId,
      created_at: now,
      sessions: sessions,
      metadata: {
        total_sessions: sessions.length,
        backup_format_version: '1.0',
        source_store_type: 'filesystem'
      }
    };
    
    // Write backup to file
    await this._writeBackupFile(backupId, backup);
    
    // Cleanup old backups if limit exceeded
    if (this._config.max_backups) {
      await this._cleanupOldBackups();
    }
    
    // Notify listeners
    for (const listener of this._backupCreatedListeners) {
      try {
        listener(backup);
      } catch (error) {
        console.error('[FileSystemSessionStore][ERROR] Backup created listener error:', error);
      }
    }
    
    console.info('[FileSystemSessionStore][LOG] Backup created:', backupId, sessions.length, 'sessions');
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
        const existing = await this.getSession(session.session_id);
        
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
          await this._writeSessionFile(session.session_id, session);
          await this._updateIndexes(session, existing ? 'update' : 'create', existing || undefined);
        }
        
        restored_count++;
      } catch (error) {
        const errorMsg = `Failed to restore session ${session.session_id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        errors.push(errorMsg);
        console.error('[FileSystemSessionStore][ERROR]', errorMsg);
      }
    }
    
    const result = { restored_count, skipped_count, errors };
    console.info('[FileSystemSessionStore][LOG] Backup restore completed:', result);
    return result;
  }

  async listBackups(): Promise<Array<{
    backup_id: string;
    created_at: Date;
    session_count: number;
    size_bytes?: number;
  }>> {
    const backupFiles = await this._getAllBackupFiles();
    const backups = [];

    for (const filename of backupFiles) {
      try {
        const backupId = this._extractBackupId(filename);
        const backupPath = path.join(this._backupsDir, filename);
        const stats = await fs.stat(backupPath);
        
        // Read backup metadata without loading full backup
        const backupData = await fs.readFile(backupPath, 'utf8');
        const backup = SessionSerializer.backupFromJSON(backupData);
        
        backups.push({
          backup_id: backupId,
          created_at: backup.created_at,
          session_count: backup.sessions.length,
          size_bytes: stats.size
        });
      } catch (error) {
        console.warn('[FileSystemSessionStore][WARN] Failed to read backup file:', filename, error);
      }
    }

    return backups.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      await this._deleteBackupFile(backupId);
      console.info('[FileSystemSessionStore][LOG] Backup deleted:', backupId);
      return true;
    } catch (error) {
      if (this._isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  // ========================================================================
  // Statistics and Monitoring
  // ========================================================================

  async getStats(): Promise<SessionStoreStats> {
    const sessionFiles = await this._getAllSessionFiles();
    const now = new Date();
    
    let totalSessions = 0;
    let activeSessions = 0;
    let expiredSessions = 0;
    const sessionsByProcessor: Record<string, number> = {};
    let oldestTime = Infinity;
    let newestTime = 0;
    let totalSize = 0;

    for (const filename of sessionFiles) {
      try {
        const sessionPath = path.join(this._sessionsDir, filename);
        const stats = await fs.stat(sessionPath);
        totalSize += stats.size;
        
        const session = await this._readSessionFile(this._extractSessionId(filename));
        if (session) {
          totalSessions++;
          
          if (session.expires_at && session.expires_at <= now) {
            expiredSessions++;
          } else {
            activeSessions++;
          }
          
          sessionsByProcessor[session.processor_id] = 
            (sessionsByProcessor[session.processor_id] || 0) + 1;
          
          const createdTime = session.created_at.getTime();
          if (createdTime < oldestTime) {
            oldestTime = createdTime;
          }
          if (createdTime > newestTime) {
            newestTime = createdTime;
          }
        }
      } catch (error) {
        console.warn('[FileSystemSessionStore][WARN] Failed to process session file:', filename, error);
      }
    }
    
    return {
      total_sessions: totalSessions,
      active_sessions: activeSessions,
      expired_sessions: expiredSessions,
      sessions_by_processor: sessionsByProcessor,
      storage_size_bytes: totalSize,
      oldest_session: oldestTime !== Infinity ? new Date(oldestTime) : undefined,
      newest_session: newestTime !== 0 ? new Date(newestTime) : undefined
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
    
    // Check directory accessibility
    try {
      await fs.access(this._sessionsDir, fs.constants.R_OK | fs.constants.W_OK);
    } catch (error) {
      issues.push(`Sessions directory not accessible: ${this._sessionsDir}`);
    }
    
    // Check session limit
    if (this._config.max_sessions) {
      const sessionCount = await this._countSessionFiles();
      if (sessionCount >= this._config.max_sessions) {
        issues.push(`Session limit reached: ${sessionCount}/${this._config.max_sessions}`);
      }
    }
    
    // Check disk space (basic check for available space)
    try {
      const stats = await fs.stat(this._baseDir);
      if (stats.isDirectory()) {
        // Directory is accessible, which is a good sign
      }
    } catch (error) {
      issues.push(`Base directory not accessible: ${this._baseDir}`);
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
    const cleanedBackups = await this._cleanupOldBackups();
    if (cleanedBackups > 0) {
      operations.push(`Cleaned up ${cleanedBackups} old backups`);
    }
    
    // Clean up temporary files
    const tempFiles = await this._cleanupTempFiles();
    if (tempFiles > 0) {
      operations.push(`Cleaned up ${tempFiles} temporary files`);
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

  private async _ensureDirectories(): Promise<void> {
    const dirs = [this._sessionsDir, this._backupsDir, this._indexDir, this._tempDir];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error('[FileSystemSessionStore][ERROR] Failed to create directory:', dir, error);
        throw error;
      }
    }
  }

  private _getSessionFilePath(sessionId: string): string {
    return path.join(this._sessionsDir, `${sessionId}.json`);
  }

  private _getBackupFilePath(backupId: string): string {
    return path.join(this._backupsDir, `${backupId}.json`);
  }

  private _getTempFilePath(filename: string): string {
    return path.join(this._tempDir, filename);
  }

  private async _writeSessionFile(sessionId: string, session: PersistedSession): Promise<void> {
    const filePath = this._getSessionFilePath(sessionId);
    const tempPath = this._getTempFilePath(`${sessionId}.tmp`);
    
    try {
      // Write to temporary file first for atomic operation
      const content = SessionSerializer.toJSON(session, false);
      await fs.writeFile(tempPath, content, 'utf8');
      
      // Atomic move to final location
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Cleanup temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private async _readSessionFile(sessionId: string): Promise<PersistedSession | null> {
    const filePath = this._getSessionFilePath(sessionId);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return SessionSerializer.fromJSON(content);
    } catch (error) {
      if (this._isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  private async _deleteSessionFile(sessionId: string): Promise<void> {
    const filePath = this._getSessionFilePath(sessionId);
    await fs.unlink(filePath);
  }

  private async _writeBackupFile(backupId: string, backup: SessionBackup): Promise<void> {
    const filePath = this._getBackupFilePath(backupId);
    const tempPath = this._getTempFilePath(`${backupId}-backup.tmp`);
    
    try {
      // Write to temporary file first for atomic operation
      const content = SessionSerializer.backupToJSON(backup, false);
      await fs.writeFile(tempPath, content, 'utf8');
      
      // Atomic move to final location
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Cleanup temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private async _deleteBackupFile(backupId: string): Promise<void> {
    const filePath = this._getBackupFilePath(backupId);
    await fs.unlink(filePath);
  }

  private async _getAllSessionFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this._sessionsDir);
      return files.filter(f => f.endsWith('.json'));
    } catch (error) {
      console.error('[FileSystemSessionStore][ERROR] Failed to read sessions directory:', error);
      return [];
    }
  }

  private async _getAllBackupFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this._backupsDir);
      return files.filter(f => f.endsWith('.json'));
    } catch (error) {
      console.error('[FileSystemSessionStore][ERROR] Failed to read backups directory:', error);
      return [];
    }
  }

  private async _countSessionFiles(): Promise<number> {
    const files = await this._getAllSessionFiles();
    return files.length;
  }

  private _extractSessionId(filename: string): string {
    return filename.replace('.json', '');
  }

  private _extractBackupId(filename: string): string {
    return filename.replace('.json', '');
  }

  private _isNotFoundError(error: any): boolean {
    return error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
  }

  private _matchesFilter(session: PersistedSession, filter: SessionFilter): boolean {
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
  }

  private _matchesSearchTerm(session: PersistedSession, searchTerm: string): boolean {
    return (
      session.processor_id.toLowerCase().includes(searchTerm) ||
      session.activity_id.toLowerCase().includes(searchTerm) ||
      session.request_id.toLowerCase().includes(searchTerm) ||
      session.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
      Object.values(session.metadata).some(value => 
        String(value).toLowerCase().includes(searchTerm)
      )
    );
  }

  private _applySorting(sessions: PersistedSession[], options: SessionQueryOptions): void {
    const { sort_by = 'created_at', sort_order = 'desc' } = options;
    
    sessions.sort((a, b) => {
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

  private async _updateIndexes(
    session: PersistedSession, 
    operation: 'create' | 'update' | 'delete',
    oldSession?: PersistedSession
  ): Promise<void> {
    // Placeholder for future index implementation
    // This could maintain index files for faster querying
    console.debug('[FileSystemSessionStore][DEBUG] Index update:', operation, session.session_id);
  }

  private async _cleanupOldBackups(): Promise<number> {
    if (!this._config.max_backups) {
      return 0;
    }

    const backups = await this.listBackups();
    const toDelete = backups.slice(this._config.max_backups);
    
    let deletedCount = 0;
    for (const backup of toDelete) {
      try {
        await this.deleteBackup(backup.backup_id);
        deletedCount++;
      } catch (error) {
        console.error('[FileSystemSessionStore][ERROR] Failed to delete backup:', backup.backup_id, error);
      }
    }
    
    return deletedCount;
  }

  private async _cleanupTempFiles(): Promise<number> {
    try {
      const tempFiles = await fs.readdir(this._tempDir);
      const now = Date.now();
      let deletedCount = 0;
      
      for (const filename of tempFiles) {
        try {
          const filePath = path.join(this._tempDir, filename);
          const stats = await fs.stat(filePath);
          
          // Delete files older than 1 hour
          if (now - stats.mtime.getTime() > 3600000) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        } catch (error) {
          console.warn('[FileSystemSessionStore][WARN] Failed to cleanup temp file:', filename, error);
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error('[FileSystemSessionStore][ERROR] Failed to cleanup temp directory:', error);
      return 0;
    }
  }
}