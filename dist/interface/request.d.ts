/**
 * TypeScript port of Query and Request for Sentient Agent Framework.
 */
import { SessionObject } from './session';
export interface Query {
    id: string;
    prompt: string;
}
export interface Request {
    query: Query;
    session?: SessionObject;
}
