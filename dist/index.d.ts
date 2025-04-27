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
export * from './interface/events';
export * from './interface/exceptions';
export * from './interface/hook';
export * from './interface/identity';
export * from './interface/request';
export * from './interface/response_handler';
export * from './interface/session';
export * from './interface/agent';
export * from './interface/event_factories';
export * from './implementation/default_id_generator';
export * from './implementation/default_hook';
export * from './implementation/default_text_stream';
export * from './implementation/default_response_handler';
export * from './implementation/default_session';
export * from './implementation/default_server';
import { ResponseEventAdapter as ResponseEventAdapterImpl } from './implementation/response_event_adapter';
export { ResponseEventAdapterImpl };
export * from './client/sentient_agent_client';
