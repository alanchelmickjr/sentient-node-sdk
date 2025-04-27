# Sentient Agent Framework

<p align="center">
  <img src="src/banner.png" alt="Sentient Agent Framework" width="600"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/sentient-agent-framework">
    <img src="https://img.shields.io/npm/v/sentient-agent-framework" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/sentient-agent-framework">
    <img src="https://img.shields.io/npm/dm/sentient-agent-framework" alt="npm downloads">
  </a>
  <a href="https://github.com/sentient-agi/sentient-agent-framework/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/sentient-agi/sentient-agent-framework" alt="license">
  </a>
</p>

<p align="center">
  <a href="https://sentient.xyz/" target="_blank">
    <img alt="Homepage" src="https://img.shields.io/badge/Website-Sentient.xyz-%23EAEAEA?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNDEuMzMzIiBoZWlnaHQ9IjM0MS4zMzMiIHZlcnNpb249IjEuMCIgdmlld0JveD0iMCAwIDI1NiAyNTYiPjxwYXRoIGQ9Ik0xMzIuNSAyOC40Yy0xLjUgMi4yLTEuMiAzLjkgNC45IDI3LjIgMy41IDEzLjcgOC41IDMzIDExLjEgNDIuOSAyLjYgOS45IDUuMyAxOC42IDYgMTkuNCAzLjIgMy4zIDExLjctLjggMTMuMS02LjQuNS0xLjktMTcuMS03Mi0xOS43LTc4LjYtMS4yLTMtNy41LTYuOS0xMS4zLTYuOS0xLjYgMC0zLjEuOS00LjEgMi40ek0xMTAgMzBjLTEuMSAxLjEtMiAzLjEtMiA0LjVzLjkgMy40IDIgNC41IDMuMSAyIDQuNSAyIDMuNC0uOSA0LjUtMiAyLTMuMSAyLTQuNS0uOS0zLjQtMi00LjUtMy4xLTItNC41LTItMy40LjktNC41IDJ6TTgxLjUgNDYuMWMtMi4yIDEuMi00LjYgMi44LTUuMiAzLjctMS44IDIuMy0xLjYgNS42LjUgNy40IDEuMyAxLjIgMzIuMSAxMC4yIDQ1LjQgMTMuMyAzIC44IDYuOC0yLjIgNi44LTUuMyAwLTMuNi0yLjItOS4yLTMuOS0xMC4xQzEyMy41IDU0LjIgODcuMiA0NCA4NiA0NGMtLjMuMS0yLjMgMS00LjUgMi4xek0xNjUgNDZjLTEuMSAxLjEtMiAyLjUtMiAzLjIgMCAyLjggMTEuMyA0NC41IDEyLjYgNDYuNS45IDEuNSAyLjQgMi4zIDQuMiAyLjMgMy44IDAgOS4yLTUuNiA5LjItOS40IDAtMS41LTIuMS0xMC45LTQuNy0yMC44bC00LjctMTguMS00LjUtMi44Yy01LjMtMy40LTcuNC0zLjYtMTAuMS0uOXpNNDguNyA2NS4xYy03LjcgNC4xLTYuOSAxMC43IDEuNSAxMyAyLjQuNiAyMS40IDUuOCA0Mi4yIDExLjYgMjIuOCA2LjIgMzguOSAxMC4yIDQwLjMgOS44IDMuNS0uOCA0LjYtMy44IDMuMi04LjgtMS41LTUuNy0yLjMtNi41LTguMy04LjJDOTQuMiA3My4xIDU2LjYgNjMgNTQuOCA2M2MtMS4zLjEtNCAxLTYuMSAyLjF6TTE5OC4yIDY0LjdjLTMuMSAyLjgtMy41IDUuNi0xLjEgOC42IDQgNS4xIDEwLjkgMi41IDEwLjktNC4xIDAtNS4zLTUuOC03LjktOS44LTQuNXpNMTgxLjggMTEzLjFjLTI3IDI2LjQtMzEuOCAzMS41LTMxLjggMzMuOSAwIDEuNi43IDMuNSAxLjUgNC40IDEuNyAxLjcgNy4xIDMgMTAuMiAyLjQgMi4xLS4zIDU2LjktNTMuNCA1OS01Ny4xIDEuNy0zLjEgMS42LTkuOC0uMy0xMi41LTMuNi01LjEtNC45LTQuMi0zOC42IDI4Ljl6TTM2LjYgODguMWMtNSA0LTIuNCAxMC45IDQuMiAxMC45IDMuMyAwIDYuMi0yLjkgNi4yLTYuMyAwLTIuMS00LjMtNi43LTYuMy02LjctLjggMC0yLjYuOS00LjEgMi4xek02My40IDk0LjVjLTEuNi43LTguOSA3LjMtMTYuMSAxNC43TDM0IDEyMi43djUuNmMwIDYuMyAxLjYgOC43IDUuOSA4LjcgMi4xIDAgNi0zLjQgMTkuOS0xNy4zIDkuNS05LjUgMTcuMi0xOCAxNy4yLTE4LjkgMC00LjctOC40LTguNi0xMy42LTYuM3pNNjIuOSAxMzAuNiAzNCAxNTkuNXY1LjZjMCA2LjIgMS44IDguOSA2IDguOSAzLjIgMCA2Ni02Mi40IDY2LTY1LjYgMC0zLjMtMy41LTUuNi05LjEtNi4ybC01LS41LTI5IDI4Ljl6TTE5Ni4zIDEzNS4yYy05IDktMTYuNiAxNy4zLTE2LjkgMTguNS0xLjMgNS4xIDIuNiA4LjMgMTAgOC4zIDIuOCAwIDUuMi0yIDE3LjktMTQuOCAxNC41LTE0LjcgMTQuNy0xNC45IDE0LjctMTkuMyAwLTUuOC0yLjItOC45LTYuMi04LjktMi42IDAtNS40IDIuMy0xOS41IDE2LjJ6TTk2IDEzNi44Yy0yLjkuOS04IDYuNi04IDkgMCAxLjMgMi45IDEzLjQgNi40IDI3IDMuNiAxMy42IDcuOSAzMC4zIDkuNyAzNy4yIDEuNyA2LjkgMy42IDEzLjMgNC4xIDE0LjIuNSAxIDIuNiAyLjcgNC44IDMuOCA2LjggMy41IDExIDIuMyAxMS0zLjIgMC0zLTIwLjYtODMuMS0yMi4xLTg1LjktLjktMS45LTMuNi0yLjgtNS45LTIuMXpNMTIwLjUgMTU4LjRjLTEuOSAyLjktMS4yIDguNSAxLjQgMTEuNiAxLjEgMS40IDEyLjEgNC45IDM5LjYgMTIuNSAyMC45IDUuOCAzOC44IDEwLjUgMzkuOCAxMC41czMuNi0xIDUuNy0yLjJjOC4xLTQuNyA3LjEtMTAuNi0yLjMtMTMuMi0yOC4yLTguMS03OC41LTIxLjYtODAuMy0yMS42LTEuNCAwLTMgMS0zLjkgMi40ek0yMTAuNyAxNTguOGMtMS44IDEuOS0yLjIgNS45LS45IDcuOCAxLjUgMi4zIDUgMy40IDcuNiAyLjQgNi40LTIuNCA1LjMtMTEuMi0xLjUtMTEuOC0yLjQtLjItNCAuMy01LjIgMS42ek02OS42IDE2MmMtMiAyLjItMy42IDQuMy0zLjYgNC44LjEgMi42IDEwLjEgMzguNiAxMS4xIDM5LjkgMi4yIDIuNiA5IDUuNSAxMS41IDQuOSA1LTEuMyA0LjktMy0xLjUtMjcuNy0zLjMtMTIuNy02LjUtMjMuNy03LjItMjQuNS0yLjItMi43LTYuNC0xLjctMTAuMyAyLjZ6TTQ5LjYgMTgxLjVjLTIuNCAyLjUtMi45IDUuNC0xLjIgOEM1MiAxOTUgNjAgMTkzIDYwIDE4Ni42YzAtMS45LS44LTQtMS44LTQuOS0yLjMtMi4xLTYuNi0yLjItOC42LS4yek0xMjguNSAxODdjLTIuMyAyLjUtMS4zIDEwLjMgMS42IDEyLjggMi4yIDEuOSAzNC44IDExLjIgMzkuNCAxMS4yIDMuNiAwIDEwLjEtNC4xIDExLTcgLjYtMS45LTEuNy03LTMuMS03LS4yIDAtMTAuMy0yLjctMjIuMy02cy0yMi41LTYtMjMuMy02Yy0uOCAwLTIuMy45LTMuMyAyek0xMzYuNyAyMTYuOGMtMy40IDMuOC0xLjUgOS41IDMuNSAxMC43IDMuOSAxIDguMy0zLjQgNy4zLTcuMy0xLjItNS4xLTcuNS03LjEtMTAuOC0zLjR6Ii8%2BPC9zdmc%2B&link=https%3A%2F%2Fhuggingface.co%2FSentientagi"/>
  </a>
  <a href="https://x.com/SentientAGI">
    <img alt="Twitter Follow" src="https://img.shields.io/badge/Twitter-SentientAGI-white?logo=x"/>
  </a>
  <a href="https://discord.gg/sentientfoundation">
    <img alt="Discord" src="https://img.shields.io/badge/Discord-SentientAGI-7289da?logo=discord&logoColor=white&color=7289da"/>
  </a>
  <a href="https://huggingface.co/Sentientagi">
    <img src="https://img.shields.io/badge/Hugging_Face-SentientAGI-yellow?style=sociak&logo=huggingface"/>
  </a>
</p>

> [!WARNING]
> **This TypeScript package is currently in beta and will likely change. It is not yet ready for production use.**

## Overview

The Sentient Agent Framework is a TypeScript implementation of the Sentient Agent Framework for building agents that serve Sentient Chat events. It provides a client-server architecture for interacting with the Sentient platform's API, similar to how streaming inference works.

In addition to supporting OpenAI API compatible agents, Sentient Chat supports a custom, open source event system for agent responses. These events can be rendered in Sentient Chat to provide a richer user experience. This is particularly useful for streaming responses from an AI agent, when you might want to show the agent's work while the response is being generated, rather than having the user wait for the final response.

## Installation

```bash
# Using npm
npm install sentient-agent-framework

# Using yarn
yarn add sentient-agent-framework

# Using pnpm (recommended)
pnpm add sentient-agent-framework
```

## Usage

The framework can be used in various environments:

### 1. Next.js / Vercel Environment

```typescript
// pages/api/agent.ts
import { AbstractAgent, DefaultServer } from 'sentient-agent-framework';

class MyAgent extends AbstractAgent {
  constructor() {
    super('My Agent');
  }

  async assist(session, query, responseHandler) {
    // Emit a text block
    await responseHandler.emitTextBlock('THINKING', 'Processing your query...');
    
    // Create a text stream for the final response
    const stream = responseHandler.createTextStream('RESPONSE');
    
    // Stream the response in chunks
    await stream.emitChunk('Hello, ');
    await stream.emitChunk('world!');
    
    // Complete the stream
    await stream.complete();
    
    // Complete the response
    await responseHandler.complete();
  }
}

// Create the agent and server
const agent = new MyAgent();
const server = new DefaultServer(agent);

// Export the handler for Next.js API routes
export default async function handler(req, res) {
  return server.handleRequest(req, res);
}
```

### 2. Express Server

```typescript
// server.js
import express from 'express';
import { AbstractAgent, DefaultServer } from 'sentient-agent-framework';

class MyAgent extends AbstractAgent {
  constructor() {
    super('My Agent');
  }

  async assist(session, query, responseHandler) {
    // Implementation as above
  }
}

// Create Express app
const app = express();
app.use(express.json());

// Create the agent and server
const agent = new MyAgent();
const server = new DefaultServer(agent);

// Mount the server at /assist endpoint
app.use('/assist', (req, res) => server.handleRequest(req, res));

// Start the server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### 3. Fastify Server

```typescript
// server.js
import Fastify from 'fastify';
import { AbstractAgent, DefaultServer } from 'sentient-agent-framework';

class MyAgent extends AbstractAgent {
  constructor() {
    super('My Agent');
  }

  async assist(session, query, responseHandler) {
    // Implementation as above
  }
}

// Create Fastify app
const fastify = Fastify({
  logger: true
});

// Register JSON parser
fastify.register(require('@fastify/formbody'));

// Create the agent and server
const agent = new MyAgent();
const server = new DefaultServer(agent);

// Add route for the agent
fastify.post('/assist', async (request, reply) => {
  return server.handleRequest(request.raw, reply.raw);
});

// Start the server
fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
```

### 4. Client Usage

```typescript
import { SentientAgentClient } from 'sentient-agent-framework';

async function main() {
  // Create a client
  const client = new SentientAgentClient();
  
  // Query an agent
  for await (const event of client.queryAgent('What is the weather today?', 'http://localhost:3000/assist')) {
    // Process events based on their type
    switch (event.content_type) {
      case 'atomic.textblock':
        console.log(`${event.event_name}: ${event.content}`);
        break;
      case 'chunked.text':
        process.stdout.write(event.content);
        break;
      case 'atomic.json':
        console.log(`${event.event_name}: ${JSON.stringify(event.content)}`);
        break;
      case 'atomic.error':
        console.error(`Error: ${event.content.error_message}`);
        break;
      case 'atomic.done':
        console.log('\nDone!');
        break;
    }
  }
}

main().catch(console.error);
## Testing with the CLI

The framework includes a CLI client for testing agents. To use it:

1. Start the example server:
```bash
# Install dependencies if you haven't already
pnpm install

# Start the example server
pnpm run example-server
```

2. In another terminal, run the CLI client:
```bash
pnpm run cli
```

3. Enter the URL of the server (e.g., `http://localhost:3000`) and start chatting with the agent.
   - The CLI will automatically append "/assist" to the URL if it's not already included

The CLI client will display the events received from the agent, including:
- Text blocks
- JSON documents
- Streaming text
- Error messages
```

## Event Types

The framework supports several event types:

1. **TextBlockEvent**: For sending complete text messages
2. **DocumentEvent**: For sending JSON data
3. **TextChunkEvent**: For streaming text in chunks
4. **ErrorEvent**: For sending error messages
5. **DoneEvent**: For signaling the end of a response

## Architecture

The framework follows a client-server architecture:

```mermaid
graph TD
    Client[Client] -->|HTTP Request| Server[Server]
    Server -->|SSE Events| Client
    
    Server -->|Creates| Session[Session]
    Server -->|Creates| ResponseHandler[ResponseHandler]
    
    Agent[Agent] -->|Uses| ResponseHandler
    ResponseHandler -->|Creates| TextStream[TextStream]
    
    ResponseHandler -->|Emits| Events[Events]
    TextStream -->|Emits| Events
    
    Events -->|Via| Hook[Hook]
    Hook -->|To| Client
```

## Documentation

- [Interface Documentation](./src/interface/README.md)
- [Implementation Documentation](./src/implementation/README.md)

## Publishing to npm

To publish this package to npm:

1. Ensure all tests pass:
```bash
pnpm run test
```

2. Build the package:
```bash
pnpm run build
```

3. Update the version in package.json following semantic versioning:
```bash
# For patch releases (bug fixes)
pnpm version patch

# For minor releases (new features, backward compatible)
pnpm version minor

# For major releases (breaking changes)
pnpm version major
```

4. Publish to npm:
```bash
pnpm publish
```

5. Create a GitHub release with release notes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.