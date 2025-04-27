"use strict";
/**
 * Agent Interface
 *
 * This module defines the AbstractAgent class, which is the foundation for all agents
 * in the Sentient Agent Framework. It provides a common interface for agents to
 * process requests and generate responses.
 *
 * @example
 * ```typescript
 * class MyAgent extends AbstractAgent {
 *   constructor() {
 *     super('My Custom Agent');
 *   }
 *
 *   async assist(session: Session, query: Query, responseHandler: ResponseHandler): Promise<void> {
 *     // Implement your agent logic here
 *   }
 * }
 * ```
 *
 * @module sentient-agent-framework/interface/agent
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractAgent = void 0;
/**
 * An agent that has an identity and an assist method.
 */
class AbstractAgent {
    name;
    constructor(name) {
        this.name = name;
    }
}
exports.AbstractAgent = AbstractAgent;
//# sourceMappingURL=agent.js.map