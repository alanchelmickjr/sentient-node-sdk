# Sentient Agent Framework CLI

The Sentient Agent Framework CLI provides a comprehensive command-line interface for testing and interacting with AI agents built using the Sentient Agent Framework.

## Features

- **Interactive Mode**: Real-time chat interface with agents
- **SSE Streaming**: Live streaming of agent responses
- **Session Management**: Create, save, load, and manage conversation sessions
- **Capability Discovery**: Explore and test agent capabilities
- **Configuration Management**: Flexible configuration system
- **Batch Processing**: Automated testing with script files
- **History & Auto-completion**: Command history and tab completion
- **Cross-platform Support**: Works on Windows, macOS, and Linux
- **Rich Terminal Output**: Colored output, progress bars, and formatted display

## Quick Start

### Interactive Mode

Start the CLI in interactive mode:

```bash
pnpm run cli
```

Or use the binary directly:

```bash
sentient-cli
```

### Connect to an Agent

```bash
# In interactive mode
connect http://localhost:8000

# Or specify URL at startup
sentient-cli --agent-url http://localhost:8000
```

### Basic Commands

```bash
# Send a query to the connected agent
query Hello, how can you help me?

# Or just type your message directly
Hello, how can you help me?

# Create a new session
session create "My Chat Session"

# List all sessions
session list

# Load a previous session
session load <session-id>

# Save current session
session save "Important Conversation"

# Show agent capabilities
capabilities

# Show connection status
status

# Get help
help
```

## Command Reference

### Connection Commands

- `connect <url>` - Connect to an agent server
- `disconnect` - Disconnect from current agent
- `status` - Show connection and session status

### Query Commands

- `query <message>` - Send a query to the connected agent
- `ask <message>` - Alias for query
- `q <message>` - Short alias for query

### Session Management

- `session list` - List all saved sessions
- `session create [name]` - Create new session
- `session load <id>` - Load existing session
- `session save [name]` - Save current session
- `session delete <id>` - Delete session

### Capability Commands

- `capabilities` - List available capabilities
- `capabilities list` - Same as above
- `capabilities discover` - Discover agent capabilities
- `capabilities test <name>` - Test a specific capability

### Configuration

- `config show` - Display current configuration
- `config get <key>` - Get configuration value
- `config set <key> <value>` - Set configuration value
- `config reset` - Reset to default configuration

### Utility Commands

- `history [count]` - Show command history
- `help [command]` - Show help information
- `debug [on|off|info]` - Toggle debug mode
- `verbose [on|off]` - Toggle verbose output
- `clear` - Clear screen
- `exit` / `quit` - Exit CLI

## Configuration

The CLI uses a configuration file located at `~/.sentient-cli/config.json`. You can also specify a custom config file:

```bash
sentient-cli --config /path/to/config.json
```

### Configuration Options

```json
{
  "defaultAgentUrl": "http://localhost:8000",
  "requestTimeout": 30000,
  "enableSSE": true,
  "sessionDirectory": "~/.sentient-cli/sessions",
  "autoSaveSessions": true,
  "colorOutput": true,
  "verbose": false,
  "debug": false,
  "promptStyle": "detailed"
}
```

## Batch Processing

Run commands from a file:

```bash
sentient-cli --batch commands.txt
```

Example batch file:

```text
# Connect to agent
connect http://localhost:8000

# Create session
session create "Automated Test"

# Send queries
query What is machine learning?
query Explain neural networks
query How do transformers work?

# Save session
session save "ML Tutorial"
```

## Advanced Usage

### Custom Configuration

```bash
# Use custom config file
sentient-cli --config ./my-config.json

# Set agent URL
sentient-cli --agent-url https://my-agent.example.com

# Enable verbose and debug mode
sentient-cli --verbose --debug

# Run batch with error handling
sentient-cli --batch test.txt --continue-on-error
```

### Session Persistence

Sessions are automatically saved to `~/.sentient-cli/sessions/` and include:

- Conversation history
- Agent responses
- Metadata (creation time, tags, etc.)
- Configuration snapshots

### SSE Streaming

The CLI supports real-time Server-Sent Events (SSE) streaming for live agent responses:

- Automatic reconnection on connection loss
- Configurable retry attempts and delays
- Event filtering and processing
- Real-time display of streaming content

## Environment Variables

- `SENTIENT_CLI_CONFIG` - Path to configuration file
- `SENTIENT_CLI_DATA_DIR` - Data directory for sessions and logs
- `SENTIENT_CLI_AGENT_URL` - Default agent URL
- `FORCE_COLOR` - Force colored output (1 or true)
- `NO_COLOR` - Disable colored output (any value)

## Troubleshooting

### Connection Issues

```bash
# Check connection status
status

# Test with simple CLI (fallback)
sentient-cli --simple

# Enable debug logging
debug on
connect http://localhost:8000
```

### Session Problems

```bash
# List all sessions
session list

# Check session directory
config get sessionDirectory

# Reset configuration
config reset
```

### Performance Issues

```bash
# Disable SSE streaming
config set enableSSE false

# Increase timeout
config set requestTimeout 60000

# Reduce history size
config set historySize 100
```

## Development

### Building the CLI

```bash
# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

### Adding Custom Commands

The CLI is extensible. See `src/cli/sentient_agent_cli.ts` for examples of adding new commands.

### Configuration Schema

The configuration system supports validation and type checking. See `src/cli/config.ts` for the full schema.

## Examples

### Basic Chat Session

```bash
$ sentient-cli
🤖 Sentient Agent Framework CLI v1.1.1
Welcome to the Sentient Agent CLI!

● sentient> connect http://localhost:8000
ℹ️ INFO: Connecting to agent at http://localhost:8000...
✅ Connected successfully

● sentient> session create "Learning Session"
ℹ️ INFO: Created new session: abc123

● [abc123] sentient> What is artificial intelligence?
[Agent response streams here in real-time]

● [abc123] sentient> session save
ℹ️ INFO: Session saved: abc123

● [abc123] sentient> exit
```

### Batch Processing

```bash
# test-script.txt
connect http://localhost:8000
session create "Automated Testing"
query Tell me about machine learning
query What are neural networks?
session save "ML Basics"
```

```bash
$ sentient-cli --batch test-script.txt
ℹ️ INFO: Running batch mode with file: test-script.txt
ℹ️ INFO: Executing: connect http://localhost:8000
ℹ️ INFO: Executing: session create "Automated Testing"
...
ℹ️ INFO: Batch processing completed
```

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Enable debug mode: `debug on`
3. Check logs in `~/.sentient-cli/`
4. File issues on GitHub

## License

MIT License - see LICENSE file for details.