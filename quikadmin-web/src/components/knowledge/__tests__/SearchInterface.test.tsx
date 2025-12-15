/**
 * SearchInterface Component Tests
 * Tests for the Knowledge Base search interface
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchInterface } from '../SearchInterface'
import { useKnowledgeStore, useSearchResults, useSearchLoading, useSearchQuery } from '@/stores/knowledgeStore'

// Mock the store
vi.mock('@/stores/knowledgeStore', () => ({
  useKnowledgeStore: vi.fn(),
  useSearchResults: vi.fn(() => []),
  useSearchLoading: vi.fn(() => false),
  useSearchQuery: vi.fn(() => ''),
}))

// Mock the debounce hook
vi.mock('@/hooks/useDebounce', () => ({
  useDebouncedValue: vi.fn((value) => value),
}))

describe('SearchInterface', () => {
  const mockSearch = vi.fn()
  const mockHybridSearch = vi.fn()
  const mockClearSearch = vi.fn()
  const mockSetSearchQuery = vi.fn()

  beforeEach(() => {
    vi.mocked(useKnowledgeStore).mockReturnValue({
      searchResults: [],
      searchLoading: false,
      searchQuery: '',
      search: mockSearch,
      hybridSearch: mockHybridSearch,
      clearSearch: mockClearSearch,
      setSearchQuery: mockSetSearchQuery,
    } as any)
    vi.mocked(useSearchResults).mockReturnValue([])
    vi.mocked(useSearchLoading).mockReturnValue(false)
    vi.mocked(useSearchQuery).mockReturnValue('')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders search input', () => {
      render(<SearchInterface />)
      const input = screen.getByPlaceholderText(/search your knowledge base/i)
      expect(input).toBeInTheDocument()
    })

    it('renders search button', () => {
      render(<SearchInterface />)
      const button = screen.getByRole('button', { name: /search/i })
      expect(button).toBeInTheDocument()
    })

    it('renders options button', () => {
      render(<SearchInterface />)
      const buttons = screen.getAllByRole('button')
      // Should have search button and options button
      expect(buttons.length).toBeGreaterThanOrEqual(2)
    })

    it('shows empty state when no search performed', () => {
      render(<SearchInterface />)
      expect(screen.getByText(/search your knowledge base/i)).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('calls search when button clicked with query', async () => {
      const user = userEvent.setup()
      render(<SearchInterface />)

      const input = screen.getByPlaceholderText(/search your knowledge base/i)
      await user.type(input, 'test query')

      const searchButton = screen.getByRole('button', { name: /search$/i })
      await user.click(searchButton)

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query',
        })
      )
    })

    it('does not call search with empty query', async () => {
      const user = userEvent.setup()
      render(<SearchInterface />)

      const searchButton = screen.getByRole('button', { name: /search$/i })
      await user.click(searchButton)

      expect(mockSearch).not.toHaveBeenCalled()
    })

    it('calls search on Enter key', async () => {
      const user = userEvent.setup()
      render(<SearchInterface />)

      const input = screen.getByPlaceholderText(/search your knowledge base/i)
      await user.type(input, 'test query{Enter}')

      expect(mockSearch).toHaveBeenCalled()
    })

    it('disables search button while loading', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        searchResults: [],
        searchLoading: true,
        searchQuery: 'test',
        search: mockSearch,
        hybridSearch: mockHybridSearch,
        clearSearch: mockClearSearch,
        setSearchQuery: mockSetSearchQuery,
      } as any)
      vi.mocked(useSearchResults).mockReturnValue([])
      vi.mocked(useSearchLoading).mockReturnValue(true)
      vi.mocked(useSearchQuery).mockReturnValue('test')

      render(<SearchInterface />)
      const searchButton = screen.getByRole('button', { name: /searching/i })
      expect(searchButton).toBeDisabled()
    })
  })

  // NOTE: Some tests in this suite fail due to a React/Radix UI Collapsible compatibility issue
  // in the test environment. When searchResults exist, the component renders Collapsible components,
  // which causes "Cannot read properties of null (reading 'useState')" errors.
  // This is a known testing environment issue that needs investigation.
  // The component works correctly in the browser.
  describe('Search Results', () => {
    it('displays search results', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        searchResults: [
          {
            id: '1',
            sourceId: 'source-1',
            sourceTitle: 'Test Document',
            text: 'This is test content from the document.',
            pageNumber: 1,
            sectionHeader: 'Introduction',
            chunkIndex: 0,
            similarity: 0.85,
          },
        ],
        searchLoading: false,
        searchQuery: 'test',
        search: mockSearch,
        hybridSearch: mockHybridSearch,
        clearSearch: mockClearSearch,
        setSearchQuery: mockSetSearchQuery,
      } as any)
      vi.mocked(useSearchResults).mockReturnValue([
          {
            id: '1',
            sourceId: 'source-1',
            sourceTitle: 'Test Document',
            text: 'This is test content from the document.',
            pageNumber: 1,
            sectionHeader: 'Introduction',
            chunkIndex: 0,
            similarity: 0.85,
          },
        ])
      vi.mocked(useSearchLoading).mockReturnValue(false)
      vi.mocked(useSearchQuery).mockReturnValue('test')

      render(<SearchInterface />)

      expect(screen.getByText('Test Document')).toBeInTheDocument()
      expect(screen.getByText(/this is test content/i)).toBeInTheDocument()
      expect(screen.getByText(/85% match/i)).toBeInTheDocument()
    })

    it('shows result count', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        searchResults: [
          { id: '1', sourceId: 's1', sourceTitle: 'Doc 1', text: 'Text 1', chunkIndex: 0, similarity: 0.8, pageNumber: null, sectionHeader: null },
          { id: '2', sourceId: 's2', sourceTitle: 'Doc 2', text: 'Text 2', chunkIndex: 0, similarity: 0.7, pageNumber: null, sectionHeader: null },
        ],
        searchLoading: false,
        searchQuery: 'test',
        search: mockSearch,
        hybridSearch: mockHybridSearch,
        clearSearch: mockClearSearch,
        setSearchQuery: mockSetSearchQuery,
      } as any)
      vi.mocked(useSearchResults).mockReturnValue([
          { id: '1', sourceId: 's1', sourceTitle: 'Doc 1', text: 'Text 1', chunkIndex: 0, similarity: 0.8, pageNumber: null, sectionHeader: null },
          { id: '2', sourceId: 's2', sourceTitle: 'Doc 2', text: 'Text 2', chunkIndex: 0, similarity: 0.7, pageNumber: null, sectionHeader: null },
        ])
      vi.mocked(useSearchLoading).mockReturnValue(false)
      vi.mocked(useSearchQuery).mockReturnValue('test')

      render(<SearchInterface />)

      // Check for the result count text (text is split across elements, so use function matcher)
      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Found 2 results'
      })).toBeInTheDocument()
    })

    it('shows no results message when search returns empty', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        searchResults: [],
        searchLoading: false,
        searchQuery: 'test query',
        search: mockSearch,
        hybridSearch: mockHybridSearch,
        clearSearch: mockClearSearch,
        setSearchQuery: mockSetSearchQuery,
      } as any)
      vi.mocked(useSearchResults).mockReturnValue([])
      vi.mocked(useSearchLoading).mockReturnValue(false)
      vi.mocked(useSearchQuery).mockReturnValue('test query')

      render(<SearchInterface />)

      expect(screen.getByText(/no results found/i)).toBeInTheDocument()
    })
  })

  // NOTE: Tests that interact with the options panel may fail due to Radix UI component
  // rendering issues in the test environment.
  describe('Search Options', () => {
    it('toggles options panel', async () => {
      const user = userEvent.setup()
      render(<SearchInterface />)

      // Options should be hidden initially
      expect(screen.queryByText(/hybrid search/i)).not.toBeInTheDocument()

      // Click options button (the settings icon button) - it's the first button (index 0)
      const optionsButton = screen.getAllByRole('button')[0]
      await user.click(optionsButton)

      // Options should now be visible
      await waitFor(() => {
        expect(screen.getByText(/hybrid search/i)).toBeInTheDocument()
      })
    })

    it('uses hybrid search when enabled', async () => {
      const user = userEvent.setup()
      render(<SearchInterface />)

      // Open options - first button is the settings/options button
      const optionsButton = screen.getAllByRole('button')[0]
      await user.click(optionsButton)

      // Wait for switch to appear
      const hybridSwitch = await screen.findByRole('switch')
      await user.click(hybridSwitch)

      // Type query and search
      const input = screen.getByPlaceholderText(/search your knowledge base/i)
      await user.type(input, 'test query')

      const searchButton = screen.getByRole('button', { name: /search$/i })
      await user.click(searchButton)

      expect(mockHybridSearch).toHaveBeenCalled()
      expect(mockSearch).not.toHaveBeenCalled()
    })
  })

  // NOTE: This test fails when searchResults exist due to Collapsible rendering issues.
  describe('Clear Results', () => {
    it('clears results when clear button clicked', async () => {
      const user = userEvent.setup()

      vi.mocked(useKnowledgeStore).mockReturnValue({
        searchResults: [
          { id: '1', sourceId: 's1', sourceTitle: 'Doc', text: 'Text', chunkIndex: 0, similarity: 0.8, pageNumber: null, sectionHeader: null },
        ],
        searchLoading: false,
        searchQuery: 'test',
        search: mockSearch,
        hybridSearch: mockHybridSearch,
        clearSearch: mockClearSearch,
        setSearchQuery: mockSetSearchQuery,
      } as any)
      vi.mocked(useSearchResults).mockReturnValue([
          { id: '1', sourceId: 's1', sourceTitle: 'Doc', text: 'Text', chunkIndex: 0, similarity: 0.8, pageNumber: null, sectionHeader: null },
        ])
      vi.mocked(useSearchLoading).mockReturnValue(false)
      vi.mocked(useSearchQuery).mockReturnValue('test')

      render(<SearchInterface />)

      const clearButton = screen.getByRole('button', { name: /clear results/i })
      await user.click(clearButton)

      expect(mockClearSearch).toHaveBeenCalled()
    })
  })

  describe('Loading State', () => {
    it('shows loading skeletons while searching', () => {
      vi.mocked(useKnowledgeStore).mockReturnValue({
        searchResults: [],
        searchLoading: true,
        searchQuery: 'test',
        search: mockSearch,
        hybridSearch: mockHybridSearch,
        clearSearch: mockClearSearch,
        setSearchQuery: mockSetSearchQuery,
      } as any)
      vi.mocked(useSearchResults).mockReturnValue([])
      vi.mocked(useSearchLoading).mockReturnValue(true)
      vi.mocked(useSearchQuery).mockReturnValue('test')

      render(<SearchInterface />)

      // Should show skeleton cards
      const skeletons = document.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })
})
