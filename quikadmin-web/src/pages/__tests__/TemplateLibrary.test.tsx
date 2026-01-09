/**
 * TemplateLibrary Page Tests
 *
 * Tests for the TemplateLibrary page including:
 * - Template listing and filtering
 * - Duplicate functionality
 * - Preview modal integration
 * - Delete confirmation
 * - Error handling
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TemplateLibrary from '../TemplateLibrary';

// Mock framer-motion to avoid animation issues
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<object>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock form service
vi.mock('@/services/formService', () => ({
  getTemplates: vi.fn(),
  deleteTemplate: vi.fn(),
  duplicateTemplate: vi.fn(),
  useTemplate: vi.fn(),
  getTemplate: vi.fn(),
}));

import { toast } from 'sonner';
import {
  getTemplates,
  deleteTemplate,
  duplicateTemplate,
  useTemplate,
} from '@/services/formService';

// Create test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('TemplateLibrary Page', () => {
  const mockTemplates = [
    {
      id: 'template-1',
      name: 'W-2 Tax Form',
      description: 'Standard W-2 wage and tax statement template.',
      formType: 'W2',
      usageCount: 156,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-06-20T14:30:00Z',
      mappings: { field1: 'value1' },
      fieldMappings: [{ targetField: 'field1', sourceField: 'value1' }],
    },
    {
      id: 'template-2',
      name: 'I-9 Employment Form',
      description: 'Employment eligibility verification form.',
      formType: 'I9',
      usageCount: 89,
      createdAt: '2024-02-10T09:00:00Z',
      updatedAt: '2024-05-15T11:20:00Z',
      mappings: { field2: 'value2' },
      fieldMappings: [{ targetField: 'field2', sourceField: 'value2' }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (getTemplates as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplates);
    (deleteTemplate as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (duplicateTemplate as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockTemplates[0],
      id: 'template-3',
      name: 'W-2 Tax Form (Copy)',
    });
    (useTemplate as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('renders template library page', async () => {
    renderWithProviders(<TemplateLibrary />);

    await waitFor(() => {
      expect(screen.getByTestId('template-library')).toBeInTheDocument();
    });

    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByTestId('template-search')).toBeInTheDocument();
  });

  it('displays templates after loading', async () => {
    renderWithProviders(<TemplateLibrary />);

    await waitFor(() => {
      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
    });

    expect(screen.getByText('I-9 Employment Form')).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    (getTemplates as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockTemplates), 100))
    );

    renderWithProviders(<TemplateLibrary />);

    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('filters templates by search query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TemplateLibrary />);

    await waitFor(() => {
      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('template-search');
    await user.type(searchInput, 'W-2');

    expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
    expect(screen.queryByText('I-9 Employment Form')).not.toBeInTheDocument();
  });

  it('shows empty state when no templates match filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TemplateLibrary />);

    await waitFor(() => {
      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('template-search');
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText('No templates match your filters')).toBeInTheDocument();
  });

  describe('Duplicate Functionality', () => {
    it('duplicates template when duplicate action is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TemplateLibrary />);

      await waitFor(() => {
        expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      });

      // Open the dropdown menu for the first template
      const actionsButton = screen.getByTestId('template-actions-template-1');
      await user.click(actionsButton);

      // Click duplicate
      const duplicateOption = screen.getByRole('menuitem', { name: /duplicate/i });
      await user.click(duplicateOption);

      await waitFor(() => {
        expect(duplicateTemplate).toHaveBeenCalledWith('template-1');
      });

      expect(toast.success).toHaveBeenCalledWith('Template duplicated');
      expect(mockNavigate).toHaveBeenCalledWith('/templates/edit/template-3');
    });

    it('shows error toast when duplication fails', async () => {
      const user = userEvent.setup();
      (duplicateTemplate as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Duplication failed')
      );

      renderWithProviders(<TemplateLibrary />);

      await waitFor(() => {
        expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      });

      const actionsButton = screen.getByTestId('template-actions-template-1');
      await user.click(actionsButton);

      const duplicateOption = screen.getByRole('menuitem', { name: /duplicate/i });
      await user.click(duplicateOption);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to duplicate template');
      });
    });
  });

  describe('Preview Functionality', () => {
    it('opens preview modal when preview action is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TemplateLibrary />);

      await waitFor(() => {
        expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      });

      const actionsButton = screen.getByTestId('template-actions-template-1');
      await user.click(actionsButton);

      const previewOption = screen.getByRole('menuitem', { name: /preview/i });
      await user.click(previewOption);

      await waitFor(() => {
        expect(screen.getByTestId('template-preview-modal')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Functionality', () => {
    it('shows delete confirmation dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TemplateLibrary />);

      await waitFor(() => {
        expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      });

      const actionsButton = screen.getByTestId('template-actions-template-1');
      await user.click(actionsButton);

      const deleteOption = screen.getByRole('menuitem', { name: /delete/i });
      await user.click(deleteOption);

      await waitFor(() => {
        expect(screen.getByText('Delete Template')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Are you sure you want to delete "W-2 Tax Form"/)
      ).toBeInTheDocument();
    });

    it('deletes template when confirmed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TemplateLibrary />);

      await waitFor(() => {
        expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      });

      const actionsButton = screen.getByTestId('template-actions-template-1');
      await user.click(actionsButton);

      const deleteOption = screen.getByRole('menuitem', { name: /delete/i });
      await user.click(deleteOption);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /^delete$/i }));

      await waitFor(() => {
        expect(deleteTemplate).toHaveBeenCalledWith('template-1');
      });

      expect(toast.success).toHaveBeenCalledWith('Template deleted successfully');
    });

    it('cancels delete when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TemplateLibrary />);

      await waitFor(() => {
        expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      });

      const actionsButton = screen.getByTestId('template-actions-template-1');
      await user.click(actionsButton);

      const deleteOption = screen.getByRole('menuitem', { name: /delete/i });
      await user.click(deleteOption);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(deleteTemplate).not.toHaveBeenCalled();
    });
  });

  describe('View Mode Toggle', () => {
    it('toggles between grid and list view', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TemplateLibrary />);

      await waitFor(() => {
        expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      });

      // Should start in grid view
      expect(screen.getByTestId('template-grid')).toBeInTheDocument();

      // Switch to list view
      await user.click(screen.getByTestId('view-mode-list'));

      expect(screen.getByTestId('template-list')).toBeInTheDocument();

      // Switch back to grid view
      await user.click(screen.getByTestId('view-mode-grid'));

      expect(screen.getByTestId('template-grid')).toBeInTheDocument();
    });
  });

  describe('Template Click Navigation', () => {
    it('navigates to fill-form when template is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TemplateLibrary />);

      await waitFor(() => {
        expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      });

      // Click on the template card
      const templateCard = screen.getByTestId('template-card-template-1');
      await user.click(templateCard);

      expect(useTemplate).toHaveBeenCalledWith('template-1');
      expect(mockNavigate).toHaveBeenCalledWith('/fill-form', {
        state: { templateId: 'template-1' },
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error state when templates fail to load', async () => {
      (getTemplates as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to fetch')
      );

      renderWithProviders(<TemplateLibrary />);

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      expect(screen.getByText('Failed to load templates')).toBeInTheDocument();
    });
  });
});
