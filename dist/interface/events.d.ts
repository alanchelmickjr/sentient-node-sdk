/**
 * Event Types for Sentient Agent Framework
 *
 * This module defines the event types used in the Sentient Agent Framework.
 * It includes interfaces for different types of events that can be emitted
 * by agents, such as text blocks, JSON documents, streaming text, and errors.
 *
 * The event system is designed to be flexible and extensible, allowing agents
 * to emit a variety of event types to provide a rich user experience.
 *
 * @module sentient-agent-framework/interface/events
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */
export declare const ERROR = "error";
export declare const DEFAULT_ERROR_CODE = 500;
export declare enum BaseEventType {
    ATOMIC = "atomic",
    CHUNKED = "chunked"
}
export declare enum EventContentType {
    JSON = "atomic.json",
    TEXTBLOCK = "atomic.textblock",
    TEXT_STREAM = "chunked.text",
    ERROR = "atomic.error",
    DONE = "atomic.done"
}
export type EventMetadata = Record<string, string | number | boolean>;
export interface Event {
    content_type: EventContentType;
    event_name: string;
}
export interface BaseEvent extends Event {
    schema_version?: string;
    id: string;
    source: string;
    metadata?: EventMetadata;
}
export interface AtomicEvent extends BaseEvent {
}
export interface StreamEvent extends BaseEvent {
    stream_id: string;
    is_complete: boolean;
}
export interface DocumentEvent extends AtomicEvent {
    content_type: EventContentType.JSON;
    content: Record<string, any>;
}
export interface TextBlockEvent extends AtomicEvent {
    content_type: EventContentType.TEXTBLOCK;
    content: string;
}
export interface TextChunkEvent extends StreamEvent {
    content_type: EventContentType.TEXT_STREAM;
    content: string;
}
export interface ErrorContent {
    error_message: string;
    error_code?: number;
    details?: Record<string, any>;
}
export interface ErrorEvent extends AtomicEvent {
    content_type: EventContentType.ERROR;
    event_name: typeof ERROR;
    content: ErrorContent;
}
export interface DoneEvent extends AtomicEvent {
    content_type: EventContentType.DONE;
    event_name: "done";
}
export type ResponseEvent = DocumentEvent | TextBlockEvent | TextChunkEvent | ErrorEvent | DoneEvent;
