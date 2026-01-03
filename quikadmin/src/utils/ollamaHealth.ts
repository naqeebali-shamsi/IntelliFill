/**
 * Ollama Health Check Utility
 *
 * Provides health check functionality for the Ollama LLM server
 * used by the multi-agent document processing pipeline.
 *
 * Required Models:
 *   - phi3:mini      (Classification Agent)
 *   - llama3.2:8b    (Extraction Agent, QA Agent)
 *   - mistral:7b     (Mapping Agent)
 */

import { piiSafeLogger as logger } from './piiSafeLogger';

export interface OllamaHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  host: string;
  responseTimeMs: number;
  modelsRequired: string[];
  modelsAvailable: string[];
  modelsMissing: string[];
  version?: string;
  error?: string;
}

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

// Configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const HEALTH_CHECK_TIMEOUT_MS = 10000;

// Required models for the multi-agent pipeline
const REQUIRED_MODELS = [
  'phi3:mini', // Classification (fast, small)
  'llama3.2:8b', // Extraction + QA
  'mistral:7b', // Mapping
];

// Model aliases for flexibility
const MODEL_ALIASES: Record<string, string[]> = {
  'phi3:mini': ['phi3:mini', 'phi-3-mini', 'phi3'],
  'llama3.2:8b': ['llama3.2:8b', 'llama3.2', 'llama3:8b'],
  'mistral:7b': ['mistral:7b', 'mistral:7b-instruct', 'mistral'],
};

/**
 * Check if Ollama server is responding
 */
async function checkServerConnectivity(): Promise<{
  connected: boolean;
  responseTimeMs: number;
  version?: string;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    const response = await fetch(`${OLLAMA_HOST}/api/version`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        connected: false,
        responseTimeMs: Date.now() - startTime,
        error: `Server returned ${response.status}`,
      };
    }

    const data = (await response.json()) as { version?: string };
    return {
      connected: true,
      responseTimeMs: Date.now() - startTime,
      version: data.version,
    };
  } catch (error) {
    return {
      connected: false,
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Get list of available models from Ollama
 */
async function getAvailableModels(): Promise<OllamaModel[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { models?: OllamaModel[] };
    return data.models || [];
  } catch {
    return [];
  }
}

/**
 * Check if a required model is available (considering aliases)
 */
function isModelAvailable(requiredModel: string, availableModels: OllamaModel[]): boolean {
  const aliases = MODEL_ALIASES[requiredModel] || [requiredModel];
  const availableNames = availableModels.map((m) => m.name.toLowerCase());

  return aliases.some((alias) =>
    availableNames.some((name) => name.startsWith(alias.toLowerCase()))
  );
}

/**
 * Perform a comprehensive health check of the Ollama server
 */
export async function checkOllamaHealth(): Promise<OllamaHealthStatus> {
  logger.debug('Performing Ollama health check', { host: OLLAMA_HOST });

  // Check server connectivity
  const connectivity = await checkServerConnectivity();

  if (!connectivity.connected) {
    logger.warn('Ollama server is not reachable', {
      host: OLLAMA_HOST,
      error: connectivity.error,
    });

    return {
      status: 'unhealthy',
      host: OLLAMA_HOST,
      responseTimeMs: connectivity.responseTimeMs,
      modelsRequired: REQUIRED_MODELS,
      modelsAvailable: [],
      modelsMissing: REQUIRED_MODELS,
      error: connectivity.error,
    };
  }

  // Get available models
  const availableModels = await getAvailableModels();
  const availableModelNames = availableModels.map((m) => m.name);

  // Check which required models are available
  const modelsAvailable: string[] = [];
  const modelsMissing: string[] = [];

  for (const required of REQUIRED_MODELS) {
    if (isModelAvailable(required, availableModels)) {
      modelsAvailable.push(required);
    } else {
      modelsMissing.push(required);
    }
  }

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (modelsMissing.length === 0) {
    status = 'healthy';
  } else if (modelsAvailable.length > 0) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  const result: OllamaHealthStatus = {
    status,
    host: OLLAMA_HOST,
    responseTimeMs: connectivity.responseTimeMs,
    modelsRequired: REQUIRED_MODELS,
    modelsAvailable,
    modelsMissing,
    version: connectivity.version,
  };

  if (modelsMissing.length > 0) {
    logger.warn('Some Ollama models are missing', {
      missing: modelsMissing,
      available: availableModelNames,
    });
  } else {
    logger.debug('Ollama health check passed', { status, version: connectivity.version });
  }

  return result;
}

/**
 * Quick check if Ollama is available (for circuit breaker)
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${OLLAMA_HOST}/api/version`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Test a specific model with a simple prompt
 */
export async function testModel(modelName: string): Promise<{
  success: boolean;
  responseTimeMs: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: 'Respond with only the word OK',
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        responseTimeMs: Date.now() - startTime,
        error: `Model returned ${response.status}`,
      };
    }

    const data = (await response.json()) as { response?: string };
    return {
      success: !!data.response,
      responseTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Model test failed',
    };
  }
}

/**
 * Get the configured model for a specific agent role
 */
export function getModelForRole(role: 'classifier' | 'extractor' | 'mapper' | 'qa'): string {
  const envVarMap: Record<string, string> = {
    classifier: 'OLLAMA_MODEL_CLASSIFIER',
    extractor: 'OLLAMA_MODEL_EXTRACTOR',
    mapper: 'OLLAMA_MODEL_MAPPER',
    qa: 'OLLAMA_MODEL_QA',
  };

  const defaults: Record<string, string> = {
    classifier: 'phi3:mini',
    extractor: 'llama3.2:8b',
    mapper: 'mistral:7b',
    qa: 'llama3.2:8b',
  };

  return process.env[envVarMap[role]] || defaults[role];
}

// Export configuration for reference
export const OLLAMA_CONFIG = {
  host: OLLAMA_HOST,
  requiredModels: REQUIRED_MODELS,
  modelAliases: MODEL_ALIASES,
  timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
};
