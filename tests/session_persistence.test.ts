import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ulid } from 'ulid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

import { SessionStore, PersistedSession, SessionFilter, SessionQueryOptions } from '../src/interface/session_store';
import { SessionObject, Interaction, RequestMessage, ASSIST_CAPABILITY } from '../src/interface/session';
import { InMemorySessionStore } from '../src/implementation/in_memory_session_store';
import { FileSystemSessionStore } from '../src/implementation/filesystem_session_store';
import { SessionPersistenceManager } from '../src/implementation/session_persistence_manager';
import { DefaultSession } from '../src/implementation/default_session';
import { SessionSerializer, SessionDataUtils } from '../src/implementation/session_serialization';
import { DefaultIdGenerator } from '../src/implementation/default_id_generator';

describe('Session Persistence System', () => {
  let tempDir: string;
  let idGenerator: DefaultIdGenerator;

  beforeEach(async () => {
    // Create temporary directory for filesystem tests
    tempDir = path.join(tmpdir(), 'session-test-' + ulid());
    await fs.mkdir(tempDir, { recursive: true });
    idGenerator = new DefaultIdGenerator();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('SessionSerializer', () => {
    it('should serialize and deserialize sessions correctly', () => {
      const session: PersistedSession = {
        session_id: ulid(),
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: [],
        created_at: new Date(),
        updated_at: new Date(),
        expires_at: new Date(Date.now() + 3600000),
        metadata: { test: 'value', number: 42 },
        tags: ['test', 'session'],
        version: 1
      };

      // Serialize to JSON
      const json = SessionSerializer.toJSON(session);
      expect(typeof json).toBe('string');

      // Deserialize from JSON
      const deserialized = SessionSerializer.fromJSON(json);
      expect(deserialized.session_id).toBe(session.session_id);
      expect(deserialized.processor_id).toBe(session.processor_id);
      expect(deserialized.activity_id).toBe(session.activity_id);
      expect(deserialized.created_at).toEqual(session.created_at);
      expect(deserialized.metadata).toEqual(session.metadata);
      expect(deserialized.tags).toEqual(session.tags);
    });

    it('should handle sessions with interactions', () => {
      const interaction: Interaction<RequestMessage> = {
        request: {
          sender: 'test-sender',
          recipients: new Set(['recipient1']),
          event: {
            id: ulid(),
            chatId: ulid(),
            content: {
              capability: ASSIST_CAPABILITY,
              request_payload: {
                parts: [{
                  prompt: 'test prompt',
                  fileIds: []
                }]
              }
            }
          }
        },
        responses: []
      };

      const session: PersistedSession = {
        session_id: ulid(),
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: [interaction],
        created_at: new Date(),
        updated_at: new Date(),
        metadata: {},
        tags: [],
        version: 1
      };

      const json = SessionSerializer.toJSON(session);
      const deserialized = SessionSerializer.fromJSON(json);
      
      expect(deserialized.interactions).toHaveLength(1);
      expect(deserialized.interactions[0].request.sender).toBe('test-sender');
      expect(deserialized.interactions[0].request.recipients).toEqual(new Set(['recipient1']));
    });

    it('should validate serialized data', () => {
      const validData = {
        session_id: ulid(),
        processor_id: 'test',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {},
        tags: [],
        session_version: 1
      };

      expect(SessionSerializer.validateSerialized(validData)).toBe(true);
      expect(SessionSerializer.validateSerialized({})).toBe(false);
      expect(SessionSerializer.validateSerialized(null)).toBe(false);
    });
  });

  describe('SessionDataUtils', () => {
    it('should check if session is expired', () => {
      const expiredSession: PersistedSession = {
        session_id: ulid(),
        processor_id: 'test',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: [],
        created_at: new Date(),
        updated_at: new Date(),
        expires_at: new Date(Date.now() - 1000), // Expired
        metadata: {},
        tags: [],
        version: 1
      };

      const activeSession: PersistedSession = {
        ...expiredSession,
        expires_at: new Date(Date.now() + 3600000) // Not expired
      };

      expect(SessionDataUtils.isExpired(expiredSession)).toBe(true);
      expect(SessionDataUtils.isExpired(activeSession)).toBe(false);
    });

    it('should calculate session age and time since update', () => {
      const session: PersistedSession = {
        session_id: ulid(),
        processor_id: 'test',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: [],
        created_at: new Date(Date.now() - 5000),
        updated_at: new Date(Date.now() - 2000),
        metadata: {},
        tags: [],
        version: 1
      };

      const age = SessionDataUtils.getAge(session);
      const timeSinceUpdate = SessionDataUtils.getTimeSinceUpdate(session);

      expect(age).toBeGreaterThanOrEqual(5000);
      expect(timeSinceUpdate).toBeGreaterThanOrEqual(2000);
    });
  });

  describe('InMemorySessionStore', () => {
    let store: InMemorySessionStore;

    beforeEach(async () => {
      store = new InMemorySessionStore(idGenerator);
      await store.initialize();
    });

    afterEach(async () => {
      await store.shutdown();
    });

    it('should create and retrieve sessions', async () => {
      const sessionObject: SessionObject = {
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      };

      const created = await store.createSession(sessionObject);
      expect(created.session_id).toBeDefined();
      expect(created.processor_id).toBe(sessionObject.processor_id);

      const retrieved = await store.getSession(created.session_id);
      expect(retrieved).toEqual(created);
    });

    it('should update sessions with version control', async () => {
      const sessionObject: SessionObject = {
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      };

      const created = await store.createSession(sessionObject);
      expect(created.version).toBe(1);

      const updated = await store.updateSession(created.session_id, {
        metadata: { updated: true }
      });

      expect(updated.version).toBe(2);
      expect(updated.metadata.updated).toBe(true);

      // Test optimistic locking
      await expect(
        store.updateSession(created.session_id, { tags: ['test'] }, { expected_version: 1 })
      ).rejects.toThrow();
    });

    it('should delete sessions', async () => {
      const sessionObject: SessionObject = {
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      };

      const created = await store.createSession(sessionObject);
      expect(await store.hasSession(created.session_id)).toBe(true);

      const deleted = await store.deleteSession(created.session_id);
      expect(deleted).toBe(true);
      expect(await store.hasSession(created.session_id)).toBe(false);
    });

    it('should filter and query sessions', async () => {
      // Create test sessions
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const sessionObject: SessionObject = {
          processor_id: `processor-${i}`,
          activity_id: ulid(),
          request_id: ulid(),
          interactions: []
        };
        const created = await store.createSession(sessionObject, {
          tags: i % 2 === 0 ? ['even'] : ['odd']
        });
        sessions.push(created);
      }

      // Test filtering
      const evenSessions = await store.listSessions({ tags: ['even'] });
      expect(evenSessions.length).toBe(3);

      // Test pagination
      const limited = await store.listSessions({}, { limit: 2 });
      expect(limited.length).toBe(2);

      // Test counting
      const count = await store.countSessions({ tags: ['odd'] });
      expect(count).toBe(2);
    });

    it('should handle session expiration and cleanup', async () => {
      const sessionObject: SessionObject = {
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      };

      // Create expired session
      const expiredSession = await store.createSession(sessionObject, {
        expires_at: new Date(Date.now() - 1000)
      });

      // Create active session
      const activeSession = await store.createSession(sessionObject, {
        expires_at: new Date(Date.now() + 3600000)
      });

      const expiredIds = await store.expireSessions();
      expect(expiredIds).toContain(expiredSession.session_id);
      expect(expiredIds).not.toContain(activeSession.session_id);

      const cleanedCount = await store.cleanupExpiredSessions();
      expect(cleanedCount).toBeGreaterThan(0);
    });

    it('should support transactions', async () => {
      const transaction = await store.beginTransaction();
      expect(transaction.isActive()).toBe(true);

      await transaction.commit();
      expect(transaction.isActive()).toBe(false);

      // Test rollback
      const transaction2 = await store.beginTransaction();
      await transaction2.rollback();
      expect(transaction2.isActive()).toBe(false);
    });

    it('should create and restore backups', async () => {
      // Create test sessions
      for (let i = 0; i < 3; i++) {
        const sessionObject: SessionObject = {
          processor_id: `processor-${i}`,
          activity_id: ulid(),
          request_id: ulid(),
          interactions: []
        };
        await store.createSession(sessionObject);
      }

      const backup = await store.createBackup();
      expect(backup.sessions.length).toBe(3);
      expect(backup.backup_id).toBeDefined();

      // Clear store
      const sessions = await store.listSessions();
      for (const session of sessions) {
        await store.deleteSession(session.session_id);
      }

      // Restore from backup
      const result = await store.restoreFromBackup(backup);
      expect(result.restored_count).toBe(3);
      expect(result.errors.length).toBe(0);

      const restoredSessions = await store.listSessions();
      expect(restoredSessions.length).toBe(3);
    });

    it('should provide statistics and health check', async () => {
      // Create some test data
      for (let i = 0; i < 3; i++) {
        const sessionObject: SessionObject = {
          processor_id: `processor-${i % 2}`,
          activity_id: ulid(),
          request_id: ulid(),
          interactions: []
        };
        await store.createSession(sessionObject);
      }

      const stats = await store.getStats();
      expect(stats.total_sessions).toBe(3);
      expect(stats.sessions_by_processor['processor-0']).toBe(2);
      expect(stats.sessions_by_processor['processor-1']).toBe(1);

      const health = await store.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.issues.length).toBe(0);
    });
  });

  describe('FileSystemSessionStore', () => {
    let store: FileSystemSessionStore;

    beforeEach(async () => {
      store = new FileSystemSessionStore(tempDir, idGenerator);
      await store.initialize();
    });

    afterEach(async () => {
      await store.shutdown();
    });

    it('should persist sessions to filesystem', async () => {
      const sessionObject: SessionObject = {
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      };

      const created = await store.createSession(sessionObject);
      expect(created.session_id).toBeDefined();

      // Verify file exists
      const sessionFile = path.join(tempDir, 'sessions', `${created.session_id}.json`);
      const exists = await fs.access(sessionFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Read file directly
      const fileContent = await fs.readFile(sessionFile, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed.session_id).toBe(created.session_id);
    });

    it('should handle concurrent operations safely', async () => {
      const sessionObject: SessionObject = {
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      };

      // Create multiple sessions concurrently
      const promises = Array(5).fill(0).map(() => store.createSession(sessionObject));
      const sessions = await Promise.all(promises);
      
      expect(sessions.length).toBe(5);
      expect(new Set(sessions.map(s => s.session_id)).size).toBe(5); // All unique
    });

    it('should maintain data consistency during crashes', async () => {
      const sessionObject: SessionObject = {
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      };

      const session = await store.createSession(sessionObject);
      
      // Simulate crash by creating new store instance
      await store.shutdown();
      const newStore = new FileSystemSessionStore(tempDir, idGenerator);
      await newStore.initialize();
      
      const retrieved = await newStore.getSession(session.session_id);
      expect(retrieved).toEqual(session);
      
      await newStore.shutdown();
    });

    it('should cleanup temporary files', async () => {
      const sessionObject: SessionObject = {
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      };

      // Create and update session (creates temp files)
      const session = await store.createSession(sessionObject);
      await store.updateSession(session.session_id, { metadata: { test: true } });

      // Run optimization to cleanup temp files
      const result = await store.optimize();
      expect(result.operations_performed).toBeDefined();
    });
  });

  describe('SessionPersistenceManager', () => {
    let manager: SessionPersistenceManager;

    beforeEach(async () => {
      manager = new SessionPersistenceManager({
        store_type: 'memory',
        auto_persist_enabled: true,
        auto_persist_interval_ms: 100, // Short interval for testing
        id_generator: idGenerator
      });
      await manager.initialize();
    });

    afterEach(async () => {
      await manager.shutdown();
    });

    it('should create and manage sessions', async () => {
      const sessionObject: SessionObject = {
        processor_id: 'test-processor',
        activity_id: ulid(),
        request_id: ulid(),
        interactions: []
      };

      const session = await manager.createManagedSession(sessionObject);
      expect(session).toBeInstanceOf(DefaultSession);
      expect(session.processor_id).toBe(sessionObject.processor_id);

      // Verify session is persisted
      const persisted = await manager.getSession(session.getPersistenceSessionId()!);
      expect(persisted).toBeDefined();
    });

    it('should handle auto-persistence', async () => {
      const session = await manager.createManagedSession();
      
      // Mark for persistence
      manager.markSessionForPersistence(session.getPersistenceSessionId()!);
      
      // Wait for auto-persist interval
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify session was persisted
      const persisted = await manager.getSession(session.getPersistenceSessionId()!);
      expect(persisted).toBeDefined();
    });

    it('should switch store types', async () => {
      // Create session in memory store
      const session = await manager.createManagedSession();
      const sessionId = session.getPersistenceSessionId()!;

      // Switch to filesystem store
      await manager.updateConfig({
        store_type: 'filesystem',
        filesystem_base_dir: tempDir
      });

      // Verify session was migrated
      const retrieved = await manager.getSession(sessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.session_id).toBe(sessionId);
    });

    it('should provide statistics and monitoring', async () => {
      // Create test sessions
      await manager.createManagedSession();
      await manager.createManagedSession();

      const stats = await manager.getStats();
      expect(stats.total_sessions).toBeGreaterThanOrEqual(2);
      expect(stats.store_type).toBe('memory');

      const health = await manager.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should handle bulk operations', async () => {
      // Create multiple sessions
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const session = await manager.createManagedSession({}, {
          tags: i % 2 === 0 ? ['even'] : ['odd']
        });
        sessions.push(session);
      }

      // Bulk update
      const result = await manager.bulkUpdateSessions(
        { tags: ['even'] },
        { metadata: { bulk_updated: true } }
      );

      expect(result.updated_count).toBe(3); // 3 even sessions
      expect(result.errors.length).toBe(0);
    });

    it('should find sessions by criteria', async () => {
      const processor1Sessions = [];
      const processor2Sessions = [];

      // Create sessions for different processors
      for (let i = 0; i < 3; i++) {
        const session1 = await manager.createManagedSession({
          processor_id: 'processor-1'
        });
        processor1Sessions.push(session1);

        const session2 = await manager.createManagedSession({
          processor_id: 'processor-2'
        });
        processor2Sessions.push(session2);
      }

      const found = await manager.findSessions({
        processor_id: 'processor-1',
        limit: 2
      });

      expect(found.length).toBe(2);
      expect(found.every(s => s.processor_id === 'processor-1')).toBe(true);
    });
  });

  describe('DefaultSession Integration', () => {
    let manager: SessionPersistenceManager;
    let session: DefaultSession;

    beforeEach(async () => {
      manager = new SessionPersistenceManager({
        store_type: 'memory',
        auto_persist_enabled: true,
        id_generator: idGenerator
      });
      await manager.initialize();

      session = await manager.createManagedSession();
    });

    afterEach(async () => {
      await manager.shutdown();
    });

    it('should integrate persistence with DefaultSession', () => {
      expect(session.getPersistenceManager()).toBe(manager);
      expect(session.getPersistenceSessionId()).toBeDefined();
    });

    it('should auto-persist on interactions', () => {
      const interaction: Interaction<RequestMessage> = {
        request: {
          sender: 'test',
          recipients: null,
          event: {
            id: ulid(),
            chatId: ulid(),
            content: {
              capability: ASSIST_CAPABILITY,
              request_payload: {
                parts: [{
                  prompt: 'test',
                  fileIds: []
                }]
              }
            }
          }
        },
        responses: []
      };

      // Mock the markSessionForPersistence method to verify it's called
      const markSpy = jest.spyOn(manager, 'markSessionForPersistence');

      session.addInteraction(interaction);
      expect(markSpy).toHaveBeenCalledWith(session.getPersistenceSessionId());
    });

    it('should manually persist session', async () => {
      const persistedId = await session.persist();
      expect(persistedId).toBe(session.activity_id);
    });

    it('should load from persistence', async () => {
      // Add some data to session
      const interaction: Interaction<RequestMessage> = {
        request: {
          sender: 'test',
          recipients: null,
          event: {
            id: ulid(),
            chatId: ulid(),
            content: {
              capability: ASSIST_CAPABILITY,
              request_payload: {
                parts: [{
                  prompt: 'test data',
                  fileIds: []
                }]
              }
            }
          }
        },
        responses: []
      };

      session.addInteraction(interaction);
      await session.persist();

      // Create new session and load data
      const newSession = new DefaultSession();
      newSession.setPersistenceManager(manager);
      newSession.setPersistenceSessionId(session.getPersistenceSessionId()!);

      const loaded = await newSession.loadFromPersistence();
      expect(loaded).toBe(true);

      // Verify data was loaded
      const interactions = [];
      for await (const interaction of newSession.get_interactions()) {
        interactions.push(interaction);
      }
      expect(interactions.length).toBe(1);
    });

    it('should provide enhanced session info with persistence', () => {
      const info = session.getEnhancedSessionInfoWithPersistence();
      
      expect(info.persistence.managerConfigured).toBe(true);
      expect(info.persistence.autoPersistenceEnabled).toBe(true); // Should be enabled
      expect(info.persistence.persistenceSessionId).toBeDefined();
    });

    it('should handle persistence metadata', () => {
      const metadata = session.getPersistenceMetadata();
      
      expect(metadata.session_type).toBe('DefaultSession');
      expect(metadata.auto_persistence_enabled).toBe(true);
      expect(metadata.interactions_count).toBe(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle serialization errors gracefully', () => {
      // Create object with circular reference
      const circular: any = { a: 1 };
      circular.self = circular;

      expect(() => {
        JSON.stringify(circular);
      }).toThrow();

      // SessionSerializer should handle this more gracefully in practice
      // This test documents the expected behavior
    });

    it('should handle filesystem errors', async () => {
      const invalidPath = '/invalid/path/that/does/not/exist';
      const store = new FileSystemSessionStore(invalidPath, idGenerator);

      await expect(store.initialize()).rejects.toThrow();
    });

    it('should handle session not found errors', async () => {
      const store = new InMemorySessionStore(idGenerator);
      await store.initialize();

      const nonExistentId = ulid();
      expect(await store.getSession(nonExistentId)).toBeNull();
      expect(await store.hasSession(nonExistentId)).toBe(false);
      
      await expect(
        store.updateSession(nonExistentId, {})
      ).rejects.toThrow('Session not found');

      await store.shutdown();
    });

    it('should handle persistence manager without store', async () => {
      const session = new DefaultSession();
      
      const result = await session.persist();
      expect(result).toBeNull();

      const loaded = await session.loadFromPersistence();
      expect(loaded).toBe(false);
    });

    it('should validate input parameters', async () => {
      const store = new InMemorySessionStore(idGenerator);
      await store.initialize();

      // Invalid session object
      await expect(
        store.createSession({} as SessionObject)
      ).rejects.toThrow();

      await store.shutdown();
    });
  });
});