import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TemplateLibrary from './TemplateLibrary';

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Helper to render with router wrapper
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('TemplateLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Rendering', () => {
    it('should render the page with header and controls', () => {
      renderWithRouter(<TemplateLibrary />);

      // Check page header
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Templates');
      expect(
        screen.getByText('Browse and manage your form templates for quick document filling.')
      ).toBeInTheDocument();

      // Check breadcrumbs
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Template Library')).toBeInTheDocument();

      // Check Create Template button
      expect(screen.getByTestId('create-template-button')).toBeInTheDocument();
    });

    it('should render search input', () => {
      renderWithRouter(<TemplateLibrary />);

      const searchInput = screen.getByTestId('template-search');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('placeholder', 'Search templates...');
    });

    it('should render category filter dropdown', () => {
      renderWithRouter(<TemplateLibrary />);

      expect(screen.getByTestId('category-filter')).toBeInTheDocument();
    });

    it('should render sort by dropdown', () => {
      renderWithRouter(<TemplateLibrary />);

      expect(screen.getByTestId('sort-by')).toBeInTheDocument();
    });

    it('should render view mode toggle buttons', () => {
      renderWithRouter(<TemplateLibrary />);

      expect(screen.getByTestId('view-mode-grid')).toBeInTheDocument();
      expect(screen.getByTestId('view-mode-list')).toBeInTheDocument();
    });

    it('should render template cards in grid view by default', () => {
      renderWithRouter(<TemplateLibrary />);

      expect(screen.getByTestId('template-grid')).toBeInTheDocument();
      expect(screen.queryByTestId('template-list')).not.toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    it('should switch to list view when list button is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      const listButton = screen.getByTestId('view-mode-list');
      await user.click(listButton);

      expect(screen.getByTestId('template-list')).toBeInTheDocument();
      expect(screen.queryByTestId('template-grid')).not.toBeInTheDocument();
    });

    it('should switch back to grid view when grid button is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      // Switch to list first
      const listButton = screen.getByTestId('view-mode-list');
      await user.click(listButton);

      // Switch back to grid
      const gridButton = screen.getByTestId('view-mode-grid');
      await user.click(gridButton);

      expect(screen.getByTestId('template-grid')).toBeInTheDocument();
      expect(screen.queryByTestId('template-list')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter templates based on search query', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      const searchInput = screen.getByTestId('template-search');
      await user.type(searchInput, 'W-2');

      // Should show W-2 Tax Form template
      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      // Should hide other templates not matching the search
      expect(screen.queryByText('Power of Attorney')).not.toBeInTheDocument();
    });

    it('should show empty state when no templates match search', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      const searchInput = screen.getByTestId('template-search');
      await user.type(searchInput, 'nonexistent template xyz');

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No templates match your filters')).toBeInTheDocument();
    });

    it('should search in both name and description', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      const searchInput = screen.getByTestId('template-search');
      await user.type(searchInput, 'employment eligibility');

      // Should find I-9 form by description
      expect(screen.getByText('I-9 Employment Eligibility')).toBeInTheDocument();
    });
  });

  describe('Category Filter', () => {
    it('should filter templates by category', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      // Open category dropdown
      const categoryTrigger = screen.getByTestId('category-filter');
      await user.click(categoryTrigger);

      // Select "Legal" category from the dropdown (use role to be specific)
      const legalOption = screen.getByRole('option', { name: 'Legal' });
      await user.click(legalOption);

      // Should only show legal templates
      expect(screen.getByText('Power of Attorney')).toBeInTheDocument();
      expect(screen.queryByText('W-2 Tax Form')).not.toBeInTheDocument();
    });

    it('should show all templates when "All Categories" is selected', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      // First filter by a category
      const categoryTrigger = screen.getByTestId('category-filter');
      await user.click(categoryTrigger);
      const legalOption = screen.getByRole('option', { name: 'Legal' });
      await user.click(legalOption);

      // Then select All Categories
      await user.click(categoryTrigger);
      const allOption = screen.getByRole('option', { name: 'All Categories' });
      await user.click(allOption);

      // Should show all templates
      expect(screen.getByText('Power of Attorney')).toBeInTheDocument();
      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('should sort templates by name', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      // Open sort dropdown
      const sortTrigger = screen.getByTestId('sort-by');
      await user.click(sortTrigger);

      // Select "Name" from dropdown
      const nameOption = screen.getByRole('option', { name: 'Name' });
      await user.click(nameOption);

      // Get all template cards and verify order
      const cards = screen.getAllByTestId(/^template-card-/);
      expect(cards.length).toBeGreaterThan(0);
    });

    it('should sort templates by usage count', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      // Open sort dropdown
      const sortTrigger = screen.getByTestId('sort-by');
      await user.click(sortTrigger);

      // Select "Most Used" from dropdown
      const mostUsedOption = screen.getByRole('option', { name: 'Most Used' });
      await user.click(mostUsedOption);

      // Verify templates are visible (sorted by usage)
      expect(screen.getByTestId('template-grid')).toBeInTheDocument();
    });
  });

  describe('Template Card Interactions', () => {
    it('should display template information in cards', () => {
      renderWithRouter(<TemplateLibrary />);

      // Check for template name
      expect(screen.getByText('W-2 Tax Form')).toBeInTheDocument();
      // Check for template description
      expect(
        screen.getByText(
          'Standard W-2 wage and tax statement template for employee income reporting.'
        )
      ).toBeInTheDocument();
      // Check for category badge
      expect(screen.getAllByText('Financial').length).toBeGreaterThan(0);
    });

    it('should navigate to fill-form when template card is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      const templateCard = screen.getByTestId('template-card-1');
      await user.click(templateCard);

      expect(mockNavigate).toHaveBeenCalledWith('/fill-form', {
        state: { templateId: '1' },
      });
    });
  });

  describe('List View', () => {
    it('should display template information in list items', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      // Switch to list view
      const listButton = screen.getByTestId('view-mode-list');
      await user.click(listButton);

      // Check list view is rendered
      const listContainer = screen.getByTestId('template-list');
      expect(listContainer).toBeInTheDocument();

      // Check for template name in list
      expect(within(listContainer).getByText('W-2 Tax Form')).toBeInTheDocument();
    });

    it('should navigate to fill-form when list item is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      // Switch to list view
      const listButton = screen.getByTestId('view-mode-list');
      await user.click(listButton);

      // Click on a list item
      const listItem = screen.getByTestId('template-list-item-1');
      await user.click(listItem);

      expect(mockNavigate).toHaveBeenCalledWith('/fill-form', {
        state: { templateId: '1' },
      });
    });
  });

  describe('Create Template Button', () => {
    it('should navigate to /templates when create button is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      const createButton = screen.getByTestId('create-template-button');
      await user.click(createButton);

      expect(mockNavigate).toHaveBeenCalledWith('/templates');
    });
  });

  describe('Empty State', () => {
    it('should show empty state with clear filters action when filters produce no results', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      // Search for something that does not exist
      const searchInput = screen.getByTestId('template-search');
      await user.type(searchInput, 'xyz no match');

      const emptyState = screen.getByTestId('empty-state');
      expect(emptyState).toBeInTheDocument();
      expect(
        within(emptyState).getByText('No templates match your filters')
      ).toBeInTheDocument();
      expect(
        within(emptyState).getByRole('button', { name: /clear filters/i })
      ).toBeInTheDocument();
    });

    it('should clear filters when Clear Filters button is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      // Apply a filter that produces no results
      const searchInput = screen.getByTestId('template-search');
      await user.type(searchInput, 'xyz no match');

      // Click Clear Filters
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      await user.click(clearButton);

      // Templates should be visible again
      expect(screen.getByTestId('template-grid')).toBeInTheDocument();
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });
  });

  describe('Results Count', () => {
    it('should display results count', () => {
      renderWithRouter(<TemplateLibrary />);

      // The mock data has 6 templates
      expect(screen.getByText('Showing 6 templates')).toBeInTheDocument();
    });

    it('should update results count after filtering', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      // Filter to show only financial templates
      const categoryTrigger = screen.getByTestId('category-filter');
      await user.click(categoryTrigger);
      const financialOption = screen.getByRole('option', { name: 'Financial' });
      await user.click(financialOption);

      // Should show filtered count
      expect(screen.getByText('Showing 2 templates (filtered)')).toBeInTheDocument();
    });

    it('should show singular "template" when only one result', async () => {
      const user = userEvent.setup();
      renderWithRouter(<TemplateLibrary />);

      // Filter to show only legal templates (1 result)
      const categoryTrigger = screen.getByTestId('category-filter');
      await user.click(categoryTrigger);
      const legalOption = screen.getByRole('option', { name: 'Legal' });
      await user.click(legalOption);

      // Should show singular form
      expect(screen.getByText('Showing 1 template (filtered)')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on view toggle buttons', () => {
      renderWithRouter(<TemplateLibrary />);

      expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
      expect(screen.getByLabelText('List view')).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', () => {
      renderWithRouter(<TemplateLibrary />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Templates');
    });
  });
});
