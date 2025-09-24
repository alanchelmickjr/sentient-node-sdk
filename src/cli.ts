#!/usr/bin/env node

/**
 * Sentient Agent Framework CLI - Entry Point
 *
 * This is the main entry point for the comprehensive Sentient Agent CLI.
 * It provides backward compatibility with the original simple CLI while
 * offering access to the full-featured interactive CLI system.
 *
 * Usage:
 *   pnpm run cli                    # Start interactive mode
 *   pnpm run cli --help            # Show help
 *   pnpm run cli --batch file.txt  # Run batch commands
 *   pnpm run cli --simple          # Use original simple CLI
 *
 * @module sentient-agent-framework/cli
 * @author Sentient AI Team
 * @version 1.1.1
 */

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Check for simple CLI flag (backward compatibility)
  if (args.includes('--simple')) {
    const { SimpleCLI } = await import('./cli/simple_cli.js');
    const simpleCLI = new SimpleCLI();
    await simpleCLI.run();
    return;
  }

  // Use the comprehensive CLI by default
  try {
    const { SentientAgentCLI } = await import('./cli/sentient_agent_cli.js');
    
    // Parse basic config from args
    const config: any = {};
    
    // Extract config from command line arguments
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
        case '--verbose':
        case '-v':
          config.verbose = true;
          break;
        case '--debug':
        case '-d':
          config.debug = true;
          break;
      }
    }
    
    const cli = new SentientAgentCLI(config);
    await cli.initialize();
    
    // Check for batch mode
    if (args.includes('--batch') || args.includes('-b')) {
      const batchIndex = args.findIndex(arg => arg === '--batch' || arg === '-b');
      const batchFile = args[batchIndex + 1];
      
      if (batchFile && !batchFile.startsWith('-')) {
        await cli.runBatchMode(batchFile);
      } else {
        console.error('Error: Batch mode requires a file path');
        process.exit(1);
      }
    } else {
      // Start interactive mode
      await cli.runInteractiveMode();
    }
  } catch (error) {
    console.error('CLI Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the CLI
if (require.main === module) {
  main().catch(console.error);
}