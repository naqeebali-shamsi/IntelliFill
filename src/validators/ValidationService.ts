import { MappingResult } from '../mappers/FieldMapper';
import { logger } from '../utils/logger';

export interface ValidationRule {
  field: string;
  type: 'required' | 'email' | 'phone' | 'date' | 'regex' | 'custom';
  value?: any;
  message?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fieldErrors: Record<string, string[]>;
}

export class ValidationService {
  private rules: ValidationRule[] = [];

  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  setRules(rules: ValidationRule[]): void {
    this.rules = rules;
  }

  async validateMappings(mappingResult: MappingResult): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldErrors: Record<string, string[]> = {};

    // Validate each mapping
    for (const mapping of mappingResult.mappings) {
      const fieldValidation = this.validateField(mapping.formField, mapping.value);
      
      if (fieldValidation.errors.length > 0) {
        fieldErrors[mapping.formField] = fieldValidation.errors;
        errors.push(...fieldValidation.errors.map(e => `${mapping.formField}: ${e}`));
      }
      
      if (fieldValidation.warnings.length > 0) {
        warnings.push(...fieldValidation.warnings.map(w => `${mapping.formField}: ${w}`));
      }

      // Add confidence warnings
      if (mapping.confidence < 0.5) {
        warnings.push(`Very low confidence (${(mapping.confidence * 100).toFixed(1)}%) for field '${mapping.formField}'`);
      } else if (mapping.confidence < 0.7) {
        warnings.push(`Low confidence (${(mapping.confidence * 100).toFixed(1)}%) for field '${mapping.formField}'`);
      }
    }

    // Check for required fields
    const requiredRules = this.rules.filter(r => r.type === 'required');
    for (const rule of requiredRules) {
      const isMapped = mappingResult.mappings.some(m => m.formField === rule.field);
      if (!isMapped) {
        errors.push(`Required field '${rule.field}' is not mapped`);
        fieldErrors[rule.field] = [`Field is required but not mapped`];
      }
    }

    // Add warnings for unmapped form fields
    if (mappingResult.unmappedFormFields.length > 0) {
      warnings.push(`${mappingResult.unmappedFormFields.length} form fields could not be mapped`);
    }

    // Overall confidence warning
    if (mappingResult.overallConfidence < 0.6) {
      warnings.push(`Overall mapping confidence is low: ${(mappingResult.overallConfidence * 100).toFixed(1)}%`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fieldErrors
    };
  }

  private validateField(
    fieldName: string,
    value: any
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldRules = this.rules.filter(r => r.field === fieldName);

    for (const rule of fieldRules) {
      switch (rule.type) {
        case 'required':
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            errors.push(rule.message || 'Field is required');
          }
          break;

        case 'email':
          if (value && !this.isValidEmail(String(value))) {
            errors.push(rule.message || 'Invalid email format');
          }
          break;

        case 'phone':
          if (value && !this.isValidPhone(String(value))) {
            warnings.push(rule.message || 'Phone number may be invalid');
          }
          break;

        case 'date':
          if (value && !this.isValidDate(String(value))) {
            warnings.push(rule.message || 'Date format may be invalid');
          }
          break;

        case 'regex':
          if (value && rule.value && !new RegExp(rule.value).test(String(value))) {
            errors.push(rule.message || `Value does not match required pattern`);
          }
          break;

        case 'custom':
          if (rule.value && typeof rule.value === 'function') {
            const result = rule.value(value);
            if (!result) {
              errors.push(rule.message || 'Custom validation failed');
            }
          }
          break;
      }
    }

    return { errors, warnings };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    // Remove all non-digit characters for validation
    const digits = phone.replace(/\D/g, '');
    // Check if it's a valid phone number (7-15 digits)
    return digits.length >= 7 && digits.length <= 15;
  }

  private isValidDate(date: string): boolean {
    // Try to parse the date
    const parsed = Date.parse(date);
    if (!isNaN(parsed)) {
      return true;
    }

    // Check common date formats
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,  // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/,   // DD-MM-YYYY
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/ // M/D/YY or MM/DD/YYYY
    ];

    return datePatterns.some(pattern => pattern.test(date));
  }

  async validateData(data: Record<string, any>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldErrors: Record<string, string[]> = {};

    for (const [field, value] of Object.entries(data)) {
      const validation = this.validateField(field, value);
      
      if (validation.errors.length > 0) {
        fieldErrors[field] = validation.errors;
        errors.push(...validation.errors.map(e => `${field}: ${e}`));
      }
      
      if (validation.warnings.length > 0) {
        warnings.push(...validation.warnings.map(w => `${field}: ${w}`));
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fieldErrors
    };
  }

  clearRules(): void {
    this.rules = [];
  }

  getRules(): ValidationRule[] {
    return [...this.rules];
  }
}