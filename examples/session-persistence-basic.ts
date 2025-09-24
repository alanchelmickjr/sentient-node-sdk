/**
 * Basic Session Persistence Example
 * 
 * Demonstrates basic setup and usage of the session persistence system
 * with in-memory storage for development.
 */

import { SessionPersistenceManager } from '../src/implementation/session_persistence_manager';
import { DefaultSession } from '../src/implementation/default_session';
import { ASSIST_CAPABILITY } from '../src/interface/session';
import { ulid } from 'ulid';

async function basicPersistenceExample() {
  console.log('=== Basic Session Persistence Example ===\n');

  // 1. Create persistence manager with memory store
  const manager = new SessionPersistenceManager({
    store_type: 'memory',
    auto_persist_enabled: true,
    auto_persist_interval_ms: 5000, // 5 seconds for demo
    default_session_ttl_ms: 300000, // 5 minutes
  });

  await manager.initialize();
  console.log('✓ Persistence manager initialized\n');

  // 2. Create a managed session
  const session = await manager.createManagedSession({
    processor_id: 'demo-processor',
    activity_id: ulid(),
    request_id: ulid()
  }, {
    metadata: { 
      user_id: '12345',
      session_type: 'demo',
      created_by: 'example'
    },
    tags: ['demo', 'basic-example'],
    expires_at: new Date(Date.now() + 300000) // 5 minutes
  });

  console.log(`✓ Session created: ${session.activity_id}`);
  console.log(`  Processor: ${session.processor_id}`);
  console.log(`  Auto-persistence enabled: ${session.isAutoPersistenceEnabled()}\n`);

  // 3. Add some interactions to the session
  console.log('Adding interactions...');
  for (let i = 0; i < 3; i++) {
    session.addInteraction({
      request: {
        sender: `user-${i}`,
        recipients: null,
        event: {
          id: ulid(),
          chatId: ulid(),
          content: {
            capability: ASSIST_CAPABILITY,
            request_payload: {
              parts: [{
                prompt: `Demo message ${i + 1}`,
                fileIds: []
              }]
            }
          }
        }
      },
      responses: []
    });
  }

  // 4. Manually persist the session
  const persistedId = await session.persist();
  console.log(`✓ Session manually persisted with ID: ${persistedId}\n`);

  // 5. Verify the session was saved
  const retrievedSession = await manager.getSession(session.activity_id);
  if (retrievedSession) {
    console.log('✓ Session successfully retrieved from storage');
    console.log(`  Interactions: ${retrievedSession.interactions.length}`);
    console.log(`  Metadata: ${JSON.stringify(retrievedSession.metadata)}`);
    console.log(`  Tags: ${retrievedSession.tags.join(', ')}\n`);
  }

  // 6. Query sessions
  console.log('Querying sessions...');
  const allSessions = await manager.listSessions();
  console.log(`✓ Total sessions in store: ${allSessions.length}`);

  const demoSessions = await manager.listSessions({
    processor_id: 'demo-processor'
  });
  console.log(`✓ Demo processor sessions: ${demoSessions.length}`);

  const taggedSessions = await manager.listSessions({
    tags: ['demo']
  });
  console.log(`✓ Sessions with 'demo' tag: ${taggedSessions.length}\n`);

  // 7. Get statistics
  const stats = await manager.getStats();
  console.log('Storage Statistics:');
  console.log(`  Total sessions: ${stats.total_sessions}`);
  console.log(`  Active sessions: ${stats.active_sessions}`);
  console.log(`  Store type: ${stats.store_type}`);
  console.log(`  Persist count: ${stats.persist_count}\n`);

  // 8. Create and test a new session instance that loads from storage
  console.log('Testing session loading...');
  const newSession = new DefaultSession();
  newSession.setPersistenceManager(manager);
  newSession.setPersistenceSessionId(session.activity_id);
  
  const loaded = await newSession.loadFromPersistence();
  if (loaded) {
    console.log('✓ Session data loaded into new instance');
    
    // Verify interactions were loaded
    const interactions = [];
    for await (const interaction of newSession.get_interactions()) {
      interactions.push(interaction);
    }
    console.log(`✓ Loaded ${interactions.length} interactions\n`);
  }

  // 9. Test session expiration
  console.log('Testing session lifecycle...');
  
  // Create a session that expires quickly
  const shortSession = await manager.createManagedSession({
    processor_id: 'demo-processor'
  }, {
    expires_at: new Date(Date.now() + 100) // Expires in 100ms
  });
  
  console.log(`✓ Created short-lived session: ${shortSession.activity_id}`);
  
  // Wait for expiration
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const expiredIds = await manager.expireSessions();
  console.log(`✓ Found ${expiredIds.length} expired sessions`);
  
  const cleanedCount = await manager.cleanupExpiredSessions();
  console.log(`✓ Cleaned up ${cleanedCount} expired sessions\n`);

  // 10. Shutdown gracefully
  console.log('Shutting down...');
  await manager.shutdown();
  console.log('✓ Persistence manager shut down gracefully\n');

  console.log('=== Basic Session Persistence Example Complete ===');
}

// Run the example
if (require.main === module) {
  basicPersistenceExample().catch(console.error);
}

export { basicPersistenceExample };