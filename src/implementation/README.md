# Implementation Directory – TypeScript/Node.js Port

This directory contains the concrete implementations for the Sentient Agent Framework as ported to TypeScript and Node.js for npm distribution and Next.js/Express environments.

---

## Key Components

### DefaultServer (src/implementation/default_server.ts)
- **TypeScript/Express implementation** of the server that streams agent output to clients via Server-Sent Events (SSE).
- Replaces Python FastAPI/Uvicorn with Express and Node.js HTTP primitives.
- Handles `/assist` HTTP endpoint, instantiates agent session, hook, and response handler, and streams events.

### DefaultSession (src/implementation/default_session.ts)
- **TypeScript class** that wraps a SessionObject and provides accessors for processorId, activityId, requestId, and an async iterable of interactions.
- Replaces Python attribute access with TypeScript getters.

### DefaultHook (src/implementation/default_hook.tsx)
- **TypeScript implementation** of an async event queue hook.
- Collects events in an array (queue) and uses DefaultIdGenerator to ensure monotonic event IDs.

### DefaultIdGenerator (src/implementation/default_id_generator.ts)
- **ULID-based ID generator** using the `ulid` npm package and a mutex for monotonic, thread-safe generation.
- TypeScript port of the Python class, using async/await and JavaScript's monotonicFactory.

### DefaultTextStream (src/implementation/default_text_stream.ts)
- **Streams text chunks as events** using the StreamEventEmitter interface.
- Provides methods to emit chunks and mark the stream as complete.

### DefaultResponseHandler (src/implementation/default_response_handler.ts)
- **Not yet ported.**
- Will manage event emission, stream management, and response completion.

---

## TypeScript/Node.js Migration Notes

- **Express** replaces FastAPI/Uvicorn for HTTP and SSE.
- **ulid** npm package replaces Python's `ulid` library.
- All types are statically defined with TypeScript interfaces and classes.
- Async patterns use `async/await` and Promises.
- Queueing uses arrays (or custom async queues) instead of Python's asyncio.Queue.
- All IDs are strings (ULIDs).
- Python-specific features (Pydantic, Field, decorators) are replaced with TypeScript idioms.

---

## Migration Status

| Component              | File                                      | Status         |
|------------------------|-------------------------------------------|----------------|
| DefaultServer          | src/implementation/default_server.ts       | ✅ Ported      |
| DefaultSession         | src/implementation/default_session.ts      | ✅ Ported      |
| DefaultHook            | src/implementation/default_hook.tsx        | ✅ Ported      |
| DefaultIdGenerator     | src/implementation/default_id_generator.ts | ✅ Ported      |
| DefaultTextStream      | src/implementation/default_text_stream.ts  | ✅ Ported      |
| DefaultResponseHandler | src/implementation/default_response_handler.ts | ⏳ Pending |
| (Legacy Python)        | implementation/*.py                        | 🚧 Legacy      |

---

## Usage

All implementations are now located under `src/implementation/` for npm/TypeScript consumption. Legacy Python files remain in `implementation/` for reference only.

---

## TODO

- Port DefaultResponseHandler to TypeScript.
- Replace all legacy imports with canonical src/ imports in the codebase.
- Complete interface/request.ts and interface/session.ts for full type safety.
- Add tests for each implementation.