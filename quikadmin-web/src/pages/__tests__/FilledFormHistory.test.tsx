/**
 * FilledFormHistory Page Tests
 *
 * Tests for the filled forms history page including:
 * - Loading states
 * - Empty states
 * - Search and filter functionality
 * - Table display
 * - Actions (view, download, delete)
 * - Pagination
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import FilledFormHistory from '@/pages/FilledFormHistory';
import type { FilledForm } from '@/services/filledFormsService';
import { useFilledFormsStore } from '@/stores/filledFormsStore';

// Mock the filledFormsService
const mockGetFilledForms = vi.fn();
const mockGetFilledForm = vi.fn();
const mockDownloadFilledForm = vi.fn();
const mockDeleteFilledForm = vi.fn();

vi.mock('@/services/filledFormsService', () => ({
  filledFormsService: {
    getFilledForms: (...args: unknown[]) => mockGetFilledForms(...args),
    getFilledForm: (...args: unknown[]) => mockGetFilledForm(...args),
    downloadFilledForm: (...args: unknown[]) => mockDownloadFilledForm(...args),
    deleteFilledForm: (...args: unknown[]) => mockDeleteFilledForm(...args),
  },
  default: {
    getFilledForms: (...args: unknown[]) => mockGetFilledForms(...args),
    getFilledForm: (...args: unknown[]) => mockGetFilledForm(...args),
    downloadFilledForm: (...args: unknown[]) => mockDownloadFilledForm(...args),
    deleteFilledForm: (...args: unknown[]) => mockDeleteFilledForm(...args),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock filled form data
const mockFilledForms: FilledForm[] = [
  {
    id: 'form-1',
    clientId: 'client-1',
    clientName: 'John Doe',
    templateId: 'template-1',
    templateName: 'W-2 Tax Form',
    templateCategory: 'financial',
    fileUrl: '/outputs/filled-forms/john-doe_w2.pdf',
    downloadUrl: '/api/filled-forms/form-1/download',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'form-2',
    clientId: 'client-2',
    clientName: 'Jane Smith',
    templateId: 'template-2',
    templateName: 'I-9 Employment',
    templateCategory: 'hr',
    fileUrl: '/outputs/filled-forms/jane-smith_i9.pdf',
    downloadUrl: '/api/filled-forms/form-2/download',
    createdAt: '2024-01-14T09:00:00Z',
  },
  {
    id: 'form-3',
    clientId: 'client-1',
    clientName: 'John Doe',
    templateId: 'template-3',
    templateName: 'Power of Attorney',
    templateCategory: 'legal',
    fileUrl: '/outputs/filled-forms/john-doe_poa.pdf',
    downloadUrl: '/api/filled-forms/form-3/download',
    createdAt: '2024-01-13T14:00:00Z',
  },
];

const mockPagination = {
  total: 3,
  limit: 20,
  offset: 0,
  hasMore: false,
};

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('FilledFormHistory Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state between tests
    useFilledFormsStore.getState().reset();
    // Default successful response
    mockGetFilledForms.mockResolvedValue({
      success: true,
      data: {
        filledForms: mockFilledForms,
        pagination: mockPagination,
      },
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    // Reset store state after tests
    useFilledFormsStore.getState().reset();
  });

  describe('Loading State', () => {
    it('shows loading state while fetching data', () => {
      // Delay the response to see loading state
      mockGetFilledForms.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText(/loading filled forms/i)).toBeInTheDocument();
    });

    it('removes loading state after data is fetched', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no forms exist', async () => {
      mockGetFilledForms.mockResolvedValue({
        success: true,
        data: {
          filledForms: [],
          pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
        },
      });

      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      expect(screen.getByText(/no filled forms yet/i)).toBeInTheDocument();
      expect(screen.getByText(/process a document to get started/i)).toBeInTheDocument();
    });

    it('shows filtered empty state when filters return no results', async () => {
      mockGetFilledForms.mockResolvedValue({
        success: true,
        data: {
          filledForms: [],
          pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
        },
      });

      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('form-search')).toBeInTheDocument();
      });

      // Add a search query to activate filter
      const searchInput = screen.getByTestId('form-search');
      await userEvent.type(searchInput, 'nonexistent');
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/no forms match your filters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Table Display', () => {
    it('renders forms table with correct data', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('forms-table')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Check table headers
      expect(screen.getByText('Form Name')).toBeInTheDocument();
      expect(screen.getByText('Client')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();

      // Check form data
      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      // John Doe appears twice (in two forms), so use getAllByText
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
      expect(screen.getByText('I-9 Employment')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('shows template category badge', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('forms-table')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(screen.getByText('financial')).toBeInTheDocument();
      expect(screen.getByText('hr')).toBeInTheDocument();
      expect(screen.getByText('legal')).toBeInTheDocument();
    });

    it('displays formatted dates', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('forms-table')).toBeInTheDocument();
      }, { timeout: 3000 });

      // The dates should be formatted (Jan 15, 2024 format)
      expect(screen.getByText(/Jan 15, 2024/i)).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('renders search input', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('form-search')).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText(/search forms/i)).toBeInTheDocument();
    });

    it('filters forms by search query', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('forms-table')).toBeInTheDocument();
      }, { timeout: 3000 });

      const searchInput = screen.getByTestId('form-search');
      await userEvent.type(searchInput, 'W-2');
      await userEvent.keyboard('{Enter}');

      // Client-side filtering should hide non-matching forms
      await waitFor(() => {
        expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Functionality', () => {
    it('renders status filter dropdown', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('status-filter')).toBeInTheDocument();
      });
    });

    it('renders sort dropdown', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sort-by')).toBeInTheDocument();
      });
    });

    it('clears filters when clear button is clicked', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('form-search')).toBeInTheDocument();
      });

      // Type something to enable clear button
      const searchInput = screen.getByTestId('form-search');
      await userEvent.type(searchInput, 'test');
      await userEvent.keyboard('{Enter}');

      // Clear button should appear
      await waitFor(() => {
        expect(screen.getByTestId('clear-filters')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('clear-filters'));

      // Search should be cleared
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Actions', () => {
    it('shows action buttons on row hover', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('forms-table')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Action buttons exist but may be hidden until hover
      expect(screen.getByTestId('view-form-form-1')).toBeInTheDocument();
      expect(screen.getByTestId('download-form-form-1')).toBeInTheDocument();
      expect(screen.getByTestId('delete-form-form-1')).toBeInTheDocument();
    });

    it('handles view action', async () => {
      const { toast } = await import('sonner');

      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('view-form-form-1')).toBeInTheDocument();
      }, { timeout: 3000 });

      await userEvent.click(screen.getByTestId('view-form-form-1'));

      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining('W-2 Tax Form')
      );
    });

    it('handles download action', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      mockDownloadFilledForm.mockResolvedValue(mockBlob);

      // Mock URL.createObjectURL and revokeObjectURL
      const createObjectURL = vi.fn(() => 'blob:test');
      const revokeObjectURL = vi.fn();
      global.URL.createObjectURL = createObjectURL;
      global.URL.revokeObjectURL = revokeObjectURL;

      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('download-form-form-1')).toBeInTheDocument();
      }, { timeout: 3000 });

      await userEvent.click(screen.getByTestId('download-form-form-1'));

      await waitFor(() => {
        expect(mockDownloadFilledForm).toHaveBeenCalledWith('form-1');
      });
    });

    it('shows delete confirmation dialog', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('delete-form-form-1')).toBeInTheDocument();
      }, { timeout: 3000 });

      await userEvent.click(screen.getByTestId('delete-form-form-1'));

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText(/delete filled form/i)).toBeInTheDocument();
        expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
      });
    });

    it('cancels delete when cancel button is clicked', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('delete-form-form-1')).toBeInTheDocument();
      }, { timeout: 3000 });

      await userEvent.click(screen.getByTestId('delete-form-form-1'));

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByText(/are you sure you want to delete/i)).not.toBeInTheDocument();
      });

      // Delete should not have been called
      expect(mockDeleteFilledForm).not.toHaveBeenCalled();
    });

    it('deletes form when confirmed', async () => {
      mockDeleteFilledForm.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('delete-form-form-1')).toBeInTheDocument();
      }, { timeout: 3000 });

      await userEvent.click(screen.getByTestId('delete-form-form-1'));

      // Click delete in dialog
      const deleteButton = screen.getByRole('button', { name: /^delete$/i });
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteFilledForm).toHaveBeenCalledWith('form-1');
      });
    });
  });

  describe('Pagination', () => {
    it('shows pagination when there are multiple pages', async () => {
      mockGetFilledForms.mockResolvedValue({
        success: true,
        data: {
          filledForms: mockFilledForms,
          pagination: { total: 50, limit: 20, offset: 0, hasMore: true },
        },
      });

      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      // Wait for table to render first, then pagination
      await waitFor(() => {
        expect(screen.getByTestId('forms-table')).toBeInTheDocument();
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(screen.getByTestId('prev-page')).toBeInTheDocument();
        expect(screen.getByTestId('next-page')).toBeInTheDocument();
      });

      expect(screen.getByText(/page 1 of/i)).toBeInTheDocument();
    });

    it('disables previous button on first page', async () => {
      mockGetFilledForms.mockResolvedValue({
        success: true,
        data: {
          filledForms: mockFilledForms,
          pagination: { total: 50, limit: 20, offset: 0, hasMore: true },
        },
      });

      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      // Wait for table to render first
      await waitFor(() => {
        expect(screen.getByTestId('forms-table')).toBeInTheDocument();
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(screen.getByTestId('prev-page')).toBeDisabled();
      });
    });

    it('does not show pagination when total items fit on one page', async () => {
      mockGetFilledForms.mockResolvedValue({
        success: true,
        data: {
          filledForms: mockFilledForms,
          pagination: { total: 3, limit: 20, offset: 0, hasMore: false },
        },
      });

      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      // Wait for table to render
      await waitFor(() => {
        expect(screen.getByTestId('forms-table')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Pagination should not be visible for 3 items (less than pageSize of 20)
      expect(screen.queryByTestId('prev-page')).not.toBeInTheDocument();
      expect(screen.queryByTestId('next-page')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error state when API fails', async () => {
      mockGetFilledForms.mockRejectedValue(
        new Error('Network error')
      );

      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to load forms/i)).toBeInTheDocument();
    });

    it('shows retry button on error', async () => {
      mockGetFilledForms.mockRejectedValue(
        new Error('Network error')
      );

      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Page Header', () => {
    it('renders page title', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      // Wait for the page to be rendered
      await waitFor(() => {
        expect(screen.getByTestId('filled-form-history')).toBeInTheDocument();
      });

      // Check for heading specifically
      expect(screen.getByRole('heading', { name: /filled forms history/i })).toBeInTheDocument();
    });

    it('renders page description', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/view and manage all your generated filled forms/i)).toBeInTheDocument();
      });
    });

    it('renders breadcrumbs', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      // Breadcrumb list should be present
      const breadcrumbNav = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(breadcrumbNav).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible page structure', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('filled-form-history')).toBeInTheDocument();
      });

      // Page title should be a heading
      expect(screen.getByRole('heading', { name: /filled forms history/i })).toBeInTheDocument();
    });

    it('has accessible table structure', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Table should have headers
      const table = screen.getByRole('table');
      const headers = within(table).getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(0);
    });

    it('has accessible action buttons', async () => {
      render(
        <TestWrapper>
          <FilledFormHistory />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('view-form-form-1')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Action buttons should have title attributes for accessibility
      expect(screen.getByTestId('view-form-form-1')).toHaveAttribute('title');
      expect(screen.getByTestId('download-form-form-1')).toHaveAttribute('title');
      expect(screen.getByTestId('delete-form-form-1')).toHaveAttribute('title');
    });
  });
});
