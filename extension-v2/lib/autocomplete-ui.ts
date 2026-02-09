/**
 * Autocomplete UI - Shadow DOM based autocomplete for matched form fields
 *
 * Renders badge indicators on matched fields and dropdown menus
 * with profile values. Uses Shadow DOM for style isolation.
 */

import { fillField } from './form-filler';
import { MAX_SUGGESTIONS, DEBOUNCE_DELAY_MS } from '../shared/constants';
import type { MatchedField, FillResult } from '../shared/types/field-matching';

type FormElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface FieldUI {
  matchedField: MatchedField;
  badge: HTMLElement;
  dropdown: HTMLElement | null;
}

const SHADOW_HOST_ID = 'intellifill-autocomplete-root';

const STYLES = `
  :host {
    all: initial;
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
  }

  .if-badge {
    position: absolute;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #6366f1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    transition: transform 0.15s ease;
    z-index: 2147483647;
  }

  .if-badge:hover {
    transform: scale(1.15);
  }

  .if-badge svg {
    width: 10px;
    height: 10px;
    fill: white;
  }

  .if-dropdown {
    position: absolute;
    min-width: 220px;
    max-width: 360px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    pointer-events: auto;
    overflow: hidden;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .if-dropdown-header {
    padding: 6px 10px;
    font-size: 11px;
    color: #64748b;
    border-bottom: 1px solid #f1f5f9;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .if-dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    cursor: pointer;
    font-size: 13px;
    color: #1e293b;
    transition: background 0.1s;
  }

  .if-dropdown-item:hover,
  .if-dropdown-item.if-active {
    background: #f1f5f9;
  }

  .if-dropdown-item-value {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 8px;
  }

  .if-dropdown-item-confidence {
    font-size: 10px;
    padding: 2px 5px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .if-confidence-high {
    background: #dcfce7;
    color: #166534;
  }

  .if-confidence-medium {
    background: #fef9c3;
    color: #854d0e;
  }

  .if-confidence-low {
    background: #fee2e2;
    color: #991b1b;
  }

  .if-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #1e293b;
    color: white;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    pointer-events: auto;
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.2s, transform 0.2s;
    z-index: 2147483647;
  }

  .if-toast.if-visible {
    opacity: 1;
    transform: translateY(0);
  }
`;

function createBadgeSVG(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z');
  svg.appendChild(path);
  return svg;
}

export class AutocompleteManager {
  private shadowHost: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private fieldUIMap = new Map<FormElement, FieldUI>();
  private focusListeners = new Map<FormElement, () => void>();
  private activeDropdown: { element: FormElement; index: number } | null = null;
  private mutationObserver: MutationObserver | null = null;
  private scrollHandler: (() => void) | null = null;
  private repositionTimer: ReturnType<typeof setTimeout> | null = null;

  /** Initialize the Shadow DOM container */
  init(): void {
    if (this.shadowHost) return;

    this.shadowHost = document.createElement('div');
    this.shadowHost.id = SHADOW_HOST_ID;
    this.shadowHost.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;';
    document.body.appendChild(this.shadowHost);

    this.shadowRoot = this.shadowHost.attachShadow({ mode: 'closed' });
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLES;
    this.shadowRoot.appendChild(styleEl);

    // Track scroll/resize to reposition badges and dropdowns
    this.scrollHandler = this.debounce(() => this.repositionAll(), 50);
    window.addEventListener('scroll', this.scrollHandler, true);
    window.addEventListener('resize', this.scrollHandler);

    // Observe DOM for removed fields
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.cleanupRemovedElements(node as Element);
          }
        });
      }
    });
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  /** Attach autocomplete UI to matched fields */
  attachToFields(matchedFields: MatchedField[]): void {
    if (!this.shadowRoot) this.init();

    for (const matchedField of matchedFields) {
      const element = matchedField.field.element;
      if (this.fieldUIMap.has(element)) continue;

      const badge = this.createBadge(element, matchedField);
      const ui: FieldUI = { matchedField, badge, dropdown: null };
      this.fieldUIMap.set(element, ui);

      // Show dropdown on field focus (tracked for cleanup)
      const focusHandler = () => this.showDropdown(element);
      element.addEventListener('focus', focusHandler);
      this.focusListeners.set(element, focusHandler);
    }
  }

  /** Remove all UI elements and listeners */
  destroy(): void {
    this.closeDropdown();

    for (const [element, ui] of this.fieldUIMap) {
      ui.badge.remove();
      if (ui.dropdown) ui.dropdown.remove();
      const focusHandler = this.focusListeners.get(element);
      if (focusHandler) element.removeEventListener('focus', focusHandler);
    }
    this.fieldUIMap.clear();
    this.focusListeners.clear();

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler, true);
      window.removeEventListener('resize', this.scrollHandler);
    }
    if (this.mutationObserver) this.mutationObserver.disconnect();
    if (this.repositionTimer) clearTimeout(this.repositionTimer);

    if (this.shadowHost) {
      this.shadowHost.remove();
      this.shadowHost = null;
      this.shadowRoot = null;
    }
  }

  /** Show a toast notification */
  showToast(message: string, duration = 2500): void {
    if (!this.shadowRoot) return;

    const toast = document.createElement('div');
    toast.className = 'if-toast';
    toast.textContent = message;
    this.shadowRoot.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('if-visible');
    });

    setTimeout(() => {
      toast.classList.remove('if-visible');
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  /** Show fill-all results as toast */
  showFillResult(result: FillResult): void {
    const parts: string[] = [];
    if (result.filled > 0) parts.push(`${result.filled} filled`);
    if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
    if (result.failed > 0) parts.push(`${result.failed} failed`);
    this.showToast(`IntelliFill: ${parts.join(', ')}`);
  }

  /** Get all currently tracked matched fields */
  getMatchedFields(): MatchedField[] {
    return Array.from(this.fieldUIMap.values()).map((ui) => ui.matchedField);
  }

  // --- Private methods ---

  private createBadge(element: FormElement, matchedField: MatchedField): HTMLElement {
    const badge = document.createElement('div');
    badge.className = 'if-badge';
    badge.appendChild(createBadgeSVG());
    badge.title = `IntelliFill: ${matchedField.matches.length} suggestion(s)`;
    this.shadowRoot!.appendChild(badge);

    this.positionBadge(badge, element);

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleDropdown(element);
    });

    return badge;
  }

  private positionBadge(badge: HTMLElement, element: FormElement): void {
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    badge.style.top = `${rect.top + scrollY + (rect.height - 18) / 2}px`;
    badge.style.left = `${rect.right + scrollX - 24}px`;
  }

  private toggleDropdown(element: FormElement): void {
    if (this.activeDropdown?.element === element) {
      this.closeDropdown();
    } else {
      this.showDropdown(element);
    }
  }

  private showDropdown(element: FormElement): void {
    const ui = this.fieldUIMap.get(element);
    if (!ui || !this.shadowRoot) return;

    this.closeDropdown();

    const matches = ui.matchedField.matches.slice(0, MAX_SUGGESTIONS);
    if (matches.length === 0) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'if-dropdown';

    const header = document.createElement('div');
    header.className = 'if-dropdown-header';
    header.textContent = 'IntelliFill Suggestions';
    dropdown.appendChild(header);

    matches.forEach((match, index) => {
      const item = document.createElement('div');
      item.className = 'if-dropdown-item';
      if (index === 0) item.classList.add('if-active');
      item.dataset.index = String(index);

      const valueSpan = document.createElement('span');
      valueSpan.className = 'if-dropdown-item-value';
      valueSpan.textContent = match.value;
      valueSpan.title = `${match.profileField} (${match.matchMethod})`;
      item.appendChild(valueSpan);

      const confidenceSpan = document.createElement('span');
      confidenceSpan.className = 'if-dropdown-item-confidence';
      const pct = Math.round(match.confidence * 100);
      confidenceSpan.textContent = `${pct}%`;
      if (match.confidence >= 0.8) {
        confidenceSpan.classList.add('if-confidence-high');
      } else if (match.confidence >= 0.6) {
        confidenceSpan.classList.add('if-confidence-medium');
      } else {
        confidenceSpan.classList.add('if-confidence-low');
      }
      item.appendChild(confidenceSpan);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        fillField(element, match.value);
        this.closeDropdown();
      });

      item.addEventListener('mouseenter', () => {
        this.setActiveItem(dropdown, index);
      });

      dropdown.appendChild(item);
    });

    this.shadowRoot.appendChild(dropdown);
    ui.dropdown = dropdown;
    this.positionDropdown(dropdown, element);
    this.activeDropdown = { element, index: 0 };

    // Keyboard navigation
    this.keydownHandler = (e: KeyboardEvent) => this.handleDropdownKeydown(e, element, dropdown);
    element.addEventListener('keydown', this.keydownHandler as EventListener);

    // Close on outside click
    this.outsideClickHandler = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node) && e.target !== element) {
        this.closeDropdown();
      }
    };
    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler!);
    }, 0);
  }

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  private closeDropdown(): void {
    if (!this.activeDropdown) return;

    const ui = this.fieldUIMap.get(this.activeDropdown.element);
    if (ui?.dropdown) {
      ui.dropdown.remove();
      ui.dropdown = null;
    }

    if (this.keydownHandler) {
      this.activeDropdown.element.removeEventListener('keydown', this.keydownHandler as EventListener);
      this.keydownHandler = null;
    }

    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }

    this.activeDropdown = null;
  }

  private positionDropdown(dropdown: HTMLElement, element: FormElement): void {
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    dropdown.style.top = `${rect.bottom + scrollY + 4}px`;
    dropdown.style.left = `${rect.left + scrollX}px`;
    dropdown.style.minWidth = `${Math.max(220, rect.width)}px`;
  }

  private setActiveItem(dropdown: HTMLElement, index: number): void {
    const items = dropdown.querySelectorAll('.if-dropdown-item');
    items.forEach((item, i) => {
      item.classList.toggle('if-active', i === index);
    });
    if (this.activeDropdown) {
      this.activeDropdown.index = index;
    }
  }

  private handleDropdownKeydown(e: KeyboardEvent, element: FormElement, dropdown: HTMLElement): void {
    const items = dropdown.querySelectorAll('.if-dropdown-item');
    const count = items.length;
    if (count === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = ((this.activeDropdown?.index ?? -1) + 1) % count;
        this.setActiveItem(dropdown, next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = ((this.activeDropdown?.index ?? 1) - 1 + count) % count;
        this.setActiveItem(dropdown, prev);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        const activeIndex = this.activeDropdown?.index ?? 0;
        const ui = this.fieldUIMap.get(element);
        if (ui) {
          const match = ui.matchedField.matches[activeIndex];
          if (match) {
            fillField(element, match.value);
            this.closeDropdown();
          }
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        this.closeDropdown();
        break;
    }
  }

  private repositionAll(): void {
    for (const [element, ui] of this.fieldUIMap) {
      this.positionBadge(ui.badge, element);
      if (ui.dropdown && this.activeDropdown?.element === element) {
        this.positionDropdown(ui.dropdown, element);
      }
    }
  }

  private cleanupRemovedElements(root: Element): void {
    for (const [element, ui] of this.fieldUIMap) {
      if (root.contains(element) || !document.body.contains(element)) {
        ui.badge.remove();
        if (ui.dropdown) ui.dropdown.remove();
        const focusHandler = this.focusListeners.get(element);
        if (focusHandler) element.removeEventListener('focus', focusHandler);
        this.focusListeners.delete(element);
        this.fieldUIMap.delete(element);
        if (this.activeDropdown?.element === element) {
          this.activeDropdown = null;
        }
      }
    }
  }

  private debounce(fn: () => void, ms: number): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }
}
