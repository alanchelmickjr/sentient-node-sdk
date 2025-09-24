/**
 * Session Persistence System Exports
 * 
 * Provides comprehensive session management with multiple storage backends,
 * automatic persistence, lifecycle management, and transaction support.
 */

// Core interfaces
export * from '../../interface/session_store';

// Storage implementations
export { InMemorySessionStore } from '../in_memory_session_store';
export { FileSystemSessionStore } from '../filesystem_session_store';

// High-level management
export { SessionPersistenceManager } from '../session_persistence_manager';
export type { 
  SessionPersistenceConfig, 
  SessionPersistenceStats 
} from '../session_persistence_manager';

// Serialization utilities
export { 
  SessionSerializer, 
  SessionDataUtils,
  SerializationError,
  SERIALIZATION_VERSION
} from '../session_serialization';
export type { 
  SerializedSession, 
  SerializedBackup 
} from '../session_serialization';

// Enhanced DefaultSession with persistence
export { DefaultSession } from '../default_session';

// ID generation
export { DefaultIdGenerator } from '../default_id_generator';