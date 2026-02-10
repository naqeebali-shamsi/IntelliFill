/**
 * Keyboard Shortcuts - Global shortcuts for IntelliFill form filling
 *
 * Ctrl+Shift+F: Fill all matched fields
 * Ctrl+Shift+R: Refresh profile data
 * Ctrl+Shift+L: Infer unmatched fields via LLM
 */

export interface ShortcutHandlers {
  onFillAll: () => void;
  onRefreshProfile: () => void;
  onInferFields?: () => void;
}

let keydownListener: ((e: KeyboardEvent) => void) | null = null;

/** Register keyboard shortcuts */
export function setupShortcuts(handlers: ShortcutHandlers): void {
  teardownShortcuts();

  keydownListener = (e: KeyboardEvent) => {
    if (!e.ctrlKey || !e.shiftKey) return;

    switch (e.key.toUpperCase()) {
      case 'F':
        e.preventDefault();
        handlers.onFillAll();
        break;
      case 'R':
        e.preventDefault();
        handlers.onRefreshProfile();
        break;
      case 'L':
        e.preventDefault();
        handlers.onInferFields?.();
        break;
    }
  };

  document.addEventListener('keydown', keydownListener);
}

/** Remove keyboard shortcuts */
export function teardownShortcuts(): void {
  if (keydownListener) {
    document.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
}
