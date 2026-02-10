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
import { matchFields, matchFieldsAsync, buildFieldContext } from '../lib/field-matcher';
import { fillAllFields } from '../lib/form-filler';
import { AutocompleteManager } from '../lib/autocomplete-ui';
import { setupShortcuts, teardownShortcuts } from '../lib/keyboard-shortcuts';
import type { DetectedField } from '../shared/types/field-detection';
import type { UserProfile } from '../shared/types/api';
import type { ContentMessage, ContentStatus, InferFieldsResult } from '../shared/types/messages';
import type { FieldContext, FieldMatch, MatchedField } from '../shared/types/field-matching';

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
    const autocompleteManager = new AutocompleteManager();

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

    /** Fill all single-match fields and show result toast */
    function handleFillAll(): void {
      const matchedFields = autocompleteManager.getMatchedFields();
      if (matchedFields.length === 0) {
        autocompleteManager.showToast('IntelliFill: No matched fields to fill');
        return;
      }
      const result = fillAllFields(matchedFields);
      autocompleteManager.showFillResult(result);
    }

    /** Refresh profile and re-process all fields */
    async function handleRefreshProfile(): Promise<void> {
      const success = await fetchProfile();
      if (success) {
        processedFields.clear();
        autocompleteManager.destroy();
        processFields();
        autocompleteManager.showToast('IntelliFill: Profile refreshed');
      }
    }

    // Track unmatched fields for LLM inference
    let unmatchedFieldsCache: { field: DetectedField; context: FieldContext }[] = [];

    /** Send unmatched fields to background for LLM inference, then attach UI */
    async function inferAndAttach(
      unmatchedItems: { field: DetectedField; context: FieldContext }[],
    ): Promise<void> {
      if (!userProfile || unmatchedItems.length === 0) return;

      const profileKeys = userProfile.fields.map((f) => f.key);
      const profileMap = new Map(
        userProfile.fields.map((f) => [f.key, f.values[0] ?? '']),
      );

      try {
        const result = (await browser.runtime.sendMessage({
          action: 'inferFields',
          fields: unmatchedItems.map((u) => u.context),
          profileKeys,
        })) as InferFieldsResult;

        if (!result.success || result.mappings.length === 0) return;

        const newMatched: MatchedField[] = [];
        for (const mapping of result.mappings) {
          const item = unmatchedItems[mapping.index];
          if (!item) continue;

          const value = profileMap.get(mapping.profileKey);
          if (!value) continue;

          const match: FieldMatch = {
            profileField: mapping.profileKey,
            value,
            confidence: mapping.confidence, // Already capped at 0.9 by backend
            matchMethod: 'llm',
          };
          newMatched.push({ field: item.field, matches: [match] });
        }

        if (newMatched.length > 0) {
          console.log(`IntelliFill: LLM matched ${newMatched.length} additional fields`);
          autocompleteManager.attachToFields(newMatched);
          // Remove newly matched from cache by element reference
          const matchedElements = new Set(newMatched.map((m) => m.field.element));
          unmatchedFieldsCache = unmatchedFieldsCache.filter(
            (item) => !matchedElements.has(item.field.element),
          );
        }
      } catch (error) {
        console.error('IntelliFill: LLM inference failed, heuristic matching still active', error);
      }
    }

    /** Process all detected form fields on the page */
    function processFields(): void {
      if (!userProfile) return;

      const fields: DetectedField[] = detectFields();
      const newFields: DetectedField[] = [];

      for (const fieldData of fields) {
        if (processedFields.has(fieldData.element)) continue;

        processedFields.add(fieldData.element);
        markAsProcessed(fieldData.element);
        fieldData.element.setAttribute('data-intellifill-type', fieldData.type);
        newFields.push(fieldData);
      }

      if (newFields.length === 0) return;

      console.log(`IntelliFill: Processing ${newFields.length} new fields`);

      // Match fields with heuristics, collecting unmatched for LLM
      const { matched, unmatched } = matchFieldsAsync(newFields, userProfile.fields);
      console.log(`IntelliFill: Matched ${matched.length} fields to profile data`);

      if (matched.length > 0) {
        autocompleteManager.attachToFields(matched);
      }

      // Async LLM inference for unmatched fields (non-blocking)
      if (unmatched.length > 0) {
        console.log(`IntelliFill: ${unmatched.length} unmatched fields, requesting LLM inference`);
        unmatchedFieldsCache = [...unmatchedFieldsCache, ...unmatched];
        inferAndAttach(unmatched);
      }
    }

    /** Manually trigger LLM inference for all unmatched fields (Ctrl+Shift+I) */
    async function handleInferFields(): Promise<void> {
      if (!userProfile) {
        autocompleteManager.showToast('IntelliFill: No profile loaded');
        return;
      }

      // Rebuild unmatched list from all processed fields
      const allFields = detectFields();
      const { unmatched } = matchFieldsAsync(allFields, userProfile.fields);
      const unmatchedItems = unmatched.map((u, i) => ({
        field: u.field,
        context: buildFieldContext(u.field, i),
      }));

      if (unmatchedItems.length === 0) {
        autocompleteManager.showToast('IntelliFill: All fields already matched');
        return;
      }

      autocompleteManager.showToast(`IntelliFill: Inferring ${unmatchedItems.length} fields...`);
      unmatchedFieldsCache = unmatchedItems;
      await inferAndAttach(unmatchedItems);
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

        // Setup keyboard shortcuts
        setupShortcuts({
          onFillAll: handleFillAll,
          onRefreshProfile: handleRefreshProfile,
          onInferFields: handleInferFields,
        });
      } catch (error) {
        console.error('IntelliFill: Initialization failed', error);
      }
    }

    // Listen for messages from background or popup
    browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
      const message = raw as ContentMessage;
      switch (message.action) {
        case 'refreshProfile':
          handleRefreshProfile()
            .then(() => sendResponse({ success: true }))
            .catch(() => sendResponse({ success: false }));
          break;

        case 'toggleExtension':
          isEnabled = message.enabled;
          if (isEnabled) {
            processFields();
            setupShortcuts({
              onFillAll: handleFillAll,
              onRefreshProfile: handleRefreshProfile,
              onInferFields: handleInferFields,
            });
          } else {
            processedFields.clear();
            autocompleteManager.destroy();
            teardownShortcuts();
            if (domObserver) {
              domObserver.disconnect();
              domObserver = null;
            }
          }
          sendResponse({ success: true });
          break;

        case 'fillAll':
          handleFillAll();
          sendResponse({ success: true });
          break;

        case 'inferFields':
          handleInferFields()
            .then(() => sendResponse({ success: true }))
            .catch(() => sendResponse({ success: false }));
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
