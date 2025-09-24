/**
 * Comprehensive Sentient Agent Framework CLI
 * 
 * Provides interactive command-line interface for testing and interaction
 * with the Sentient Agent Framework including real-time SSE streaming,
 * session management, capability discovery, and batch processing.
 */

import * as readline from 'readline';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';

import { SentientAgentClient, ConnectionState, SSEOptions } from '../client/sentient_agent_client';
import { CLIConfig, CLIConfigManager, createConfigManager } from './config';
import { SessionPersistenceManager } from '../implementation/session_persistence_manager';
import { CapabilityManager } from '../implementation/capability_manager';
import { DefaultIdGenerator } from '../implementation/default_id_generator';
import { DefaultSession } from '../implementation/default_session';
import {
  ResponseEvent,
  EventContentType,
  TextChunkEvent,
  DocumentEvent,
  TextBlockEvent,
  ErrorEvent
} from '../interface/events';

/**
 * Command definition interface
 */
interface CLICommand {
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
  handler: (args: string[]) => Promise<void>;
  options?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

/**
 * Connection status information
 */
interface ConnectionStatus {
  connected: boolean;
  url?: string;
  state: ConnectionState;
  reconnectAttempts: number;
  lastError?: string;
}

/**
 * Session information for CLI display
 */
interface SessionInfo {
  id: string;
  name?: string;
  created: Date;
  lastUsed: Date;
  interactionCount: number;
  isActive: boolean;
}

/**
 * Main CLI class providing comprehensive agent interaction capabilities
 */
export class SentientAgentCLI extends EventEmitter {
  private config: CLIConfig;
  private configManager: CLIConfigManager;
  private client: SentientAgentClient;
  private sessionManager: SessionPersistenceManager;
  private capabilityManager: CapabilityManager;
  private idGenerator: DefaultIdGenerator;
  
  private rl?: readline.Interface;
  private currentSession?: DefaultSession;
  private connectionStatus: ConnectionStatus;
  private commandHistory: string[] = [];
  private commands = new Map<string, CLICommand>();
  
  // Display and formatting
  private colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
  };

  constructor(configOverrides: Partial<CLIConfig> = {}) {
    super();
    
    this.configManager = createConfigManager(configOverrides.configPath);
    this.config = { ...this.configManager.get(), ...configOverrides };
    this.idGenerator = new DefaultIdGenerator();
    
    // Initialize connection status
    this.connectionStatus = {
      connected: false,
      state: ConnectionState.DISCONNECTED,
      reconnectAttempts: 0
    };

    // Create client with SSE options from config
    this.client = new SentientAgentClient(this.config.defaultAgentUrl, this.config.sseOptions);
    
    // Initialize session manager
    this.sessionManager = new SessionPersistenceManager({
      store_type: 'filesystem',
      filesystem_base_dir: this.config.sessionDirectory,
      auto_persist_enabled: this.config.autoSaveSessions,
      id_generator: this.idGenerator
    });

    // Initialize capability manager
    this.capabilityManager = new CapabilityManager({
      persistence: {
        enabled: true,
        autoSave: true,
        saveInterval: 30000,
        filePath: path.join(this.config.dataDirectory, 'capabilities.json')
      }
    });

    this.setupCommands();
    this.setupEventHandlers();
  }

  /**
   * Initialize CLI system
   */
  async initialize(): Promise<void> {
    // Load configuration
    this.config = await this.configManager.load();
    
    // Ensure data directories exist
    await fs.mkdir(this.config.dataDirectory, { recursive: true });
    await fs.mkdir(this.config.sessionDirectory, { recursive: true });
    
    // Initialize managers
    await this.sessionManager.initialize();
    await this.capabilityManager.initialize();
    
    this.log('info', 'CLI initialized successfully');
  }

  /**
   * Start interactive mode
   */
  async runInteractiveMode(): Promise<void> {
    this.setupReadline();
    this.printWelcome();
    
    if (this.config.defaultAgentUrl && this.config.defaultAgentUrl !== 'http://localhost:8000') {
      this.log('info', `Auto-connecting to ${this.config.defaultAgentUrl}...`);
      await this.connectToAgent(this.config.defaultAgentUrl);
    }
    
    this.startInteractiveLoop();
  }

  /**
   * Run batch processing mode
   */
  async runBatchMode(batchFile: string): Promise<void> {
    this.log('info', `Running batch mode with file: ${batchFile}`);
    
    try {
      const commands = await fs.readFile(batchFile, 'utf-8');
      const lines = commands.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
      
      for (const line of lines) {
        this.log('info', `Executing: ${line}`);
        
        try {
          await this.executeCommand(line);
        } catch (error) {
          this.log('error', `Command failed: ${error}`);
          
          if (!this.config.continueOnError) {
            throw error;
          }
        }
      }
      
      this.log('info', 'Batch processing completed');
    } catch (error) {
      this.log('error', `Batch processing failed: ${error}`);
      throw error;
    }
  }

  /**
   * Shutdown CLI and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.rl) {
      this.rl.close();
    }
    
    this.client.disconnectSSE();
    await this.sessionManager.shutdown();
    await this.capabilityManager.shutdown();
    
    if (this.config.autoSaveSessions && this.currentSession) {
      await this.saveCurrentSession();
    }
    
    this.log('info', 'CLI shutdown complete');
  }

  /**
   * Setup readline interface with auto-completion and history
   */
  private setupReadline(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: this.config.enableAutoComplete ? this.autocomplete.bind(this) : undefined,
      history: this.config.enableHistory ? this.commandHistory.slice(-this.config.historySize) : [],
      historySize: this.config.historySize
    });

    // Handle Ctrl+C gracefully
    this.rl.on('SIGINT', () => {
      this.log('info', '\nReceived SIGINT, shutting down...');
      this.shutdown().finally(() => process.exit(0));
    });
  }

  /**
   * Print welcome message and current status
   */
  private printWelcome(): void {
    const title = this.colorize('bright', '╔═══════════════════════════════════════════════════════════╗');
    const header = this.colorize('bright', '║        🤖 Sentient Agent Framework CLI v1.1.1           ║');
    const subtitle = this.colorize('bright', '║    Advanced AI Agent Testing & Interaction Platform      ║');
    const footer = this.colorize('bright', '╚═══════════════════════════════════════════════════════════╝');

    console.log('\n' + title);
    console.log(header);
    console.log(subtitle);
    console.log(footer + '\n');

    console.log(this.colorize('cyan', 'Welcome to the Sentient Agent CLI!'));
    console.log(this.colorize('gray', 'Type "help" for available commands or "connect <url>" to get started.\n'));

    if (this.config.showHints) {
      console.log(this.colorize('yellow', '💡 Hints:'));
      console.log(this.colorize('gray', '  • Use Tab for auto-completion'));
      console.log(this.colorize('gray', '  • Use Up/Down arrows for command history'));
      console.log(this.colorize('gray', '  • Use "session create" to start a new conversation'));
      console.log(this.colorize('gray', '  • Use "capabilities" to discover agent features\n'));
    }
  }

  /**
   * Start the interactive command loop
   */
  private startInteractiveLoop(): void {
    if (!this.rl) return;

    const prompt = this.generatePrompt();
    this.rl.question(prompt, async (input) => {
      const command = input.trim();
      
      if (command) {
        this.commandHistory.push(command);
        
        try {
          await this.executeCommand(command);
        } catch (error) {
          this.log('error', `Command error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Continue the loop
      this.startInteractiveLoop();
    });
  }

  /**
   * Generate dynamic prompt based on connection status and session
   */
  private generatePrompt(): string {
    let prompt = '';
    
    if (this.config.promptStyle === 'detailed') {
      // Show connection status
      if (this.connectionStatus.connected) {
        prompt += this.colorize('green', '●');
      } else {
        prompt += this.colorize('red', '●');
      }
      
      // Show session info
      if (this.currentSession) {
        prompt += this.colorize('blue', ` [${this.currentSession.activity_id.slice(-8)}]`);
      }
      
      prompt += this.colorize('cyan', ' sentient') + this.colorize('white', '> ');
    } else if (this.config.promptStyle === 'simple') {
      prompt = this.colorize('cyan', 'sentient> ');
    } else {
      prompt = '> ';
    }
    
    return prompt;
  }

  /**
   * Execute a command by parsing and dispatching to appropriate handler
   */
  private async executeCommand(input: string): Promise<void> {
    const parts = input.trim().split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Handle built-in commands
    if (commandName === 'exit' || commandName === 'quit') {
      await this.shutdown();
      process.exit(0);
    }

    if (commandName === 'clear' || commandName === 'cls') {
      console.clear();
      this.printWelcome();
      return;
    }

    // Look up command
    const command = this.commands.get(commandName);
    if (command) {
      await command.handler(args);
    } else {
      // If not a known command and we're connected, treat as query
      if (this.connectionStatus.connected && commandName !== 'help') {
        await this.handleQuery([input]);
      } else {
        this.log('error', `Unknown command: ${commandName}. Type "help" for available commands.`);
      }
    }
  }

  /**
   * Setup all CLI commands
   */
  private setupCommands(): void {
    // Connection commands
    this.addCommand({
      name: 'connect',
      description: 'Connect to an agent server',
      usage: 'connect <url>',
      aliases: ['conn'],
      handler: this.handleConnect.bind(this),
      options: [
        { name: 'url', description: 'Agent server URL', required: true }
      ]
    });

    this.addCommand({
      name: 'disconnect',
      description: 'Disconnect from current agent',
      usage: 'disconnect',
      aliases: ['disc'],
      handler: this.handleDisconnect.bind(this)
    });

    this.addCommand({
      name: 'status',
      description: 'Show connection and session status',
      usage: 'status',
      handler: this.handleStatus.bind(this)
    });

    // Query commands
    this.addCommand({
      name: 'query',
      description: 'Send a query to the connected agent',
      usage: 'query <message>',
      aliases: ['ask', 'q'],
      handler: this.handleQuery.bind(this),
      options: [
        { name: 'message', description: 'Query message', required: true }
      ]
    });

    // Session commands
    this.addCommand({
      name: 'session',
      description: 'Session management commands',
      usage: 'session <list|create|load|save|delete> [args...]',
      handler: this.handleSession.bind(this)
    });

    // Capability commands
    this.addCommand({
      name: 'capabilities',
      description: 'List and test agent capabilities',
      usage: 'capabilities [list|test|discover]',
      aliases: ['caps', 'cap'],
      handler: this.handleCapabilities.bind(this)
    });

    // Configuration commands
    this.addCommand({
      name: 'config',
      description: 'Configuration management',
      usage: 'config <show|set|get|reset> [key] [value]',
      handler: this.handleConfig.bind(this)
    });

    // History and help commands
    this.addCommand({
      name: 'history',
      description: 'Show command history',
      usage: 'history [count]',
      aliases: ['hist'],
      handler: this.handleHistory.bind(this)
    });

    this.addCommand({
      name: 'help',
      description: 'Show available commands',
      usage: 'help [command]',
      aliases: ['h', '?'],
      handler: this.handleHelp.bind(this)
    });

    // Debugging commands
    this.addCommand({
      name: 'debug',
      description: 'Toggle debug mode and show debug information',
      usage: 'debug [on|off|info]',
      handler: this.handleDebug.bind(this)
    });

    this.addCommand({
      name: 'verbose',
      description: 'Toggle verbose output',
      usage: 'verbose [on|off]',
      aliases: ['v'],
      handler: this.handleVerbose.bind(this)
    });
  }

  /**
   * Add a command to the command registry
   */
  private addCommand(command: CLICommand): void {
    this.commands.set(command.name, command);
    
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }
  }

  // ========================================================================
  // Command Handlers
  // ========================================================================

  /**
   * Handle connect command
   */
  private async handleConnect(args: string[]): Promise<void> {
    if (args.length === 0) {
      this.log('error', 'Usage: connect <url>');
      return;
    }

    const url = args[0];
    await this.connectToAgent(url);
  }

  /**
   * Handle disconnect command
   */
  private async handleDisconnect(args: string[]): Promise<void> {
    this.client.disconnectSSE();
    this.connectionStatus = {
      connected: false,
      state: ConnectionState.DISCONNECTED,
      reconnectAttempts: 0
    };
    
    this.log('info', 'Disconnected from agent');
  }

  /**
   * Handle status command
   */
  private async handleStatus(args: string[]): Promise<void> {
    console.log(this.colorize('bright', '\n📊 Status Information'));
    console.log('─'.repeat(50));

    // Connection status
    console.log(this.colorize('cyan', '🔗 Connection:'));
    if (this.connectionStatus.connected) {
      console.log(`  ${this.colorize('green', '● Connected')} to ${this.connectionStatus.url}`);
      console.log(`  State: ${this.connectionStatus.state}`);
    } else {
      console.log(`  ${this.colorize('red', '● Disconnected')}`);
      if (this.connectionStatus.lastError) {
        console.log(`  Last Error: ${this.colorize('red', this.connectionStatus.lastError)}`);
      }
    }

    // Session status
    console.log(this.colorize('cyan', '\n📝 Session:'));
    if (this.currentSession) {
      console.log(`  ${this.colorize('green', '● Active')} Session: ${this.currentSession.activity_id}`);
      console.log(`  Processor: ${this.currentSession.processor_id}`);
      console.log(`  Request: ${this.currentSession.request_id}`);
    } else {
      console.log(`  ${this.colorize('yellow', '○ No active session')}`);
    }

    // Configuration info
    console.log(this.colorize('cyan', '\n⚙️ Configuration:'));
    console.log(`  Data Directory: ${this.config.dataDirectory}`);
    console.log(`  Session Directory: ${this.config.sessionDirectory}`);
    console.log(`  Auto-save: ${this.config.autoSaveSessions ? '✓' : '✗'}`);
    console.log(`  SSE Enabled: ${this.config.enableSSE ? '✓' : '✗'}`);
    console.log(`  Debug Mode: ${this.config.debug ? '✓' : '✗'}`);
    
    console.log();
  }

  /**
   * Handle query command
   */
  private async handleQuery(args: string[]): Promise<void> {
    if (!this.connectionStatus.connected) {
      this.log('error', 'Not connected to any agent. Use "connect <url>" first.');
      return;
    }

    if (args.length === 0) {
      this.log('error', 'Usage: query <message>');
      return;
    }

    const query = args.join(' ');
    
    // Create session if none exists
    if (!this.currentSession) {
      await this.createNewSession();
    }

    this.log('info', `Sending query: ${this.colorize('blue', query)}`);
    
    try {
      // Setup SSE streaming if enabled
      if (this.config.enableSSE) {
        await this.client.queryAgentWithSSE(query, this.connectionStatus.url!, true);
      } else {
        await this.client.queryAgent(query, this.connectionStatus.url!);
        await this.client.processEvents(this.connectionStatus.url!);
      }
    } catch (error) {
      this.log('error', `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle session management commands
   */
  private async handleSession(args: string[]): Promise<void> {
    if (args.length === 0) {
      this.log('error', 'Usage: session <list|create|load|save|delete> [args...]');
      return;
    }

    const subcommand = args[0].toLowerCase();
    const subArgs = args.slice(1);

    switch (subcommand) {
      case 'list':
        await this.listSessions();
        break;
      case 'create':
        await this.createNewSession(subArgs[0]);
        break;
      case 'load':
        if (subArgs.length === 0) {
          this.log('error', 'Usage: session load <session_id>');
          return;
        }
        await this.loadSession(subArgs[0]);
        break;
      case 'save':
        await this.saveCurrentSession(subArgs[0]);
        break;
      case 'delete':
        if (subArgs.length === 0) {
          this.log('error', 'Usage: session delete <session_id>');
          return;
        }
        await this.deleteSession(subArgs[0]);
        break;
      default:
        this.log('error', `Unknown session command: ${subcommand}`);
    }
  }

  /**
   * Handle capabilities command
   */
  private async handleCapabilities(args: string[]): Promise<void> {
    const subcommand = args[0]?.toLowerCase() || 'list';

    switch (subcommand) {
      case 'list':
        await this.listCapabilities();
        break;
      case 'discover':
        await this.discoverCapabilities();
        break;
      case 'test':
        if (args.length < 2) {
          this.log('error', 'Usage: capabilities test <capability_name>');
          return;
        }
        await this.testCapability(args[1]);
        break;
      default:
        this.log('error', `Unknown capabilities command: ${subcommand}`);
    }
  }

  /**
   * Handle config command
   */
  private async handleConfig(args: string[]): Promise<void> {
    if (args.length === 0) {
      this.log('error', 'Usage: config <show|set|get|reset> [key] [value]');
      return;
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'show':
        console.log(this.colorize('bright', '\n⚙️ Current Configuration:'));
        console.log('─'.repeat(50));
        console.log(this.configManager.toString());
        console.log();
        break;
      case 'get':
        if (args.length < 2) {
          this.log('error', 'Usage: config get <key>');
          return;
        }
        const value = this.configManager.getValue(args[1]);
        console.log(`${args[1]}: ${JSON.stringify(value)}`);
        break;
      case 'set':
        if (args.length < 3) {
          this.log('error', 'Usage: config set <key> <value>');
          return;
        }
        try {
          let newValue: any = args[2];
          // Try to parse as JSON for complex values
          try {
            newValue = JSON.parse(args[2]);
          } catch {
            // Keep as string if not valid JSON
          }
          this.configManager.set(args[1], newValue);
          await this.configManager.save();
          this.log('info', `Configuration updated: ${args[1]} = ${JSON.stringify(newValue)}`);
        } catch (error) {
          this.log('error', `Failed to update configuration: ${error}`);
        }
        break;
      case 'reset':
        this.configManager.reset();
        await this.configManager.save();
        this.log('info', 'Configuration reset to defaults');
        break;
      default:
        this.log('error', `Unknown config command: ${subcommand}`);
    }
  }

  /**
   * Handle history command
   */
  private async handleHistory(args: string[]): Promise<void> {
    const count = args[0] ? parseInt(args[0], 10) : 10;
    const recentHistory = this.commandHistory.slice(-count);

    console.log(this.colorize('bright', `\n📜 Command History (last ${count}):`));
    console.log('─'.repeat(50));

    recentHistory.forEach((cmd, index) => {
      const lineNumber = this.commandHistory.length - recentHistory.length + index + 1;
      console.log(`${this.colorize('gray', lineNumber.toString().padStart(3))}: ${cmd}`);
    });
    console.log();
  }

  /**
   * Handle help command
   */
  private async handleHelp(args: string[]): Promise<void> {
    if (args.length > 0) {
      // Show help for specific command
      const commandName = args[0].toLowerCase();
      const command = this.commands.get(commandName);
      
      if (command) {
        console.log(this.colorize('bright', `\n📖 Help: ${command.name}`));
        console.log('─'.repeat(50));
        console.log(`Description: ${command.description}`);
        console.log(`Usage: ${this.colorize('cyan', command.usage)}`);
        
        if (command.aliases && command.aliases.length > 0) {
          console.log(`Aliases: ${command.aliases.join(', ')}`);
        }
        
        if (command.options && command.options.length > 0) {
          console.log('\nOptions:');
          command.options.forEach(opt => {
            const required = opt.required ? ' (required)' : '';
            console.log(`  ${this.colorize('yellow', opt.name)}${required}: ${opt.description}`);
          });
        }
        console.log();
      } else {
        this.log('error', `Unknown command: ${commandName}`);
      }
    } else {
      // Show all commands
      console.log(this.colorize('bright', '\n📖 Available Commands:'));
      console.log('─'.repeat(50));
      
      const uniqueCommands = new Map<string, CLICommand>();
      this.commands.forEach((cmd, name) => {
        if (name === cmd.name) {
          uniqueCommands.set(name, cmd);
        }
      });
      
      uniqueCommands.forEach(cmd => {
        const aliases = cmd.aliases ? ` (${cmd.aliases.join(', ')})` : '';
        console.log(`${this.colorize('cyan', cmd.name.padEnd(12))} ${cmd.description}${aliases}`);
      });
      
      console.log(`\nUse "${this.colorize('cyan', 'help <command>')}" for detailed command information.`);
      console.log(`Type any message to send it as a query to the connected agent.\n`);
    }
  }

  /**
   * Handle debug command
   */
  private async handleDebug(args: string[]): Promise<void> {
    if (args.length === 0 || args[0] === 'info') {
      console.log(this.colorize('bright', '\n🐛 Debug Information:'));
      console.log('─'.repeat(50));
      console.log(`Debug Mode: ${this.config.debug ? 'ON' : 'OFF'}`);
      console.log(`Verbose Mode: ${this.config.verbose ? 'ON' : 'OFF'}`);
      console.log(`Log Level: ${this.config.logLevel}`);
      
      if (this.config.logFile) {
        console.log(`Log File: ${this.config.logFile}`);
      }
      
      console.log(`\nConnection Debug:`);
      console.log(`  State: ${this.connectionStatus.state}`);
      console.log(`  Reconnect Attempts: ${this.connectionStatus.reconnectAttempts}`);
      
      if (this.connectionStatus.connected) {
        const connectionInfo = this.client.getConnectionInfo();
        console.log(`  Connection Info: ${JSON.stringify(connectionInfo, null, 2)}`);
      }
      
      console.log();
    } else {
      const enabled = args[0].toLowerCase() === 'on';
      this.config.debug = enabled;
      this.configManager.update({ debug: enabled });
      await this.configManager.save();
      this.log('info', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Handle verbose command
   */
  private async handleVerbose(args: string[]): Promise<void> {
    if (args.length === 0) {
      this.config.verbose = !this.config.verbose;
    } else {
      this.config.verbose = args[0].toLowerCase() === 'on';
    }
    
    this.configManager.update({ verbose: this.config.verbose });
    await this.configManager.save();
    this.log('info', `Verbose mode ${this.config.verbose ? 'enabled' : 'disabled'}`);
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Connect to an agent server
   */
  private async connectToAgent(url: string): Promise<void> {
    this.log('info', `Connecting to agent at ${url}...`);
    
    try {
      // Update client URL and establish SSE connection
      this.client = new SentientAgentClient(url, this.config.sseOptions);
      this.setupEventHandlers();
      
      if (this.config.enableSSE) {
        await this.client.connectSSE();
      }
      
      this.connectionStatus = {
        connected: true,
        url: url,
        state: ConnectionState.CONNECTED,
        reconnectAttempts: 0
      };
      
      this.log('info', this.colorize('green', '✓ Connected successfully'));
      
      // Auto-discover capabilities
      if (this.config.verbose) {
        await this.discoverCapabilities();
      }
      
    } catch (error) {
      this.connectionStatus = {
        connected: false,
        state: ConnectionState.ERROR,
        reconnectAttempts: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.log('error', `Failed to connect: ${this.connectionStatus.lastError}`);
    }
  }

  /**
   * Setup event handlers for client events
   */
  private setupEventHandlers(): void {
    // SSE connection events
    this.client.on('sseConnected', () => {
      this.log('debug', 'SSE connection established');
      this.connectionStatus.state = ConnectionState.CONNECTED;
    });

    this.client.on('sseError', (error: Error) => {
      this.log('error', `SSE error: ${error.message}`);
      this.connectionStatus.lastError = error.message;
    });

    this.client.on('sseConnectionStateChange', ({ previous, current }) => {
      this.log('debug', `Connection state changed: ${previous} → ${current}`);
      this.connectionStatus.state = current;
    });

    this.client.on('sseReconnecting', ({ attempt, delay }) => {
      this.log('info', `Reconnecting... (attempt ${attempt}, delay ${delay}ms)`);
      this.connectionStatus.reconnectAttempts = attempt;
    });

    // Event stream handling
    this.client.on('sseEvent', (event: ResponseEvent) => {
      this.handleStreamingEvent(event);
    });

    // Query events (non-SSE)
    this.client.on('querySuccess', (data) => {
      this.log('debug', 'Query sent successfully');
    });

    this.client.on('queryError', (error) => {
      this.log('error', `Query error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    });

    this.client.on('eventsReceived', (data) => {
      if (data.interactions && Array.isArray(data.interactions)) {
        for (const interaction of data.interactions) {
          if (interaction.responses) {
            for (const response of interaction.responses) {
              this.handleStreamingEvent(response.event);
            }
          }
        }
      }
    });
  }

  /**
   * Handle streaming events from the agent
   */
  private handleStreamingEvent(event: ResponseEvent): void {
    const timestamp = this.config.displayTimestamps ? 
      this.colorize('gray', `[${new Date().toLocaleTimeString()}] `) : '';

    switch (event.content_type) {
      case EventContentType.TEXT_STREAM:
        const textEvent = event as TextChunkEvent;
        if (textEvent.stream_id) {
          process.stdout.write(textEvent.content);
          if (textEvent.is_complete) {
            console.log(); // New line after stream completion
          }
        }
        break;

      case EventContentType.TEXTBLOCK:
        const blockEvent = event as TextBlockEvent;
        console.log(`${timestamp}${this.colorize('blue', blockEvent.event_name)}`);
        console.log(blockEvent.content);
        console.log();
        break;

      case EventContentType.JSON:
        const jsonEvent = event as DocumentEvent;
        console.log(`${timestamp}${this.colorize('magenta', jsonEvent.event_name)}`);
        console.log(JSON.stringify(jsonEvent.content, null, 2));
        console.log();
        break;

      case EventContentType.ERROR:
        const errorEvent = event as ErrorEvent;
        console.log(`${timestamp}${this.colorize('red', errorEvent.event_name)}`);
        console.error(`${this.colorize('red', 'Error:')} ${errorEvent.content.error_message}`);
        if (errorEvent.content.details) {
          console.error(JSON.stringify(errorEvent.content.details, null, 2));
        }
        console.log();
        break;

      case EventContentType.DONE:
        console.log(`${timestamp}${this.colorize('green', '✓ Request completed')}`);
        console.log('─'.repeat(50));
        break;

      default:
        this.log('debug', `Received event: ${(event as ResponseEvent).content_type}`);
    }
  }

  /**
   * Auto-completion for commands and arguments
   */
  private autocomplete(line: string): [string[], string] {
    const completions: string[] = [];
    const hits: string[] = [];

    // Get all command names
    const commandNames = Array.from(this.commands.keys());
    
    // If line is empty or just whitespace, show all commands
    if (!line.trim()) {
      return [commandNames, line];
    }

    // Split line into parts
    const parts = line.trim().split(/\s+/);
    
    if (parts.length === 1) {
      // Completing command name
      const partial = parts[0].toLowerCase();
      for (const cmd of commandNames) {
        if (cmd.startsWith(partial)) {
          hits.push(cmd);
        }
      }
    } else {
      // Completing command arguments
      const commandName = parts[0].toLowerCase();
      const command = this.commands.get(commandName);
      
      if (command) {
        // Add command-specific completions
        switch (command.name) {
          case 'session':
            if (parts.length === 2) {
              const subcommands = ['list', 'create', 'load', 'save', 'delete'];
              const partial = parts[1].toLowerCase();
              for (const sub of subcommands) {
                if (sub.startsWith(partial)) {
                  hits.push(`${parts[0]} ${sub}`);
                }
              }
            }
            break;
          case 'config':
            if (parts.length === 2) {
              const subcommands = ['show', 'set', 'get', 'reset'];
              const partial = parts[1].toLowerCase();
              for (const sub of subcommands) {
                if (sub.startsWith(partial)) {
                  hits.push(`${parts[0]} ${sub}`);
                }
              }
            }
            break;
          case 'capabilities':
            if (parts.length === 2) {
              const subcommands = ['list', 'test', 'discover'];
              const partial = parts[1].toLowerCase();
              for (const sub of subcommands) {
                if (sub.startsWith(partial)) {
                  hits.push(`${parts[0]} ${sub}`);
                }
              }
            }
            break;
        }
      }
    }

    return [hits.length > 0 ? hits : completions, line];
  }

  /**
   * Create a new session
   */
  private async createNewSession(name?: string): Promise<void> {
    try {
      this.currentSession = await this.sessionManager.createManagedSession({}, {
        metadata: name ? { name } : undefined,
        tags: ['cli-created']
      });
      
      this.log('info', `Created new session: ${this.currentSession.activity_id}`);
      if (name) {
        this.log('info', `Session name: ${name}`);
      }
    } catch (error) {
      this.log('error', `Failed to create session: ${error}`);
    }
  }

  /**
   * Load an existing session
   */
  private async loadSession(sessionId: string): Promise<void> {
    try {
      const loadedSession = await this.sessionManager.loadManagedSession(sessionId);
      
      if (loadedSession) {
        this.currentSession = loadedSession;
        this.log('info', `Loaded session: ${sessionId}`);
      } else {
        this.log('error', `Session not found: ${sessionId}`);
      }
    } catch (error) {
      this.log('error', `Failed to load session: ${error}`);
    }
  }

  /**
   * Save current session
   */
  private async saveCurrentSession(name?: string): Promise<void> {
    if (!this.currentSession) {
      this.log('error', 'No active session to save');
      return;
    }

    try {
      const sessionId = await this.sessionManager.persistSession(this.currentSession);
      
      if (name) {
        await this.sessionManager.updateSession(sessionId, {
          metadata: { name }
        });
      }
      
      this.log('info', `Session saved: ${sessionId}`);
    } catch (error) {
      this.log('error', `Failed to save session: ${error}`);
    }
  }

  /**
   * Delete a session
   */
  private async deleteSession(sessionId: string): Promise<void> {
    try {
      const deleted = await this.sessionManager.deleteSession(sessionId);
      
      if (deleted) {
        this.log('info', `Session deleted: ${sessionId}`);
        
        // If we deleted the current session, clear it
        if (this.currentSession && this.currentSession.activity_id === sessionId) {
          this.currentSession = undefined;
        }
      } else {
        this.log('error', `Session not found: ${sessionId}`);
      }
    } catch (error) {
      this.log('error', `Failed to delete session: ${error}`);
    }
  }

  /**
   * List all sessions
   */
  private async listSessions(): Promise<void> {
    try {
      const sessions = await this.sessionManager.listSessions();
      
      console.log(this.colorize('bright', '\n📝 Sessions:'));
      console.log('─'.repeat(80));
      
      if (sessions.length === 0) {
        console.log(this.colorize('gray', 'No sessions found'));
      } else {
        console.log(`${'ID'.padEnd(20)} ${'Name'.padEnd(20)} ${'Created'.padEnd(20)} ${'Interactions'}`);
        console.log('─'.repeat(80));
        
        for (const session of sessions) {
          const id = session.session_id.slice(-8);
          const name = session.metadata?.name || '(unnamed)';
          const created = session.created_at.toLocaleDateString();
          const interactions = session.interactions.length;
          const isActive = this.currentSession && this.currentSession.activity_id === session.session_id ? ' ●' : '';
          
          console.log(`${id.padEnd(20)} ${name.padEnd(20)} ${created.padEnd(20)} ${interactions}${isActive}`);
        }
      }
      
      console.log();
    } catch (error) {
      this.log('error', `Failed to list sessions: ${error}`);
    }
  }

  /**
   * List available capabilities
   */
  private async listCapabilities(): Promise<void> {
    const capabilities = this.capabilityManager.discoverCapabilities();
    
    console.log(this.colorize('bright', '\n🔧 Available Capabilities:'));
    console.log('─'.repeat(80));
    
    if (capabilities.length === 0) {
      console.log(this.colorize('gray', 'No capabilities discovered'));
    } else {
      capabilities.forEach(cap => {
        const streamIcon = cap.stream_response ? '🌊' : '📦';
        console.log(`${streamIcon} ${this.colorize('cyan', cap.name)}: ${cap.description}`);
      });
    }
    
    console.log();
  }

  /**
   * Discover capabilities from connected agent
   */
  private async discoverCapabilities(): Promise<void> {
    if (!this.connectionStatus.connected) {
      this.log('error', 'Not connected to any agent');
      return;
    }

    this.log('info', 'Discovering agent capabilities...');
    
    // This would typically involve querying the agent for its capabilities
    // For now, we'll show the locally registered capabilities
    await this.listCapabilities();
  }

  /**
   * Test a specific capability
   */
  private async testCapability(capabilityName: string): Promise<void> {
    this.log('info', `Testing capability: ${capabilityName}`);
    
    // This would involve sending a test request to the capability
    // Implementation depends on the specific capability interface
    this.log('info', 'Capability testing not yet implemented');
  }

  /**
   * Colorize text output if colors are enabled
   */
  private colorize(color: keyof typeof this.colors, text: string): string {
    if (!this.config.colorOutput) {
      return text;
    }
    return `${this.colors[color]}${text}${this.colors.reset}`;
  }

  /**
   * Log message with appropriate level and formatting
   */
  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string): void {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const configLevels = { error: 0, warn: 1, info: 2, debug: 3 };
    
    if (levels[level] > configLevels[this.config.logLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = this.config.verbose ? `[${timestamp}] ` : '';
    
    switch (level) {
      case 'error':
        console.error(`${prefix}${this.colorize('red', '❌ ERROR:')} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix}${this.colorize('yellow', '⚠️  WARN:')} ${message}`);
        break;
      case 'info':
        console.log(`${prefix}${this.colorize('cyan', 'ℹ️  INFO:')} ${message}`);
        break;
      case 'debug':
        if (this.config.debug) {
          console.log(`${prefix}${this.colorize('gray', '🐛 DEBUG:')} ${message}`);
        }
        break;
    }
  }
}