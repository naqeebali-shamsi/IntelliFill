/**
 * TemplatePreviewModal Component Tests
 *
 * Tests for the TemplatePreviewModal component including:
 * - Modal display and content rendering
 * - Field mappings table
 * - Sample output preview
 * - Edit and Use Template actions
 * - Loading and error states
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TemplatePreviewModal } from '../TemplatePreviewModal';

// Mock the formService
vi.mock('@/services/formService', () => ({
  getTemplate: vi.fn(),
}));

import { getTemplate } from '@/services/formService';

// Create a test wrapper with QueryClientProvider
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProvider = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe('TemplatePreviewModal', () => {
  const mockTemplate = {
    id: 'template-1',
    name: 'W-2 Tax Form',
    description: 'Standard W-2 wage and tax statement template.',
    formType: 'W2',
    usageCount: 156,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-06-20T14:30:00Z',
    mappings: {
      employee_name: 'full_name',
      employer_ein: 'employer_ein',
      wages: 'wages',
    },
    fieldMappings: [
      { targetField: 'employee_name', sourceField: 'full_name' },
      { targetField: 'employer_ein', sourceField: 'employer_ein' },
      { targetField: 'wages', sourceField: 'wages' },
    ],
  };

  const mockHandlers = {
    onOpenChange: vi.fn(),
    onEdit: vi.fn(),
    onUseTemplate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getTemplate as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplate);
  });

  it('renders modal when open is true', async () => {
    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
      />
    );

    expect(screen.getByTestId('template-preview-modal')).toBeInTheDocument();
    expect(screen.getByText('Template Preview')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={false}
        onOpenChange={mockHandlers.onOpenChange}
      />
    );

    expect(screen.queryByTestId('template-preview-modal')).not.toBeInTheDocument();
  });

  it('shows loading state while fetching template', async () => {
    (getTemplate as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockTemplate), 100))
    );

    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
      />
    );

    expect(screen.getByText('Loading template details...')).toBeInTheDocument();
  });

  it('displays template information after loading', async () => {
    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
    });

    expect(screen.getByText('Standard W-2 wage and tax statement template.')).toBeInTheDocument();
    expect(screen.getByText('W2')).toBeInTheDocument();
    expect(screen.getByText('3 field mappings')).toBeInTheDocument();
    expect(screen.getByText('156 uses')).toBeInTheDocument();
  });

  it('displays field mappings table', async () => {
    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Field Mappings')).toBeInTheDocument();
    });

    // Check field mapping rows
    expect(screen.getByText('employee_name')).toBeInTheDocument();
    expect(screen.getByText('full_name')).toBeInTheDocument();
    expect(screen.getByText('employer_ein')).toBeInTheDocument();
    expect(screen.getByText('wages')).toBeInTheDocument();
  });

  it('displays sample output preview', async () => {
    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sample Output Preview')).toBeInTheDocument();
    });
  });

  it('calls onEdit when Edit button is clicked', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
        onEdit={mockHandlers.onEdit}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('preview-edit-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('preview-edit-button'));

    expect(mockHandlers.onEdit).toHaveBeenCalledWith('template-1');
    expect(mockHandlers.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onUseTemplate when Use Template button is clicked', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
        onUseTemplate={mockHandlers.onUseTemplate}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('preview-use-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('preview-use-button'));

    expect(mockHandlers.onUseTemplate).toHaveBeenCalledWith('template-1');
    expect(mockHandlers.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange when Close button is clicked', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(mockHandlers.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error state when template fetch fails', async () => {
    (getTemplate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to fetch'));

    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load template')).toBeInTheDocument();
    });
  });

  it('shows empty field mappings message when no mappings exist', async () => {
    (getTemplate as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockTemplate,
      fieldMappings: [],
      mappings: {},
    });

    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No field mappings defined yet')).toBeInTheDocument();
    });
  });

  it('does not show Edit button when onEdit is not provided', async () => {
    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
        onUseTemplate={mockHandlers.onUseTemplate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('preview-edit-button')).not.toBeInTheDocument();
  });

  it('does not show Use Template button when onUseTemplate is not provided', async () => {
    renderWithProvider(
      <TemplatePreviewModal
        templateId="template-1"
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
        onEdit={mockHandlers.onEdit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('preview-use-button')).not.toBeInTheDocument();
  });

  it('does not fetch when templateId is null', () => {
    renderWithProvider(
      <TemplatePreviewModal
        templateId={null}
        open={true}
        onOpenChange={mockHandlers.onOpenChange}
      />
    );

    expect(getTemplate).not.toHaveBeenCalled();
  });
});
