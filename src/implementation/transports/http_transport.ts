/**
 * HTTP Transport for Sentient Agent Framework Logging
 *
 * Provides HTTP/HTTPS-based logging with batching, retry logic, and authentication.
 * Suitable for sending logs to remote aggregation services and monitoring platforms.
 *
 * @module sentient-agent-framework/implementation/transports/http_transport
 * @author Alan 56.7 & Claude 3.7 the Magnificent via Roo on SPARC with Love for Sentient AI Berkeley Hackathon
 * @version 0.1.0
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import {
  LogTransport,
  LogEntry,
  LogLevel,
  HTTPTransportConfig,
  LogFormatter,
  TransportError
} from '../../interface/logging';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface BatchEntry {
  entry: LogEntry;
  timestamp: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface HTTPResponse {
  statusCode: number;
  statusMessage: string;
  body: string;
}

// ============================================================================
// HTTP Formatter
// ============================================================================

export class HTTPFormatter implements LogFormatter {
  constructor(private includeSystemInfo: boolean = true) {}

  format(entry: LogEntry): Record<string, any> {
    const logObject: Record<string, any> = {
      timestamp: entry.timestamp.toISOString(),
      level: entry.levelName,
      logger: entry.logger,
      message: entry.message
    };

    // Add context
    if (entry.context && Object.keys(entry.context).length > 0) {
      logObject.context = entry.context;
    }

    // Add error information
    if (entry.error) {
      logObject.error = entry.error;
    }

    // Add metadata
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      logObject.metadata = entry.metadata;
    }

    // Add system information if configured
    if (this.includeSystemInfo) {
      if (entry.source) logObject.source = entry.source;
      if (entry.hostname) logObject.hostname = entry.hostname;
      if (entry.pid) logObject.pid = entry.pid;
      if (entry.version) logObject.version = entry.version;
    }

    return logObject;
  }
}

// ============================================================================
// HTTP Transport Implementation
// ============================================================================

export class HTTPTransport implements LogTransport {
  public readonly type = 'http';
  private _level: LogLevel;
  private _enabled: boolean;
  private _formatter: LogFormatter;
  private _batch: BatchEntry[] = [];
  private _batchTimer?: NodeJS.Timeout;
  private _retryQueue: BatchEntry[] = [];
  private _isShuttingDown = false;

  // Configuration
  private readonly host: string;
  private readonly port: number;
  private readonly path: string;
  private readonly ssl: boolean;
  private readonly timeout: number;
  private readonly headers: Record<string, string>;
  private readonly auth?: {
    username?: string;
    password?: string;
    token?: string;
  };
  private readonly batchConfig: {
    size: number;
    timeout: number;
  };
  private readonly retryConfig: RetryConfig;

  constructor(
    public readonly name: string,
    config: HTTPTransportConfig
  ) {
    this._level = config.level ?? LogLevel.INFO;
    this._enabled = config.enabled ?? true;
    this._formatter = config.formatter ?? new HTTPFormatter();

    // Parse URL components
    const url = new URL(`http${config.ssl ? 's' : ''}://${config.host}${config.port ? ':' + config.port : ''}${config.path || '/logs'}`);
    this.host = url.hostname;
    this.port = config.port ?? (config.ssl ? 443 : 80);
    this.path = config.path ?? '/logs';
    this.ssl = config.ssl ?? false;
    this.timeout = config.timeout ?? 30000; // 30 seconds

    // Headers and authentication
    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'sentient-agent-framework-http-transport/1.0.0',
      ...config.headers
    };
    this.auth = config.auth;

    // Batch configuration
    this.batchConfig = {
      size: config.batch?.size ?? 10,
      timeout: config.batch?.timeout ?? 5000 // 5 seconds
    };

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffFactor: 2
    };

    this._setupBatchTimer();
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
    if (!this._enabled || entry.level < this._level || this._isShuttingDown) {
      return;
    }

    const batchEntry: BatchEntry = {
      entry,
      timestamp: Date.now()
    };

    this._batch.push(batchEntry);

    // Check if batch is full
    if (this._batch.length >= this.batchConfig.size) {
      await this._flushBatch();
    }
  }

  async close(): Promise<void> {
    this._isShuttingDown = true;

    // Clear batch timer
    if (this._batchTimer) {
      clearTimeout(this._batchTimer);
      this._batchTimer = undefined;
    }

    // Flush remaining logs
    await this._flushBatch();

    // Process retry queue
    if (this._retryQueue.length > 0) {
      await this._sendBatch(this._retryQueue);
      this._retryQueue = [];
    }
  }

  setLevel(level: LogLevel): void {
    this._level = level;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  // ============================================================================
  // HTTP Transport Specific Methods
  // ============================================================================

  async flush(): Promise<void> {
    await this._flushBatch();
  }

  setHeaders(headers: Record<string, string>): void {
    Object.assign(this.headers, headers);
  }

  setAuth(auth: { username?: string; password?: string; token?: string }): void {
    Object.assign(this.auth || {}, auth);
  }

  getStats(): {
    batchSize: number;
    retryQueueSize: number;
    isEnabled: boolean;
  } {
    return {
      batchSize: this._batch.length,
      retryQueueSize: this._retryQueue.length,
      isEnabled: this._enabled
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private _setupBatchTimer(): void {
    this._batchTimer = setTimeout(() => {
      if (this._batch.length > 0) {
        this._flushBatch().catch(error => {
          console.error(`HTTP transport ${this.name} batch flush error:`, error);
        });
      }
      this._setupBatchTimer();
    }, this.batchConfig.timeout);
  }

  private async _flushBatch(): Promise<void> {
    if (this._batch.length === 0) return;

    const batchToSend = [...this._batch];
    this._batch = [];

    try {
      await this._sendBatch(batchToSend);
    } catch (error) {
      // Add failed batch to retry queue
      this._retryQueue.push(...batchToSend);
      
      // Try to send retry queue
      if (this._retryQueue.length > 0) {
        setTimeout(() => {
          this._processRetryQueue().catch(retryError => {
            console.error(`HTTP transport ${this.name} retry error:`, retryError);
          });
        }, this.retryConfig.baseDelay);
      }
    }
  }

  private async _sendBatch(batch: BatchEntry[]): Promise<void> {
    if (batch.length === 0) return;

    const payload = {
      logs: batch.map(item => this._formatter.format(item.entry)),
      metadata: {
        source: 'sentient-agent-framework',
        transport: this.name,
        batchSize: batch.length,
        timestamp: new Date().toISOString()
      }
    };

    const data = JSON.stringify(payload);
    
    await this._makeRequest(data);
  }

  private async _makeRequest(data: string, retryCount = 0): Promise<HTTPResponse> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        ...this.headers,
        'Content-Length': Buffer.byteLength(data).toString()
      };

      // Add authentication headers
      if (this.auth?.token) {
        headers['Authorization'] = `Bearer ${this.auth.token}`;
      } else if (this.auth?.username && this.auth?.password) {
        const credentials = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }

      const options = {
        hostname: this.host,
        port: this.port,
        path: this.path,
        method: 'POST',
        headers,
        timeout: this.timeout
      };

      const client = this.ssl ? https : http;
      const req = client.request(options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          const response: HTTPResponse = {
            statusCode: res.statusCode || 0,
            statusMessage: res.statusMessage || '',
            body
          };

          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            const error = new TransportError(
              this.name,
              `HTTP request failed: ${res.statusCode} ${res.statusMessage}`,
              new Error(body)
            );
            
            // Retry on 5xx errors or specific 4xx errors
            if (retryCount < this.retryConfig.maxRetries &&
                res.statusCode &&
                (res.statusCode >= 500 || res.statusCode === 408 || res.statusCode === 429)) {
              
              const delay = Math.min(
                this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, retryCount),
                this.retryConfig.maxDelay
              );
              
              setTimeout(() => {
                this._makeRequest(data, retryCount + 1)
                  .then(resolve)
                  .catch(reject);
              }, delay);
            } else {
              reject(error);
            }
          }
        });
      });

      req.on('error', (error) => {
        if (retryCount < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, retryCount),
            this.retryConfig.maxDelay
          );
          
          setTimeout(() => {
            this._makeRequest(data, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, delay);
        } else {
          reject(new TransportError(
            this.name,
            `HTTP request failed after ${retryCount + 1} attempts: ${error.message}`,
            error
          ));
        }
      });

      req.on('timeout', () => {
        req.destroy();
        const error = new TransportError(
          this.name,
          `HTTP request timed out after ${this.timeout}ms`
        );
        
        if (retryCount < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, retryCount),
            this.retryConfig.maxDelay
          );
          
          setTimeout(() => {
            this._makeRequest(data, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, delay);
        } else {
          reject(error);
        }
      });

      req.write(data);
      req.end();
    });
  }

  private async _processRetryQueue(): Promise<void> {
    if (this._retryQueue.length === 0 || this._isShuttingDown) return;

    const retryBatch = [...this._retryQueue];
    this._retryQueue = [];

    try {
      await this._sendBatch(retryBatch);
    } catch (error) {
      // If retry fails, we drop the logs to prevent infinite retry loops
      console.error(`HTTP transport ${this.name} retry failed, dropping ${retryBatch.length} log entries:`, error);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a basic HTTP transport
 */
export function createHTTPTransport(
  name: string,
  host: string,
  config?: Partial<HTTPTransportConfig>
): HTTPTransport {
  return new HTTPTransport(name, {
    type: 'http',
    name,
    host,
    ...config
  });
}

/**
 * Creates an HTTPS transport with token authentication
 */
export function createHTTPSTransport(
  name: string,
  host: string,
  token: string,
  config?: Partial<HTTPTransportConfig>
): HTTPTransport {
  return new HTTPTransport(name, {
    type: 'http',
    name,
    host,
    ssl: true,
    auth: { token },
    ...config
  });
}

/**
 * Creates an HTTP transport for ELK Stack (Elasticsearch/Logstash)
 */
export function createElasticsearchTransport(
  name: string,
  host: string,
  index: string,
  config?: Partial<HTTPTransportConfig>
): HTTPTransport {
  return new HTTPTransport(name, {
    type: 'http',
    name,
    host,
    path: `/${index}/_doc`,
    headers: {
      'Content-Type': 'application/json'
    },
    batch: {
      size: 50, // Elasticsearch handles larger batches well
      timeout: 10000
    },
    ...config
  });
}

/**
 * Creates an HTTP transport for Splunk HEC (HTTP Event Collector)
 */
export function createSplunkTransport(
  name: string,
  host: string,
  token: string,
  config?: Partial<HTTPTransportConfig>
): HTTPTransport {
  return new HTTPTransport(name, {
    type: 'http',
    name,
    host,
    path: '/services/collector/event',
    ssl: true,
    headers: {
      'Authorization': `Splunk ${token}`,
      'Content-Type': 'application/json'
    },
    batch: {
      size: 20,
      timeout: 5000
    },
    ...config
  });
}

/**
 * Creates an HTTP transport for custom webhook endpoints
 */
export function createWebhookTransport(
  name: string,
  url: string,
  config?: Partial<HTTPTransportConfig>
): HTTPTransport {
  const parsedUrl = new URL(url);
  
  return new HTTPTransport(name, {
    type: 'http',
    name,
    host: parsedUrl.hostname,
    port: parseInt(parsedUrl.port) || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    ssl: parsedUrl.protocol === 'https:',
    batch: {
      size: 10,
      timeout: 5000
    },
    ...config
  });
}

// ============================================================================
// Exports
// ============================================================================

export {
  type BatchEntry,
  type RetryConfig,
  type HTTPResponse
};