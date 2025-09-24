/**
 * Terminal utilities for cross-platform terminal support
 * 
 * Provides platform-specific terminal functionality, colors, and formatting.
 */

import * as os from 'os';
import * as process from 'process';

export interface TerminalCapabilities {
  supportsColor: boolean;
  supportsUnicode: boolean;
  width: number;
  height: number;
  platform: string;
}

export interface ColorTheme {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  debug: string;
  muted: string;
  reset: string;
}

/**
 * ANSI color codes
 */
export const ANSI_COLORS = {
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
  gray: '\x1b[90m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
  
  // 256-color support
  fg256: (color: number) => `\x1b[38;5;${color}m`,
  bg256: (color: number) => `\x1b[48;5;${color}m`,
  
  // RGB color support
  fgRgb: (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`,
  bgRgb: (r: number, g: number, b: number) => `\x1b[48;2;${r};${g};${b}m`,
};

/**
 * Default color theme
 */
export const DEFAULT_THEME: ColorTheme = {
  primary: ANSI_COLORS.cyan,
  secondary: ANSI_COLORS.blue,
  success: ANSI_COLORS.green,
  warning: ANSI_COLORS.yellow,
  error: ANSI_COLORS.red,
  info: ANSI_COLORS.cyan,
  debug: ANSI_COLORS.gray,
  muted: ANSI_COLORS.dim,
  reset: ANSI_COLORS.reset
};

/**
 * Terminal utility class
 */
export class TerminalUtils {
  private capabilities: TerminalCapabilities;
  private theme: ColorTheme;
  private colorEnabled: boolean;

  constructor(colorEnabled = true, theme: ColorTheme = DEFAULT_THEME) {
    this.capabilities = this.detectCapabilities();
    this.theme = theme;
    this.colorEnabled = colorEnabled && this.capabilities.supportsColor;
  }

  /**
   * Detect terminal capabilities
   */
  private detectCapabilities(): TerminalCapabilities {
    const platform = os.platform();
    const isTTY = process.stdout.isTTY;
    
    // Detect color support
    const supportsColor = isTTY && (
      process.env.FORCE_COLOR === '1' ||
      process.env.FORCE_COLOR === 'true' ||
      (process.env.TERM && process.env.TERM !== 'dumb') ||
      !!process.env.COLORTERM ||
      platform === 'win32'
    );

    // Detect Unicode support
    const supportsUnicode = (
      process.env.LC_ALL === 'C.UTF-8' ||
      process.env.LC_CTYPE === 'UTF-8' ||
      process.env.LANG?.includes('UTF-8') ||
      platform === 'darwin' ||
      platform === 'linux'
    );

    // Get terminal dimensions
    const width = process.stdout.columns || 80;
    const height = process.stdout.rows || 24;

    return {
      supportsColor,
      supportsUnicode,
      width,
      height,
      platform
    };
  }

  /**
   * Colorize text based on theme
   */
  colorize(type: keyof ColorTheme | string, text: string): string {
    if (!this.colorEnabled) {
      return text;
    }

    const color = this.theme[type as keyof ColorTheme] || type;
    return `${color}${text}${this.theme.reset}`;
  }

  /**
   * Create a progress bar
   */
  createProgressBar(
    current: number,
    total: number,
    width = 30,
    filled = '█',
    empty = '░'
  ): string {
    const percentage = Math.min(current / total, 1);
    const filledWidth = Math.floor(percentage * width);
    const emptyWidth = width - filledWidth;
    
    const bar = filled.repeat(filledWidth) + empty.repeat(emptyWidth);
    const percent = Math.floor(percentage * 100);
    
    return `${bar} ${percent}%`;
  }

  /**
   * Create a spinner animation
   */
  createSpinner(frame = 0): string {
    const frames = this.capabilities.supportsUnicode 
      ? ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
      : ['|', '/', '-', '\\'];
    
    return frames[frame % frames.length];
  }

  /**
   * Format text in a box
   */
  createBox(
    text: string,
    options: {
      padding?: number;
      margin?: number;
      style?: 'single' | 'double' | 'rounded';
      width?: number;
    } = {}
  ): string {
    const { padding = 1, margin = 0, style = 'single', width } = options;
    
    const boxChars = {
      single: { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' },
      double: { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝' },
      rounded: { h: '─', v: '│', tl: '╭', tr: '╮', bl: '╰', br: '╯' }
    };

    const chars = this.capabilities.supportsUnicode ? boxChars[style] : {
      h: '-', v: '|', tl: '+', tr: '+', bl: '+', br: '+'
    };

    const lines = text.split('\n');
    const maxLineLength = Math.max(...lines.map(line => line.length));
    const boxWidth = width || (maxLineLength + (padding * 2));
    
    const horizontalLine = chars.h.repeat(boxWidth - 2);
    const topLine = chars.tl + horizontalLine + chars.tr;
    const bottomLine = chars.bl + horizontalLine + chars.br;
    
    const paddedLines = lines.map(line => {
      const paddedLine = line.padEnd(boxWidth - 2 - (padding * 2));
      return chars.v + ' '.repeat(padding) + paddedLine + ' '.repeat(padding) + chars.v;
    });

    const marginLine = ' '.repeat(margin);
    const result = [
      marginLine + topLine,
      ...paddedLines.map(line => marginLine + line),
      marginLine + bottomLine
    ].join('\n');

    return result;
  }

  /**
   * Create a table from data
   */
  createTable(
    data: Array<Record<string, any>>,
    options: {
      headers?: string[];
      maxWidth?: number;
      alignment?: Record<string, 'left' | 'center' | 'right'>;
    } = {}
  ): string {
    if (data.length === 0) {
      return '';
    }

    const { maxWidth = this.capabilities.width - 4, alignment = {} } = options;
    const headers = options.headers || Object.keys(data[0]);
    
    // Calculate column widths
    const columnWidths: Record<string, number> = {};
    headers.forEach(header => {
      const maxContentWidth = Math.max(
        header.length,
        ...data.map(row => String(row[header] || '').length)
      );
      columnWidths[header] = Math.min(maxContentWidth, Math.floor(maxWidth / headers.length));
    });

    // Format cell content
    const formatCell = (content: string, width: number, align: 'left' | 'center' | 'right' = 'left') => {
      const truncated = content.length > width ? content.substring(0, width - 3) + '...' : content;
      
      switch (align) {
        case 'center':
          return truncated.padStart(Math.floor((width + truncated.length) / 2)).padEnd(width);
        case 'right':
          return truncated.padStart(width);
        default:
          return truncated.padEnd(width);
      }
    };

    // Create separator line
    const separator = headers.map(header => '─'.repeat(columnWidths[header])).join('─┼─');
    const topLine = '┌─' + separator + '─┐';
    const midLine = '├─' + separator + '─┤';
    const bottomLine = '└─' + separator + '─┘';

    // Create header row
    const headerRow = '│ ' + headers.map(header => 
      formatCell(header, columnWidths[header], 'center')
    ).join(' │ ') + ' │';

    // Create data rows
    const dataRows = data.map(row => 
      '│ ' + headers.map(header => 
        formatCell(String(row[header] || ''), columnWidths[header], alignment[header] || 'left')
      ).join(' │ ') + ' │'
    );

    return [
      topLine,
      headerRow,
      midLine,
      ...dataRows,
      bottomLine
    ].join('\n');
  }

  /**
   * Clear screen
   */
  clearScreen(): void {
    if (this.capabilities.platform === 'win32') {
      process.stdout.write('\x1Bc');
    } else {
      process.stdout.write('\x1b[2J\x1b[H');
    }
  }

  /**
   * Move cursor to position
   */
  moveCursor(x: number, y: number): void {
    process.stdout.write(`\x1b[${y};${x}H`);
  }

  /**
   * Hide/show cursor
   */
  setCursorVisibility(visible: boolean): void {
    process.stdout.write(visible ? '\x1b[?25h' : '\x1b[?25l');
  }

  /**
   * Get terminal capabilities
   */
  getCapabilities(): TerminalCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Set color theme
   */
  setTheme(theme: ColorTheme): void {
    this.theme = theme;
  }

  /**
   * Enable/disable colors
   */
  setColorEnabled(enabled: boolean): void {
    this.colorEnabled = enabled && this.capabilities.supportsColor;
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    if (seconds > 0) return `${seconds}s`;
    return `${ms}ms`;
  }

  /**
   * Format file size in human-readable format
   */
  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  }

  /**
   * Wrap text to fit terminal width
   */
  wrapText(text: string, width?: number): string {
    const maxWidth = width || this.capabilities.width - 4;
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + word).length > maxWidth) {
        if (currentLine) {
          lines.push(currentLine.trim());
          currentLine = '';
        }
      }
      currentLine += word + ' ';
    }

    if (currentLine) {
      lines.push(currentLine.trim());
    }

    return lines.join('\n');
  }

  /**
   * Create a status indicator
   */
  createStatus(type: 'success' | 'error' | 'warning' | 'info' | 'loading', message: string): string {
    const icons = this.capabilities.supportsUnicode ? {
      success: '✅',
      error: '❌', 
      warning: '⚠️ ',
      info: 'ℹ️ ',
      loading: '⏳'
    } : {
      success: '[OK]',
      error: '[ERR]',
      warning: '[WARN]',
      info: '[INFO]',
      loading: '[...]'
    };

    const colors = {
      success: this.theme.success,
      error: this.theme.error,
      warning: this.theme.warning,
      info: this.theme.info,
      loading: this.theme.primary
    };

    return this.colorize(colors[type], `${icons[type]} ${message}`);
  }
}

/**
 * Global terminal utilities instance
 */
export const terminal = new TerminalUtils();

/**
 * Helper function to create colored text
 */
export function colorize(color: keyof ColorTheme | string, text: string): string {
  return terminal.colorize(color, text);
}

/**
 * Helper function to create status messages
 */
export function status(type: 'success' | 'error' | 'warning' | 'info' | 'loading', message: string): string {
  return terminal.createStatus(type, message);
}