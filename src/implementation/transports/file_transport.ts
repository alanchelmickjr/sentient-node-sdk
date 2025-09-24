/**
 * File Transport for Sentient Agent Framework Logging
 *
 * Provides file-based logging with automatic rotation, compression, and archival.
 * Supports size-based and time-based rotation strategies.
 *
 * @module sentient-agent-framework/implementation/transports/file_transport
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import {
  LogTransport,
  LogEntry,
  LogLevel,
  FileTransportConfig,
  LogFormatter,
  TransportError
} from '../../interface/logging';

// ============================================================================
// Utility Functions and Types
// ============================================================================

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const rename = promisify(fs.rename);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const gzip = promisify(zlib.gzip);

interface RotationInfo {
  shouldRotate: boolean;
  reason: 'size' | 'time' | 'manual';
  currentSize?: number;
  maxSize?: number;
}

interface AuditEntry {
  date: number;
  name: string;
  hash?: string;
}

interface RotatedFile {
  filename: string;
  date: Date;
  size: number;
}

// ============================================================================
// File Formatter
// ============================================================================

export class FileFormatter implements LogFormatter {
  constructor(private includeMetadata: boolean = true) {}

  format(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.levelName.padEnd(5);
    const logger = entry.logger;
    const message = entry.message;

    let line = `${timestamp} [${level}] ${logger}: ${message}`;

    // Add context
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = this.formatContext(entry.context);
      if (contextStr) {
        line += ` ${contextStr}`;
      }
    }

    // Add error information
    if (entry.error) {
      line += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        const stackLines = entry.error.stack.split('\n').slice(1);
        line += '\n  ' + stackLines.map(l => `  ${l}`).join('\n  ');
      }
    }

    // Add metadata if configured
    if (this.includeMetadata && entry.metadata && Object.keys(entry.metadata).length > 0) {
      line += ` metadata=${JSON.stringify(entry.metadata)}`;
    }

    return line;
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

    return Object.entries(filtered)
      .map(([key, value]) => `${key}=${this.formatValue(value)}`)
      .join(' ');
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
}

// ============================================================================
// File Transport Implementation
// ============================================================================

export class FileTransport implements LogTransport {
  public readonly type = 'file';
  private _level: LogLevel;
  private _enabled: boolean;
  private _formatter: LogFormatter;
  private _writeStream?: fs.WriteStream;
  private _rotationTimer?: NodeJS.Timeout;
  private _pendingWrites: Array<() => Promise<void>> = [];
  private _isRotating = false;

  // Configuration
  private readonly filename: string;
  private readonly maxSize?: number;
  private readonly maxFiles?: number;
  private readonly compress: boolean;
  private readonly datePattern?: string;
  private readonly createSymlink: boolean;
  private readonly symlinkName?: string;
  private readonly auditFile?: string;
  private readonly frequency?: string;
  private readonly utc: boolean;
  private readonly extension: string;

  constructor(
    public readonly name: string,
    config: FileTransportConfig
  ) {
    this._level = config.level ?? LogLevel.INFO;
    this._enabled = config.enabled ?? true;
    this._formatter = config.formatter ?? new FileFormatter();

    // File configuration
    this.filename = config.filename;
    this.maxSize = this.parseSize(config.maxSize);
    this.maxFiles = config.maxFiles ?? 5;
    this.compress = config.compress ?? false;
    this.datePattern = config.datePattern;
    this.createSymlink = config.createSymlink ?? false;
    this.symlinkName = config.symlinkName ?? path.basename(this.filename);
    this.auditFile = config.auditFile;
    this.frequency = config.frequency;
    this.utc = config.utc ?? false;
    this.extension = config.extension ?? '';

    // Initialize transport
    this._initialize();
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

  async log(entry: LogEntry): Promise<void> {
    if (!this._enabled || entry.level < this._level) {
      return;
    }

    const writeOperation = async () => {
      try {
        await this._ensureDirectory();
        await this._checkRotation();
        await this._writeToFile(entry);
      } catch (error) {
        throw new TransportError(
          this.name,
          `Failed to write log entry: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        );
      }
    };

    if (this._isRotating) {
      // Queue the write if rotation is in progress
      this._pendingWrites.push(writeOperation);
    } else {
      await writeOperation();
    }
  }

  async close(): Promise<void> {
    // Clear rotation timer
    if (this._rotationTimer) {
      clearInterval(this._rotationTimer);
      this._rotationTimer = undefined;
    }

    // Process pending writes
    if (this._pendingWrites.length > 0) {
      await Promise.all(this._pendingWrites.map(write => write()));
      this._pendingWrites = [];
    }

    // Close write stream
    if (this._writeStream) {
      await new Promise<void>((resolve, reject) => {
        this._writeStream!.end((error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      this._writeStream = undefined;
    }
  }

  setLevel(level: LogLevel): void {
    this._level = level;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  // ============================================================================
  // File Transport Specific Methods
  // ============================================================================

  async rotate(): Promise<void> {
    await this._performRotation('manual');
  }

  async getLogFiles(): Promise<RotatedFile[]> {
    const dir = path.dirname(this.filename);
    const baseName = path.basename(this.filename, path.extname(this.filename));
    
    try {
      const files = await readdir(dir);
      const logFiles: RotatedFile[] = [];

      for (const file of files) {
        if (file.startsWith(baseName) && file !== path.basename(this.filename)) {
          const filePath = path.join(dir, file);
          const stats = await stat(filePath);
          logFiles.push({
            filename: file,
            date: stats.mtime,
            size: stats.size
          });
        }
      }

      return logFiles.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      throw new TransportError(
        this.name,
        `Failed to list log files: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async cleanupOldFiles(): Promise<void> {
    if (!this.maxFiles) return;

    const logFiles = await this.getLogFiles();
    const filesToDelete = logFiles.slice(this.maxFiles);

    for (const file of filesToDelete) {
      try {
        const filePath = path.join(path.dirname(this.filename), file.filename);
        await unlink(filePath);
      } catch (error) {
        console.error(`Failed to delete old log file ${file.filename}:`, error);
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async _initialize(): Promise<void> {
    try {
      await this._ensureDirectory();
      await this._createWriteStream();
      
      if (this.frequency && this.datePattern) {
        this._setupTimeBasedRotation();
      }
    } catch (error) {
      throw new TransportError(
        this.name,
        `Failed to initialize file transport: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async _ensureDirectory(): Promise<void> {
    const dir = path.dirname(this.filename);
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async _createWriteStream(): Promise<void> {
    if (this._writeStream) {
      this._writeStream.end();
    }

    this._writeStream = fs.createWriteStream(this.filename, { 
      flags: 'a',
      encoding: 'utf8',
      highWaterMark: 16 * 1024 // 16KB buffer
    });

    this._writeStream.on('error', (error) => {
      console.error(`File transport ${this.name} stream error:`, error);
    });

    // Create symlink if configured
    if (this.createSymlink && this.symlinkName) {
      await this._createSymlink();
    }
  }

  private async _createSymlink(): Promise<void> {
    if (!this.symlinkName) return;
    
    try {
      const symlinkPath = path.join(path.dirname(this.filename), this.symlinkName);
      const targetPath = path.basename(this.filename);
      
      // Remove existing symlink
      try {
        await unlink(symlinkPath);
      } catch (error) {
        // Ignore if symlink doesn't exist
      }
      
      fs.symlinkSync(targetPath, symlinkPath);
    } catch (error) {
      console.error(`Failed to create symlink:`, error);
    }
  }

  private async _writeToFile(entry: LogEntry): Promise<void> {
    if (!this._writeStream) {
      await this._createWriteStream();
    }

    const formatted = this._formatter.format(entry);
    const message = typeof formatted === 'string' ? formatted : JSON.stringify(formatted);
    const line = `${message}\n`;

    return new Promise<void>((resolve, reject) => {
      this._writeStream!.write(line, 'utf8', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private async _checkRotation(): Promise<void> {
    const rotationInfo = await this._getRotationInfo();
    if (rotationInfo.shouldRotate) {
      await this._performRotation(rotationInfo.reason);
    }
  }

  private async _getRotationInfo(): Promise<RotationInfo> {
    // Check size-based rotation
    if (this.maxSize) {
      try {
        const stats = await stat(this.filename);
        if (stats.size >= this.maxSize) {
          return {
            shouldRotate: true,
            reason: 'size',
            currentSize: stats.size,
            maxSize: this.maxSize
          };
        }
      } catch (error) {
        // File doesn't exist yet, no rotation needed
      }
    }

    // Time-based rotation is handled by timer
    return { shouldRotate: false, reason: 'manual' };
  }

  private async _performRotation(reason: string): Promise<void> {
    if (this._isRotating) return;
    
    this._isRotating = true;

    try {
      // Close current stream
      if (this._writeStream) {
        await new Promise<void>((resolve) => {
          this._writeStream!.end(() => resolve());
        });
        this._writeStream = undefined;
      }

      // Generate rotated filename
      const rotatedFilename = this._generateRotatedFilename();
      
      // Rename current file to rotated name
      try {
        await rename(this.filename, rotatedFilename);
      } catch (error) {
        // File might not exist
      }

      // Compress if configured
      if (this.compress) {
        await this._compressFile(rotatedFilename);
      }

      // Update audit log
      if (this.auditFile) {
        await this._updateAuditLog(rotatedFilename);
      }

      // Create new stream
      await this._createWriteStream();

      // Cleanup old files
      await this.cleanupOldFiles();

      // Process pending writes
      const pendingWrites = [...this._pendingWrites];
      this._pendingWrites = [];
      
      for (const writeOp of pendingWrites) {
        await writeOp();
      }

    } finally {
      this._isRotating = false;
    }
  }

  private _generateRotatedFilename(): string {
    const dir = path.dirname(this.filename);
    const baseName = path.basename(this.filename, path.extname(this.filename));
    const ext = path.extname(this.filename) || this.extension;
    
    const now = this.utc ? new Date() : new Date();
    const timestamp = this.datePattern ? 
      this._formatDate(now, this.datePattern) :
      now.toISOString().replace(/[:.]/g, '-');
    
    return path.join(dir, `${baseName}.${timestamp}${ext}`);
  }

  private _formatDate(date: Date, pattern: string): string {
    const year = this.utc ? date.getUTCFullYear() : date.getFullYear();
    const month = String((this.utc ? date.getUTCMonth() : date.getMonth()) + 1).padStart(2, '0');
    const day = String(this.utc ? date.getUTCDate() : date.getDate()).padStart(2, '0');
    const hour = String(this.utc ? date.getUTCHours() : date.getHours()).padStart(2, '0');
    const minute = String(this.utc ? date.getUTCMinutes() : date.getMinutes()).padStart(2, '0');
    const second = String(this.utc ? date.getUTCSeconds() : date.getSeconds()).padStart(2, '0');

    return pattern
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour)
      .replace('mm', minute)
      .replace('ss', second);
  }

  private async _compressFile(filename: string): Promise<void> {
    try {
      const data = await readFile(filename);
      const compressed = await gzip(data);
      await writeFile(`${filename}.gz`, compressed);
      await unlink(filename);
    } catch (error) {
      console.error(`Failed to compress file ${filename}:`, error);
    }
  }

  private async _updateAuditLog(filename: string): Promise<void> {
    if (!this.auditFile) return;

    try {
      const auditEntry: AuditEntry = {
        date: Date.now(),
        name: path.basename(filename)
      };

      let auditData: AuditEntry[] = [];
      try {
        const existingData = await readFile(this.auditFile, 'utf8');
        auditData = JSON.parse(existingData);
      } catch (error) {
        // Audit file doesn't exist or is invalid
      }

      auditData.push(auditEntry);
      await writeFile(this.auditFile, JSON.stringify(auditData, null, 2));
    } catch (error) {
      console.error(`Failed to update audit log:`, error);
    }
  }

  private _setupTimeBasedRotation(): void {
    if (!this.frequency) return;

    const interval = this._parseFrequency(this.frequency);
    if (interval > 0) {
      this._rotationTimer = setInterval(() => {
        this._performRotation('time').catch(error => {
          console.error(`Time-based rotation failed:`, error);
        });
      }, interval);
    }
  }

  private _parseFrequency(frequency: string): number {
    const match = frequency.match(/^(\d+)([smhdw])$/i);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 's': return value * 1000; // seconds
      case 'm': return value * 60 * 1000; // minutes
      case 'h': return value * 60 * 60 * 1000; // hours
      case 'd': return value * 24 * 60 * 60 * 1000; // days
      case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks
      default: return 0;
    }
  }

  private parseSize(size?: string | number): number | undefined {
    if (typeof size === 'number') {
      return size;
    }

    if (typeof size === 'string') {
      const match = size.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();

        switch (unit) {
          case 'B': return value;
          case 'KB': return value * 1024;
          case 'MB': return value * 1024 * 1024;
          case 'GB': return value * 1024 * 1024 * 1024;
        }
      }
    }

    return undefined;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a basic file transport
 */
export function createFileTransport(
  name: string,
  filename: string,
  config?: Partial<FileTransportConfig>
): FileTransport {
  return new FileTransport(name, { ...config, filename, type: 'file', name });
}

/**
 * Creates a file transport with size-based rotation
 */
export function createRotatingFileTransport(
  name: string,
  filename: string,
  maxSize: string | number,
  maxFiles?: number
): FileTransport {
  return new FileTransport(name, {
    type: 'file',
    name,
    filename,
    maxSize,
    maxFiles: maxFiles ?? 5,
    compress: true
  });
}

/**
 * Creates a file transport with time-based rotation
 */
export function createTimedRotatingFileTransport(
  name: string,
  filename: string,
  frequency: string,
  datePattern?: string
): FileTransport {
  return new FileTransport(name, {
    type: 'file',
    name,
    filename,
    frequency,
    datePattern: datePattern ?? 'YYYY-MM-DD-HH',
    maxFiles: 10,
    compress: true
  });
}

// ============================================================================
// Exports
// ============================================================================

export {
  type RotatedFile,
  type AuditEntry
};