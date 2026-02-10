/**
 * Unified LLM Client with Multi-Provider Fallback - Phase 2.2
 *
 * Provides a unified interface for LLM calls with:
 * - Multi-provider support (Gemini, Claude, OpenAI)
 * - Automatic fallback on provider failure
 * - Circuit breaker pattern for reliability
 * - Cost tracking and rate limiting
 *
 * @module multiagent/llmClient
 */

import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';
import { z } from 'zod';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { FEATURE_FLAGS } from '../config/featureFlags';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Supported LLM providers
 */
export type LLMProvider = 'gemini' | 'claude' | 'openai';

/**
 * Provider configuration
 */
export interface ProviderConfig {
  name: LLMProvider;
  priority: number;
  enabled: boolean;
  apiKeyEnv: string;
  models: {
    default: string;
    fast: string;
    vision?: string;
  };
  costPer1kTokens: {
    input: number;
    output: number;
  };
}

/**
 * LLM request options
 */
export interface LLMRequestOptions {
  /** Prompt text */
  prompt: string;
  /** Optional image data (base64) */
  image?: {
    data: string;
    mimeType: string;
  };
  /** Model tier to use */
  tier?: 'default' | 'fast';
  /** Specific provider to use (bypasses fallback) */
  provider?: LLMProvider;
  /** JSON schema for structured output */
  schema?: z.ZodType<any>;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * LLM response
 */
export interface LLMResponse<T = string> {
  /** Response content (string or parsed object) */
  content: T;
  /** Provider that handled the request */
  provider: LLMProvider;
  /** Model used */
  model: string;
  /** Token usage */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  /** Estimated cost in USD */
  estimatedCost: number;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Circuit breaker state
 */
interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Provider configurations
 */
const PROVIDER_CONFIGS: Record<LLMProvider, ProviderConfig> = {
  gemini: {
    name: 'gemini',
    priority: 1,
    enabled: true,
    apiKeyEnv: 'GEMINI_API_KEY',
    models: {
      default: 'gemini-3-flash-preview',
      fast: 'gemini-3-flash-preview',
      vision: 'gemini-3-flash-preview',
    },
    costPer1kTokens: {
      input: 0.000075,
      output: 0.0003,
    },
  },
  claude: {
    name: 'claude',
    priority: 2,
    enabled: true,
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    models: {
      default: 'claude-3-5-haiku-latest',
      fast: 'claude-3-5-haiku-latest',
      vision: 'claude-3-5-sonnet-latest',
    },
    costPer1kTokens: {
      input: 0.0008,
      output: 0.004,
    },
  },
  openai: {
    name: 'openai',
    priority: 3,
    enabled: true,
    apiKeyEnv: 'OPENAI_API_KEY',
    models: {
      default: 'gpt-4o-mini',
      fast: 'gpt-4o-mini',
      vision: 'gpt-4o',
    },
    costPer1kTokens: {
      input: 0.00015,
      output: 0.0006,
    },
  },
};

/**
 * Circuit breaker configuration
 */
const CIRCUIT_BREAKER_CONFIG = {
  /** Number of failures before opening circuit */
  failureThreshold: 3,
  /** Time in ms before attempting to close circuit */
  resetTimeMs: 60000,
};

/**
 * Default request timeout
 */
const DEFAULT_TIMEOUT_MS = 30000;

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Circuit breaker for managing provider health
 */
class CircuitBreaker {
  private states: Map<LLMProvider, CircuitState> = new Map();

  /**
   * Check if circuit is open (provider should be skipped)
   */
  isOpen(provider: LLMProvider): boolean {
    const state = this.states.get(provider);
    if (!state) return false;

    if (state.isOpen) {
      // Check if we should attempt to close
      const timeSinceFailure = Date.now() - state.lastFailure;
      if (timeSinceFailure > CIRCUIT_BREAKER_CONFIG.resetTimeMs) {
        // Half-open: allow one request
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Record a failure for a provider
   */
  recordFailure(provider: LLMProvider): void {
    const state = this.states.get(provider) || {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
    };

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      state.isOpen = true;
      logger.warn(`Circuit breaker opened for ${provider}`, {
        failures: state.failures,
      });
    }

    this.states.set(provider, state);
  }

  /**
   * Record a success (reset circuit)
   */
  recordSuccess(provider: LLMProvider): void {
    this.states.delete(provider);
  }

  /**
   * Get circuit breaker status for all providers
   */
  getStatus(): Record<LLMProvider, { isOpen: boolean; failures: number }> {
    const status: Record<string, { isOpen: boolean; failures: number }> = {};
    for (const provider of Object.keys(PROVIDER_CONFIGS) as LLMProvider[]) {
      const state = this.states.get(provider);
      status[provider] = {
        isOpen: state?.isOpen || false,
        failures: state?.failures || 0,
      };
    }
    return status as Record<LLMProvider, { isOpen: boolean; failures: number }>;
  }
}

// ============================================================================
// LLM Client Class
// ============================================================================

/**
 * Unified LLM Client with multi-provider fallback
 */
export class LLMClient {
  private circuitBreaker: CircuitBreaker;
  private geminiClient: GoogleGenerativeAI | null = null;
  private claudeModule: any = null;
  private openaiModule: any = null;

  constructor() {
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Get available providers sorted by priority
   */
  private getAvailableProviders(): ProviderConfig[] {
    return Object.values(PROVIDER_CONFIGS)
      .filter((config) => {
        // Check if provider is enabled
        if (!config.enabled) return false;

        // Check if API key is available
        const apiKey = process.env[config.apiKeyEnv];
        if (!apiKey || apiKey.length === 0) return false;

        // Check multi-provider feature flag (except for primary provider)
        if (!FEATURE_FLAGS.MULTI_PROVIDER && config.name !== 'gemini') {
          return false;
        }

        // Check circuit breaker
        if (this.circuitBreaker.isOpen(config.name)) {
          logger.debug(`Skipping ${config.name}: circuit breaker open`);
          return false;
        }

        return true;
      })
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Initialize Gemini client
   */
  private getGeminiClient(): GoogleGenerativeAI {
    if (!this.geminiClient) {
      const apiKey =
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_KEY;

      if (!apiKey) {
        throw new Error('Gemini API key not configured');
      }

      this.geminiClient = new GoogleGenerativeAI(apiKey);
    }
    return this.geminiClient;
  }

  /**
   * Call Gemini API
   */
  private async callGemini(
    options: LLMRequestOptions,
    config: ProviderConfig
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const genAI = this.getGeminiClient();

    const modelName = options.image
      ? config.models.vision || config.models.default
      : options.tier === 'fast'
        ? config.models.fast
        : config.models.default;

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: options.schema
        ? {
            responseMimeType: 'application/json',
          }
        : undefined,
    });

    const parts: Part[] = [{ text: options.prompt }];

    if (options.image) {
      parts.push({
        inlineData: {
          mimeType: options.image.mimeType,
          data: options.image.data,
        },
      });
    }

    const result = await Promise.race([
      model.generateContent(parts),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Gemini request timed out')),
          options.timeoutMs || DEFAULT_TIMEOUT_MS
        )
      ),
    ]);

    const response = result.response;
    const text = response.text();

    // Estimate tokens (rough approximation)
    const inputTokens = Math.ceil(options.prompt.length / 4);
    const outputTokens = Math.ceil(text.length / 4);

    const processingTimeMs = Date.now() - startTime;
    const estimatedCost =
      (inputTokens / 1000) * config.costPer1kTokens.input +
      (outputTokens / 1000) * config.costPer1kTokens.output;

    return {
      content: text,
      provider: 'gemini',
      model: modelName,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      estimatedCost,
      processingTimeMs,
    };
  }

  /**
   * Call Claude API (Anthropic)
   */
  private async callClaude(
    options: LLMRequestOptions,
    config: ProviderConfig
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    // Lazy load Anthropic SDK
    if (!this.claudeModule) {
      try {
        this.claudeModule = await import('@anthropic-ai/sdk');
      } catch (error) {
        throw new Error('Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk');
      }
    }

    const Anthropic = this.claudeModule.default || this.claudeModule.Anthropic;
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const modelName = options.image
      ? config.models.vision || config.models.default
      : options.tier === 'fast'
        ? config.models.fast
        : config.models.default;

    const messages: any[] = [];

    if (options.image) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: options.image.mimeType,
              data: options.image.data,
            },
          },
          {
            type: 'text',
            text: options.prompt,
          },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: options.prompt,
      });
    }

    const response = await Promise.race([
      client.messages.create({
        model: modelName,
        max_tokens: options.maxTokens || 4096,
        messages,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Claude request timed out')),
          options.timeoutMs || DEFAULT_TIMEOUT_MS
        )
      ),
    ]);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    const processingTimeMs = Date.now() - startTime;
    const estimatedCost =
      (response.usage.input_tokens / 1000) * config.costPer1kTokens.input +
      (response.usage.output_tokens / 1000) * config.costPer1kTokens.output;

    return {
      content: text,
      provider: 'claude',
      model: modelName,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      estimatedCost,
      processingTimeMs,
    };
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    options: LLMRequestOptions,
    config: ProviderConfig
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    // Lazy load OpenAI SDK
    if (!this.openaiModule) {
      try {
        this.openaiModule = await import('openai');
      } catch (error) {
        throw new Error('OpenAI SDK not installed. Run: npm install openai');
      }
    }

    const OpenAI = this.openaiModule.default || this.openaiModule.OpenAI;
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const modelName = options.image
      ? config.models.vision || config.models.default
      : options.tier === 'fast'
        ? config.models.fast
        : config.models.default;

    const messages: any[] = [];

    if (options.image) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${options.image.mimeType};base64,${options.image.data}`,
            },
          },
          {
            type: 'text',
            text: options.prompt,
          },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: options.prompt,
      });
    }

    const response = await Promise.race([
      client.chat.completions.create({
        model: modelName,
        messages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('OpenAI request timed out')),
          options.timeoutMs || DEFAULT_TIMEOUT_MS
        )
      ),
    ]);

    const text = response.choices[0]?.message?.content || '';
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    const processingTimeMs = Date.now() - startTime;
    const estimatedCost =
      (usage.prompt_tokens / 1000) * config.costPer1kTokens.input +
      (usage.completion_tokens / 1000) * config.costPer1kTokens.output;

    return {
      content: text,
      provider: 'openai',
      model: modelName,
      usage: {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      estimatedCost,
      processingTimeMs,
    };
  }

  /**
   * Call a specific provider
   */
  private async callProvider(
    provider: LLMProvider,
    options: LLMRequestOptions
  ): Promise<LLMResponse> {
    const config = PROVIDER_CONFIGS[provider];

    switch (provider) {
      case 'gemini':
        return this.callGemini(options, config);
      case 'claude':
        return this.callClaude(options, config);
      case 'openai':
        return this.callOpenAI(options, config);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Generate completion with automatic fallback
   *
   * @param options - Request options
   * @returns LLM response
   */
  async generate(options: LLMRequestOptions): Promise<LLMResponse> {
    // If specific provider requested, use it directly
    if (options.provider) {
      try {
        const response = await this.callProvider(options.provider, options);
        this.circuitBreaker.recordSuccess(options.provider);
        return response;
      } catch (error) {
        this.circuitBreaker.recordFailure(options.provider);
        throw error;
      }
    }

    // Get available providers and try each
    const providers = this.getAvailableProviders();

    if (providers.length === 0) {
      throw new Error('No LLM providers available. Check API keys and feature flags.');
    }

    let lastError: Error | null = null;

    for (const config of providers) {
      try {
        logger.debug(`Trying LLM provider: ${config.name}`);

        const response = await this.callProvider(config.name, options);
        this.circuitBreaker.recordSuccess(config.name);

        logger.info(`LLM request completed`, {
          provider: config.name,
          model: response.model,
          tokens: response.usage.totalTokens,
          cost: response.estimatedCost.toFixed(6),
          timeMs: response.processingTimeMs,
        });

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        this.circuitBreaker.recordFailure(config.name);

        logger.warn(`LLM provider ${config.name} failed`, {
          error: lastError.message,
          willTryNext: providers.indexOf(config) < providers.length - 1,
        });
      }
    }

    throw lastError ?? new Error('All LLM providers failed');
  }

  /**
   * Generate completion with JSON output
   */
  async generateJSON<T>(
    options: LLMRequestOptions & { schema: z.ZodType<T> }
  ): Promise<LLMResponse<T>> {
    const response = await this.generate({
      ...options,
      prompt: `${options.prompt}\n\nRespond with valid JSON only, no markdown or explanation.`,
    });

    // Parse JSON
    let parsed: T;
    try {
      let rawParsed: unknown;

      // First try direct parse (works when responseMimeType: 'application/json' is set)
      try {
        rawParsed = JSON.parse(response.content.trim());
      } catch {
        // Fallback: extract JSON from markdown code blocks or bare JSON
        const jsonMatch =
          response.content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
          response.content.match(/\[[\s\S]*\]/) ||
          response.content.match(/\{[\s\S]*\}/);

        const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response.content;
        rawParsed = JSON.parse(jsonStr.trim());
      }

      // Validate with Zod schema
      parsed = options.schema.parse(rawParsed);
    } catch (error) {
      throw new Error(
        `Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return {
      ...response,
      content: parsed,
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): Record<LLMProvider, { isOpen: boolean; failures: number }> {
    return this.circuitBreaker.getStatus();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Shared LLM client instance
 */
export const llmClient = new LLMClient();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate LLM completion (convenience wrapper)
 */
export async function generateCompletion(
  prompt: string,
  options?: Partial<LLMRequestOptions>
): Promise<string> {
  const response = await llmClient.generate({ prompt, ...options });
  return response.content;
}

/**
 * Generate LLM completion with JSON output (convenience wrapper)
 */
export async function generateJSON<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options?: Partial<LLMRequestOptions>
): Promise<T> {
  const response = await llmClient.generateJSON({ prompt, schema, ...options });
  return response.content;
}

/**
 * Check if multi-provider fallback is available
 */
export function isMultiProviderAvailable(): boolean {
  if (!FEATURE_FLAGS.MULTI_PROVIDER) return false;

  const availableProviders = Object.values(PROVIDER_CONFIGS).filter((config) => {
    const apiKey = process.env[config.apiKeyEnv];
    return apiKey && apiKey.length > 0;
  });

  return availableProviders.length > 1;
}
