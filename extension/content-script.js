/**
 * IntelliFill Content Script
 *
 * Main entry point for the extension on web pages
 * Detects fields and injects autocomplete functionality
 */

(function() {
  'use strict';

  console.log('IntelliFill: Content script loaded');

  let isEnabled = true;
  let userProfile = null;
  let processedFields = new Set();

  /**
   * Initialize the extension
   */
  async function initialize() {
    try {
      // Check if extension is enabled
      const settings = await chrome.storage.local.get(['enabled', 'profile', 'profileTimestamp']);

      isEnabled = settings.enabled !== false; // Default to true

      if (!isEnabled) {
        console.log('IntelliFill: Extension is disabled');
        return;
      }

      // Check if we have cached profile
      if (settings.profile && settings.profileTimestamp) {
        const now = Date.now();
        const cacheAge = now - settings.profileTimestamp;
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

        if (cacheAge < CACHE_DURATION) {
          userProfile = settings.profile;
          console.log('IntelliFill: Using cached profile');
        }
      }

      // Fetch fresh profile if needed
      if (!userProfile) {
        await fetchProfile();
      }

      // Process existing fields
      if (userProfile) {
        processFields();

        // Observe for dynamic fields
        observeForNewFields();

        console.log('IntelliFill: Initialized successfully');
      } else {
        console.log('IntelliFill: No profile available. Please log in.');
      }

    } catch (error) {
      console.error('IntelliFill: Initialization failed', error);
    }
  }

  /**
   * Fetch user profile from background script
   */
  async function fetchProfile() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getProfile'
      });

      if (response.success && response.profile) {
        userProfile = response.profile;

        // Cache the profile
        await chrome.storage.local.set({
          profile: userProfile,
          profileTimestamp: Date.now()
        });

        console.log('IntelliFill: Profile fetched successfully');
        return true;
      } else {
        console.log('IntelliFill: Failed to fetch profile', response.error);
        return false;
      }
    } catch (error) {
      console.error('IntelliFill: Error fetching profile', error);
      return false;
    }
  }

  /**
   * Process all form fields on the page
   */
  function processFields() {
    const fields = FieldDetector.detectFields();

    console.log(`IntelliFill: Detected ${fields.length} fields`);

    fields.forEach(fieldData => {
      // Skip if already processed
      if (processedFields.has(fieldData.element)) {
        return;
      }

      // Mark as processed
      processedFields.add(fieldData.element);
      FieldDetector.markAsProcessed(fieldData.element);

      // Inject autocomplete
      try {
        AutocompleteInjector.injectAutocomplete(fieldData, userProfile);
      } catch (error) {
        console.error('IntelliFill: Failed to inject autocomplete', error);
      }
    });
  }

  /**
   * Observe DOM for new fields
   */
  function observeForNewFields() {
    FieldDetector.observeDOMChanges(() => {
      console.log('IntelliFill: New fields detected');
      processFields();
    });
  }

  /**
   * Handle keyboard shortcuts
   */
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+F - Force fill focused field
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();

      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        // Trigger focus to show suggestions
        activeElement.dispatchEvent(new Event('focus'));
      }
    }

    // Ctrl+Shift+R - Refresh profile
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      console.log('IntelliFill: Refreshing profile...');

      fetchProfile().then(success => {
        if (success) {
          // Re-process all fields
          processedFields.clear();
          processFields();

          // Show notification
          showNotification('Profile refreshed successfully');
        }
      });
    }
  });

  /**
   * Show notification to user
   */
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'intellifill-notification';
    notification.textContent = `IntelliFill: ${message}`;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('intellifill-notification-show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('intellifill-notification-show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Listen for messages from background script or popup
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'refreshProfile':
        fetchProfile().then(success => {
          if (success) {
            processedFields.clear();
            processFields();
          }
          sendResponse({ success });
        });
        return true; // Keep channel open for async response

      case 'toggleExtension':
        isEnabled = message.enabled;
        chrome.storage.local.set({ enabled: isEnabled });

        if (isEnabled) {
          processFields();
        } else {
          // TODO: Remove all injected autocomplete
          processedFields.clear();
        }
        sendResponse({ success: true });
        break;

      case 'getStatus':
        sendResponse({
          enabled: isEnabled,
          hasProfile: !!userProfile,
          fieldsProcessed: processedFields.size
        });
        break;
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
