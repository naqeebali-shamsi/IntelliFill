/**
 * Tests for form-fields utility functions
 * @module lib/__tests__/form-fields.test
 */

import { describe, it, expect } from 'vitest';
import {
  suggestForms,
  getMissingFields,
  getSuggestedDocuments,
  getDocumentsForForm,
  getFormTypeLabel,
  hasAllRequiredFields,
  type FormSuggestion,
} from '../form-fields';

describe('suggestForms', () => {
  it('returns empty array when no documents uploaded', () => {
    const result = suggestForms([]);
    expect(result).toEqual([]);
  });

  it('suggests visa-application with high confidence for Passport', () => {
    const result = suggestForms(['Passport']);

    const visaSuggestion = result.find((s) => s.formId === 'visa-application');
    expect(visaSuggestion).toBeDefined();
    expect(visaSuggestion?.matchedDocuments).toContain('Passport');
    expect(visaSuggestion?.confidence).toBeGreaterThan(0.5);
  });

  it('suggests emirates-id for Emirates ID document', () => {
    const result = suggestForms(['Emirates ID']);

    const eidSuggestion = result.find((s) => s.formId === 'emirates-id');
    expect(eidSuggestion).toBeDefined();
    expect(eidSuggestion?.matchedDocuments).toContain('Emirates ID');
  });

  it('sorts suggestions by confidence descending', () => {
    const result = suggestForms(['Passport', 'Emirates ID']);

    // Should be sorted by confidence
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
    }
  });

  it('combines multiple documents for higher coverage', () => {
    const singleDoc = suggestForms(['Passport']);
    const multiDoc = suggestForms(['Passport', 'Utility Bill']);

    const singleResidence = singleDoc.find((s) => s.formId === 'residence-permit');
    const multiResidence = multiDoc.find((s) => s.formId === 'residence-permit');

    // Multiple docs should give higher or equal coverage
    expect(multiResidence?.matchedFieldCount).toBeGreaterThanOrEqual(
      singleResidence?.matchedFieldCount || 0
    );
  });

  it('calculates correct field counts', () => {
    const result = suggestForms(['Passport']);

    const visaSuggestion = result.find((s) => s.formId === 'visa-application');
    expect(visaSuggestion).toBeDefined();
    expect(visaSuggestion?.totalFieldCount).toBe(5); // visa requires 5 fields
    expect(visaSuggestion?.matchedFieldCount).toBeGreaterThan(0);
    expect(visaSuggestion?.matchedFieldCount).toBeLessThanOrEqual(
      visaSuggestion?.totalFieldCount || 0
    );
  });

  it('identifies missing documents correctly', () => {
    const result = suggestForms(['Passport']);

    // residence-permit needs both Passport and Utility Bill
    const residenceSuggestion = result.find((s) => s.formId === 'residence-permit');
    if (residenceSuggestion) {
      expect(residenceSuggestion.missingDocuments).toContain('Utility Bill');
      expect(residenceSuggestion.matchedDocuments).toContain('Passport');
    }
  });

  it('handles unknown document types gracefully', () => {
    const result = suggestForms(['Unknown Document Type']);
    expect(result).toEqual([]);
  });

  it('returns all applicable forms for comprehensive document set', () => {
    const result = suggestForms([
      'Passport',
      'Emirates ID',
      "Driver's License",
      'Bank Statement',
      'Utility Bill',
    ]);

    // Should suggest multiple forms
    expect(result.length).toBeGreaterThan(1);

    // Should have high confidence for several forms
    const highConfidenceForms = result.filter((s) => s.confidence >= 0.8);
    expect(highConfidenceForms.length).toBeGreaterThan(0);
  });
});

describe('getDocumentsForForm', () => {
  it('returns passport for visa-application', () => {
    const docs = getDocumentsForForm('visa-application');
    expect(docs).toContain('Passport');
  });

  it('returns Emirates ID and Utility Bill for bank-account', () => {
    const docs = getDocumentsForForm('bank-account');
    expect(docs).toContain('Emirates ID');
    expect(docs).toContain('Utility Bill');
    expect(docs).toContain('Bank Statement');
  });

  it('returns empty array for unknown form', () => {
    const docs = getDocumentsForForm('unknown-form');
    expect(docs).toEqual([]);
  });
});

describe('getMissingFields', () => {
  it('returns all required fields when profile is empty', () => {
    const missing = getMissingFields({}, 'visa-application');
    expect(missing).toEqual([
      'fullName',
      'passportNumber',
      'dateOfBirth',
      'nationality',
      'passportExpiry',
    ]);
  });

  it('returns remaining fields when some are provided', () => {
    const missing = getMissingFields(
      { fullName: 'John Doe', dateOfBirth: '1990-01-01' },
      'visa-application'
    );
    expect(missing).toContain('passportNumber');
    expect(missing).toContain('nationality');
    expect(missing).toContain('passportExpiry');
    expect(missing).not.toContain('fullName');
    expect(missing).not.toContain('dateOfBirth');
  });

  it('returns empty array when all fields provided', () => {
    const missing = getMissingFields(
      {
        fullName: 'John Doe',
        passportNumber: 'P123456',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        passportExpiry: '2030-01-01',
      },
      'visa-application'
    );
    expect(missing).toEqual([]);
  });
});

describe('getSuggestedDocuments', () => {
  it('suggests Passport for passport-related fields', () => {
    const docs = getSuggestedDocuments(['passportNumber', 'passportExpiry']);
    expect(docs).toContain('Passport');
  });

  it('suggests Emirates ID for emiratesIdNumber', () => {
    const docs = getSuggestedDocuments(['emiratesIdNumber']);
    expect(docs).toContain('Emirates ID');
  });

  it('suggests multiple documents for address', () => {
    const docs = getSuggestedDocuments(['address']);
    expect(docs.length).toBeGreaterThan(1);
    expect(docs).toContain("Driver's License");
    expect(docs).toContain('Utility Bill');
  });
});

describe('hasAllRequiredFields', () => {
  it('returns false for empty profile', () => {
    expect(hasAllRequiredFields({}, 'visa-application')).toBe(false);
  });

  it('returns true when all fields present', () => {
    const complete = hasAllRequiredFields(
      {
        fullName: 'John',
        passportNumber: 'P123',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        passportExpiry: '2030-01-01',
      },
      'visa-application'
    );
    expect(complete).toBe(true);
  });
});

describe('getFormTypeLabel', () => {
  it('returns human-readable labels', () => {
    expect(getFormTypeLabel('visa-application')).toBe('Visa Application');
    expect(getFormTypeLabel('emirates-id')).toBe('Emirates ID Application');
    expect(getFormTypeLabel('bank-account')).toBe('Bank Account Opening');
  });

  it('returns original key for unknown form', () => {
    expect(getFormTypeLabel('unknown-form')).toBe('unknown-form');
  });
});
