/**
 * IntelliFill Content Script
 *
 * Main entry point for the extension on web pages.
 * Detects form fields and provides autocomplete suggestions
 * using profile data fetched through the background service worker.
 */

import {
  detectFields,
  markAsProcessed,
  isProcessed,
  observeDOMChanges,
} from '../lib/field-detector';
import type { DetectedField } from '../shared/types/field-detection';
import type { UserProfile } from '../shared/types/api';
import type { ContentMessage, ContentStatus } from '../shared/types/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_end',
  allFrames: false,

  main() {
    console.log('IntelliFill: Content script loaded');

    let isEnabled = true;
    let userProfile: UserProfile | null = null;
    const processedFields = new Set<Element>();
    let domObserver: MutationObserver | null = null;

    /** Fetch profile from background service worker */
    async function fetchProfile(): Promise<boolean> {
      try {
        const response = (await browser.runtime.sendMessage({
          action: 'getProfile',
        })) as { success: boolean; profile?: UserProfile };
        if (response.success && response.profile) {
          userProfile = response.profile;
          console.log('IntelliFill: Profile loaded');
          return true;
        }
        console.log('IntelliFill: No profile available');
        return false;
      } catch (error) {
        console.error('IntelliFill: Error fetching profile', error);
        return false;
      }
    }

    /** Process all detected form fields on the page */
    function processFields(): void {
      if (!userProfile) return;

      const fields: DetectedField[] = detectFields();
      console.log(`IntelliFill: Detected ${fields.length} fields`);

      for (const fieldData of fields) {
        if (processedFields.has(fieldData.element)) continue;

        processedFields.add(fieldData.element);
        markAsProcessed(fieldData.element);

        // TODO: Inject autocomplete UI (will be implemented in a future task)
        // For now, just mark the field as detected
        fieldData.element.setAttribute('data-intellifill-type', fieldData.type);
      }
    }

    /** Initialize the content script */
    async function initialize(): Promise<void> {
      try {
        // Check extension settings
        const settings = await browser.storage.local.get(['settings']);
        const parsed = settings.settings as { enabled?: boolean } | undefined;
        isEnabled = parsed?.enabled !== false;

        if (!isEnabled) {
          console.log('IntelliFill: Extension is disabled');
          return;
        }

        // Fetch profile
        await fetchProfile();

        if (userProfile) {
          processFields();
          // Observe for dynamically added fields (SPAs, AJAX forms)
          domObserver = observeDOMChanges(() => {
            console.log('IntelliFill: New fields detected');
            processFields();
          });
        }
      } catch (error) {
        console.error('IntelliFill: Initialization failed', error);
      }
    }

    // Listen for messages from background or popup
    browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
      const message = raw as ContentMessage;
      switch (message.action) {
        case 'refreshProfile':
          fetchProfile().then((success) => {
            if (success) {
              processedFields.clear();
              processFields();
            }
            sendResponse({ success });
          });
          break;

        case 'toggleExtension':
          isEnabled = message.enabled;
          if (isEnabled) {
            processFields();
          } else {
            processedFields.clear();
            if (domObserver) {
              domObserver.disconnect();
              domObserver = null;
            }
          }
          sendResponse({ success: true });
          break;

        case 'getStatus': {
          const status: ContentStatus = {
            enabled: isEnabled,
            hasProfile: !!userProfile,
            fieldsProcessed: processedFields.size,
          };
          sendResponse(status);
          break;
        }
      }
      return true; // Keep channel open for async responses
    });

    // Start initialization
    initialize();
  },
});
