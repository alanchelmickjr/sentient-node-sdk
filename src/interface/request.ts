/**
 * TypeScript port of Query and Request for Sentient Agent Framework.
 */

import { SessionObject } from './session'; // Placeholder import, to be ported

export interface Query {
  id: string; // ULID
  prompt: string;
}

export interface Request {
  query: Query;
  session?: SessionObject;
}