/**
 * Autocomplete Injector
 *
 * Injects autocomplete dropdown into form fields
 * Ported from React AutocompleteField component
 */

const AutocompleteInjector = (() => {
  'use strict';

  // Constants
  const DEBOUNCE_DELAY = 300;
  const MAX_SUGGESTIONS = 5;
  const DROPDOWN_CLASS = 'intellifill-autocomplete';
  const ACTIVE_CLASS = 'intellifill-active';

  /**
   * Calculate string similarity (0-100)
   */
  function calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 100;

    if (s1.includes(s2) || s2.includes(s1)) {
      const longer = Math.max(s1.length, s2.length);
      const shorter = Math.min(s1.length, s2.length);
      return Math.round((shorter / longer) * 90);
    }

    // Levenshtein distance
    const matrix = [];
    const len1 = s1.length;
    const len2 = s2.length;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (s1.charAt(i - 1) === s2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[len1][len2];
    const maxLength = Math.max(len1, len2);
    return Math.round((1 - distance / maxLength) * 100);
  }

  /**
   * Calculate recency score (0-100)
   */
  function calculateRecencyScore(lastUpdated) {
    const now = new Date();
    const date = new Date(lastUpdated);
    const daysSinceUpdate = (now - date) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate < 7) return 100;
    if (daysSinceUpdate < 30) return 80;
    if (daysSinceUpdate < 90) return 60;
    if (daysSinceUpdate < 180) return 40;
    if (daysSinceUpdate < 365) return 20;
    return 10;
  }

  /**
   * Calculate relevance score
   */
  function calculateRelevanceScore(similarity, confidence, recencyScore, sourceCount) {
    const maxSourceCount = 10;
    const sourceScore = Math.min(sourceCount / maxSourceCount, 1) * 100;

    return Math.round(
      (similarity * 0.4) +
      (confidence * 0.3) +
      (recencyScore * 0.2) +
      (sourceScore * 0.1)
    );
  }

  /**
   * Get suggestions for a field
   */
  async function getSuggestions(fieldName, fieldType, currentValue, profile) {
    if (!profile || !profile.fields || profile.fields.length === 0) {
      return [];
    }

    const normalizedFieldName = fieldName.toLowerCase().replace(/[_\s-]+/g, '_');
    const allSuggestions = [];

    for (const field of profile.fields) {
      const similarity = calculateSimilarity(normalizedFieldName, field.key);

      if (similarity < 20) continue;

      for (const value of field.values) {
        // Filter by current value
        if (currentValue && currentValue.length > 0) {
          const valueLower = value.toLowerCase();
          const currentLower = currentValue.toLowerCase();

          if (!valueLower.startsWith(currentLower) && !valueLower.includes(currentLower)) {
            continue;
          }
        }

        const recencyScore = calculateRecencyScore(field.lastUpdated);
        const relevanceScore = calculateRelevanceScore(
          similarity,
          field.confidence,
          recencyScore,
          field.sourceCount
        );

        allSuggestions.push({
          value,
          confidence: field.confidence,
          fieldKey: field.key,
          sourceCount: field.sourceCount,
          lastUpdated: field.lastUpdated,
          relevanceScore
        });
      }
    }

    // Sort by relevance
    allSuggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Remove duplicates
    const seen = new Set();
    const unique = [];

    for (const suggestion of allSuggestions) {
      const key = suggestion.value.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }

    return unique.slice(0, MAX_SUGGESTIONS);
  }

  /**
   * Get confidence level
   */
  function getConfidenceLevel(confidence) {
    if (confidence >= 80) return 'high';
    if (confidence >= 50) return 'medium';
    return 'low';
  }

  /**
   * Create dropdown element
   */
  function createDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = `${DROPDOWN_CLASS} ${DROPDOWN_CLASS}-dropdown`;
    dropdown.setAttribute('role', 'listbox');
    dropdown.style.display = 'none';
    return dropdown;
  }

  /**
   * Create suggestion item element
   */
  function createSuggestionItem(suggestion, index) {
    const item = document.createElement('div');
    item.className = `${DROPDOWN_CLASS}-item`;
    item.setAttribute('role', 'option');
    item.setAttribute('data-index', index);
    item.setAttribute('data-value', suggestion.value);

    const content = document.createElement('div');
    content.className = `${DROPDOWN_CLASS}-item-content`;

    const valueSpan = document.createElement('span');
    valueSpan.className = `${DROPDOWN_CLASS}-item-value`;
    valueSpan.textContent = suggestion.value;
    content.appendChild(valueSpan);

    const metaDiv = document.createElement('div');
    metaDiv.className = `${DROPDOWN_CLASS}-item-meta`;

    const confidenceLevel = getConfidenceLevel(suggestion.confidence);
    const badge = document.createElement('span');
    badge.className = `${DROPDOWN_CLASS}-badge ${DROPDOWN_CLASS}-badge-${confidenceLevel}`;
    badge.textContent = confidenceLevel.charAt(0).toUpperCase() + confidenceLevel.slice(1);
    metaDiv.appendChild(badge);

    if (suggestion.sourceCount > 1) {
      const sourceCount = document.createElement('span');
      sourceCount.className = `${DROPDOWN_CLASS}-source-count`;
      sourceCount.textContent = `${suggestion.sourceCount} sources`;
      metaDiv.appendChild(sourceCount);
    }

    item.appendChild(content);
    item.appendChild(metaDiv);

    return item;
  }

  /**
   * Position dropdown relative to input
   */
  function positionDropdown(dropdown, input) {
    const rect = input.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    dropdown.style.position = 'absolute';
    dropdown.style.top = `${rect.bottom + scrollTop + 2}px`;
    dropdown.style.left = `${rect.left + scrollLeft}px`;
    dropdown.style.width = `${rect.width}px`;
    dropdown.style.zIndex = '999999';
  }

  /**
   * Show dropdown with suggestions
   */
  function showDropdown(dropdown, suggestions, input) {
    dropdown.innerHTML = '';

    if (suggestions.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    suggestions.forEach((suggestion, index) => {
      const item = createSuggestionItem(suggestion, index);
      dropdown.appendChild(item);
    });

    positionDropdown(dropdown, input);
    dropdown.style.display = 'block';
  }

  /**
   * Hide dropdown
   */
  function hideDropdown(dropdown) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
  }

  /**
   * Set active item
   */
  function setActiveItem(dropdown, index) {
    const items = dropdown.querySelectorAll(`.${DROPDOWN_CLASS}-item`);
    items.forEach((item, i) => {
      if (i === index) {
        item.classList.add(ACTIVE_CLASS);
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove(ACTIVE_CLASS);
      }
    });
  }

  /**
   * Select suggestion
   */
  function selectSuggestion(input, value, dropdown) {
    // Set value
    input.value = value;

    // Trigger input event
    const event = new Event('input', { bubbles: true });
    input.dispatchEvent(event);

    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);

    // Hide dropdown
    hideDropdown(dropdown);

    // Focus back on input
    input.focus();
  }

  /**
   * Debounce function
   */
  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Inject autocomplete into a field
   */
  function injectAutocomplete(fieldData, profile) {
    const { element, name, type } = fieldData;

    // Skip if already injected
    if (element.hasAttribute('data-intellifill-injected')) {
      return;
    }

    // Mark as injected
    element.setAttribute('data-intellifill-injected', 'true');

    // Disable native autocomplete
    element.setAttribute('autocomplete', 'off');

    // Create dropdown
    const dropdown = createDropdown();
    document.body.appendChild(dropdown);

    // Store dropdown reference on element
    element._intellifillDropdown = dropdown;

    let selectedIndex = -1;
    let currentSuggestions = [];

    // Fetch and show suggestions
    const fetchAndShowSuggestions = async (value) => {
      try {
        const suggestions = await getSuggestions(name, type, value, profile);
        currentSuggestions = suggestions;
        selectedIndex = -1;
        showDropdown(dropdown, suggestions, element);
      } catch (error) {
        console.error('IntelliFill: Failed to get suggestions', error);
      }
    };

    const debouncedFetch = debounce(fetchAndShowSuggestions, DEBOUNCE_DELAY);

    // Input handler
    element.addEventListener('input', (e) => {
      debouncedFetch(e.target.value);
    });

    // Focus handler
    element.addEventListener('focus', () => {
      if (currentSuggestions.length > 0) {
        showDropdown(dropdown, currentSuggestions, element);
      } else {
        fetchAndShowSuggestions(element.value);
      }
    });

    // Blur handler (with delay for clicks)
    element.addEventListener('blur', () => {
      setTimeout(() => {
        hideDropdown(dropdown);
        selectedIndex = -1;
      }, 200);
    });

    // Keyboard navigation
    element.addEventListener('keydown', (e) => {
      if (dropdown.style.display === 'none' || currentSuggestions.length === 0) {
        if (e.key === 'ArrowDown') {
          fetchAndShowSuggestions(element.value);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
          setActiveItem(dropdown, selectedIndex);
          break;

        case 'ArrowUp':
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          if (selectedIndex >= 0) {
            setActiveItem(dropdown, selectedIndex);
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < currentSuggestions.length) {
            selectSuggestion(element, currentSuggestions[selectedIndex].value, dropdown);
          }
          break;

        case 'Escape':
          e.preventDefault();
          hideDropdown(dropdown);
          selectedIndex = -1;
          break;

        case 'Tab':
          hideDropdown(dropdown);
          selectedIndex = -1;
          break;
      }
    });

    // Click handler for dropdown items
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest(`.${DROPDOWN_CLASS}-item`);
      if (item) {
        const value = item.getAttribute('data-value');
        selectSuggestion(element, value, dropdown);
      }
    });

    // Reposition on scroll/resize
    const repositionHandler = () => {
      if (dropdown.style.display === 'block') {
        positionDropdown(dropdown, element);
      }
    };

    window.addEventListener('scroll', repositionHandler, true);
    window.addEventListener('resize', repositionHandler);

    // Cleanup on element removal
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.removedNodes.forEach((node) => {
          if (node === element || node.contains?.(element)) {
            dropdown.remove();
            observer.disconnect();
          }
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Remove autocomplete from a field
   */
  function removeAutocomplete(element) {
    if (!element.hasAttribute('data-intellifill-injected')) {
      return;
    }

    element.removeAttribute('data-intellifill-injected');

    if (element._intellifillDropdown) {
      element._intellifillDropdown.remove();
      delete element._intellifillDropdown;
    }
  }

  // Public API
  return {
    injectAutocomplete,
    removeAutocomplete,
    getSuggestions,
    getConfidenceLevel
  };
})();

// Make available globally
window.AutocompleteInjector = AutocompleteInjector;
