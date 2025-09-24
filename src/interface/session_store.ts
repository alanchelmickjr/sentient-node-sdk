import { SessionObject, Session, Interaction, RequestMessage } from './session';

/**
 * Session filter criteria for querying sessions
 */
export interface SessionFilter {
  processor_id?: string | string[];
  activity_id?: string | string[];
  request_id?: string | string[];
  created_after?: Date;
  created_before?: Date;
  updated_after?: Date;
  updated_before?: Date;
  expires_after?: Date;
  expires_before?: Date;
  has_interactions?: boolean;
  interaction_count_min?: number;
  interaction_count_max?: number;
  metadata?: Record<string, any>;
  tags?: string[];
}

/**
 * Session query options
 */
export interface SessionQueryOptions {
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'updated_at' | 'activity_id' | 'expires_at';
  sort_order?: 'asc' | 'desc';
}

/**
 * Persisted session data with metadata
 */
export interface PersistedSession {
  session_id: string; // ULID - primary key
  processor_id: string;
  activity_id: string; // ULID
  request_id: string; // ULID
  interactions: Interaction<RequestMessage>[];
  created_at: Date;
  updated_at: Date;
  expires_at?: Date;
  metadata: Record<string, any>;
  tags: string[];
  version: number; // For optimistic locking
}

/**
 * Session backup data structure
 */
export interface SessionBackup {
  backup_id: string; // ULID
  created_at: Date;
  sessions: PersistedSession[];
  metadata: {
    total_sessions: number;
    backup_format_version: string;
    source_store_type: string;
  };
}

/**
 * Transaction context for atomic operations
 */
export interface SessionTransaction {
  readonly transaction_id: string; // ULID
  readonly started_at: Date;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

/**
 * Session store statistics
 */
export interface SessionStoreStats {
  total_sessions: number;
  active_sessions: number;
  expired_sessions: number;
  sessions_by_processor: Record<string, number>;
  storage_size_bytes?: number;
  oldest_session?: Date;
  newest_session?: Date;
}

/**
 * Session store configuration
 */
export interface SessionStoreConfig {
  auto_cleanup_enabled?: boolean;
  cleanup_interval_ms?: number;
  default_session_ttl_ms?: number;
  max_sessions?: number;
  compression_enabled?: boolean;
  encryption_enabled?: boolean;
  encryption_key?: string;
  backup_enabled?: boolean;
  backup_interval_ms?: number;
  max_backups?: number;
}

/**
 * Session store errors
 */
export class SessionStoreError extends Error {
  constructor(message: string, public code: string, public cause?: Error) {
    super(message);
    this.name = 'SessionStoreError';
  }
}

export class SessionNotFoundError extends SessionStoreError {
  constructor(sessionId: string, cause?: Error) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND', cause);
    this.name = 'SessionNotFoundError';
  }
}

export class SessionConflictError extends SessionStoreError {
  constructor(sessionId: string, message: string, cause?: Error) {
    super(`Session conflict for ${sessionId}: ${message}`, 'SESSION_CONFLICT', cause);
    this.name = 'SessionConflictError';
  }
}

export class TransactionError extends SessionStoreError {
  constructor(transactionId: string, message: string, cause?: Error) {
    super(`Transaction ${transactionId}: ${message}`, 'TRANSACTION_ERROR', cause);
    this.name = 'TransactionError';
  }
}

/**
 * Core session store interface providing CRUD operations and persistence
 */
export interface SessionStore {
  /**
   * Initialize the session store
   */
  initialize(config?: SessionStoreConfig): Promise<void>;

  /**
   * Shutdown the session store and cleanup resources
   */
  shutdown(): Promise<void>;

  /**
   * Get store configuration
   */
  getConfig(): SessionStoreConfig;

  /**
   * Update store configuration
   */
  updateConfig(config: Partial<SessionStoreConfig>): Promise<void>;

  // ========================================================================
  // CRUD Operations
  // ========================================================================

  /**
   * Create a new session
   */
  createSession(
    sessionObject: SessionObject,
    options?: {
      expires_at?: Date;
      metadata?: Record<string, any>;
      tags?: string[];
    }
  ): Promise<PersistedSession>;

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Promise<PersistedSession | null>;

  /**
   * Update an existing session
   */
  updateSession(
    sessionId: string,
    updates: Partial<Pick<PersistedSession, 'interactions' | 'metadata' | 'tags' | 'expires_at'>>,
    options?: {
      expected_version?: number; // For optimistic locking
    }
  ): Promise<PersistedSession>;

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): Promise<boolean>;

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): Promise<boolean>;

  // ========================================================================
  // Query Operations
  // ========================================================================

  /**
   * List sessions with filtering and pagination
   */
  listSessions(
    filter?: SessionFilter,
    options?: SessionQueryOptions
  ): Promise<PersistedSession[]>;

  /**
   * Count sessions matching filter
   */
  countSessions(filter?: SessionFilter): Promise<number>;

  /**
   * Search sessions by text query
   */
  searchSessions(
    query: string,
    options?: SessionQueryOptions
  ): Promise<PersistedSession[]>;

  /**
   * Get sessions by processor ID
   */
  getSessionsByProcessor(
    processorId: string,
    options?: SessionQueryOptions
  ): Promise<PersistedSession[]>;

  /**
   * Get active (non-expired) sessions
   */
  getActiveSessions(options?: SessionQueryOptions): Promise<PersistedSession[]>;

  /**
   * Get expired sessions
   */
  getExpiredSessions(options?: SessionQueryOptions): Promise<PersistedSession[]>;

  // ========================================================================
  // Session Lifecycle Management
  // ========================================================================

  /**
   * Set session expiration
   */
  setSessionExpiration(sessionId: string, expiresAt: Date): Promise<void>;

  /**
   * Extend session expiration by duration
   */
  extendSessionExpiration(sessionId: string, durationMs: number): Promise<void>;

  /**
   * Refresh session (update updated_at timestamp)
   */
  refreshSession(sessionId: string): Promise<void>;

  /**
   * Expire sessions that have passed their expiration time
   */
  expireSessions(): Promise<string[]>; // Returns expired session IDs

  /**
   * Cleanup expired sessions (delete them)
   */
  cleanupExpiredSessions(): Promise<number>; // Returns count of deleted sessions

  // ========================================================================
  // Transaction Support
  // ========================================================================

  /**
   * Begin a new transaction
   */
  beginTransaction(): Promise<SessionTransaction>;

  /**
   * Execute operations within a transaction
   */
  withTransaction<T>(
    operation: (transaction: SessionTransaction) => Promise<T>
  ): Promise<T>;

  // ========================================================================
  // Backup and Restore
  // ========================================================================

  /**
   * Create a backup of all sessions
   */
  createBackup(
    options?: {
      include_expired?: boolean;
      filter?: SessionFilter;
    }
  ): Promise<SessionBackup>;

  /**
   * Restore sessions from backup
   */
  restoreFromBackup(
    backup: SessionBackup,
    options?: {
      merge_strategy?: 'overwrite' | 'skip_existing' | 'update_newer';
      dry_run?: boolean;
    }
  ): Promise<{
    restored_count: number;
    skipped_count: number;
    errors: string[];
  }>;

  /**
   * List available backups
   */
  listBackups(): Promise<Array<{
    backup_id: string;
    created_at: Date;
    session_count: number;
    size_bytes?: number;
  }>>;

  /**
   * Delete a backup
   */
  deleteBackup(backupId: string): Promise<boolean>;

  // ========================================================================
  // Statistics and Monitoring
  // ========================================================================

  /**
   * Get store statistics
   */
  getStats(): Promise<SessionStoreStats>;

  /**
   * Health check for the store
   */
  healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    last_check: Date;
  }>;

  /**
   * Optimize store performance (cleanup, indexing, etc.)
   */
  optimize(): Promise<{
    operations_performed: string[];
    performance_impact: string;
  }>;

  // ========================================================================
  // Event Hooks
  // ========================================================================

  /**
   * Register event listeners for store operations
   */
  onSessionCreated?(callback: (session: PersistedSession) => void): void;
  onSessionUpdated?(callback: (session: PersistedSession, oldSession: PersistedSession) => void): void;
  onSessionDeleted?(callback: (sessionId: string) => void): void;
  onSessionExpired?(callback: (session: PersistedSession) => void): void;
  onBackupCreated?(callback: (backup: SessionBackup) => void): void;
}