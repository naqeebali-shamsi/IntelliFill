/**
 * AutocompleteField Component Tests
 *
 * Tests for the intelligent autocomplete field component including:
 * - Rendering and basic functionality
 * - Keyboard navigation
 * - Suggestion ranking
 * - Click-to-fill interaction
 * - Debouncing logic
 * - Accessibility (ARIA attributes)
 *
 * @module components/features/__tests__/autocomplete-field
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutocompleteField } from '../autocomplete-field';
import { FieldType } from '@/services/suggestionEngine';
import * as suggestionEngineModule from '@/services/suggestionEngine';

// Mock the suggestion engine
const mockGetSuggestions = vi.fn();
const mockGetUserProfile = vi.fn();
const mockGetConfidenceLevel = vi.fn();
const mockClearCache = vi.fn();
const mockRefreshProfile = vi.fn();

// Create mock class
class MockSuggestionEngine {
  getSuggestions = mockGetSuggestions;
  getUserProfile = mockGetUserProfile;
  getConfidenceLevel = mockGetConfidenceLevel;
  clearCache = mockClearCache;
  refreshProfile = mockRefreshProfile;
}

// Mock the getSuggestionEngine function
vi.spyOn(suggestionEngineModule, 'getSuggestionEngine').mockReturnValue(
  new MockSuggestionEngine() as any
);

describe('AutocompleteField', () => {
  const mockSuggestions = [
    {
      value: 'john@example.com',
      confidence: 95,
      fieldKey: 'email',
      sourceCount: 3,
      lastUpdated: new Date('2025-01-15'),
      relevanceScore: 98,
    },
    {
      value: 'john.doe@company.com',
      confidence: 85,
      fieldKey: 'email',
      sourceCount: 2,
      lastUpdated: new Date('2025-01-10'),
      relevanceScore: 92,
    },
    {
      value: 'j.doe@personal.com',
      confidence: 70,
      fieldKey: 'email',
      sourceCount: 1,
      lastUpdated: new Date('2025-01-05'),
      relevanceScore: 85,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfidenceLevel.mockImplementation((confidence: number) => {
      if (confidence >= 80) return 'high';
      if (confidence >= 50) return 'medium';
      return 'low';
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Rendering', () => {
    it('renders input field with label', () => {
      render(
        <AutocompleteField
          name="email"
          label="Email Address"
          placeholder="Enter email"
        />
      );

      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
    });

    it('renders required indicator when required prop is true', () => {
      render(
        <AutocompleteField
          name="email"
          label="Email Address"
          required
        />
      );

      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('renders error message when error prop is provided', () => {
      render(
        <AutocompleteField
          name="email"
          label="Email Address"
          error="Email is required"
        />
      );

      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    it('applies custom className to input', () => {
      render(
        <AutocompleteField
          name="email"
          className="custom-class"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-class');
    });
  });

  describe('Suggestions Display', () => {
    it('fetches and displays suggestions on focus', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const user = userEvent.setup();
      render(
        <AutocompleteField
          name="email"
          fieldType={FieldType.EMAIL}
        />
      );

      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(mockGetSuggestions).toHaveBeenCalledWith(
          'email',
          FieldType.EMAIL,
          '',
          5
        );
      });

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        expect(screen.getByText('john.doe@company.com')).toBeInTheDocument();
        expect(screen.getByText('j.doe@personal.com')).toBeInTheDocument();
      });
    });

    it('shows confidence badges when showConfidence is true', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const user = userEvent.setup();
      render(
        <AutocompleteField
          name="email"
          showConfidence={true}
        />
      );

      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getAllByText('High').length).toBeGreaterThan(0);
      });
    });

    it('hides confidence badges when showConfidence is false', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const user = userEvent.setup();
      render(
        <AutocompleteField
          name="email"
          showConfidence={false}
        />
      );

      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      });

      expect(screen.queryByText('High')).not.toBeInTheDocument();
    });

    it('shows source count for suggestions with multiple sources', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const user = userEvent.setup();
      render(<AutocompleteField name="email" />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('3 sources')).toBeInTheDocument();
        expect(screen.getByText('2 sources')).toBeInTheDocument();
      });
    });

    it('limits suggestions to maxSuggestions prop', async () => {
      const manySuggestions = Array.from({ length: 10 }, (_, i) => ({
        value: `email${i}@example.com`,
        confidence: 90 - i * 5,
        fieldKey: 'email',
        sourceCount: 1,
        lastUpdated: new Date(),
        relevanceScore: 90 - i * 5,
      }));

      mockGetSuggestions.mockResolvedValue(manySuggestions);

      const user = userEvent.setup();
      render(
        <AutocompleteField
          name="email"
          maxSuggestions={3}
        />
      );

      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(mockGetSuggestions).toHaveBeenCalledWith(
          'email',
          undefined,
          '',
          3
        );
      });
    });

    it('shows "No suggestions available" when no matches found', async () => {
      mockGetSuggestions.mockResolvedValue([]);

      const user = userEvent.setup();
      render(<AutocompleteField name="email" />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'xyz');

      await waitFor(() => {
        expect(screen.getByText('No suggestions available')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates suggestions with arrow down key', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const user = userEvent.setup();
      render(<AutocompleteField name="email" />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      });

      // Press arrow down to select first item
      await user.keyboard('{ArrowDown}');

      const firstOption = screen.getByText('john@example.com').closest('[role="option"]');
      expect(firstOption).toHaveAttribute('aria-selected', 'true');

      // Press arrow down again to select second item
      await user.keyboard('{ArrowDown}');

      const secondOption = screen.getByText('john.doe@company.com').closest('[role="option"]');
      expect(secondOption).toHaveAttribute('aria-selected', 'true');
    });

    it('navigates suggestions with arrow up key', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const user = userEvent.setup();
      render(<AutocompleteField name="email" />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      });

      // Navigate down to second item
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // Navigate back up to first item
      await user.keyboard('{ArrowUp}');

      const firstOption = screen.getByText('john@example.com').closest('[role="option"]');
      expect(firstOption).toHaveAttribute('aria-selected', 'true');
    });

    it('selects suggestion with Enter key', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const handleChange = vi.fn();
      const handleSuggestionSelect = vi.fn();
      const user = userEvent.setup();

      render(
        <AutocompleteField
          name="email"
          onChange={handleChange}
          onSuggestionSelect={handleSuggestionSelect}
        />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      });

      // Navigate to first suggestion and press Enter
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(handleSuggestionSelect).toHaveBeenCalledWith('john@example.com');
        expect(input.value).toBe('john@example.com');
      });
    });

    it('closes dropdown with Escape key', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const user = userEvent.setup();
      render(<AutocompleteField name="email" />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('john@example.com')).not.toBeInTheDocument();
      });
    });

    it('closes dropdown with Tab key without selecting', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const handleSuggestionSelect = vi.fn();
      const user = userEvent.setup();

      render(
        <AutocompleteField
          name="email"
          onSuggestionSelect={handleSuggestionSelect}
        />
      );

      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      });

      await user.keyboard('{Tab}');

      expect(handleSuggestionSelect).not.toHaveBeenCalled();
    });
  });

  describe('Click-to-Fill Interaction', () => {
    it('fills input when clicking a suggestion', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const handleChange = vi.fn();
      const handleSuggestionSelect = vi.fn();
      const user = userEvent.setup();

      render(
        <AutocompleteField
          name="email"
          onChange={handleChange}
          onSuggestionSelect={handleSuggestionSelect}
        />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      });

      const suggestion = screen.getByText('john@example.com');
      await user.click(suggestion);

      await waitFor(() => {
        expect(handleSuggestionSelect).toHaveBeenCalledWith('john@example.com');
        expect(input.value).toBe('john@example.com');
      });
    });

    it('closes dropdown after selecting a suggestion', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const user = userEvent.setup();
      render(<AutocompleteField name="email" />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      });

      const suggestion = screen.getByText('john@example.com');
      await user.click(suggestion);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Debouncing Logic', () => {
    it('debounces suggestion fetching during typing', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const user = userEvent.setup();
      render(<AutocompleteField name="email" />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      // Initial call count
      const initialCallCount = mockGetSuggestions.mock.calls.length;

      // Type quickly
      await user.type(input, 'john');

      // Wait for debounce to complete
      await waitFor(() => {
        expect(mockGetSuggestions.mock.calls.length).toBeGreaterThan(initialCallCount);
      }, { timeout: 1000 });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      render(<AutocompleteField name="email" label="Email" />);

      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-controls', 'email-suggestions');
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    it('updates aria-expanded when dropdown opens', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const user = userEvent.setup();
      render(<AutocompleteField name="email" />);

      const input = screen.getByRole('textbox');

      // Initially should be false
      expect(input).toHaveAttribute('aria-expanded', 'false');

      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      }, { timeout: 2000 });

      // After suggestions load, should be true
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      }, { timeout: 1000 });
    });

    it('has aria-invalid when error is present', () => {
      render(
        <AutocompleteField
          name="email"
          error="Email is required"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'email-error');
    });

    it('suggestions have proper role and aria-selected', async () => {
      mockGetSuggestions.mockResolvedValue(mockSuggestions);

      const user = userEvent.setup();
      render(<AutocompleteField name="email" />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      }, { timeout: 2000 });

      await waitFor(() => {
        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();
      }, { timeout: 1000 });

      const options = screen.getAllByRole('option');
      expect(options.length).toBe(mockSuggestions.length);

      // Initially no selection
      options.forEach((option) => {
        expect(option).toHaveAttribute('aria-selected', 'false');
      });
    });
  });

  describe('Controlled vs Uncontrolled', () => {
    it('works as uncontrolled component', async () => {
      mockGetSuggestions.mockResolvedValue([]);

      const user = userEvent.setup();
      render(<AutocompleteField name="email" />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await user.type(input, 'test@example.com');

      await waitFor(() => {
        expect(input.value).toBe('test@example.com');
      }, { timeout: 1000 });
    });

    it('works as controlled component', async () => {
      mockGetSuggestions.mockResolvedValue([]);

      const handleChange = vi.fn();
      const user = userEvent.setup();

      const { rerender } = render(
        <AutocompleteField
          name="email"
          value=""
          onChange={handleChange}
        />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');

      await user.type(input, 't');

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
      }, { timeout: 1000 });

      rerender(
        <AutocompleteField
          name="email"
          value="test@example.com"
          onChange={handleChange}
        />
      );

      expect(input.value).toBe('test@example.com');
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator while fetching suggestions', async () => {
      // Create a promise that doesn't resolve immediately
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockGetSuggestions.mockReturnValue(delayedPromise);

      const user = userEvent.setup();
      render(<AutocompleteField name="email" />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      // Check for loading spinner (it has animate-spin class)
      await waitFor(() => {
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      }, { timeout: 1000 });

      // Resolve the promise to clean up
      resolvePromise!(mockSuggestions);
    });
  });
});
