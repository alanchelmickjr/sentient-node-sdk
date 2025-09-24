/**
 * CLI Configuration Management
 * 
 * Handles loading, saving, and managing CLI configuration settings.
 * Supports both file-based and runtime configuration.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface CLIConfig {
  // Agent connection settings
  defaultAgentUrl: string;
  requestTimeout: number;
  enableSSE: boolean;
  sseOptions: {
    enableAutoReconnect: boolean;
    maxReconnectAttempts: number;
    initialReconnectDelay: number;
    maxReconnectDelay: number;
  };

  // Session management
  sessionDirectory: string;
  autoSaveSessions: boolean;
  sessionBackupEnabled: boolean;
  maxSessionHistory: number;

  // Terminal and display settings
  colorOutput: boolean;
  enableHistory: boolean;
  historySize: number;
  promptStyle: 'simple' | 'detailed' | 'minimal';
  displayTimestamps: boolean;
  
  // Logging and debugging
  verbose: boolean;
  debug: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  logFile?: string;

  // Batch processing
  batchFile?: string;
  batchTimeout: number;
  continueOnError: boolean;

  // Auto-completion and help
  enableAutoComplete: boolean;
  showHints: boolean;
  
  // Performance settings
  streamBufferSize: number;
  maxConcurrentRequests: number;
  
  // File paths
  configPath?: string;
  dataDirectory: string;
}

export const DEFAULT_CLI_CONFIG: CLIConfig = {
  // Agent connection settings
  defaultAgentUrl: 'http://localhost:8000',
  requestTimeout: 30000,
  enableSSE: true,
  sseOptions: {
    enableAutoReconnect: true,
    maxReconnectAttempts: 5,
    initialReconnectDelay: 1000,
    maxReconnectDelay: 10000,
  },

  // Session management
  sessionDirectory: path.join(os.homedir(), '.sentient-cli', 'sessions'),
  autoSaveSessions: true,
  sessionBackupEnabled: true,
  maxSessionHistory: 100,

  // Terminal and display settings
  colorOutput: true,
  enableHistory: true,
  historySize: 1000,
  promptStyle: 'detailed',
  displayTimestamps: false,
  
  // Logging and debugging
  verbose: false,
  debug: false,
  logLevel: 'info',

  // Batch processing
  batchTimeout: 60000,
  continueOnError: false,

  // Auto-completion and help
  enableAutoComplete: true,
  showHints: true,
  
  // Performance settings
  streamBufferSize: 8192,
  maxConcurrentRequests: 5,
  
  // File paths
  dataDirectory: path.join(os.homedir(), '.sentient-cli'),
};

/**
 * Configuration manager for the CLI
 */
export class CLIConfigManager {
  private config: CLIConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(os.homedir(), '.sentient-cli', 'config.json');
    this.config = { ...DEFAULT_CLI_CONFIG };
  }

  /**
   * Load configuration from file or use defaults
   */
  async load(): Promise<CLIConfig> {
    try {
      // Ensure config directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });

      // Try to load existing config
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(configData);
      
      // Merge with defaults to handle new config options
      this.config = this.mergeConfig(DEFAULT_CLI_CONFIG, loadedConfig);
      
      // Validate and fix any issues
      this.validateConfig();
      
      return this.config;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // Config file doesn't exist, create with defaults
        await this.save();
        return this.config;
      } else {
        console.warn(`Warning: Could not load config from ${this.configPath}: ${error}. Using defaults.`);
        return { ...DEFAULT_CLI_CONFIG };
      }
    }
  }

  /**
   * Save current configuration to file
   */
  async save(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config to ${this.configPath}: ${error}`);
    }
  }

  /**
   * Get current configuration
   */
  get(): CLIConfig {
    return { ...this.config };
  }

  /**
   * Update configuration values
   */
  update(updates: Partial<CLIConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    this.validateConfig();
  }

  /**
   * Set a specific configuration value by path
   */
  set(key: string, value: any): void {
    const keys = key.split('.');
    let current: any = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
    this.validateConfig();
  }

  /**
   * Get a specific configuration value by path
   */
  getValue(key: string): any {
    const keys = key.split('.');
    let current: any = this.config;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.config = { ...DEFAULT_CLI_CONFIG };
  }

  /**
   * Get configuration as formatted string for display
   */
  toString(): string {
    const formatValue = (obj: any, indent = 0): string => {
      const spaces = '  '.repeat(indent);
      
      if (typeof obj === 'object' && obj !== null) {
        const lines: string[] = [];
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object' && value !== null) {
            lines.push(`${spaces}${key}:`);
            lines.push(formatValue(value, indent + 1));
          } else {
            lines.push(`${spaces}${key}: ${JSON.stringify(value)}`);
          }
        }
        return lines.join('\n');
      } else {
        return `${spaces}${JSON.stringify(obj)}`;
      }
    };

    return formatValue(this.config);
  }

  /**
   * Validate and fix configuration values
   */
  private validateConfig(): void {
    // Ensure numeric values are within reasonable ranges
    this.config.requestTimeout = Math.max(1000, Math.min(300000, this.config.requestTimeout));
    this.config.historySize = Math.max(10, Math.min(10000, this.config.historySize));
    this.config.maxSessionHistory = Math.max(1, Math.min(1000, this.config.maxSessionHistory));
    this.config.streamBufferSize = Math.max(1024, Math.min(65536, this.config.streamBufferSize));
    this.config.maxConcurrentRequests = Math.max(1, Math.min(20, this.config.maxConcurrentRequests));
    
    // Ensure SSE options are valid
    if (this.config.sseOptions) {
      this.config.sseOptions.maxReconnectAttempts = Math.max(0, Math.min(50, this.config.sseOptions.maxReconnectAttempts));
      this.config.sseOptions.initialReconnectDelay = Math.max(100, Math.min(60000, this.config.sseOptions.initialReconnectDelay));
      this.config.sseOptions.maxReconnectDelay = Math.max(this.config.sseOptions.initialReconnectDelay, Math.min(300000, this.config.sseOptions.maxReconnectDelay));
    }
    
    // Ensure directories exist and are writable
    if (!path.isAbsolute(this.config.sessionDirectory)) {
      this.config.sessionDirectory = path.resolve(this.config.sessionDirectory);
    }
    if (!path.isAbsolute(this.config.dataDirectory)) {
      this.config.dataDirectory = path.resolve(this.config.dataDirectory);
    }
  }

  /**
   * Deep merge two configuration objects
   */
  private mergeConfig(base: any, override: any): any {
    const result = { ...base };
    
    for (const key in override) {
      if (override.hasOwnProperty(key)) {
        if (typeof override[key] === 'object' && override[key] !== null && 
            typeof base[key] === 'object' && base[key] !== null &&
            !Array.isArray(override[key])) {
          result[key] = this.mergeConfig(base[key], override[key]);
        } else {
          result[key] = override[key];
        }
      }
    }
    
    return result;
  }
}

/**
 * Create and export a global config manager instance
 */
export function createConfigManager(configPath?: string): CLIConfigManager {
  return new CLIConfigManager(configPath);
}