# React Hooks Library Index

Reference guide for reusable React hooks from usehooks.com and usehooks-ts.

**Last Updated:** 2025-12-31

---

## Quick Comparison

| Aspect            | usehooks.com             | usehooks-ts        |
| ----------------- | ------------------------ | ------------------ |
| **Package**       | `@uidotdev/usehooks`     | `usehooks-ts`      |
| **Hook Count**    | 50+                      | 33-40              |
| **TypeScript**    | Good (declaration files) | Excellent (native) |
| **Tree-shakable** | Yes                      | Yes                |
| **SSR Support**   | Better                   | Good               |
| **GitHub Stars**  | 11.3k+                   | High               |

**Recommendation:** Use `usehooks-ts` for TypeScript-first projects; use `@uidotdev/usehooks` for broader hook coverage.

---

## Complete Hook Catalog

### State & Data Management

| Hook              | Library      | Description                 | Use Case                       |
| ----------------- | ------------ | --------------------------- | ------------------------------ |
| `useToggle`       | Both         | Toggle boolean state        | Modals, menus, switches        |
| `useCounter`      | Both         | Counter with min/max limits | Pagination, quantity selectors |
| `useBoolean`      | usehooks-ts  | Boolean state with setters  | Feature flags, toggles         |
| `useDefault`      | usehooks.com | State with default values   | Form fields                    |
| `useHistoryState` | usehooks.com | Undo/redo functionality     | Text editors, drawing apps     |
| `useList`         | usehooks.com | List manipulation           | Dynamic lists, todos           |
| `useMap`          | usehooks.com | Map data structure state    | Key-value stores               |
| `useSet`          | usehooks.com | Set data structure state    | Unique collections             |
| `useQueue`        | usehooks.com | Queue data structure        | Job queues, notifications      |
| `useObjectState`  | usehooks.com | Complex object state        | Form state, settings           |
| `useStep`         | usehooks-ts  | Step counter with bounds    | Wizards, carousels             |

### Storage

| Hook                  | Library     | Description             | Use Case                 |
| --------------------- | ----------- | ----------------------- | ------------------------ |
| `useLocalStorage`     | Both        | Persist to localStorage | User preferences, tokens |
| `useSessionStorage`   | Both        | Session-scoped storage  | Temporary form data      |
| `useReadLocalStorage` | usehooks-ts | Read-only localStorage  | Display stored values    |

### Timing & Intervals

| Hook                | Library      | Description              | Use Case                    |
| ------------------- | ------------ | ------------------------ | --------------------------- |
| `useTimeout`        | Both         | Delayed execution        | Delayed actions, toasts     |
| `useInterval`       | Both         | Periodic execution       | Polling, animations         |
| `useCountdown`      | Both         | Countdown timer          | OTP timers, sales countdown |
| `useIntervalWhen`   | usehooks.com | Conditional intervals    | Pausable polling            |
| `useRandomInterval` | usehooks.com | Random interval callback | Animations, games           |

### Performance & Optimization

| Hook          | Library      | Description          | Use Case                      |
| ------------- | ------------ | -------------------- | ----------------------------- |
| `useDebounce` | Both         | Delay execution      | Search input, form validation |
| `useThrottle` | usehooks.com | Throttle updates     | Scroll handlers, resize       |
| `usePrevious` | usehooks.com | Track previous value | Change detection, animations  |

### DOM & Events

| Hook                | Library      | Description               | Use Case                 |
| ------------------- | ------------ | ------------------------- | ------------------------ |
| `useEventListener`  | Both         | Event listener management | Custom event handling    |
| `useClickAway`      | usehooks.com | Detect outside clicks     | Dropdowns, modals        |
| `useOnClickOutside` | usehooks-ts  | Detect outside clicks     | Dropdowns, modals        |
| `useHover`          | Both         | Track hover state         | Tooltips, interactive UI |
| `useKeyPress`       | usehooks.com | Keyboard event handling   | Shortcuts, games         |
| `useLongPress`      | usehooks.com | Long press detection      | Mobile interactions      |
| `useMeasure`        | usehooks.com | Element dimensions        | Layout calculations      |
| `useMouse`          | usehooks.com | Mouse position tracking   | Cursors, tooltips        |
| `useResizeObserver` | usehooks-ts  | Element resize tracking   | Responsive components    |

### Browser APIs

| Hook                 | Library      | Description           | Use Case                   |
| -------------------- | ------------ | --------------------- | -------------------------- |
| `useCopyToClipboard` | Both         | Copy to clipboard     | Share buttons, code blocks |
| `useScript`          | Both         | Load external scripts | Analytics, widgets         |
| `useFetch`           | usehooks.com | Data fetching         | API calls                  |
| `useDocumentTitle`   | usehooks.com | Dynamic page title    | SPA navigation             |
| `useFavicon`         | usehooks.com | Dynamic favicon       | Notifications, status      |
| `useBattery`         | usehooks.com | Battery status        | Power-aware features       |
| `useGeolocation`     | usehooks.com | User location         | Maps, location services    |

### Browser State

| Hook                      | Library      | Description          | Use Case                      |
| ------------------------- | ------------ | -------------------- | ----------------------------- |
| `useWindowSize`           | Both         | Window dimensions    | Responsive layouts            |
| `useMediaQuery`           | Both         | Media query matching | Responsive design             |
| `useNetworkState`         | usehooks.com | Network status       | Offline detection             |
| `useOrientation`          | usehooks.com | Device orientation   | Mobile games, rotation        |
| `usePreferredLanguage`    | usehooks.com | User language        | i18n                          |
| `useVisibilityChange`     | usehooks.com | Page visibility      | Pause/resume actions          |
| `usePageLeave`            | usehooks.com | Page exit detection  | Save drafts, analytics        |
| `useIdle`                 | usehooks.com | User inactivity      | Session timeout               |
| `useWindowScroll`         | usehooks.com | Scroll position      | Infinite scroll, parallax     |
| `useIntersectionObserver` | Both         | Element visibility   | Lazy loading, infinite scroll |
| `useDarkMode`             | usehooks-ts  | Dark mode toggle     | Theme switching               |

### SSR & Hydration

| Hook                        | Library      | Description            | Use Case           |
| --------------------------- | ------------ | ---------------------- | ------------------ |
| `useIsClient`               | usehooks.com | Client-side check      | SSR safety         |
| `useIsFirstRender`          | usehooks.com | First render detection | Hydration handling |
| `useIsomorphicLayoutEffect` | usehooks-ts  | SSR-safe layout effect | Server components  |

### Debugging & Development

| Hook             | Library      | Description           | Use Case              |
| ---------------- | ------------ | --------------------- | --------------------- |
| `useRenderCount` | usehooks.com | Count re-renders      | Performance debugging |
| `useRenderInfo`  | usehooks.com | Render debugging info | Performance analysis  |
| `useLogger`      | usehooks.com | Lifecycle logging     | Development debugging |

### Utilities

| Hook                 | Library      | Description         | Use Case                |
| -------------------- | ------------ | ------------------- | ----------------------- |
| `useContinuousRetry` | usehooks.com | Auto-retry logic    | API retry, reconnection |
| `useLockBodyScroll`  | usehooks.com | Disable body scroll | Modals, overlays        |
| `useUnmount`         | usehooks-ts  | Cleanup on unmount  | Resource cleanup        |
| `useEventCallback`   | usehooks-ts  | Stable callback ref | Event handlers          |

---

## Priority Implementation for IntelliFill

### Phase 1: Essential (Immediate Value)

```typescript
// Install
npm install @uidotdev/usehooks
// or
npm install usehooks-ts
```

| Hook               | Purpose in IntelliFill              |
| ------------------ | ----------------------------------- |
| `useLocalStorage`  | Cache auth tokens, user preferences |
| `useDebounce`      | Document search optimization        |
| `useToggle`        | Modal/drawer state                  |
| `useMediaQuery`    | Responsive dashboard                |
| `useEventListener` | Custom event handling               |

### Phase 2: Enhancement

| Hook                | Purpose in IntelliFill     |
| ------------------- | -------------------------- |
| `usePrevious`       | Form change detection      |
| `useThrottle`       | Scroll/resize handlers     |
| `useHover`          | Interactive document cards |
| `useKeyPress`       | Keyboard shortcuts         |
| `useLockBodyScroll` | Modal UX                   |

### Phase 3: Advanced Features

| Hook                      | Purpose in IntelliFill        |
| ------------------------- | ----------------------------- |
| `useIntersectionObserver` | Lazy load documents           |
| `useHistoryState`         | Document editing undo/redo    |
| `useNetworkState`         | Offline mode detection        |
| `useIdle`                 | Session timeout               |
| `useVisibilityChange`     | Pause uploads when tab hidden |

---

## Implementation Patterns

### Pattern 1: Ref + State Return

```typescript
// useHover returns ref and state
const [ref, isHovering] = useHover();
return <div ref={ref}>{isHovering ? "Hovered" : "Not hovered"}</div>;
```

### Pattern 2: Value + Setter Return

```typescript
// useToggle returns value and toggle function
const [isOpen, toggle] = useToggle(false);
return <button onClick={toggle}>{isOpen ? "Close" : "Open"}</button>;
```

### Pattern 3: Debounced Value

```typescript
// useDebounce returns debounced value
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);

useEffect(() => {
  // API call only when debounced value changes
  fetchResults(debouncedSearch);
}, [debouncedSearch]);
```

### Pattern 4: Storage Sync

```typescript
// useLocalStorage syncs with localStorage
const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light');
// Automatically persists and syncs across tabs
```

---

## Sources

- [usehooks.com](https://usehooks.com/) - 50+ hooks from ui.dev
- [usehooks-ts.com](https://usehooks-ts.com/) - TypeScript-first hooks
- [GitHub: @uidotdev/usehooks](https://github.com/uidotdev/usehooks)
- [GitHub: usehooks-ts](https://github.com/juliencrn/usehooks-ts)
