/**
 * TemplateCard Component Tests
 *
 * Tests for the TemplateCard component in both grid and list view modes.
 * Task 486: Component tests for TemplateCard
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateCard, TemplateCardSkeleton, type Template } from '../TemplateCard';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<object>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('TemplateCard Component', () => {
  const mockTemplate: Template = {
    id: 'template-1',
    name: 'W-2 Tax Form',
    description: 'Standard W-2 wage and tax statement template.',
    category: 'financial',
    usageCount: 156,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-06-20T14:30:00Z',
    fieldCount: 12,
  };

  const mockHandlers = {
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onPreview: vi.fn(),
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Grid View Mode', () => {
    it('renders template name and description', () => {
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      expect(screen.getByText(/Standard W-2 wage/)).toBeInTheDocument();
    });

    it('renders category badge', () => {
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      expect(screen.getByText('Financial')).toBeInTheDocument();
    });

    it('renders usage count', () => {
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      expect(screen.getByText('156 uses')).toBeInTheDocument();
    });

    it('renders field count badge when provided', () => {
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      expect(screen.getByText('12 fields')).toBeInTheDocument();
    });

    it('renders formatted date', () => {
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      expect(screen.getByText('Jun 20, 2024')).toBeInTheDocument();
    });

    it('calls onClick when card is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
          onClick={mockHandlers.onClick}
        />
      );

      const card = screen.getByTestId(`template-card-${mockTemplate.id}`);
      await user.click(card);

      expect(mockHandlers.onClick).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onClick).toHaveBeenCalledWith(mockTemplate.id);
    });

    it('opens dropdown menu on actions button click', async () => {
      const user = userEvent.setup();
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      const actionsButton = screen.getByTestId(`template-actions-${mockTemplate.id}`);
      await user.click(actionsButton);

      expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /duplicate/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    });

    it('calls onEdit when edit menu item is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      const actionsButton = screen.getByTestId(`template-actions-${mockTemplate.id}`);
      await user.click(actionsButton);

      const editOption = screen.getByRole('menuitem', { name: /edit/i });
      await user.click(editOption);

      expect(mockHandlers.onEdit).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockTemplate.id);
    });

    it('calls onDuplicate when duplicate menu item is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      const actionsButton = screen.getByTestId(`template-actions-${mockTemplate.id}`);
      await user.click(actionsButton);

      const duplicateOption = screen.getByRole('menuitem', { name: /duplicate/i });
      await user.click(duplicateOption);

      expect(mockHandlers.onDuplicate).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onDuplicate).toHaveBeenCalledWith(mockTemplate.id);
    });

    it('calls onDelete when delete menu item is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      const actionsButton = screen.getByTestId(`template-actions-${mockTemplate.id}`);
      await user.click(actionsButton);

      const deleteOption = screen.getByRole('menuitem', { name: /delete/i });
      await user.click(deleteOption);

      expect(mockHandlers.onDelete).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onDelete).toHaveBeenCalledWith(mockTemplate.id);
    });

    it('shows preview option when onPreview is provided', async () => {
      const user = userEvent.setup();
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
          onPreview={mockHandlers.onPreview}
        />
      );

      const actionsButton = screen.getByTestId(`template-actions-${mockTemplate.id}`);
      await user.click(actionsButton);

      expect(screen.getByRole('menuitem', { name: /preview/i })).toBeInTheDocument();
    });

    it('does not trigger card click when clicking dropdown', async () => {
      const user = userEvent.setup();
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
          onClick={mockHandlers.onClick}
        />
      );

      const actionsButton = screen.getByTestId(`template-actions-${mockTemplate.id}`);
      await user.click(actionsButton);

      // Clicking the actions button should not trigger the card click
      expect(mockHandlers.onClick).not.toHaveBeenCalled();
    });
  });

  describe('List View Mode', () => {
    it('renders template in list layout', () => {
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="list"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      expect(screen.getByTestId(`template-list-item-${mockTemplate.id}`)).toBeInTheDocument();
    });

    it('renders template name and description in list mode', () => {
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="list"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      expect(screen.getByText(/Standard W-2 wage/)).toBeInTheDocument();
    });

    it('calls onClick when list item is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="list"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
          onClick={mockHandlers.onClick}
        />
      );

      const listItem = screen.getByTestId(`template-list-item-${mockTemplate.id}`);
      await user.click(listItem);

      expect(mockHandlers.onClick).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onClick).toHaveBeenCalledWith(mockTemplate.id);
    });

    it('renders actions menu in list mode', async () => {
      const user = userEvent.setup();
      render(
        <TemplateCard
          template={mockTemplate}
          viewMode="list"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      const actionsButton = screen.getByTestId(`template-actions-${mockTemplate.id}`);
      await user.click(actionsButton);

      expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
    });
  });

  describe('Category Variants', () => {
    const categories: Template['category'][] = ['legal', 'financial', 'hr', 'medical', 'custom'];

    categories.forEach((category) => {
      it(`renders ${category} category badge correctly`, () => {
        render(
          <TemplateCard
            template={{ ...mockTemplate, category }}
            viewMode="grid"
            onEdit={mockHandlers.onEdit}
            onDuplicate={mockHandlers.onDuplicate}
            onDelete={mockHandlers.onDelete}
          />
        );

        const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
        expect(screen.getByText(capitalizedCategory)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('renders without fieldCount', () => {
      const templateWithoutFieldCount = { ...mockTemplate };
      delete templateWithoutFieldCount.fieldCount;

      render(
        <TemplateCard
          template={templateWithoutFieldCount}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      expect(screen.queryByText(/fields/i)).not.toBeInTheDocument();
    });

    it('handles empty description', () => {
      const templateWithEmptyDescription = {
        ...mockTemplate,
        description: '',
      };

      render(
        <TemplateCard
          template={templateWithEmptyDescription}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      // Should still render without crashing
      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
    });

    it('handles zero usage count', () => {
      const templateWithZeroUsage = {
        ...mockTemplate,
        usageCount: 0,
      };

      render(
        <TemplateCard
          template={templateWithZeroUsage}
          viewMode="grid"
          onEdit={mockHandlers.onEdit}
          onDuplicate={mockHandlers.onDuplicate}
          onDelete={mockHandlers.onDelete}
        />
      );

      expect(screen.getByText('0 uses')).toBeInTheDocument();
    });
  });
});

describe('TemplateCardSkeleton Component', () => {
  it('renders grid skeleton', () => {
    render(<TemplateCardSkeleton viewMode="grid" />);
    expect(screen.getByTestId('template-card-skeleton')).toBeInTheDocument();
  });

  it('renders list skeleton', () => {
    render(<TemplateCardSkeleton viewMode="list" />);
    expect(screen.getByTestId('template-list-skeleton')).toBeInTheDocument();
  });

  it('applies custom className to grid skeleton', () => {
    render(<TemplateCardSkeleton viewMode="grid" className="custom-class" />);
    const skeleton = screen.getByTestId('template-card-skeleton');
    expect(skeleton).toHaveClass('custom-class');
  });

  it('applies custom className to list skeleton', () => {
    render(<TemplateCardSkeleton viewMode="list" className="custom-class" />);
    const skeleton = screen.getByTestId('template-list-skeleton');
    expect(skeleton).toHaveClass('custom-class');
  });
});
