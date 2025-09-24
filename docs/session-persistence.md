# Session Persistence System

The Session Persistence System provides comprehensive session management with multiple storage backends, automatic persistence, lifecycle management, and transaction support.

## Overview

The persistence system consists of several key components:

- **SessionStore Interface**: Abstract interface for different storage backends
- **Storage Implementations**: InMemorySessionStore and FileSystemSessionStore
- **SessionPersistenceManager**: High-level management and orchestration
- **DefaultSession Integration**: Automatic persistence for session objects
- **Serialization Utilities**: Safe JSON serialization with ULID preservation

## Quick Start

### Basic Setup

```typescript
import { 
  SessionPersistenceManager,
  InMemorySessionStore,
  FileSystemSessionStore 
} from './src/implementation';

// Memory-based persistence (for development/testing)
const manager = new SessionPersistenceManager({
  store_type: 'memory',
  auto_persist_enabled: true,
  auto_persist_interval_ms: 30000 // 30 seconds
});

await manager.initialize();

// Create a managed session
const session = await manager.createManagedSession({
  processor_id: 'my-processor',
  activity_id: 'activity-123', // ULID
  request_id: 'request-456'     // ULID
});

console.log('Session created:', session.activity_id);
```

### Filesystem-based Persistence

```typescript
const manager = new SessionPersistenceManager({
  store_type: 'filesystem',
  filesystem_base_dir: './session_data',
  store_config: {
    auto_cleanup_enabled: true,
    cleanup_interval_ms: 300000, // 5 minutes
    default_session_ttl_ms: 3600000, // 1 hour
    max_sessions: 10000,
    backup_enabled: true,
    backup_interval_ms: 600000 // 10 minutes
  }
});

await manager.initialize();
```

## Core Components

### SessionStore Interface

The `SessionStore` interface provides a consistent API across different storage backends:

```typescript
interface SessionStore {
  // Lifecycle
  initialize(config?: SessionStoreConfig): Promise<void>;
  shutdown(): Promise<void>;
  
  // CRUD Operations
  createSession(sessionObject: SessionObject, options?: CreateOptions): Promise<PersistedSession>;
  getSession(sessionId: string): Promise<PersistedSession | null>;
  updateSession(sessionId: string, updates: Partial<PersistedSession>): Promise<PersistedSession>;
  deleteSession(sessionId: string): Promise<boolean>;
  
  // Querying
  listSessions(filter?: SessionFilter, options?: SessionQueryOptions): Promise<PersistedSession[]>;
  searchSessions(query: string, options?: SessionQueryOptions): Promise<PersistedSession[]>;
  
  // Lifecycle Management
  expireSessions(): Promise<string[]>;
  cleanupExpiredSessions(): Promise<number>;
  
  // Transactions
  beginTransaction(): Promise<SessionTransaction>;
  withTransaction<T>(operation: (tx: SessionTransaction) => Promise<T>): Promise<T>;
  
  // Backup & Restore
  createBackup(options?: BackupOptions): Promise<SessionBackup>;
  restoreFromBackup(backup: SessionBackup, options?: RestoreOptions): Promise<RestoreResult>;
}
```

### Storage Backends

#### InMemorySessionStore

Best for development, testing, and temporary sessions:

```typescript
import { InMemorySessionStore } from './src/implementation/in_memory_session_store';

const store = new InMemorySessionStore();
await store.initialize({
  max_sessions: 1000,
  default_session_ttl_ms: 3600000,
  auto_cleanup_enabled: true
});

const session = await store.createSession({
  processor_id: 'test-processor',
  activity_id: 'activity-123',
  request_id: 'request-456',
  interactions: []
});
```

#### FileSystemSessionStore

For production use with persistent storage:

```typescript
import { FileSystemSessionStore } from './src/implementation/filesystem_session_store';

const store = new FileSystemSessionStore('./data/sessions');
await store.initialize({
  auto_cleanup_enabled: true,
  backup_enabled: true,
  max_sessions: 100000
});
```

### SessionPersistenceManager

High-level orchestration with automatic session management:

```typescript
const manager = new SessionPersistenceManager({
  store_type: 'filesystem',
  filesystem_base_dir: './session_data',
  auto_persist_enabled: true,
  auto_persist_interval_ms: 30000,
  auto_persist_on_interaction: true
});

await manager.initialize();

// Create managed sessions
const session = await manager.createManagedSession({
  processor_id: 'my-processor'
}, {
  expires_at: new Date(Date.now() + 3600000), // 1 hour
  metadata: { user_id: '12345', type: 'chat' },
  tags: ['production', 'user-session']
});

// Sessions are automatically persisted
session.addInteraction(someInteraction);
// Auto-persistence will save changes
```

## Advanced Usage

### Session Filtering and Querying

```typescript
// Find sessions by processor
const processorSessions = await manager.getSessionsByProcessor('my-processor');

// Advanced filtering
const sessions = await manager.listSessions({
  processor_id: ['processor-1', 'processor-2'],
  created_after: new Date(Date.now() - 86400000), // Last 24 hours
  has_interactions: true,
  tags: ['production']
}, {
  sort_by: 'updated_at',
  sort_order: 'desc',
  limit: 50
});

// Text search
const searchResults = await manager.searchSessions('user-12345', {
  limit: 10
});

// Convenience method
const recentSessions = await manager.findSessions({
  since: new Date(Date.now() - 3600000), // Last hour
  has_interactions: true,
  limit: 20
});
```

### Session Lifecycle Management

```typescript
// Set expiration
await manager.setSessionExpiration(sessionId, new Date(Date.now() + 7200000));

// Extend expiration
await manager.extendSessionExpiration(sessionId, 3600000); // +1 hour

// Refresh session (updates updated_at)
await manager.refreshSession(sessionId);

// Manual cleanup
const expiredIds = await manager.expireSessions();
const cleanedCount = await manager.cleanupExpiredSessions();
```

### Transactions

```typescript
// Atomic operations
await manager.withTransaction(async (tx) => {
  const session1 = await store.createSession(sessionData1);
  const session2 = await store.createSession(sessionData2);
  
  // Both sessions created or neither
  return { session1, session2 };
});

// Manual transaction management
const tx = await manager.beginTransaction();
try {
  // Perform operations
  await tx.commit();
} catch (error) {
  await tx.rollback();
  throw error;
}
```

### Backup and Restore

```typescript
// Create backup
const backup = await manager.createBackup({
  include_expired: false,
  filter: { processor_id: 'important-processor' }
});

console.log(`Backup created: ${backup.backup_id}, ${backup.sessions.length} sessions`);

// List backups
const backups = await manager.listBackups();

// Restore from backup
const result = await manager.restoreFromBackup(backup, {
  merge_strategy: 'skip_existing', // or 'overwrite', 'update_newer'
  dry_run: false
});

console.log(`Restored ${result.restored_count} sessions, ${result.skipped_count} skipped`);
```

### Bulk Operations

```typescript
// Bulk update sessions
const result = await manager.bulkUpdateSessions(
  { tags: ['old-version'] }, // Filter
  { 
    tags: ['migrated'], 
    metadata: { migration_date: new Date().toISOString() }
  }
);

console.log(`Updated ${result.updated_count} sessions`);
```

## DefaultSession Integration

The `DefaultSession` class can be enhanced with automatic persistence:

```typescript
import { DefaultSession } from './src/implementation/default_session';

// Create session with persistence
const session = new DefaultSession({
  processor_id: 'my-processor',
  activity_id: 'activity-123',
  request_id: 'request-456'
}, undefined, {
  persistenceManager: manager,
  enableAutoPersistence: true,
  persistenceSessionId: 'custom-id'
});

// Or configure later
session.setPersistenceManager(manager, true);

// Manual persistence
await session.persist();

// Load from storage
await session.loadFromPersistence('existing-session-id');

// Auto-persistence on changes
session.addInteraction(interaction); // Automatically persisted
session.updateSessionObject({ /* updates */ }); // Automatically persisted
```

## Configuration Options

### SessionStoreConfig

```typescript
interface SessionStoreConfig {
  auto_cleanup_enabled?: boolean;        // Enable automatic cleanup of expired sessions
  cleanup_interval_ms?: number;         // Cleanup interval (default: 60000)
  default_session_ttl_ms?: number;      // Default session TTL (default: 3600000)
  max_sessions?: number;                // Maximum number of sessions
  compression_enabled?: boolean;        // Enable compression (future)
  encryption_enabled?: boolean;         // Enable encryption (future)
  backup_enabled?: boolean;             // Enable automatic backups
  backup_interval_ms?: number;          // Backup interval (default: 300000)
  max_backups?: number;                 // Maximum backups to keep (default: 10)
}
```

### SessionPersistenceConfig

```typescript
interface SessionPersistenceConfig {
  store_type: 'memory' | 'filesystem' | 'custom';
  store_config?: SessionStoreConfig;
  filesystem_base_dir?: string;         // For filesystem store
  custom_store?: SessionStore;          // For custom implementations
  
  // Auto-persistence
  auto_persist_enabled?: boolean;
  auto_persist_interval_ms?: number;
  auto_persist_on_interaction?: boolean;
  
  // Session lifecycle
  default_session_ttl_ms?: number;
  auto_cleanup_enabled?: boolean;
  cleanup_interval_ms?: number;
  
  // Events
  enable_event_listeners?: boolean;
}
```

## Event Handling

```typescript
// Store-level events
store.onSessionCreated?.((session) => {
  console.log('Session created:', session.session_id);
});

store.onSessionUpdated?.((session, oldSession) => {
  console.log('Session updated:', session.session_id);
});

store.onSessionDeleted?.((sessionId) => {
  console.log('Session deleted:', sessionId);
});

store.onSessionExpired?.((session) => {
  console.log('Session expired:', session.session_id);
});

store.onBackupCreated?.((backup) => {
  console.log('Backup created:', backup.backup_id);
});
```

## Monitoring and Statistics

```typescript
// Get detailed statistics
const stats = await manager.getStats();
console.log(`Total sessions: ${stats.total_sessions}`);
console.log(`Active sessions: ${stats.active_sessions}`);
console.log(`Sessions by processor:`, stats.sessions_by_processor);

// Health check
const health = await manager.healthCheck();
if (!health.healthy) {
  console.warn('Health issues:', health.issues);
}

// Performance optimization
const optimizeResult = await manager.optimize();
console.log('Optimizations:', optimizeResult.operations_performed);

// Session summary
const summary = await manager.getSessionSummary(sessionId);
if (summary) {
  console.log(`Session age: ${summary.age_ms}ms`);
  console.log(`Interactions: ${summary.interaction_count}`);
  console.log(`Is managed: ${summary.is_managed}`);
}
```

## Error Handling

```typescript
import { 
  SessionNotFoundError,
  SessionConflictError,
  TransactionError,
  SerializationError
} from './src/interface/session_store';

try {
  await manager.updateSession(sessionId, updates);
} catch (error) {
  if (error instanceof SessionNotFoundError) {
    console.log('Session does not exist');
  } else if (error instanceof SessionConflictError) {
    console.log('Version conflict, retry with latest version');
  } else if (error instanceof TransactionError) {
    console.log('Transaction failed:', error.message);
  }
}

// Optimistic locking
try {
  const session = await manager.getSession(sessionId);
  await manager.updateSession(sessionId, updates, {
    expected_version: session.version
  });
} catch (error) {
  if (error instanceof SessionConflictError) {
    // Handle version conflict
  }
}
```

## Best Practices

### Performance

1. **Use appropriate store types**:
   - Memory store for development and temporary data
   - Filesystem store for production persistence

2. **Configure cleanup appropriately**:
   ```typescript
   {
     auto_cleanup_enabled: true,
     cleanup_interval_ms: 300000, // 5 minutes
     default_session_ttl_ms: 3600000 // 1 hour
   }
   ```

3. **Use pagination for large queries**:
   ```typescript
   const sessions = await manager.listSessions({}, {
     limit: 100,
     offset: 0
   });
   ```

### Data Integrity

1. **Use transactions for related operations**:
   ```typescript
   await manager.withTransaction(async (tx) => {
     // Multiple related operations
   });
   ```

2. **Handle version conflicts**:
   ```typescript
   // Use optimistic locking for updates
   await manager.updateSession(id, updates, {
     expected_version: currentVersion
   });
   ```

3. **Regular backups**:
   ```typescript
   {
     backup_enabled: true,
     backup_interval_ms: 600000, // 10 minutes
     max_backups: 24 // Keep 4 hours of backups
   }
   ```

### Security

1. **Validate session data**:
   ```typescript
   // Sanitize user inputs before storing
   const sanitizedMetadata = sanitizeObject(metadata);
   ```

2. **Use expiration appropriately**:
   ```typescript
   // Set reasonable TTL values
   const session = await manager.createManagedSession(data, {
     expires_at: new Date(Date.now() + 3600000) // 1 hour
   });
   ```

3. **Monitor for suspicious patterns**:
   ```typescript
   const stats = await manager.getStats();
   if (stats.total_sessions > threshold) {
     // Alert or take action
   }
   ```

## Migration and Upgrades

When upgrading the persistence system:

1. **Create backup before changes**:
   ```typescript
   const backup = await manager.createBackup();
   ```

2. **Test with new configuration**:
   ```typescript
   const result = await manager.restoreFromBackup(backup, {
     dry_run: true
   });
   ```

3. **Graceful shutdown**:
   ```typescript
   await manager.shutdown(); // Performs final persistence
   ```

## Troubleshooting

### Common Issues

1. **Sessions not persisting**:
   - Check auto-persistence is enabled
   - Verify store is initialized
   - Check for errors in logs

2. **Performance issues**:
   - Run optimization: `await manager.optimize()`
   - Check cleanup intervals
   - Monitor session count limits

3. **Storage errors**:
   - Verify filesystem permissions
   - Check disk space
   - Review configuration

### Debugging

Enable detailed logging:
```typescript
// Monitor events
store.onSessionCreated?.((session) => {
  console.debug('Session created:', session.session_id);
});

// Check health regularly
setInterval(async () => {
  const health = await manager.healthCheck();
  if (!health.healthy) {
    console.warn('Health check failed:', health.issues);
  }
}, 60000);
```

## Examples

See the [`examples/`](../examples/) directory for complete working examples:

- [`examples/basic-persistence.ts`](../examples/basic-persistence.ts) - Basic setup and usage
- [`examples/advanced-querying.ts`](../examples/advanced-querying.ts) - Complex queries and filtering  
- [`examples/transaction-example.ts`](../examples/transaction-example.ts) - Transaction usage
- [`examples/backup-restore.ts`](../examples/backup-restore.ts) - Backup and restore operations
- [`examples/monitoring.ts`](../examples/monitoring.ts) - Statistics and health monitoring

## API Reference

For detailed API documentation, see:
- [SessionStore Interface](../src/interface/session_store.ts)
- [SessionPersistenceManager](../src/implementation/session_persistence_manager.ts)
- [InMemorySessionStore](../src/implementation/in_memory_session_store.ts)
- [FileSystemSessionStore](../src/implementation/filesystem_session_store.ts)
- [Session Serialization](../src/implementation/session_serialization.ts)