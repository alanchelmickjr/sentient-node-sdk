/**
 * CLI Tests
 * 
 * Tests for the Sentient Agent CLI functionality
 */

import { CLIConfig, CLIConfigManager, DEFAULT_CLI_CONFIG } from '../src/cli/config';
import { TerminalUtils, ANSI_COLORS } from '../src/cli/terminal_utils';
import * as path from 'path';
import * as os from 'os';

describe('CLI Configuration', () => {
  let configManager: CLIConfigManager;
  const testConfigPath = path.join(os.tmpdir(), 'test-cli-config.json');

  beforeEach(() => {
    configManager = new CLIConfigManager(testConfigPath);
  });

  afterEach(async () => {
    try {
      const fs = await import('fs/promises');
      await fs.unlink(testConfigPath);
    } catch {
      // File may not exist
    }
  });

  test('should load default configuration', async () => {
    const config = await configManager.load();
    
    expect(config.defaultAgentUrl).toBe(DEFAULT_CLI_CONFIG.defaultAgentUrl);
    expect(config.enableSSE).toBe(true);
    expect(config.colorOutput).toBe(true);
    expect(config.verbose).toBe(false);
  });

  test('should save and load configuration', async () => {
    const updates: Partial<CLIConfig> = {
      verbose: true,
      debug: true,
      defaultAgentUrl: 'http://test-agent.example.com'
    };

    configManager.update(updates);
    await configManager.save();

    const newConfigManager = new CLIConfigManager(testConfigPath);
    const loadedConfig = await newConfigManager.load();

    expect(loadedConfig.verbose).toBe(true);
    expect(loadedConfig.debug).toBe(true);
    expect(loadedConfig.defaultAgentUrl).toBe('http://test-agent.example.com');
  });

  test('should validate configuration values', () => {
    const updates: Partial<CLIConfig> = {
      requestTimeout: -1000,
      historySize: 50000,
      maxConcurrentRequests: 100
    };

    configManager.update(updates);
    const config = configManager.get();

    // Should be clamped to valid ranges
    expect(config.requestTimeout).toBeGreaterThanOrEqual(1000);
    expect(config.historySize).toBeLessThanOrEqual(10000);
    expect(config.maxConcurrentRequests).toBeLessThanOrEqual(20);
  });

  test('should handle nested configuration updates', () => {
    configManager.set('sseOptions.maxReconnectAttempts', 15);
    configManager.set('sseOptions.enableAutoReconnect', false);

    const config = configManager.get();

    expect(config.sseOptions.maxReconnectAttempts).toBe(15);
    expect(config.sseOptions.enableAutoReconnect).toBe(false);
  });

  test('should get configuration value by path', () => {
    const defaultUrl = configManager.getValue('defaultAgentUrl');
    const sseEnabled = configManager.getValue('sseOptions.enableAutoReconnect');

    expect(defaultUrl).toBe(DEFAULT_CLI_CONFIG.defaultAgentUrl);
    expect(sseEnabled).toBe(DEFAULT_CLI_CONFIG.sseOptions.enableAutoReconnect);
  });

  test('should reset configuration to defaults', () => {
    configManager.update({ verbose: true, debug: true });
    configManager.reset();

    const config = configManager.get();
    expect(config).toEqual(DEFAULT_CLI_CONFIG);
  });

  test('should format configuration as string', () => {
    const configString = configManager.toString();
    
    expect(configString).toContain('defaultAgentUrl');
    expect(configString).toContain('enableSSE');
    expect(configString).toContain('sseOptions');
  });
});

describe('Terminal Utilities', () => {
  let terminal: TerminalUtils;

  beforeEach(() => {
    terminal = new TerminalUtils(true); // Enable colors for testing
  });

  test('should detect terminal capabilities', () => {
    const capabilities = terminal.getCapabilities();
    
    expect(capabilities).toHaveProperty('supportsColor');
    expect(capabilities).toHaveProperty('supportsUnicode');
    expect(capabilities).toHaveProperty('width');
    expect(capabilities).toHaveProperty('height');
    expect(capabilities).toHaveProperty('platform');
  });

  test('should colorize text', () => {
    const colorized = terminal.colorize('red', 'test');
    
    expect(colorized).toContain('test');
    if (terminal.getCapabilities().supportsColor) {
      expect(colorized).toContain(ANSI_COLORS.red);
      expect(colorized).toContain(ANSI_COLORS.reset);
    }
  });

  test('should create progress bar', () => {
    const progressBar = terminal.createProgressBar(50, 100, 20);
    
    expect(progressBar).toContain('50%');
    expect(progressBar).toHaveLength(24); // 20 chars + ' 50%'
  });

  test('should create spinner animation', () => {
    const spinner1 = terminal.createSpinner(0);
    const spinner2 = terminal.createSpinner(1);
    
    expect(spinner1).toBeTruthy();
    expect(spinner2).toBeTruthy();
    expect(spinner1).not.toBe(spinner2);
  });

  test('should create formatted box', () => {
    const box = terminal.createBox('Test Content', { padding: 1 });
    
    expect(box).toContain('Test Content');
    expect(box.split('\n').length).toBeGreaterThan(2); // Top, content, bottom
  });

  test('should create table from data', () => {
    const data = [
      { name: 'Alice', age: 30, city: 'New York' },
      { name: 'Bob', age: 25, city: 'San Francisco' }
    ];

    const table = terminal.createTable(data);
    
    expect(table).toContain('Alice');
    expect(table).toContain('Bob');
    expect(table).toContain('New York');
    expect(table).toContain('San Francisco');
  });

  test('should format duration', () => {
    expect(terminal.formatDuration(1000)).toBe('1s');
    expect(terminal.formatDuration(60000)).toBe('1m 0s');
    expect(terminal.formatDuration(3600000)).toBe('1h 0m');
    expect(terminal.formatDuration(86400000)).toBe('1d 0h');
  });

  test('should format file size', () => {
    expect(terminal.formatFileSize(1024)).toBe('1.0 KB');
    expect(terminal.formatFileSize(1048576)).toBe('1.0 MB');
    expect(terminal.formatFileSize(1073741824)).toBe('1.0 GB');
  });

  test('should wrap text to width', () => {
    const text = 'This is a very long line of text that should be wrapped to fit within the specified width';
    const wrapped = terminal.wrapText(text, 20);
    
    const lines = wrapped.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every(line => line.length <= 20)).toBe(true);
  });

  test('should create status indicators', () => {
    const success = terminal.createStatus('success', 'Operation completed');
    const error = terminal.createStatus('error', 'Something went wrong');
    const warning = terminal.createStatus('warning', 'Please be careful');
    const info = terminal.createStatus('info', 'Just so you know');

    expect(success).toContain('Operation completed');
    expect(error).toContain('Something went wrong');
    expect(warning).toContain('Please be careful');
    expect(info).toContain('Just so you know');
  });

  test('should handle color theme changes', () => {
    const customTheme = {
      primary: ANSI_COLORS.magenta,
      secondary: ANSI_COLORS.cyan,
      success: ANSI_COLORS.green,
      warning: ANSI_COLORS.yellow,
      error: ANSI_COLORS.red,
      info: ANSI_COLORS.blue,
      debug: ANSI_COLORS.gray,
      muted: ANSI_COLORS.dim,
      reset: ANSI_COLORS.reset
    };

    terminal.setTheme(customTheme);
    const colorized = terminal.colorize('primary', 'test');
    
    if (terminal.getCapabilities().supportsColor) {
      expect(colorized).toContain(ANSI_COLORS.magenta);
    }
  });

  test('should enable/disable colors', () => {
    terminal.setColorEnabled(false);
    const colorized = terminal.colorize('red', 'test');
    expect(colorized).toBe('test'); // No color codes

    terminal.setColorEnabled(true);
    const colorizedAgain = terminal.colorize('red', 'test');
    
    if (terminal.getCapabilities().supportsColor) {
      expect(colorizedAgain).toContain(ANSI_COLORS.red);
    }
  });
});

describe('CLI Command Parsing', () => {
  test('should parse basic commands', () => {
    const parseCommand = (input: string) => {
      const parts = input.trim().split(/\s+/);
      return {
        command: parts[0],
        args: parts.slice(1)
      };
    };

    const parsed1 = parseCommand('connect http://localhost:8000');
    expect(parsed1.command).toBe('connect');
    expect(parsed1.args).toEqual(['http://localhost:8000']);

    const parsed2 = parseCommand('session create "My Session"');
    expect(parsed2.command).toBe('session');
    expect(parsed2.args).toEqual(['create', '"My', 'Session"']);

    const parsed3 = parseCommand('query Hello world');
    expect(parsed3.command).toBe('query');
    expect(parsed3.args).toEqual(['Hello', 'world']);
  });

  test('should handle empty and whitespace commands', () => {
    const parseCommand = (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return null;
      
      const parts = trimmed.split(/\s+/);
      return {
        command: parts[0],
        args: parts.slice(1)
      };
    };

    expect(parseCommand('')).toBeNull();
    expect(parseCommand('   ')).toBeNull();
    expect(parseCommand('help')).toEqual({ command: 'help', args: [] });
  });
});

describe('CLI Integration', () => {
  test('should validate CLI component interfaces', () => {
    // Test that all CLI components have the expected structure
    
    // Config interface
    expect(DEFAULT_CLI_CONFIG).toHaveProperty('defaultAgentUrl');
    expect(DEFAULT_CLI_CONFIG).toHaveProperty('enableSSE');
    expect(DEFAULT_CLI_CONFIG).toHaveProperty('sessionDirectory');
    expect(DEFAULT_CLI_CONFIG).toHaveProperty('sseOptions');

    // SSE options
    expect(DEFAULT_CLI_CONFIG.sseOptions).toHaveProperty('enableAutoReconnect');
    expect(DEFAULT_CLI_CONFIG.sseOptions).toHaveProperty('maxReconnectAttempts');
    expect(DEFAULT_CLI_CONFIG.sseOptions).toHaveProperty('initialReconnectDelay');
    expect(DEFAULT_CLI_CONFIG.sseOptions).toHaveProperty('maxReconnectDelay');

    // Terminal utilities
    const terminalUtils = new TerminalUtils();
    expect(terminalUtils.getCapabilities).toBeDefined();
    expect(terminalUtils.colorize).toBeDefined();
    expect(terminalUtils.createProgressBar).toBeDefined();
    expect(terminalUtils.createTable).toBeDefined();
  });

  test('should have proper TypeScript types', () => {
    // This test ensures TypeScript compilation succeeds
    const config: CLIConfig = DEFAULT_CLI_CONFIG;
    const configManager: CLIConfigManager = new CLIConfigManager();
    const terminal: TerminalUtils = new TerminalUtils();

    expect(config).toBeDefined();
    expect(configManager).toBeDefined();
    expect(terminal).toBeDefined();
  });
});