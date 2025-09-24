import { Event, ResponseEvent } from './events';

export const DEFAULT_CAPABILITY = 'default';
export const ASSIST_CAPABILITY = 'assist';

export interface CapabilitySpec {
  name: string;
  description: string;
  stream_response: boolean;
}

export interface AtomicCapabilitySpec<I, O> extends CapabilitySpec {
  stream_response: false;
  input_schema: I;
  output_schema: O;
}

export interface StreamCapabilitySpec<I> extends CapabilitySpec {
  stream_response: true;
  input_schema: I;
  output_events_schema: Event[];
}

export interface CapabilityConfig {
  name: string;
  id: string;
  description?: string | null;
}

export interface CapabilityRequestContent<I> {
  capability: string;
  request_payload: I;
}

export interface AssistRequestContentPart {
  prompt: string;
  fileIds: string[];
}

export interface AssistRequestContentParts {
  parts: AssistRequestContentPart[];
}

export interface AssistRequestContent
  extends CapabilityRequestContent<AssistRequestContentParts> {
  capability: typeof ASSIST_CAPABILITY;
  request_payload: AssistRequestContentParts;
}

export interface Request<I> {
  id: string; // ULID
  chatId: string; // ULID
  content: CapabilityRequestContent<I>;
  parent_request_id?: string | null; // ULID
  root_request_id?: string | null; // ULID
}

export interface AssistRequest extends Request<AssistRequestContentParts> {
  content: AssistRequestContent;
}

export interface InteractionMessage {
  sender?: string | null;
  recipients?: Set<string> | null;
}

export interface RequestMessage extends InteractionMessage {
  event: AssistRequest;
}

export interface ResponseMessage extends InteractionMessage {
  event: ResponseEvent;
}

export interface Interaction<M extends InteractionMessage> {
  request: M;
  responses: ResponseMessage[];
}

export interface SessionObject {
  processor_id: string;
  activity_id: string; // ULID
  request_id: string; // ULID
  interactions: Interaction<RequestMessage>[];
}

export interface Session {
  readonly processor_id: string;
  readonly activity_id: string; // ULID
  readonly request_id: string; // ULID
  get_interactions(kwargs?: any): AsyncIterable<Interaction<RequestMessage>>;
}