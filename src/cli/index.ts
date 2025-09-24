#!/usr/bin/env node

/**
 * Sentient Agent Framework CLI
 * 
 * Comprehensive command-line interface for testing and interaction with the Sentient Agent Framework.
 * Provides interactive chat, session management, capability discovery, and batch processing capabilities.
 * 
 * @module sentient-agent-framework/cli
 */

import { SentientAgentCLI } from './sentient_agent_cli';
import { CLIConfig } from './config';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Parse command line arguments and start the CLI
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Handle version flag
  if (args.includes('--version') || args.includes('-v')) {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
    );
    console.log(`Sentient CLI v${packageJson.version}`);
    process.exit(0);
  }

  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Parse configuration options
  const config: Partial<CLIConfig> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    switch (arg) {
      case '--config':
      case '-c':
        if (nextArg && !nextArg.startsWith('-')) {
          config.configPath = nextArg;
          i++;
        }
        break;
      case '--agent-url':
      case '-u':
        if (nextArg && !nextArg.startsWith('-')) {
          config.defaultAgentUrl = nextArg;
          i++;
        }
        break;
      case '--session-dir':
      case '-s':
        if (nextArg && !nextArg.startsWith('-')) {
          config.sessionDirectory = nextArg;
          i++;
        }
        break;
      case '--batch':
      case '-b':
        if (nextArg && !nextArg.startsWith('-')) {
          config.batchFile = nextArg;
          i++;
        }
        break;
      case '--verbose':
      case '-V':
        config.verbose = true;
        break;
      case '--debug':
      case '-d':
        config.debug = true;
        break;
      case '--no-color':
        config.colorOutput = false;
        break;
      case '--no-history':
        config.enableHistory = false;
        break;
      case '--timeout':
      case '-t':
        if (nextArg && !nextArg.startsWith('-')) {
          config.requestTimeout = parseInt(nextArg, 10);
          i++;
        }
        break;
    }
  }

  try {
    const cli = new SentientAgentCLI(config);
    await cli.initialize();
    
    // Start appropriate mode
    if (config.batchFile) {
      await cli.runBatchMode(config.batchFile);
    } else {
      await cli.runInteractiveMode();
    }
  } catch (error) {
    console.error('CLI Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Print CLI usage information
 */
function printUsage(): void {
  console.log(`
Sentient Agent Framework CLI

Usage:
  sentient-cli [options]

Options:
  -h, --help              Show this help message
  -v, --version           Show version information
  -c, --config PATH       Path to configuration file
  -u, --agent-url URL     Default agent URL
  -s, --session-dir PATH  Session storage directory
  -b, --batch FILE        Run in batch mode with specified file
  -V, --verbose           Enable verbose output
  -d, --debug             Enable debug logging
  -t, --timeout SECONDS   Request timeout in seconds
  --no-color              Disable colored output
  --no-history            Disable command history

Interactive Commands:
  help                    Show available commands
  connect <url>           Connect to an agent
  disconnect              Disconnect from current agent
  query <message>         Send query to connected agent
  session list            List all sessions
  session create [name]   Create new session
  session load <id>       Load existing session
  session save [name]     Save current session
  session delete <id>     Delete session
  capabilities            List agent capabilities
  config show             Show current configuration
  config set <key> <val>  Set configuration value
  history                 Show command history
  clear                   Clear screen
  exit, quit              Exit CLI

Examples:
  sentient-cli                                    # Start interactive mode
  sentient-cli -u http://localhost:8000          # Connect to specific agent
  sentient-cli -b commands.txt                   # Run batch commands
  sentient-cli --verbose --debug                 # Enable detailed logging
`);
}

// Run main function
if (require.main === module) {
  main().catch(console.error);
}

export { SentientAgentCLI };
export type { CLIConfig };