/**
 * LLM Validation Schemas
 * 
 * Zod validation schemas for LLM interfaces, integrating with the existing
 * Sentient Agent Framework validation system.
 * 
 * @module sentient-agent-framework/validation/llm-schemas
 */

import { z } from 'zod';

// ============================================================================
// Basic LLM Schema Definitions
// ============================================================================

/**
 * Chat role validation
 */
export const ChatRoleSchema = z.enum(['system', 'user', 'assistant', 'function', 'tool']);

/**
 * Finish reason validation
 */
export const FinishReasonSchema = z.enum(['stop', 'length', 'function_call', 'tool_calls', 'content_filter', 'error']);

/**
 * Function definition validation
 */
export const FunctionDefinitionSchema = z.object({
  name: z.string().min(1, 'Function name is required'),
  description: z.string().optional(),
  parameters: z.record(z.any()),
  required: z.boolean().optional()
});

/**
 * Tool definition validation
 */
export const ToolDefinitionSchema = z.object({
  type: z.literal('function'),
  function: FunctionDefinitionSchema
});

/**
 * Message content validation (multimodal)
 */
export const MessageContentSchema = z.object({
  type: z.enum(['text', 'image_url', 'image_base64']),
  text: z.string().optional(),
  image_url: z.object({
    url: z.string().url(),
    detail: z.enum(['low', 'high', 'auto']).optional()
  }).optional(),
  image_base64: z.object({
    data: z.string(),
    media_type: z.string()
  }).optional()
});

/**
 * Chat message validation
 */
export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.union([z.string(), z.array(MessageContentSchema)]),
  name: z.string().optional(),
  function_call: z.object({
    name: z.string(),
    arguments: z.string()
  }).optional(),
  tool_calls: z.array(z.object({
    id: z.string(),
    type: z.literal('function'),
    function: z.object({
      name: z.string(),
      arguments: z.string()
    })
  })).optional(),
  tool_call_id: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

/**
 * LLM parameters validation
 */
export const LLMParametersSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().positive().optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  stopSequences: z.array(z.string()).optional(),
  seed: z.number().int().optional(),
  responseFormat: z.object({
    type: z.enum(['text', 'json_object', 'json_schema']),
    schema: z.record(z.any()).optional()
  }).optional(),
  functions: z.array(FunctionDefinitionSchema).optional(),
  functionCall: z.union([
    z.enum(['none', 'auto']),
    z.object({ name: z.string() })
  ]).optional(),
  tools: z.array(ToolDefinitionSchema).optional(),
  toolChoice: z.union([
    z.enum(['none', 'auto', 'required']),
    z.object({
      type: z.literal('function'),
      function: z.object({ name: z.string() })
    })
  ]).optional()
}).catchall(z.any()); // Allow provider-specific parameters

/**
 * Request metadata validation
 */
export const RequestMetadataSchema = z.object({
  sessionId: z.string().optional(),
  requestId: z.string().min(1, 'Request ID is required'),
  userId: z.string().optional(),
  timestamp: z.date(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  timeout: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
  custom: z.record(z.any()).optional()
});

/**
 * LLM request validation
 */
export const LLMRequestSchema = z.object({
  model: z.string().min(1, 'Model is required'),
  messages: z.array(ChatMessageSchema).min(1, 'At least one message is required'),
  parameters: LLMParametersSchema,
  metadata: RequestMetadataSchema,
  stream: z.boolean().optional(),
  providerOptions: z.record(z.any()).optional()
});

/**
 * Token usage validation
 */
export const TokenUsageSchema = z.object({
  promptTokens: z.number().nonnegative(),
  completionTokens: z.number().nonnegative(),
  totalTokens: z.number().nonnegative(),
  cachedTokens: z.number().nonnegative().optional()
});

/**
 * Response choice validation
 */
export const ResponseChoiceSchema = z.object({
  index: z.number().nonnegative(),
  message: z.object({
    role: ChatRoleSchema,
    content: z.string().nullable(),
    function_call: z.object({
      name: z.string(),
      arguments: z.string(),
      parsedArguments: z.record(z.any()).optional()
    }).optional(),
    tool_calls: z.array(z.object({
      id: z.string(),
      type: z.literal('function'),
      function: z.object({
        name: z.string(),
        arguments: z.string(),
        parsedArguments: z.record(z.any()).optional()
      })
    })).optional()
  }),
  finishReason: FinishReasonSchema,
  logprobs: z.object({
    tokens: z.array(z.string()),
    token_logprobs: z.array(z.number()),
    top_logprobs: z.array(z.record(z.number())).optional()
  }).optional()
});

/**
 * LLM response validation
 */
export const LLMResponseSchema = z.object({
  id: z.string().min(1),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(ResponseChoiceSchema).min(1),
  usage: TokenUsageSchema,
  systemFingerprint: z.string().optional(),
  metadata: z.object({
    processingTime: z.number().nonnegative(),
    provider: z.string(),
    requestId: z.string(),
    cached: z.boolean().optional(),
    custom: z.record(z.any()).optional()
  }).optional()
});

/**
 * Stream chunk validation
 */
export const LLMStreamChunkSchema = z.object({
  content: z.string(),
  model: z.string(),
  finishReason: FinishReasonSchema.nullable(),
  usage: TokenUsageSchema.partial().optional(),
  functionCall: z.object({
    name: z.string().optional(),
    arguments: z.string().optional()
  }).optional(),
  toolCalls: z.array(z.object({
    id: z.string().optional(),
    type: z.literal('function').optional(),
    function: z.object({
      name: z.string().optional(),
      arguments: z.string().optional()
    }).optional()
  })).optional(),
  index: z.number().optional(),
  delta: z.object({
    role: ChatRoleSchema.optional(),
    content: z.string().optional(),
    function_call: z.object({
      name: z.string().optional(),
      arguments: z.string().optional()
    }).optional(),
    tool_calls: z.array(z.object({
      index: z.number().optional(),
      id: z.string().optional(),
      type: z.literal('function').optional(),
      function: z.object({
        name: z.string().optional(),
        arguments: z.string().optional()
      }).optional()
    })).optional()
  }).optional(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional()
});

// ============================================================================
// Configuration Schemas
// ============================================================================

/**
 * Model pricing validation
 */
export const ModelPricingSchema = z.object({
  inputCost: z.number().nonnegative(),
  outputCost: z.number().nonnegative(),
  currency: z.string().length(3), // ISO currency code
  tier: z.string().optional(),
  batchPricing: z.object({
    inputCost: z.number().nonnegative(),
    outputCost: z.number().nonnegative(),
    minimumBatch: z.number().positive().optional()
  }).optional()
});

/**
 * Model capability validation
 */
export const ModelCapabilitySchema = z.object({
  maxContextLength: z.number().positive(),
  maxOutputTokens: z.number().positive(),
  supportsFunctionCalling: z.boolean(),
  supportsToolCalling: z.boolean(),
  supportsVision: z.boolean(),
  supportsJsonMode: z.boolean(),
  supportsStreaming: z.boolean(),
  supportedLanguages: z.array(z.string()),
  trainingDataCutoff: z.string().optional(),
  specialCapabilities: z.array(z.string()).optional()
});

/**
 * Model information validation
 */
export const ModelInfoSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  capabilities: ModelCapabilitySchema,
  pricing: ModelPricingSchema,
  deprecated: z.boolean().optional(),
  family: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

/**
 * Rate limit validation
 */
export const RateLimitInfoSchema = z.object({
  requestsPerMinute: z.number().positive(),
  tokensPerMinute: z.number().positive(),
  concurrentRequests: z.number().positive(),
  burstAllowance: z.number().positive().optional(),
  resetInterval: z.number().positive().optional()
});

/**
 * Retry configuration validation
 */
export const RetryConfigSchema = z.object({
  maxRetries: z.number().nonnegative(),
  baseDelay: z.number().positive(),
  maxDelay: z.number().positive(),
  jitterMs: z.number().nonnegative(),
  backoffMultiplier: z.number().min(1),
  retryOn: z.array(z.string()),
  dontRetryOn: z.array(z.string()).optional()
});

/**
 * Circuit breaker configuration validation
 */
export const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().positive(),
  successThreshold: z.number().positive(),
  timeout: z.number().positive(),
  monitoringWindow: z.number().positive(),
  minimumCalls: z.number().positive()
});

/**
 * Connection pool configuration validation
 */
export const ConnectionPoolConfigSchema = z.object({
  maxSockets: z.number().positive(),
  maxFreeSockets: z.number().positive(),
  timeout: z.number().positive(),
  keepAliveMsecs: z.number().positive(),
  maxTotalSockets: z.number().positive().optional()
});

/**
 * Base LLM provider configuration validation
 */
export const LLMProviderConfigSchema = z.object({
  providerId: z.string().min(1),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  organizationId: z.string().optional(),
  defaultModel: z.string().min(1),
  timeout: z.number().positive(),
  retries: RetryConfigSchema,
  circuitBreaker: CircuitBreakerConfigSchema,
  rateLimit: RateLimitInfoSchema,
  connectionPool: ConnectionPoolConfigSchema,
  healthCheckInterval: z.number().positive().optional(),
  enableLogging: z.boolean(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
  customHeaders: z.record(z.string()).optional(),
  providerOptions: z.record(z.any()).optional()
});

/**
 * OpenAI provider configuration validation
 */
export const OpenAIProviderConfigSchema = LLMProviderConfigSchema.extend({
  organization: z.string().optional(),
  projectId: z.string().optional(),
  enableBeta: z.boolean().optional(),
  user: z.string().optional()
});

/**
 * Anthropic provider configuration validation
 */
export const AnthropicProviderConfigSchema = LLMProviderConfigSchema.extend({
  anthropicVersion: z.string().optional(),
  anthropicBeta: z.array(z.string()).optional()
});

/**
 * Hugging Face provider configuration validation
 */
export const HuggingFaceProviderConfigSchema = LLMProviderConfigSchema.extend({
  repository: z.string().optional(),
  revision: z.string().optional(),
  useDedicatedEndpoint: z.boolean().optional(),
  dedicatedEndpointUrl: z.string().url().optional(),
  waitForModel: z.boolean().optional(),
  useCache: z.boolean().optional()
});

/**
 * Sentient provider configuration validation
 */
export const SentientProviderConfigSchema = LLMProviderConfigSchema.extend({
  apiVersion: z.string().optional(),
  modelVariant: z.string().min(1),
  promptTemplate: z.string().optional(),
  personality: z.object({
    creativityLevel: z.number().min(0).max(1),
    formalityLevel: z.number().min(0).max(1),
    verbosityLevel: z.number().min(0).max(1),
    humorLevel: z.number().min(0).max(1)
  }).optional(),
  contentFilter: z.object({
    enabled: z.boolean(),
    strictness: z.enum(['low', 'medium', 'high']),
    customRules: z.array(z.string()).optional()
  }).optional()
});

// ============================================================================
// Metrics Schemas
// ============================================================================

/**
 * Request metrics validation
 */
export const RequestMetricsSchema = z.object({
  total: z.number().nonnegative(),
  successful: z.number().nonnegative(),
  failed: z.number().nonnegative(),
  requestsPerSecond: z.number().nonnegative().optional(),
  averageRequestsPerMinute: z.number().nonnegative().optional()
});

/**
 * Token metrics validation
 */
export const TokenMetricsSchema = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  total: z.number().nonnegative(),
  cached: z.number().nonnegative().optional(),
  tokensPerSecond: z.number().nonnegative().optional(),
  averageCostPerToken: z.number().nonnegative().optional()
});

/**
 * Performance metrics validation
 */
export const PerformanceMetricsSchema = z.object({
  avgResponseTime: z.number().nonnegative(),
  minResponseTime: z.number().nonnegative(),
  maxResponseTime: z.number().nonnegative(),
  p95ResponseTime: z.number().nonnegative().optional(),
  p99ResponseTime: z.number().nonnegative().optional(),
  throughput: z.number().nonnegative().optional()
});

/**
 * Error metrics validation
 */
export const ErrorMetricsSchema = z.object({
  networkErrors: z.number().nonnegative(),
  apiErrors: z.number().nonnegative(),
  timeoutErrors: z.number().nonnegative(),
  rateLimitErrors: z.number().nonnegative(),
  authErrors: z.number().nonnegative().optional(),
  validationErrors: z.number().nonnegative().optional(),
  circuitBreakerErrors: z.number().nonnegative().optional()
});

/**
 * Provider metrics validation
 */
export const ProviderMetricsSchema = z.object({
  requests: RequestMetricsSchema,
  tokens: TokenMetricsSchema,
  performance: PerformanceMetricsSchema,
  operations: z.object({
    generate: z.number().nonnegative(),
    stream: z.number().nonnegative(),
    healthChecks: z.number().nonnegative().optional(),
    configUpdates: z.number().nonnegative().optional()
  }),
  errors: ErrorMetricsSchema,
  healthChecks: z.object({
    total: z.number().nonnegative(),
    successful: z.number().nonnegative(),
    failed: z.number().nonnegative(),
    lastCheck: z.date(),
    averageResponseTime: z.number().nonnegative().optional(),
    successRate: z.number().min(0).max(1).optional()
  }),
  timestamp: z.date()
});

// ============================================================================
// Manager Configuration Schemas
// ============================================================================

/**
 * Selection strategy validation
 */
export const SelectionStrategySchema = z.enum([
  'round_robin', 'random', 'least_loaded', 'fastest', 'cheapest', 'highest_quality', 'custom'
]);

/**
 * Load balancing configuration validation
 */
export const LoadBalancingConfigSchema = z.object({
  strategy: SelectionStrategySchema,
  weights: z.object({
    performance: z.number().min(0).max(1),
    cost: z.number().min(0).max(1),
    reliability: z.number().min(0).max(1),
    quality: z.number().min(0).max(1)
  }).optional(),
  stickySession: z.boolean().optional(),
  sessionTimeout: z.number().positive().optional(),
  healthThreshold: z.number().min(0).max(1).optional()
});

/**
 * Failover configuration validation
 */
export const FailoverConfigSchema = z.object({
  enabled: z.boolean(),
  maxAttempts: z.number().positive(),
  attemptDelay: z.number().positive(),
  backoffMultiplier: z.number().min(1),
  maxDelay: z.number().positive(),
  triggerConditions: z.object({
    networkErrors: z.boolean(),
    timeoutErrors: z.boolean(),
    rateLimitErrors: z.boolean(),
    authErrors: z.boolean(),
    serverErrors: z.boolean()
  }),
  exclusionDuration: z.number().positive()
});

/**
 * LLM manager configuration validation
 */
export const LLMManagerConfigSchema = z.object({
  defaultProvider: z.string().optional(),
  loadBalancing: LoadBalancingConfigSchema,
  failover: FailoverConfigSchema,
  globalTimeout: z.number().positive(),
  healthMonitoring: z.boolean(),
  healthCheckInterval: z.number().positive(),
  metricsEnabled: z.boolean(),
  metricsInterval: z.number().positive(),
  cachingEnabled: z.boolean(),
  cacheTTL: z.number().positive(),
  loggingEnabled: z.boolean(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error'])
});

// ============================================================================
// Type Exports
// ============================================================================

export type ChatRole = z.infer<typeof ChatRoleSchema>;
export type FinishReason = z.infer<typeof FinishReasonSchema>;
export type FunctionDefinition = z.infer<typeof FunctionDefinitionSchema>;
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
export type MessageContent = z.infer<typeof MessageContentSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type LLMParameters = z.infer<typeof LLMParametersSchema>;
export type RequestMetadata = z.infer<typeof RequestMetadataSchema>;
export type LLMRequest = z.infer<typeof LLMRequestSchema>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export type ResponseChoice = z.infer<typeof ResponseChoiceSchema>;
export type LLMResponse = z.infer<typeof LLMResponseSchema>;
export type LLMStreamChunk = z.infer<typeof LLMStreamChunkSchema>;
export type ModelPricing = z.infer<typeof ModelPricingSchema>;
export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;
export type ModelInfo = z.infer<typeof ModelInfoSchema>;
export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;
export type RetryConfig = z.infer<typeof RetryConfigSchema>;
export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;
export type ConnectionPoolConfig = z.infer<typeof ConnectionPoolConfigSchema>;
export type LLMProviderConfig = z.infer<typeof LLMProviderConfigSchema>;
export type OpenAIProviderConfig = z.infer<typeof OpenAIProviderConfigSchema>;
export type AnthropicProviderConfig = z.infer<typeof AnthropicProviderConfigSchema>;
export type HuggingFaceProviderConfig = z.infer<typeof HuggingFaceProviderConfigSchema>;
export type SentientProviderConfig = z.infer<typeof SentientProviderConfigSchema>;
export type RequestMetrics = z.infer<typeof RequestMetricsSchema>;
export type TokenMetrics = z.infer<typeof TokenMetricsSchema>;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
export type ErrorMetrics = z.infer<typeof ErrorMetricsSchema>;
export type ProviderMetrics = z.infer<typeof ProviderMetricsSchema>;
export type SelectionStrategy = z.infer<typeof SelectionStrategySchema>;
export type LoadBalancingConfig = z.infer<typeof LoadBalancingConfigSchema>;
export type FailoverConfig = z.infer<typeof FailoverConfigSchema>;
export type LLMManagerConfig = z.infer<typeof LLMManagerConfigSchema>;