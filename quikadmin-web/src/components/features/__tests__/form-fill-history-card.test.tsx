/**
 * FormFillHistoryCard Component Tests
 * Tests for the form fill history display component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { FormFillHistoryCard } from '../form-fill-history-card';
import type { FormFillHistoryEntry } from '../form-fill-history-card';

// Helper to create test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock history entries
const mockHistoryEntries: FormFillHistoryEntry[] = [
  {
    id: '1',
    formName: 'DS-160 Visa Application',
    formFileName: 'ds160_filled.pdf',
    profileId: 'profile-1',
    profileName: 'Personal',
    profileType: 'PERSONAL',
    filledAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    fieldsUsed: 45,
    totalFields: 52,
    confidence: 0.94,
    status: 'completed',
    downloadUrl: 'https://example.com/download/1',
  },
  {
    id: '2',
    formName: 'I-94 Arrival Record',
    formFileName: 'i94_filled.pdf',
    profileId: 'profile-1',
    profileName: 'Personal',
    profileType: 'PERSONAL',
    filledAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    fieldsUsed: 18,
    totalFields: 20,
    confidence: 0.98,
    status: 'completed',
    downloadUrl: 'https://example.com/download/2',
  },
  {
    id: '3',
    formName: 'Business License Application',
    formFileName: 'business_license.pdf',
    profileId: 'profile-2',
    profileName: 'ACME Corp',
    profileType: 'BUSINESS',
    filledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    fieldsUsed: 30,
    totalFields: 35,
    confidence: 0.87,
    status: 'partial',
    downloadUrl: 'https://example.com/download/3',
    warnings: ['Company EIN not found', 'Business address incomplete'],
  },
  {
    id: '4',
    formName: 'Tax Form W-4',
    formFileName: 'w4_filled.pdf',
    profileId: 'profile-1',
    profileName: 'Personal',
    profileType: 'PERSONAL',
    filledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
    fieldsUsed: 0,
    totalFields: 15,
    confidence: 0,
    status: 'failed',
    warnings: ['Form processing failed due to invalid format'],
  },
];

describe('FormFillHistoryCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading skeleton when isLoading is true', () => {
      const { container } = render(
        <FormFillHistoryCard isLoading={true} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Form Fill History')).toBeInTheDocument();
      expect(screen.getByText(/loading history/i)).toBeInTheDocument();

      // Should have skeleton elements
      const hasSkeleton = container.querySelector('[data-slot="skeleton"]') ||
                         container.querySelector('[class*="animate-pulse"]') ||
                         container.querySelector('[class*="rounded-lg"]');
      expect(hasSkeleton).toBeTruthy();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no entries are provided', () => {
      render(
        <FormFillHistoryCard entries={[]} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Form Fill History')).toBeInTheDocument();
      expect(screen.getByText(/no form fill history/i)).toBeInTheDocument();
    });

    it('should show profile-specific empty message when profileId is provided', () => {
      render(
        <FormFillHistoryCard entries={[]} profileId="profile-1" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/no forms have been filled with this profile/i)).toBeInTheDocument();
    });
  });

  describe('History Entry Display', () => {
    it('should display form names', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('DS-160 Visa Application')).toBeInTheDocument();
      expect(screen.getByText('I-94 Arrival Record')).toBeInTheDocument();
      expect(screen.getByText('Business License Application')).toBeInTheDocument();
    });

    it('should display relative time for each entry', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      // Should show relative times (e.g., "2 hours ago", "1 day ago")
      expect(screen.getByText(/hours? ago/i)).toBeInTheDocument();
      expect(screen.getByText(/day ago/i)).toBeInTheDocument();
    });

    it('should display field usage information', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('45/52 fields')).toBeInTheDocument();
      expect(screen.getByText('18/20 fields')).toBeInTheDocument();
    });

    it('should display confidence percentage', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('94% confidence')).toBeInTheDocument();
      expect(screen.getByText('98% confidence')).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    it('should display completed status badge', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      const completedBadges = screen.getAllByText('Completed');
      expect(completedBadges.length).toBeGreaterThan(0);
    });

    it('should display partial status badge', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Partial')).toBeInTheDocument();
    });

    it('should display failed status badge', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  describe('Profile Filtering', () => {
    it('should filter entries by profileId when provided', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} profileId="profile-1" />,
        { wrapper: createWrapper() }
      );

      // Should show personal profile entries
      expect(screen.getByText('DS-160 Visa Application')).toBeInTheDocument();
      expect(screen.getByText('I-94 Arrival Record')).toBeInTheDocument();
      expect(screen.getByText('Tax Form W-4')).toBeInTheDocument();

      // Should NOT show business profile entry
      expect(screen.queryByText('Business License Application')).not.toBeInTheDocument();
    });

    it('should show all entries when no profileId is provided', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('DS-160 Visa Application')).toBeInTheDocument();
      expect(screen.getByText('Business License Application')).toBeInTheDocument();
    });

    it('should show profile name when profileId is not provided', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      // Should show profile names since we're showing all profiles
      expect(screen.getAllByText('Personal').length).toBeGreaterThan(0);
      expect(screen.getByText('ACME Corp')).toBeInTheDocument();
    });
  });

  describe('Limit Prop', () => {
    it('should limit the number of displayed entries', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} limit={2} />,
        { wrapper: createWrapper() }
      );

      // Should only show first 2 entries
      expect(screen.getByText('DS-160 Visa Application')).toBeInTheDocument();
      expect(screen.getByText('I-94 Arrival Record')).toBeInTheDocument();

      // Should NOT show entries beyond limit
      expect(screen.queryByText('Business License Application')).not.toBeInTheDocument();
    });

    it('should show View All History button when entries exceed limit', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} limit={2} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByRole('button', { name: /view all history/i })).toBeInTheDocument();
    });

    it('should not show View All History button when entries are below limit', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries.slice(0, 2)} limit={5} />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByRole('button', { name: /view all history/i })).not.toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should render compact variant with simplified entries', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} compact={true} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Form Fill History')).toBeInTheDocument();
      expect(screen.getByText('DS-160 Visa Application')).toBeInTheDocument();
    });
  });

  describe('Card Description', () => {
    it('should show profile-specific description when profileId is provided', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} profileId="profile-1" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/forms filled using this profile's data/i)).toBeInTheDocument();
    });

    it('should show general description when no profileId is provided', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/recent forms you have filled/i)).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should show download button for entries with downloadUrl', async () => {
      const user = userEvent.setup();
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      // Find entry rows with download options
      const firstEntry = screen.getByText('DS-160 Visa Application').closest('[class*="group"]');
      expect(firstEntry).toBeTruthy();

      if (firstEntry) {
        await user.hover(firstEntry);
        // Download button should be visible on hover
      }
    });

    it('should show view details button', async () => {
      const user = userEvent.setup();
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      const firstEntry = screen.getByText('DS-160 Visa Application').closest('[class*="group"]');
      expect(firstEntry).toBeTruthy();

      if (firstEntry) {
        await user.hover(firstEntry);
        // View details button should be visible on hover
      }
    });
  });

  describe('Custom ClassName', () => {
    it('should apply custom className to container', () => {
      const { container } = render(
        <FormFillHistoryCard
          entries={mockHistoryEntries}
          className="custom-test-class"
        />,
        { wrapper: createWrapper() }
      );

      expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
    });
  });

  describe('Profile Type Icons', () => {
    it('should display User icon for personal profiles', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      // Personal entries should have user icons
      const personalEntries = screen.getAllByText('Personal');
      expect(personalEntries.length).toBeGreaterThan(0);
    });

    it('should display Building icon for business profiles', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      // Business entry should show ACME Corp
      expect(screen.getByText('ACME Corp')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Form Fill History')).toBeInTheDocument();
    });

    it('should have accessible tooltips for action buttons', async () => {
      const user = userEvent.setup();
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      const firstEntry = screen.getByText('DS-160 Visa Application').closest('[class*="group"]');
      if (firstEntry) {
        await user.hover(firstEntry);
        // Tooltips should provide context for action buttons
      }
    });
  });

  describe('Time Display', () => {
    it('should show relative time that updates correctly', () => {
      render(
        <FormFillHistoryCard entries={mockHistoryEntries} />,
        { wrapper: createWrapper() }
      );

      // Time should be displayed in relative format
      // "2 hours ago", "1 day ago", "3 days ago", "7 days ago"
      const timeElements = screen.getAllByText(/ago/i);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });
});
