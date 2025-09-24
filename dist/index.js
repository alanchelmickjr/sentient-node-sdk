"use strict";
/**
 * Sentient Agent Framework
 *
 * A TypeScript implementation of the Sentient Agent Framework for building
 * agents that serve Sentient Chat events.
 *
 * This package provides a complete framework for building agents that can
 * communicate with the Sentient platform's API. It includes interfaces for
 * defining agents, implementations for handling responses, and utilities
 * for streaming text and emitting events.
 *
 * @module sentient-agent-framework
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseEventAdapterImpl = void 0;
// Export interfaces
__exportStar(require("./interface/events"), exports);
__exportStar(require("./interface/exceptions"), exports);
__exportStar(require("./interface/hook"), exports);
__exportStar(require("./interface/identity"), exports);
__exportStar(require("./interface/request"), exports);
__exportStar(require("./interface/response_handler"), exports);
__exportStar(require("./interface/session"), exports);
__exportStar(require("./interface/agent"), exports);
__exportStar(require("./interface/llm"), exports);
// Export event factories
__exportStar(require("./interface/event_factories"), exports);
// Export implementations
__exportStar(require("./implementation/default_id_generator"), exports);
__exportStar(require("./implementation/default_hook"), exports);
__exportStar(require("./implementation/default_text_stream"), exports);
__exportStar(require("./implementation/default_response_handler"), exports);
__exportStar(require("./implementation/default_session"), exports);
__exportStar(require("./implementation/default_server"), exports);
__exportStar(require("./implementation/default_llm_provider"), exports);
__exportStar(require("./implementation/decorators"), exports);
// Export ResponseEventAdapter implementation with a different name to avoid naming conflicts
const response_event_adapter_1 = require("./implementation/response_event_adapter");
Object.defineProperty(exports, "ResponseEventAdapterImpl", { enumerable: true, get: function () { return response_event_adapter_1.ResponseEventAdapter; } });
// Export client
__exportStar(require("./client/sentient_agent_client"), exports);
//# sourceMappingURL=index.js.map