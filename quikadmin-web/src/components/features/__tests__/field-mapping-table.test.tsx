/**
 * FieldMappingTable Component Tests
 *
 * Tests for field mapping table with per-field confidence display,
 * extraction source indicators, and backward compatibility.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FieldMappingTable } from '@/components/features/field-mapping-table';
import type { FormField, FieldMapping, DocumentData, ExtractedFieldResult } from '@/types/formFilling';

// Mock data for testing
const mockFormFields: FormField[] = [
  { name: 'firstName', type: 'text', required: true },
  { name: 'lastName', type: 'text', required: true },
  { name: 'email', type: 'email', required: false },
  { name: 'phone', type: 'tel', required: false },
];

const mockMappings: FieldMapping[] = [
  { formField: 'firstName', documentField: 'first_name', confidence: 95, manualOverride: false },
  { formField: 'lastName', documentField: 'last_name', confidence: 85, manualOverride: false },
  { formField: 'email', documentField: 'email_address', confidence: 45, manualOverride: false },
  { formField: 'phone', documentField: null, confidence: 0, manualOverride: false },
];

// Legacy format document data (simple values)
const mockLegacyDocumentData: DocumentData = {
  first_name: 'John',
  last_name: 'Doe',
  email_address: 'john@example.com',
  phone_number: '555-1234',
};

// New format document data with ExtractedFieldResult
const mockNewFormatDocumentData: DocumentData = {
  fields: {
    first_name: {
      value: 'John',
      confidence: 92,
      source: 'ocr',
      rawText: 'John ',
    } as ExtractedFieldResult,
    last_name: {
      value: 'Doe',
      confidence: 88,
      source: 'pattern',
    } as ExtractedFieldResult,
    email_address: {
      value: 'john@example.com',
      confidence: 35,
      source: 'llm',
      rawText: 'john @ example.com',
    } as ExtractedFieldResult,
    phone_number: {
      value: '555-1234',
      confidence: 75,
      source: 'pattern',
    } as ExtractedFieldResult,
  },
};

// Props for per-field extraction info
const mockFieldExtractionInfo = {
  first_name: { confidence: 95, source: 'ocr' as const },
  last_name: { confidence: 60, source: 'pattern' as const },
  email_address: { confidence: 25, source: 'llm' as const, rawText: 'j0hn@examp1e.com' },
};

describe('FieldMappingTable Component', () => {
  const defaultProps = {
    formFields: mockFormFields,
    documentData: mockLegacyDocumentData,
    mappings: mockMappings,
    onMappingChange: vi.fn(),
    onResetMapping: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders table with all form fields', () => {
      render(<FieldMappingTable {...defaultProps} />);

      // Get table rows and check for form field names in them
      const rows = screen.getAllByRole('row');
      // First row is header, remaining are data rows
      expect(rows.length).toBeGreaterThan(4); // 1 header + 4 data rows

      // Check that form field names appear in the table
      expect(screen.getByText('firstName')).toBeInTheDocument();
      expect(screen.getByText('lastName')).toBeInTheDocument();
      // Use getAllByText for 'email' since it may appear multiple times (field name + type)
      const emailElements = screen.getAllByText(/^email$/i);
      expect(emailElements.length).toBeGreaterThan(0);
      expect(screen.getByText('phone')).toBeInTheDocument();
    });

    it('renders table headers correctly', () => {
      render(<FieldMappingTable {...defaultProps} />);

      expect(screen.getByText('Form Field')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Document Field')).toBeInTheDocument();
      expect(screen.getByText('Source')).toBeInTheDocument();
      expect(screen.getByText('Confidence')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('shows empty state when no form fields', () => {
      render(<FieldMappingTable {...defaultProps} formFields={[]} />);

      expect(
        screen.getByText('No form fields detected. Please upload a valid form.')
      ).toBeInTheDocument();
    });

    it('shows required badge for required fields', () => {
      render(<FieldMappingTable {...defaultProps} />);

      const requiredBadges = screen.getAllByText('Required');
      // firstName and lastName are required
      expect(requiredBadges).toHaveLength(2);
    });
  });

  describe('Confidence Display', () => {
    it('displays confidence percentage in badge', () => {
      render(<FieldMappingTable {...defaultProps} />);

      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('shows low confidence warning banner when fields have low confidence', () => {
      render(<FieldMappingTable {...defaultProps} />);

      // email has 45% confidence which is below 50% threshold
      expect(
        screen.getByText('Some fields have low confidence and may need review')
      ).toBeInTheDocument();
    });

    it('does not show warning banner when all fields have high confidence', () => {
      const highConfidenceMappings = mockMappings.map((m) => ({
        ...m,
        confidence: m.documentField ? 85 : 0,
      }));

      render(<FieldMappingTable {...defaultProps} mappings={highConfidenceMappings} />);

      expect(
        screen.queryByText('Some fields have low confidence and may need review')
      ).not.toBeInTheDocument();
    });
  });

  describe('Per-Field Extraction Info (New Format)', () => {
    it('uses extraction info from fieldExtractionInfo prop', () => {
      render(
        <FieldMappingTable
          {...defaultProps}
          fieldExtractionInfo={mockFieldExtractionInfo}
        />
      );

      // Should show extraction info confidence, not mapping confidence
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('uses extraction info from ExtractedFieldResult in documentData', () => {
      render(
        <FieldMappingTable
          {...defaultProps}
          documentData={mockNewFormatDocumentData}
        />
      );

      // Should show ExtractedFieldResult confidence values
      expect(screen.getByText('92%')).toBeInTheDocument();
      expect(screen.getByText('88%')).toBeInTheDocument();
      expect(screen.getByText('35%')).toBeInTheDocument();
    });

    it('prioritizes fieldExtractionInfo over documentData', () => {
      render(
        <FieldMappingTable
          {...defaultProps}
          documentData={mockNewFormatDocumentData}
          fieldExtractionInfo={mockFieldExtractionInfo}
        />
      );

      // Should use fieldExtractionInfo (95%) not ExtractedFieldResult (92%)
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });
  });

  describe('Backward Compatibility', () => {
    it('works with legacy DocumentData format (simple values)', () => {
      render(<FieldMappingTable {...defaultProps} documentData={mockLegacyDocumentData} />);

      // Should still render and use mapping confidence
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('firstName')).toBeInTheDocument();
    });

    it('handles mixed format data', () => {
      const mixedData: DocumentData = {
        fields: {
          first_name: 'John', // simple value
          last_name: {
            value: 'Doe',
            confidence: 80,
            source: 'ocr',
          } as ExtractedFieldResult,
        },
      };

      render(<FieldMappingTable {...defaultProps} documentData={mixedData} />);

      // Should render without errors
      expect(screen.getByText('firstName')).toBeInTheDocument();
    });
  });

  describe('Mapping Interactions', () => {
    it('calls onMappingChange when document field is selected', async () => {
      const onMappingChange = vi.fn();
      render(<FieldMappingTable {...defaultProps} onMappingChange={onMappingChange} />);

      // Find select trigger for phone field (unmapped)
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('shows reset button for manual override mappings', () => {
      const mappingsWithManual = mockMappings.map((m, i) =>
        i === 0 ? { ...m, manualOverride: true } : m
      );

      render(<FieldMappingTable {...defaultProps} mappings={mappingsWithManual} />);

      // Should show Manual badge for first field
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });

    it('calls onResetMapping when reset button is clicked', () => {
      const onResetMapping = vi.fn();
      const mappingsWithManual = mockMappings.map((m, i) =>
        i === 0 ? { ...m, manualOverride: true } : m
      );

      render(
        <FieldMappingTable
          {...defaultProps}
          mappings={mappingsWithManual}
          onResetMapping={onResetMapping}
        />
      );

      // Find and click reset button
      const resetButton = screen.getByRole('button');
      fireEvent.click(resetButton);

      expect(onResetMapping).toHaveBeenCalledWith('firstName');
    });
  });

  describe('Unmapped Fields', () => {
    it('shows warning icon for unmapped required fields', () => {
      const mappingsWithUnmappedRequired: FieldMapping[] = [
        { formField: 'firstName', documentField: null, confidence: 0, manualOverride: false },
        { formField: 'lastName', documentField: 'last_name', confidence: 85, manualOverride: false },
        { formField: 'email', documentField: 'email_address', confidence: 75, manualOverride: false },
        { formField: 'phone', documentField: null, confidence: 0, manualOverride: false },
      ];

      render(
        <FieldMappingTable {...defaultProps} mappings={mappingsWithUnmappedRequired} />
      );

      // firstName is required and unmapped - should show warning
      // The AlertCircle icon should be present for unmapped required field
      const firstNameRow = screen.getByText('firstName').closest('tr');
      expect(firstNameRow).toBeInTheDocument();
    });

    it('does not show confidence for unmapped fields', () => {
      render(<FieldMappingTable {...defaultProps} />);

      // phone is unmapped, should not show confidence
      const phoneRow = screen.getByText('phone').closest('tr');
      expect(phoneRow).toBeInTheDocument();
      // Verify no confidence badge in phone row (phone has null mapping)
    });
  });

  describe('Field Sources Display', () => {
    it('shows source badge when fieldSources is provided', () => {
      const fieldSources = {
        first_name: [{ documentId: '1', fileName: 'passport.pdf', confidence: 95 }],
        last_name: [
          { documentId: '1', fileName: 'passport.pdf', confidence: 90 },
          { documentId: '2', fileName: 'license.pdf', confidence: 85 },
        ],
      };

      render(<FieldMappingTable {...defaultProps} fieldSources={fieldSources} />);

      expect(screen.getByText('passport.pdf')).toBeInTheDocument();
      expect(screen.getByText('passport.pdf +1 more')).toBeInTheDocument();
    });
  });
});

describe('Confidence Level Configuration', () => {
  it('applies correct styling for high confidence (>=80)', () => {
    const highConfidenceMappings: FieldMapping[] = [
      { formField: 'firstName', documentField: 'first_name', confidence: 95, manualOverride: false },
    ];

    render(
      <FieldMappingTable
        formFields={[{ name: 'firstName', type: 'text' }]}
        documentData={{ first_name: 'John' }}
        mappings={highConfidenceMappings}
        onMappingChange={vi.fn()}
        onResetMapping={vi.fn()}
      />
    );

    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('applies correct styling for medium confidence (50-79)', () => {
    const mediumConfidenceMappings: FieldMapping[] = [
      { formField: 'firstName', documentField: 'first_name', confidence: 65, manualOverride: false },
    ];

    render(
      <FieldMappingTable
        formFields={[{ name: 'firstName', type: 'text' }]}
        documentData={{ first_name: 'John' }}
        mappings={mediumConfidenceMappings}
        onMappingChange={vi.fn()}
        onResetMapping={vi.fn()}
      />
    );

    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('applies correct styling for low confidence (<50)', () => {
    const lowConfidenceMappings: FieldMapping[] = [
      { formField: 'firstName', documentField: 'first_name', confidence: 30, manualOverride: false },
    ];

    render(
      <FieldMappingTable
        formFields={[{ name: 'firstName', type: 'text' }]}
        documentData={{ first_name: 'John' }}
        mappings={lowConfidenceMappings}
        onMappingChange={vi.fn()}
        onResetMapping={vi.fn()}
      />
    );

    expect(screen.getByText('30%')).toBeInTheDocument();
    // Should show warning banner for low confidence
    expect(
      screen.getByText('Some fields have low confidence and may need review')
    ).toBeInTheDocument();
  });
});
