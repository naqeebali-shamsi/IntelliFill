import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import Joi from 'joi';

export interface TransformationRule {
  source: string | string[];
  target: string;
  transform?: (value: any, context?: any) => any;
  validate?: Joi.Schema;
  required?: boolean;
  defaultValue?: any;
}

export interface TransformationSchema {
  name: string;
  version: string;
  rules: TransformationRule[];
  preTransform?: (data: any) => any;
  postTransform?: (data: any) => any;
  validation?: Joi.Schema;
}

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
  warnings?: Array<{
    field: string;
    message: string;
  }>;
}

export class MCPDataTransformer {
  private schemas: Map<string, TransformationSchema> = new Map();
  private logger: Logger;
  private transformCache: Map<string, any> = new Map();
  private cacheMaxSize = 1000;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    this.logger = createLogger('MCPDataTransformer');
    this.registerBuiltInTransformers();
  }

  private registerBuiltInTransformers(): void {
    // Register common transformation functions
    this.transformers = {
      toString: (value: any) => String(value),
      toNumber: (value: any) => Number(value),
      toBoolean: (value: any) => Boolean(value),
      toDate: (value: any) => new Date(value),
      toUpperCase: (value: string) => value?.toUpperCase(),
      toLowerCase: (value: string) => value?.toLowerCase(),
      trim: (value: string) => value?.trim(),
      parseJSON: (value: string) => {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      },
      stringifyJSON: (value: any) => JSON.stringify(value),
      base64Encode: (value: string) => Buffer.from(value).toString('base64'),
      base64Decode: (value: string) => Buffer.from(value, 'base64').toString(),
      sanitizeHTML: (value: string) => {
        // Basic HTML sanitization
        return value
          ?.replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');
      },
      extractNumbers: (value: string) => value?.replace(/\D/g, ''),
      formatPhone: (value: string) => {
        const numbers = value?.replace(/\D/g, '');
        if (numbers?.length === 10) {
          return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`;
        }
        return value;
      },
      formatCurrency: (value: number) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value);
      },
      arrayToCSV: (value: any[]) => value?.join(','),
      csvToArray: (value: string) => value?.split(',').map((v) => v.trim()),
      mapField: (mapping: Record<string, any>) => (value: any) => mapping[value] || value,
    };
  }

  private transformers: Record<string, (...args: any[]) => any> = {};

  registerSchema(schema: TransformationSchema): void {
    this.schemas.set(schema.name, schema);
    this.logger.info(`Registered transformation schema: ${schema.name}`, {
      version: schema.version,
      ruleCount: schema.rules.length,
    });
  }

  async transform(
    data: any,
    schemaName: string,
    options?: {
      strict?: boolean;
      includeNull?: boolean;
      preserveUnmapped?: boolean;
    }
  ): Promise<{ data: any; validation: ValidationResult }> {
    const schema = this.schemas.get(schemaName);

    if (!schema) {
      throw new Error(`Transformation schema not found: ${schemaName}`);
    }

    this.logger.debug(`Transforming data with schema: ${schemaName}`);

    try {
      // Check cache
      const cacheKey = this.getCacheKey(data, schemaName);
      if (this.transformCache.has(cacheKey)) {
        this.cacheHits++;
        return this.transformCache.get(cacheKey);
      }
      this.cacheMisses++;

      // Pre-transform hook
      const transformedData = schema.preTransform ? schema.preTransform(data) : data;

      // Apply transformation rules
      let result: any = options?.preserveUnmapped ? { ...transformedData } : {};
      const errors: ValidationResult['errors'] = [];
      const warnings: ValidationResult['warnings'] = [];

      for (const rule of schema.rules) {
        try {
          const sourceValue = this.extractValue(transformedData, rule.source);

          // Check required fields
          if (rule.required && (sourceValue === undefined || sourceValue === null)) {
            errors.push({
              field: rule.target,
              message: `Required field is missing`,
              value: sourceValue,
            });
            continue;
          }

          // Apply default value if needed
          let value =
            sourceValue !== undefined && sourceValue !== null ? sourceValue : rule.defaultValue;

          // Apply transformation
          if (rule.transform && value !== undefined) {
            value = await rule.transform(value, transformedData);
          }

          // Validate transformed value
          if (rule.validate && value !== undefined) {
            const validation = rule.validate.validate(value);
            if (validation.error) {
              errors.push({
                field: rule.target,
                message: validation.error.message,
                value,
              });
              continue;
            }
            value = validation.value;
          }

          // Set the value if it's not null/undefined or if includeNull is true
          if (value !== undefined && (value !== null || options?.includeNull)) {
            this.setValue(result, rule.target, value);
          }
        } catch (error: any) {
          this.logger.error(`Error applying transformation rule for ${rule.target}`, error);
          errors.push({
            field: rule.target,
            message: error.message,
          });
        }
      }

      // Post-transform hook
      if (schema.postTransform) {
        result = schema.postTransform(result);
      }

      // Final validation
      if (schema.validation) {
        const validation = schema.validation.validate(result, {
          abortEarly: false,
          allowUnknown: !options?.strict,
        });

        if (validation.error) {
          validation.error.details.forEach((detail) => {
            errors.push({
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value,
            });
          });
        }
      }

      const validationResult: ValidationResult = {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      const response = { data: result, validation: validationResult };

      // Cache the result
      this.updateCache(cacheKey, response);

      return response;
    } catch (error) {
      this.logger.error(`Transformation failed for schema: ${schemaName}`, error);
      throw error;
    }
  }

  private extractValue(data: any, path: string | string[]): any {
    if (Array.isArray(path)) {
      // Try multiple paths and return the first non-null value
      for (const p of path) {
        const value = this.extractValue(data, p);
        if (value !== undefined && value !== null) {
          return value;
        }
      }
      return undefined;
    }

    const parts = path.split('.');
    let current = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array notation like items[0]
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, field, index] = arrayMatch;
        current = current[field];
        if (Array.isArray(current)) {
          current = current[parseInt(index)];
        } else {
          return undefined;
        }
      } else {
        current = current[part];
      }
    }

    return current;
  }

  private setValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];

      // Handle array notation
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, field, index] = arrayMatch;
        if (!current[field]) {
          current[field] = [];
        }
        const idx = parseInt(index);
        if (!current[field][idx]) {
          current[field][idx] = {};
        }
        current = current[field][idx];
      } else {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
    }

    const lastPart = parts[parts.length - 1];
    const arrayMatch = lastPart.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, field, index] = arrayMatch;
      if (!current[field]) {
        current[field] = [];
      }
      current[field][parseInt(index)] = value;
    } else {
      current[lastPart] = value;
    }
  }

  async validate(data: any, schemaName: string): Promise<ValidationResult> {
    const schema = this.schemas.get(schemaName);

    if (!schema) {
      throw new Error(`Validation schema not found: ${schemaName}`);
    }

    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    // Validate against schema rules
    for (const rule of schema.rules) {
      const value = this.extractValue(data, rule.target);

      if (rule.required && (value === undefined || value === null)) {
        errors.push({
          field: rule.target,
          message: 'Required field is missing',
          value,
        });
      }

      if (rule.validate && value !== undefined && value !== null) {
        const validation = rule.validate.validate(value);
        if (validation.error) {
          errors.push({
            field: rule.target,
            message: validation.error.message,
            value,
          });
        }
      }
    }

    // Overall schema validation
    if (schema.validation) {
      const validation = schema.validation.validate(data, {
        abortEarly: false,
      });

      if (validation.error) {
        validation.error.details.forEach((detail) => {
          errors.push({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
          });
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  registerTransformer(name: string, transformer: (...args: any[]) => any): void {
    this.transformers[name] = transformer;
    this.logger.debug(`Registered custom transformer: ${name}`);
  }

  getTransformer(name: string): ((...args: any[]) => any) | undefined {
    return this.transformers[name];
  }

  private getCacheKey(data: any, schemaName: string): string {
    const dataHash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    return `${schemaName}:${dataHash}`;
  }

  private updateCache(key: string, value: any): void {
    // Implement LRU cache eviction
    if (this.transformCache.size >= this.cacheMaxSize) {
      const firstKey = this.transformCache.keys().next().value;
      this.transformCache.delete(firstKey);
    }

    this.transformCache.set(key, value);
  }

  getCacheStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      size: this.transformCache.size,
      maxSize: this.cacheMaxSize,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    };
  }

  clearCache(): void {
    this.transformCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.logger.info('Transformation cache cleared');
  }

  exportSchema(schemaName: string): TransformationSchema | undefined {
    return this.schemas.get(schemaName);
  }

  getAllSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }
}

// Add crypto import at the top of the file
import * as crypto from 'crypto';
