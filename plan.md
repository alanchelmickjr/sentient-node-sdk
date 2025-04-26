# Conversion Plan: Sentient Agent Framework - Python to TypeScript

This document outlines the step-by-step process for converting the Sentient Agent Framework from Python to TypeScript for use in Node.js and Next.js projects.

## 1. Set Up Node.js Package Structure

- [x] Create basic package.json structure
- [x] Set up TypeScript configuration (tsconfig.json)
- [ ] Configure ESLint and Prettier
- [ ] Set up Jest for testing
- [x] Create build scripts with rollup/esbuild/tsc
- [x] Directory structure:
  ```
  sentient-agent-framework/
  ├── src/
  │   ├── interface/       # TypeScript interfaces
  │   ├── implementation/  # Concrete implementations
  │   └── index.ts         # Main export file
  ├── dist/                # Compiled output
  ├── examples/            # Example implementations
  ├── tests/               # Test files
  ├── tsconfig.json        # TypeScript config
  ├── package.json         # Package definition
  └── README.md            # Updated documentation
  ```

## 2. Convert Core Interfaces

- [ ] Convert Event classes (interface/events.tsx → src/interface/events.ts)
  - Convert Pydantic models to TypeScript interfaces/classes
  - Replace Python enums with TypeScript enums

- [ ] Convert Hook interface (interface/hook.tsx → src/interface/hook.ts)
  - Define TypeScript Protocol equivalent

- [x] Convert Identity class (interface/identity.tsx → src/interface/identity.ts)
  - Convert Pydantic model to TypeScript class with validation

- [x] Convert Exception classes (interface/exceptions.tsx → src/interface/exceptions.ts)
  - Define custom error classes extending Error

- [ ] Convert Request/Query classes (interface/request.tsx → src/interface/request.ts)
  - Convert to TypeScript with proper type definitions

- [ ] Convert Session classes (interface/session.tsx → src/interface/session.ts)
  - Convert complex Session hierarchy to TypeScript
  - Use TypeScript Generics for the type parameters

- [ ] Convert ResponseHandler interface (interface/response_handler.tsx → src/interface/responseHandler.ts)
  - Define interface with proper TypeScript methods

- [ ] Convert AbstractAgent class (interface/agent.ts → src/interface/agent.ts)
  - Convert to abstract TypeScript class

## 3. Convert Implementations

- [x] Convert DefaultIdGenerator (implementation/default_id_generator.py → src/implementation/default_id_generator.ts)
  - Implement ULID handling in TypeScript
  - Handle async locking mechanism with appropriate TypeScript patterns

- [x] Convert DefaultHook (implementation/default_hook.tsx → src/implementation/default_hook.tsx)
  - Convert async queue handling to TypeScript

- [x] Convert DefaultTextStream (implementation/default_text_stream.py → src/implementation/default_text_stream.ts)
  - Implement StreamEventEmitter interface in TypeScript

- [ ] Convert DefaultResponseHandler (implementation/default_response_handler.py → src/implementation/default_response_handler.ts)
  - Convert Python decorator patterns to TypeScript patterns
  - Handle event emission in TypeScript

- [x] Convert DefaultSession (implementation/default_session.py → src/implementation/default_session.ts)
  - Convert to TypeScript class implementing Session interface

- [x] Convert DefaultServer (implementation/default_server.py → src/implementation/default_server.ts)
  - Replace FastAPI with Express.js or Next.js API routes
  - Convert SSE implementation to Node.js patterns
  - Use proper TypeScript async patterns

## 4. Create Main Export API

- [x] Create src/index.ts to export all public components
- [ ] Define proper TypeScript exports for library consumers
- [ ] Ensure type definitions are generated properly

## 5. Update Documentation

- [ ] Update README.md to reflect Node.js/TypeScript usage
  - Change installation instructions from pip to npm
  - Update code examples from Python to TypeScript
  - Update architecture diagrams if necessary

- [ ] Convert interface/README.md to TypeScript examples
- [x] Convert implementation/README.md to TypeScript examples
    - Implementation directory is now TypeScript/Node.js-centric. All ported files are under src/implementation/. Legacy Python files remain for reference.
- [ ] Add JSDoc comments throughout the codebase

## 6. Testing & Examples

- [ ] Set up Jest testing framework
- [ ] Write unit tests for core components
- [ ] Convert Python examples to TypeScript
- [ ] Create a simple example Next.js application

## 7. Build & Publish

- [x] Set up build pipeline with proper bundling
- [ ] Generate type definitions (.d.ts files)
- [x] Create npm package scripts
- [ ] Set up GitHub Actions for CI/CD
- [ ] Publish to npm registry

## 8. Additional Considerations

- [ ] Handle Python-specific patterns that don't have direct TypeScript equivalents:
  - Replace Pydantic with Zod or similar
  - Use appropriate async patterns for Node.js
  - Replace asyncio with Node.js Event Emitter or Promises
  - Convert ULID implementation to a JavaScript library

- [ ] Consider browser compatibility if needed
- [ ] Evaluate performance optimizations for Node.js environment

## Completion Checklist

Each task should be marked as complete when:
- [ ] Code is converted to TypeScript
- [ ] Tests pass
- [ ] Documentation is updated
- [ ] Example usage works as expected