import { PersistedSession, SessionBackup } from '../interface/session_store';
import { Interaction, RequestMessage } from '../interface/session';

/**
 * Session serialization format version
 */
export const SERIALIZATION_VERSION = '1.0';

/**
 * Serializable session data structure
 */
export interface SerializedSession {
  version: string;
  session_id: string;
  processor_id: string;
  activity_id: string;
  request_id: string;
  interactions: any[];
  created_at: string; // ISO string
  updated_at: string; // ISO string
  expires_at?: string; // ISO string
  metadata: Record<string, any>;
  tags: string[];
  session_version: number;
}

/**
 * Serializable backup data structure
 */
export interface SerializedBackup {
  version: string;
  backup_id: string;
  created_at: string; // ISO string
  sessions: SerializedSession[];
  metadata: {
    total_sessions: number;
    backup_format_version: string;
    source_store_type: string;
  };
}

/**
 * Serialization error class
 */
export class SerializationError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'SerializationError';
  }
}

/**
 * Session serialization utilities with ULID preservation
 */
export class SessionSerializer {
  /**
   * Serialize a PersistedSession to JSON-safe format
   */
  static serialize(session: PersistedSession): SerializedSession {
    try {
      return {
        version: SERIALIZATION_VERSION,
        session_id: session.session_id,
        processor_id: session.processor_id,
        activity_id: session.activity_id,
        request_id: session.request_id,
        interactions: SessionSerializer._serializeInteractions(session.interactions),
        created_at: session.created_at.toISOString(),
        updated_at: session.updated_at.toISOString(),
        expires_at: session.expires_at?.toISOString(),
        metadata: SessionSerializer._deepClone(session.metadata),
        tags: [...session.tags],
        session_version: session.version
      };
    } catch (error) {
      throw new SerializationError(
        `Failed to serialize session ${session.session_id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Deserialize a SerializedSession back to PersistedSession
   */
  static deserialize(serialized: SerializedSession): PersistedSession {
    try {
      // Validate version compatibility
      if (serialized.version !== SERIALIZATION_VERSION) {
        console.warn(
          `[SessionSerializer] Version mismatch: expected ${SERIALIZATION_VERSION}, got ${serialized.version}`
        );
      }

      return {
        session_id: serialized.session_id,
        processor_id: serialized.processor_id,
        activity_id: serialized.activity_id,
        request_id: serialized.request_id,
        interactions: SessionSerializer._deserializeInteractions(serialized.interactions),
        created_at: new Date(serialized.created_at),
        updated_at: new Date(serialized.updated_at),
        expires_at: serialized.expires_at ? new Date(serialized.expires_at) : undefined,
        metadata: SessionSerializer._deepClone(serialized.metadata),
        tags: [...serialized.tags],
        version: serialized.session_version
      };
    } catch (error) {
      throw new SerializationError(
        `Failed to deserialize session ${serialized.session_id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Serialize session to JSON string
   */
  static toJSON(session: PersistedSession, pretty = false): string {
    try {
      const serialized = SessionSerializer.serialize(session);
      return JSON.stringify(serialized, null, pretty ? 2 : 0);
    } catch (error) {
      throw new SerializationError(
        `Failed to convert session to JSON: ${session.session_id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Deserialize session from JSON string
   */
  static fromJSON(json: string): PersistedSession {
    try {
      const parsed = JSON.parse(json);
      return SessionSerializer.deserialize(parsed);
    } catch (error) {
      throw new SerializationError(
        'Failed to parse session from JSON',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Serialize multiple sessions to JSON string
   */
  static sessionsToJSON(sessions: PersistedSession[], pretty = false): string {
    try {
      const serialized = sessions.map(session => SessionSerializer.serialize(session));
      return JSON.stringify(serialized, null, pretty ? 2 : 0);
    } catch (error) {
      throw new SerializationError(
        'Failed to serialize sessions to JSON',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Deserialize multiple sessions from JSON string
   */
  static sessionsFromJSON(json: string): PersistedSession[] {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        throw new Error('Expected array of sessions');
      }
      return parsed.map(serialized => SessionSerializer.deserialize(serialized));
    } catch (error) {
      throw new SerializationError(
        'Failed to parse sessions from JSON',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Serialize a SessionBackup to JSON-safe format
   */
  static serializeBackup(backup: SessionBackup): SerializedBackup {
    try {
      return {
        version: SERIALIZATION_VERSION,
        backup_id: backup.backup_id,
        created_at: backup.created_at.toISOString(),
        sessions: backup.sessions.map(session => SessionSerializer.serialize(session)),
        metadata: SessionSerializer._deepClone(backup.metadata)
      };
    } catch (error) {
      throw new SerializationError(
        `Failed to serialize backup ${backup.backup_id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Deserialize a SerializedBackup back to SessionBackup
   */
  static deserializeBackup(serialized: SerializedBackup): SessionBackup {
    try {
      // Validate version compatibility
      if (serialized.version !== SERIALIZATION_VERSION) {
        console.warn(
          `[SessionSerializer] Backup version mismatch: expected ${SERIALIZATION_VERSION}, got ${serialized.version}`
        );
      }

      return {
        backup_id: serialized.backup_id,
        created_at: new Date(serialized.created_at),
        sessions: serialized.sessions.map(session => SessionSerializer.deserialize(session)),
        metadata: SessionSerializer._deepClone(serialized.metadata)
      };
    } catch (error) {
      throw new SerializationError(
        `Failed to deserialize backup ${serialized.backup_id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Serialize backup to JSON string
   */
  static backupToJSON(backup: SessionBackup, pretty = false): string {
    try {
      const serialized = SessionSerializer.serializeBackup(backup);
      return JSON.stringify(serialized, null, pretty ? 2 : 0);
    } catch (error) {
      throw new SerializationError(
        `Failed to convert backup to JSON: ${backup.backup_id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Deserialize backup from JSON string
   */
  static backupFromJSON(json: string): SessionBackup {
    try {
      const parsed = JSON.parse(json);
      return SessionSerializer.deserializeBackup(parsed);
    } catch (error) {
      throw new SerializationError(
        'Failed to parse backup from JSON',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Validate serialized session data structure
   */
  static validateSerialized(data: any): data is SerializedSession {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const required = [
      'session_id', 'processor_id', 'activity_id', 'request_id',
      'interactions', 'created_at', 'updated_at', 'metadata', 'tags', 'session_version'
    ];

    return required.every(field => field in data) &&
           typeof data.session_id === 'string' &&
           typeof data.processor_id === 'string' &&
           typeof data.activity_id === 'string' &&
           typeof data.request_id === 'string' &&
           Array.isArray(data.interactions) &&
           typeof data.created_at === 'string' &&
           typeof data.updated_at === 'string' &&
           typeof data.metadata === 'object' &&
           Array.isArray(data.tags) &&
           typeof data.session_version === 'number';
  }

  /**
   * Validate serialized backup data structure
   */
  static validateSerializedBackup(data: any): data is SerializedBackup {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    return 'backup_id' in data &&
           'created_at' in data &&
           'sessions' in data &&
           'metadata' in data &&
           typeof data.backup_id === 'string' &&
           typeof data.created_at === 'string' &&
           Array.isArray(data.sessions) &&
           typeof data.metadata === 'object' &&
           data.sessions.every((session: any) => SessionSerializer.validateSerialized(session));
  }

  /**
   * Create a compressed representation of sessions (removes metadata, etc.)
   */
  static compress(sessions: PersistedSession[]): string {
    try {
      const compressed = sessions.map(session => ({
        i: session.session_id,
        p: session.processor_id,
        a: session.activity_id,
        r: session.request_id,
        x: session.interactions.length,
        c: session.created_at.getTime(),
        u: session.updated_at.getTime(),
        e: session.expires_at?.getTime(),
        v: session.version
      }));
      return JSON.stringify(compressed);
    } catch (error) {
      throw new SerializationError(
        'Failed to compress sessions',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Serialize interactions array with proper type handling
   */
  private static _serializeInteractions(interactions: Interaction<RequestMessage>[]): any[] {
    return interactions.map(interaction => ({
      request: SessionSerializer._serializeMessage(interaction.request),
      responses: interaction.responses.map(response => SessionSerializer._serializeMessage(response))
    }));
  }

  /**
   * Deserialize interactions array
   */
  private static _deserializeInteractions(interactions: any[]): Interaction<RequestMessage>[] {
    return interactions.map(interaction => ({
      request: SessionSerializer._deserializeMessage(interaction.request),
      responses: interaction.responses.map((response: any) => SessionSerializer._deserializeMessage(response))
    }));
  }

  /**
   * Serialize a message (RequestMessage or ResponseMessage)
   */
  private static _serializeMessage(message: any): any {
    return {
      sender: message.sender,
      recipients: message.recipients ? Array.from(message.recipients) : null,
      event: message.event
    };
  }

  /**
   * Deserialize a message
   */
  private static _deserializeMessage(message: any): any {
    return {
      sender: message.sender,
      recipients: message.recipients ? new Set(message.recipients) : null,
      event: message.event
    };
  }

  /**
   * Deep clone an object to avoid reference issues
   */
  public static _deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Set) {
      return new Set(Array.from(obj)) as unknown as T;
    }

    if (obj instanceof Map) {
      return new Map(Array.from(obj.entries())) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => SessionSerializer._deepClone(item)) as unknown as T;
    }

    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        (cloned as any)[key] = SessionSerializer._deepClone(obj[key]);
      }
    }

    return cloned;
  }
}

/**
 * Utility functions for session data validation and migration
 */
export class SessionDataUtils {
  /**
   * Check if a session is expired
   */
  static isExpired(session: PersistedSession): boolean {
    return session.expires_at ? session.expires_at <= new Date() : false;
  }

  /**
   * Calculate session age in milliseconds
   */
  static getAge(session: PersistedSession): number {
    return Date.now() - session.created_at.getTime();
  }

  /**
   * Calculate time since last update in milliseconds
   */
  static getTimeSinceUpdate(session: PersistedSession): number {
    return Date.now() - session.updated_at.getTime();
  }

  /**
   * Calculate remaining time to expiration in milliseconds
   */
  static getTimeToExpiration(session: PersistedSession): number | null {
    if (!session.expires_at) {
      return null;
    }
    return session.expires_at.getTime() - Date.now();
  }

  /**
   * Migrate session data from older formats (placeholder for future use)
   */
  static migrate(data: any, fromVersion: string, toVersion: string): any {
    // Placeholder for future migration logic
    console.info(`[SessionDataUtils] Migration from ${fromVersion} to ${toVersion} - no changes needed`);
    return data;
  }

  /**
   * Sanitize session data for safe serialization
   */
  static sanitize(session: PersistedSession): PersistedSession {
    return {
      ...session,
      metadata: SessionSerializer._deepClone(session.metadata),
      tags: [...session.tags],
      interactions: SessionSerializer._deepClone(session.interactions)
    };
  }

  /**
   * Generate session statistics from array of sessions
   */
  static generateStats(sessions: PersistedSession[]): {
    total: number;
    active: number;
    expired: number;
    oldest_age_ms: number;
    newest_age_ms: number;
    average_interactions: number;
  } {
    if (sessions.length === 0) {
      return {
        total: 0,
        active: 0,
        expired: 0,
        oldest_age_ms: 0,
        newest_age_ms: 0,
        average_interactions: 0
      };
    }

    const now = Date.now();
    let active = 0;
    let expired = 0;
    let totalInteractions = 0;
    let oldestTime = Infinity;
    let newestTime = 0;

    for (const session of sessions) {
      if (SessionDataUtils.isExpired(session)) {
        expired++;
      } else {
        active++;
      }

      totalInteractions += session.interactions.length;
      const createdTime = session.created_at.getTime();
      
      if (createdTime < oldestTime) {
        oldestTime = createdTime;
      }
      if (createdTime > newestTime) {
        newestTime = createdTime;
      }
    }

    return {
      total: sessions.length,
      active,
      expired,
      oldest_age_ms: now - oldestTime,
      newest_age_ms: now - newestTime,
      average_interactions: totalInteractions / sessions.length
    };
  }
}