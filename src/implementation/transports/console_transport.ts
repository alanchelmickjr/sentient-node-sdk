/**
 * Console Transport for Sentient Agent Framework Logging
 *
 * Provides console output with colorized formatting for development environments.
 * Supports structured JSON output and human-readable formatting.
 *
 * @module sentient-agent-framework/implementation/transports/console_transport
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

import { 
  LogTransport, 
  LogEntry, 
  LogLevel, 
  ConsoleTransportConfig,
  LogFormatter,
  TransportError
} from '../../interface/logging';

// ============================================================================
// Console Colors and Formatting
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

const LEVEL_COLORS = {
  [LogLevel.TRACE]: COLORS.dim + COLORS.white,
  [LogLevel.DEBUG]: COLORS.cyan,
  [LogLevel.INFO]: COLORS.green,
  [LogLevel.WARN]: COLORS.yellow,
  [LogLevel.ERROR]: COLORS.red,
  [LogLevel.FATAL]: COLORS.bright + COLORS.red + COLORS.bgWhite,
  [LogLevel.OFF]: COLORS.reset
};

const LEVEL_SYMBOLS = {
  [LogLevel.TRACE]: '•',
  [LogLevel.DEBUG]: '◦',
  [LogLevel.INFO]: '✓',
  [LogLevel.WARN]: '⚠',
  [LogLevel.ERROR]: '✗',
  [LogLevel.FATAL]: '💀',
  [LogLevel.OFF]: ''
};

// ============================================================================
// Formatters
// ============================================================================

/**
 * Simple human-readable formatter for console output
 */
export class ConsoleFormatter implements LogFormatter {
  constructor(
    private colors: boolean = true,
    private timestamp: boolean = true,
    private includeContext: boolean = true
  ) {}

  format(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.timestamp) {
      const time = entry.timestamp.toISOString().split('T')[1].split('.')[0];
      parts.push(this.colors ? `${COLORS.dim}${time}${COLORS.reset}` : time);
    }

    // Level with color and symbol
    const levelColor = this.colors ? LEVEL_COLORS[entry.level] : '';
    const reset = this.colors ? COLORS.reset : '';
    const symbol = LEVEL_SYMBOLS[entry.level];
    const levelStr = `${levelColor}${symbol} ${entry.levelName}${reset}`;
    parts.push(levelStr);

    // Logger name
    const loggerStr = this.colors ? 
      `${COLORS.bright}[${entry.logger}]${COLORS.reset}` : 
      `[${entry.logger}]`;
    parts.push(loggerStr);

    // Message
    parts.push(entry.message);

    let output = parts.join(' ');

    // Context information
    if (this.includeContext && entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = this.formatContext(entry.context);
      output += ` ${contextStr}`;
    }

    // Error information
    if (entry.error) {
      output += '\n' + this.formatError(entry.error);
    }

    return output;
  }

  private formatContext(context: Record<string, any>): string {
    const filtered = Object.fromEntries(
      Object.entries(context).filter(([key, value]) => 
        key !== 'error' && value !== undefined
      )
    );

    if (Object.keys(filtered).length === 0) {
      return '';
    }

    const contextPairs = Object.entries(filtered)
      .map(([key, value]) => `${key}=${this.formatValue(value)}`)
      .join(' ');

    return this.colors ? 
      `${COLORS.dim}(${contextPairs})${COLORS.reset}` : 
      `(${contextPairs})`;
  }

  private formatValue(value: any): string {
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private formatError(error: { name: string; message: string; stack?: string }): string {
    let errorStr = this.colors ? 
      `${COLORS.red}${error.name}: ${error.message}${COLORS.reset}` :
      `${error.name}: ${error.message}`;

    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(1); // Skip first line (already shown)
      const indentedStack = stackLines.map(line => `  ${line}`).join('\n');
      errorStr += '\n' + (this.colors ? `${COLORS.dim}${indentedStack}${COLORS.reset}` : indentedStack);
    }

    return errorStr;
  }
}

/**
 * JSON formatter for structured console output
 */
export class ConsoleJSONFormatter implements LogFormatter {
  constructor(private pretty: boolean = false) {}

  format(entry: LogEntry): string {
    const logObject = {
      timestamp: entry.timestamp.toISOString(),
      level: entry.levelName,
      logger: entry.logger,
      message: entry.message,
      ...(entry.context && Object.keys(entry.context).length > 0 ? { context: entry.context } : {}),
      ...(entry.error ? { error: entry.error } : {}),
      ...(entry.metadata ? { metadata: entry.metadata } : {}),
      ...(entry.source ? { source: entry.source } : {}),
      ...(entry.hostname ? { hostname: entry.hostname } : {}),
      ...(entry.pid ? { pid: entry.pid } : {})
    };

    return this.pretty ? 
      JSON.stringify(logObject, null, 2) : 
      JSON.stringify(logObject);
  }
}

// ============================================================================
// Console Transport Implementation
// ============================================================================

export class ConsoleTransport implements LogTransport {
  public readonly type = 'console';
  private _level: LogLevel;
  private _enabled: boolean;
  private _formatter: LogFormatter;
  private _colors: boolean;
  private _timestamp: boolean;

  constructor(
    public readonly name: string,
    config: Partial<ConsoleTransportConfig> = {}
  ) {
    this._level = config.level ?? LogLevel.INFO;
    this._enabled = config.enabled ?? true;
    this._colors = config.colors ?? true;
    this._timestamp = config.timestamp ?? true;

    // Initialize formatter
    this._formatter = config.formatter ?? new ConsoleFormatter(
      this._colors,
      this._timestamp,
      true
    );
  }

  // ============================================================================
  // Transport Properties
  // ============================================================================

  get level(): LogLevel {
    return this._level;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  // ============================================================================
  // Core Transport Methods
  // ============================================================================

  log(entry: LogEntry): void {
    if (!this._enabled || entry.level < this._level) {
      return;
    }

    try {
      const formatted = this._formatter.format(entry);
      const message = typeof formatted === 'string' ? formatted : JSON.stringify(formatted);
      this._writeToConsole(entry.level, message);
    } catch (error) {
      throw new TransportError(
        this.name,
        `Failed to log message: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  close(): void {
    // Console transport doesn't need cleanup
  }

  setLevel(level: LogLevel): void {
    this._level = level;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  // ============================================================================
  // Console Transport Specific Methods
  // ============================================================================

  setColors(colors: boolean): void {
    this._colors = colors;
    if (this._formatter instanceof ConsoleFormatter) {
      this._formatter = new ConsoleFormatter(colors, this._timestamp, true);
    }
  }

  setTimestamp(timestamp: boolean): void {
    this._timestamp = timestamp;
    if (this._formatter instanceof ConsoleFormatter) {
      this._formatter = new ConsoleFormatter(this._colors, timestamp, true);
    }
  }

  setFormatter(formatter: LogFormatter): void {
    this._formatter = formatter;
  }

  useJSONFormat(pretty: boolean = false): void {
    this._formatter = new ConsoleJSONFormatter(pretty);
  }

  useHumanFormat(): void {
    this._formatter = new ConsoleFormatter(this._colors, this._timestamp, true);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private _writeToConsole(level: LogLevel, message: string): void {
    switch (level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message);
        break;
      default:
        console.log(message);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a console transport with human-readable formatting
 */
export function createConsoleTransport(
  name: string = 'console',
  config?: Partial<ConsoleTransportConfig>
): ConsoleTransport {
  return new ConsoleTransport(name, config);
}

/**
 * Creates a console transport with JSON formatting
 */
export function createJSONConsoleTransport(
  name: string = 'console-json',
  pretty: boolean = false,
  config?: Partial<ConsoleTransportConfig>
): ConsoleTransport {
  const transport = new ConsoleTransport(name, config);
  transport.useJSONFormat(pretty);
  return transport;
}

/**
 * Creates a simple console transport for development
 */
export function createDevConsoleTransport(): ConsoleTransport {
  return createConsoleTransport('dev-console', {
    level: LogLevel.DEBUG,
    colors: true,
    timestamp: true,
    enabled: true
  });
}

/**
 * Creates a production console transport with JSON output
 */
export function createProdConsoleTransport(): ConsoleTransport {
  const transport = createConsoleTransport('prod-console', {
    level: LogLevel.INFO,
    colors: false,
    timestamp: true,
    enabled: true
  });
  transport.useJSONFormat(false);
  return transport;
}

// ============================================================================
// Exports
// ============================================================================

export {
  COLORS,
  LEVEL_COLORS,
  LEVEL_SYMBOLS
};