# IntelliFill Browser Extension v2 - Architecture Document

**Date:** 2026-02-08
**Status:** DESIGN (pre-implementation)
**Scope:** Transform vanilla JS Chrome extension prototype into production-grade TypeScript browser extension

---

## Table of Contents

1. [Technology Decisions](#1-technology-decisions)
2. [Project Structure](#2-project-structure)
3. [API Integration Design](#3-api-integration-design)
4. [Content Script Architecture](#4-content-script-architecture)
5. [Security Model](#5-security-model)
6. [Cross-Browser Strategy](#6-cross-browser-strategy)
7. [Build & Deploy Pipeline](#7-build--deploy-pipeline)

---

## 1. Technology Decisions

### 1.1 Build Framework: WXT (Recommended)

**Decision:** Use [WXT](https://wxt.dev) as the extension build framework.

**Evaluation Summary:**

| Criterion                | WXT                         | Plasmo                     | Manual Vite + CRXJS       |
| ------------------------ | --------------------------- | -------------------------- | ------------------------- |
| Maintenance status       | Actively maintained         | Maintenance concerns       | CRXJS seeking maintainers |
| Bundler                  | Vite (fast)                 | Parcel (slower)            | Vite                      |
| Framework agnostic       | Yes (React, Vue, Svelte)    | React-centric              | Yes                       |
| TypeScript               | First-class, default        | First-class                | Manual config             |
| Cross-browser            | Chrome + Firefox + Safari   | Chrome + Firefox           | Chrome only (CRXJS)       |
| Manifest auto-generation | Yes, file-based entrypoints | Yes, decorators            | No                        |
| Content script UI        | Built-in Shadow DOM helper  | Built-in CSUI              | Manual                    |
| HMR                      | Fast, including background  | Moderate                   | Fast                      |
| Output size              | ~400 KB (benchmark)         | ~700 KB (benchmark)        | Variable                  |
| Community adoption       | Growing, production-proven  | Established but stagnating | Small                     |

**Rationale:**

1. **Vite-powered performance.** WXT is built on Vite, matching the build toolchain already used by `quikadmin-web`. This means shared mental models for build configuration, plugin ecosystem familiarity, and consistent developer experience.

2. **File-based entrypoints with auto-generated manifest.** WXT eliminates manual `manifest.json` management. Entrypoints are defined by file structure (e.g., `entrypoints/popup/index.html`, `entrypoints/background.ts`), and the manifest is generated at build time. This is a significant improvement over the current prototype's manually maintained manifest.

3. **Built-in Shadow DOM UI for content scripts.** WXT provides `createShadowRootUi()` out of the box, which solves the CSS isolation problem the current prototype lacks (dropdown styles leak into and from host pages).

4. **Cross-browser from a single codebase.** WXT automatically handles Manifest V3 (Chrome/Edge) and Manifest V2 (Firefox) from one source, with a unified `browser` API wrapper. This directly supports the cross-browser strategy in Section 6.

5. **Framework agnostic.** While we will use React for the popup/options UI, WXT does not lock us in. Vanilla TS content scripts remain lightweight.

6. **Active maintenance.** Unlike Plasmo (maintenance concerns in the community) and CRXJS (seeking new maintainers, archival risk), WXT has an active maintainer and growing ecosystem.

### 1.2 Language: TypeScript

TypeScript is mandatory. The extension will use strict TypeScript configuration matching the conventions in `quikadmin-web`.

**Type Organization:**

```
src/shared/types/
  api.ts           # API request/response types (mirrors backend DTOs)
  profile.ts       # ProfileField, ProfileValue, ClientProfile types
  messages.ts      # Chrome runtime message types (discriminated unions)
  storage.ts       # Storage schema types (WXT storage.defineItem)
  field-detection.ts  # FieldType enum, FieldData, DetectedField types
  settings.ts      # Extension settings types
```

**Key typing patterns:**

- **Discriminated union messages.** All `chrome.runtime` messages use a discriminated union on the `action` field, replacing the current untyped `message.action` switch. This provides compile-time exhaustiveness checking.

```typescript
// src/shared/types/messages.ts
type BackgroundMessage =
  | { action: 'login'; email: string; password: string }
  | { action: 'logout' }
  | { action: 'getProfile'; forceRefresh?: boolean }
  | { action: 'isAuthenticated' }
  | { action: 'clearCache' };

type BackgroundResponse<T extends BackgroundMessage> = T extends { action: 'login' }
  ? { success: boolean; user?: User; error?: string }
  : T extends { action: 'getProfile' }
    ? { success: boolean; profile?: Profile; error?: string }
    : T extends { action: 'isAuthenticated' }
      ? { authenticated: boolean }
      : { success: boolean };
```

- **WXT typed storage.** Use WXT's `storage.defineItem<T>()` for type-safe storage access with migration support (replaces raw `chrome.storage.local.get/set`).

- **Shared types re-exported.** API types should mirror the backend Prisma models where applicable, imported from a shared `types/` directory.

### 1.3 UI Framework: React (for popup and options pages)

**Decision:** React 18 for popup and options pages; vanilla TypeScript for content scripts.

**Rationale:**

- **Consistency.** `quikadmin-web` uses React 18, Radix UI, and the same component patterns. Reusing these patterns (and potentially shared component code) reduces context switching.
- **Content scripts stay lightweight.** The autocomplete dropdown injected into web pages must be minimal. Using React for content script UI would add ~40 KB+ to every page load. Instead, content script UI uses vanilla TS with WXT's `createShadowRootUi()`.
- **Popup is a natural React fit.** The popup has login forms, state, profile display, and settings -- all patterns already well-served by React in the existing codebase.

**Component sharing strategy:**

A small subset of UI primitives from `quikadmin-web/src/components/ui/` (Button, Input, Card) can be copied into the extension as a lightweight UI kit. Do NOT introduce a shared package dependency -- extension and web app have different build targets.

### 1.4 State Management: WXT Storage + React Context

**Decision:** Use WXT's typed `storage` module for persistent state, and lightweight React Context (not Zustand) for popup-local ephemeral state.

**Rationale:**

- **WXT storage** wraps `chrome.storage.local` with type safety, versioned migrations, and reactive watchers. It replaces the ad-hoc `chrome.storage.local.get/set` calls in the current prototype.
- **No Zustand for extension.** The popup is simple enough (login form, profile display, settings toggle) that React Context with `useReducer` suffices. Adding Zustand would introduce unnecessary bundle size for a 380px-wide popup.
- **Background script** uses module-level variables for in-memory cache (same pattern as current prototype, but typed).

**Storage schema (WXT storage items):**

```typescript
// src/shared/storage.ts
import { storage } from 'wxt/storage';

export const authToken = storage.defineItem<string | null>('local:authToken', {
  fallback: null,
});

export const refreshToken = storage.defineItem<string | null>('local:refreshToken', {
  fallback: null,
});

export const cachedProfile = storage.defineItem<CachedProfile | null>('local:cachedProfile', {
  fallback: null,
  version: 1,
});

export const extensionSettings = storage.defineItem<ExtensionSettings>('local:settings', {
  fallback: {
    enabled: true,
    apiEndpoint: 'https://app.intellifill.com/api',
    cacheMinutes: 5,
  },
  version: 1,
});
```

### 1.5 Styling: TailwindCSS 4 (popup) + Scoped CSS (content scripts)

**Popup/Options pages:** TailwindCSS 4 (matching `quikadmin-web`), integrated via WXT's Vite pipeline. The popup is a self-contained HTML page, so Tailwind works normally.

**Content script UI:** Plain CSS injected into the Shadow DOM via WXT's `cssInjectionMode: 'ui'`. TailwindCSS is NOT used for content script UI because:

1. Tailwind's utility classes could conflict with host page styles if Shadow DOM isolation fails.
2. The content script dropdown is small enough (~200 lines CSS) that hand-written, BEM-namespaced CSS is more predictable.
3. WXT automatically extracts and injects CSS into the Shadow Root when `cssInjectionMode: 'ui'` is set.

---

## 2. Project Structure

```
extension-v2/
├── entrypoints/                 # WXT file-based entrypoints
│   ├── background.ts            # Service worker (auto-registered)
│   ├── popup/                   # Popup React app
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── LoginView.tsx
│   │   │   ├── MainView.tsx
│   │   │   ├── ProfileCard.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   └── ui/              # Lightweight UI primitives
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       └── Card.tsx
│   │   └── style.css            # Tailwind entry
│   ├── content.ts               # Main content script
│   ├── content/                  # Content script modules
│   │   ├── overlay-ui.ts        # Shadow DOM autocomplete UI
│   │   ├── overlay-ui.css       # Scoped styles for overlay
│   │   └── App.tsx              # (optional) React UI for side panel
│   ├── options/                  # Options page (future)
│   │   ├── index.html
│   │   └── main.tsx
│   └── sidepanel.html           # Side panel (future, Chrome 114+)
├── lib/                         # Core logic (shared across entrypoints)
│   ├── field-detector.ts        # Field detection engine (ported from JS)
│   ├── field-matcher.ts         # Profile-to-field matching logic
│   ├── autocomplete-engine.ts   # Suggestion ranking (ported from JS)
│   ├── api-client.ts            # Typed fetch wrapper for backend API
│   └── crypto.ts                # Token encryption helpers
├── shared/                      # Shared types and constants
│   ├── types/
│   │   ├── api.ts
│   │   ├── profile.ts
│   │   ├── messages.ts
│   │   ├── storage.ts
│   │   ├── field-detection.ts
│   │   └── settings.ts
│   ├── storage.ts               # WXT storage item definitions
│   ├── constants.ts             # API URLs, cache durations, etc.
│   └── logger.ts                # Structured logging utility
├── public/                      # Static assets (copied as-is)
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
├── wxt.config.ts                # WXT configuration
├── tailwind.config.ts           # Tailwind config (popup only)
├── tsconfig.json                # TypeScript configuration
├── package.json
└── .env.example                 # Environment variables template
```

**Key structural decisions:**

1. **`entrypoints/` follows WXT convention.** Each file or directory under `entrypoints/` becomes a manifest entry. WXT auto-generates `manifest.json` from this structure.

2. **`lib/` contains framework-agnostic logic.** Field detection, matching, and ranking are pure TypeScript functions with no DOM or React dependencies. This enables unit testing and potential reuse.

3. **`shared/` holds cross-entrypoint code.** Types, storage definitions, and constants are importable by background, content, and popup entrypoints.

4. **No `src/` wrapper.** WXT defaults to root-level `entrypoints/`. Since the extension is its own package (`extension-v2/`), an additional `src/` nesting adds unnecessary depth.

---

## 3. API Integration Design

### 3.1 Authentication Flow

The extension authenticates with the IntelliFill backend using the Supabase-based auth system (`/api/auth/v2/*`).

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Popup (React)  │     │    Background     │     │  IntelliFill API │
│                  │     │  Service Worker   │     │   (Backend)      │
└────────┬─────────┘     └────────┬──────────┘     └────────┬─────────┘
         │                        │                          │
         │  1. User enters        │                          │
         │     email + password   │                          │
         │───────────────────────>│                          │
         │  sendMessage('login')  │                          │
         │                        │  2. POST /api/auth/v2/login
         │                        │─────────────────────────>│
         │                        │                          │
         │                        │  3. { accessToken,       │
         │                        │     refreshToken, user } │
         │                        │<─────────────────────────│
         │                        │                          │
         │                        │  4. Store tokens in      │
         │                        │     WXT storage (encrypted)
         │                        │                          │
         │                        │  5. GET /api/users/me/profile
         │                        │─────────────────────────>│
         │                        │                          │
         │                        │  6. { profile }          │
         │                        │<─────────────────────────│
         │                        │                          │
         │  7. { success, user }  │                          │
         │<───────────────────────│                          │
         │                        │                          │
```

**Token refresh flow:**

```
Background Service Worker (on 401 response):
  1. Intercept 401 from any API call
  2. Read refreshToken from WXT storage
  3. POST /api/auth/v2/refresh with { refreshToken }
  4. On success: store new accessToken, retry original request
  5. On failure: clear all tokens, notify popup to show login
```

### 3.2 Endpoint Mapping

The current prototype uses incorrect endpoints (`/auth/login`, `/users/me`). The v2 extension maps to the actual backend routes:

| Extension Action     | HTTP Method | Backend Route                           | Auth Required |
| -------------------- | ----------- | --------------------------------------- | ------------- |
| Login                | POST        | `/api/auth/v2/login`                    | No            |
| Register (link only) | --          | Opens web app                           | --            |
| Logout               | POST        | `/api/auth/v2/logout`                   | Yes           |
| Refresh token        | POST        | `/api/auth/v2/refresh`                  | Refresh token |
| Get current user     | GET         | `/api/users/me`                         | Yes           |
| Get user profile     | GET         | `/api/users/me/profile`                 | Yes           |
| List clients         | GET         | `/api/clients`                          | Yes           |
| Get client profile   | GET         | `/api/clients/:clientId/profile`        | Yes           |
| Get profile fields   | GET         | `/api/clients/:clientId/profile/fields` | Yes           |

### 3.3 API Client Design

```typescript
// lib/api-client.ts
import { authToken, refreshToken } from '../shared/storage';

class IntelliFillAPI {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await authToken.getValue();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.request<T>(endpoint, options); // Retry once
      }
      throw new AuthError('Session expired');
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new APIError(response.status, body.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  private async refreshAccessToken(): Promise<boolean> {
    const token = await refreshToken.getValue();
    if (!token) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/v2/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      await authToken.setValue(data.accessToken);
      if (data.refreshToken) {
        await refreshToken.setValue(data.refreshToken);
      }
      return true;
    } catch {
      return false;
    }
  }
}
```

### 3.4 Profile Sync Strategy

```
┌─────────────┐
│  Profile     │
│  Sync Flow   │
└──────┬──────┘
       │
       ▼
  ┌─────────────────────────────────┐
  │ 1. On login: fetch full profile │
  │    Cache in WXT storage         │
  │    Timestamp the cache          │
  └────────────┬────────────────────┘
               │
               ▼
  ┌─────────────────────────────────┐
  │ 2. On content script load:      │
  │    Read from WXT storage cache  │
  │    If cache < 5 min: use cached │
  │    If cache > 5 min: background │
  │    fetch + update cache         │
  └────────────┬────────────────────┘
               │
               ▼
  ┌─────────────────────────────────┐
  │ 3. Periodic: chrome.alarms     │
  │    Every 5 min if authenticated │
  │    Refresh profile silently     │
  │    Notify active content scripts│
  └────────────┬────────────────────┘
               │
               ▼
  ┌─────────────────────────────────┐
  │ 4. On-demand: user clicks       │
  │    "Refresh" in popup           │
  │    Force-fetch from API         │
  └─────────────────────────────────┘
```

### 3.5 Error Handling and Offline Support

**Network errors:**

- All API calls are wrapped in try/catch with typed error classes (`AuthError`, `APIError`, `NetworkError`).
- On network failure, the extension operates in **degraded mode**: uses cached profile data (even if stale), disables login, and shows "Offline" indicator in popup.
- When connectivity is restored (detected via `navigator.onLine` event), the background service worker triggers a profile refresh.

**Error states in UI:**

- Login failures: display error message in popup form (same UX as current prototype, but typed).
- Profile fetch failures: show last cached profile with a "stale data" indicator.
- Token expiration: automatic refresh attempt; if refresh fails, redirect to login view.

---

## 4. Content Script Architecture

### 4.1 Field Detection Improvements

The current `field-detector.js` (311 lines) provides basic regex-based field detection. The v2 rewrite improves on this:

**Current limitations being addressed:**

| Issue                              | Current Behavior           | v2 Improvement                                                                                               |
| ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| No autocomplete attribute matching | Ignored                    | Parse `autocomplete="given-name"` etc. per HTML spec                                                         |
| Flat regex patterns                | Simple `/email/i`          | Weighted multi-signal scoring (name + id + label + autocomplete + aria + context)                            |
| No form context                    | Each field standalone      | Group fields by `<form>` parent to understand form intent                                                    |
| No select/dropdown support         | Basic `<select>` detection | Full support for `<select>`, `<input type="radio">`, custom dropdowns                                        |
| Label detection fragile            | `closest('label')` only    | Multi-strategy: `for` attribute, wrapping `<label>`, `aria-labelledby`, adjacent text, `<fieldset>/<legend>` |

**v2 Field Detection Architecture:**

```typescript
// lib/field-detector.ts

export enum FieldType {
  FIRST_NAME = 'first_name',
  LAST_NAME = 'last_name',
  FULL_NAME = 'full_name',
  EMAIL = 'email',
  PHONE = 'phone',
  DATE_OF_BIRTH = 'date_of_birth',
  SSN = 'ssn',
  ADDRESS_LINE_1 = 'address_line_1',
  ADDRESS_LINE_2 = 'address_line_2',
  CITY = 'city',
  STATE = 'state',
  ZIP = 'zip',
  COUNTRY = 'country',
  // ... more specific types
  UNKNOWN = 'unknown',
}

export interface DetectedField {
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  fieldType: FieldType;
  confidence: number; // 0-100
  label: string;
  signals: FieldSignal[]; // Debugging: what signals contributed
  formContext?: FormContext; // Parent form metadata
}

// Multi-signal scoring
interface FieldSignal {
  source: 'name' | 'id' | 'autocomplete' | 'label' | 'placeholder' | 'aria' | 'context';
  value: string;
  matchedType: FieldType;
  weight: number;
}
```

### 4.2 Shadow DOM UI Injection

The current prototype appends autocomplete dropdowns directly to `document.body`, causing:

1. CSS conflicts with host page styles.
2. Host page CSS leaking into dropdown.
3. Z-index battles.
4. No cleanup on SPA navigation.

**v2 uses WXT's `createShadowRootUi()`:**

```typescript
// entrypoints/content.ts
import './content/overlay-ui.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    // Field detection runs in the page context
    const detector = new FieldDetector();
    const matcher = new FieldMatcher();

    // Shadow DOM UI for autocomplete overlay
    const ui = await createShadowRootUi(ctx, {
      name: 'intellifill-autocomplete',
      position: 'overlay', // Positioned absolutely over the page
      zIndex: 999999,
      onMount(container) {
        // Vanilla TS overlay manager renders dropdown into this container
        const overlay = new AutocompleteOverlay(container, matcher);
        return overlay;
      },
      onRemove(overlay) {
        overlay?.destroy();
      },
    });

    ui.mount();

    // Start field detection
    detector.scan(document);
    detector.observe(document.body); // MutationObserver for SPA changes

    // Listen for profile updates
    ctx.onInvalidated(() => {
      detector.disconnect();
    });
  },
});
```

**Benefits of Shadow DOM approach:**

- Complete CSS isolation (both directions).
- WXT handles cleanup when context is invalidated (e.g., extension update, SPA navigation).
- Content script CSS is bundled and injected into the Shadow Root automatically.

### 4.3 Performance Strategy

| Technique                      | Implementation                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lazy field scanning**        | Don't scan until the page has at least one `<form>` or visible `<input>`. Check with `document.querySelector('form, input, textarea, select')` before initializing. |
| **Debounced MutationObserver** | Batch DOM mutations with 200ms debounce (current: no debounce on observer).                                                                                         |
| **Intersection Observer**      | Only process fields that are visible in the viewport. Defer off-screen fields.                                                                                      |
| **Field scan caching**         | Cache scanned fields per-page. Re-scan only when MutationObserver detects changes.                                                                                  |
| **Minimal DOM footprint**      | Single Shadow Root container. Dropdown created once, repositioned as needed (not recreated per field).                                                              |
| **Profile loaded async**       | Content script initializes immediately but defers profile fetch to background. UI shows "loading" state until profile arrives.                                      |

### 4.4 Integration with Profile Data

The v2 field matcher (`lib/field-matcher.ts`) improves on the current `calculateSimilarity` approach:

```
Profile Field Key              Detected Field Type         Match Strategy
─────────────────              ───────────────────         ──────────────
"first_name"            <-->   FieldType.FIRST_NAME        Direct enum match
"email"                 <-->   FieldType.EMAIL              Direct enum match
"date_of_birth"         <-->   FieldType.DATE_OF_BIRTH     Direct enum match
"address_line_1"        <-->   FieldType.ADDRESS_LINE_1    Direct enum match
"custom_field_xyz"      <-->   FieldType.UNKNOWN           Fuzzy string match (Levenshtein)
```

The current prototype relies entirely on fuzzy string matching between field names. The v2 approach:

1. **First pass:** Map profile field keys to the `FieldType` enum and match against detected field types. This is instant and high-confidence.
2. **Second pass (fallback):** For unmatched fields, fall back to fuzzy string matching (Levenshtein + substring) with the existing relevance scoring algorithm.
3. **HTML `autocomplete` attribute mapping:** Parse standard `autocomplete` values (`given-name`, `family-name`, `email`, `tel`, `address-line1`, etc.) and map them directly to `FieldType`. This is the highest-confidence signal.

---

## 5. Security Model

### 5.1 Token Storage

**Current prototype issue:** JWT token stored in plain text in `chrome.storage.local`.

**v2 approach:**

Tokens are stored in `chrome.storage.local` via WXT's storage module. Chrome's `chrome.storage.local` is already encrypted at the OS level (Chrome encrypts the extension's storage using the user's OS profile). Additional application-layer encryption is NOT recommended because:

1. The encryption key would need to be stored alongside the data (defeating the purpose).
2. `chrome.storage.local` is already sandboxed per-extension (no cross-extension access).
3. The real attack vector is physical device access, which OS-level encryption addresses.

**Mitigations applied:**

- Tokens have short TTLs (access token: 15 min, refresh token: 7 days -- set by backend).
- On logout, all storage items are explicitly cleared via `authToken.setValue(null)` and `refreshToken.setValue(null)`.
- Token is never exposed to content scripts. Content scripts request profile data through `chrome.runtime.sendMessage()` to the background service worker. The background worker holds the token and makes API calls.

### 5.2 Content Security Policy

WXT generates the CSP automatically. The extension enforces:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'; base-uri 'self'"
  }
}
```

**Guarantees:**

- No inline scripts (`'unsafe-inline'` is never added).
- No `eval()` or `Function()` constructor.
- No remote script loading.
- All code is bundled at build time by Vite.

### 5.3 Minimal Permissions Model

```typescript
// wxt.config.ts manifest section
manifest: {
  permissions: [
    'storage',      // For WXT storage (auth tokens, cached profile, settings)
    'alarms',       // For periodic profile refresh
  ],
  host_permissions: [
    'https://app.intellifill.com/api/*',        // Production API
    ...(isDev ? ['http://localhost:3002/api/*'] : []),  // Dev only
  ],
  // content_scripts.matches is set per-entrypoint via defineContentScript
}
```

**Permissions NOT requested (and why):**

- `activeTab`: Not needed. Content scripts use `<all_urls>` match pattern (required for form detection on any page).
- `tabs`: Not needed in v2. Profile refresh notifies via `chrome.runtime.sendMessage` broadcast, not `chrome.tabs.sendMessage`.
- `cookies`: Not needed. Auth uses Bearer tokens, not cookies.
- `webRequest`/`webNavigation`: Not needed. No request interception.

### 5.4 Data Protection

- **Profile data** in storage cache is the same data the user can see in the web app. It is PII -- but it is the user's own PII, stored locally on their device in a sandboxed extension storage area.
- **Password** is never stored. It is sent to the login endpoint and immediately discarded.
- **Content scripts** never receive the raw auth token. They request profile data via runtime messaging; the background worker fetches it.
- **No analytics or telemetry** in the extension.
- **No external scripts** loaded at runtime.

### 5.5 Input Sanitization

- All values rendered in the autocomplete dropdown use `textContent` (never `innerHTML`), same as the current prototype. This is preserved in v2.
- API responses are validated against TypeScript types at the API client level.
- User input in the popup login form is validated before sending (email format, non-empty password).

---

## 6. Cross-Browser Strategy

### 6.1 Browser Priority

| Priority | Browser | Manifest | Timeline  | Notes                                   |
| -------- | ------- | -------- | --------- | --------------------------------------- |
| P0       | Chrome  | V3       | Launch    | Primary target, largest user base       |
| P0       | Edge    | V3       | Launch    | Chromium-based, same build as Chrome    |
| P1       | Firefox | V2/V3    | +1 month  | WXT handles V2/V3 compat automatically  |
| P2       | Safari  | V3       | +3 months | Requires Xcode, Apple Developer account |

### 6.2 WXT Cross-Browser Approach

WXT provides a unified `browser` API that abstracts away differences:

```typescript
// Instead of:
chrome.storage.local.get(...)   // Chrome-specific
browser.storage.local.get(...)  // Firefox-specific

// WXT provides:
import { browser } from 'wxt/browser';
browser.storage.local.get(...)  // Works everywhere
```

**Build targeting:**

```bash
# Chrome (Manifest V3)
wxt build                      # Default target
wxt build --browser chrome

# Firefox (auto-selects Manifest V2 or V3 based on compatibility)
wxt build --browser firefox

# Safari (requires additional xcrun step)
wxt build --browser safari
```

### 6.3 Manifest V2 vs V3 Considerations

| Feature          | Manifest V3 (Chrome/Edge)    | Manifest V2 (Firefox fallback) |
| ---------------- | ---------------------------- | ------------------------------ |
| Background       | Service Worker (stateless)   | Background Page (persistent)   |
| Network requests | `declarativeNetRequest`      | `webRequest` (not needed)      |
| CSP              | Stricter, no `'unsafe-eval'` | More permissive                |
| Permissions      | Required at install time     | Can be optional                |

WXT handles these differences at build time. The code is written once using the V3 mental model (service worker, no persistent background), and WXT adapts for V2 targets.

**Firefox-specific consideration:** Firefox's Manifest V3 support is still evolving. WXT defaults to V2 for Firefox when V3 support is incomplete, ensuring compatibility without manual configuration.

### 6.4 API Compatibility Layer

Features that differ across browsers:

| Feature                | Chrome | Firefox                      | Edge | Safari | Strategy                          |
| ---------------------- | ------ | ---------------------------- | ---- | ------ | --------------------------------- |
| `chrome.storage.local` | Yes    | `browser.storage.local`      | Yes  | Yes    | WXT `browser` wrapper             |
| `chrome.sidePanel`     | 114+   | No                           | Yes  | No     | Feature-detect, graceful fallback |
| `chrome.action`        | V3     | `browser.browserAction` (V2) | V3   | V3     | WXT handles                       |
| Shadow DOM             | Yes    | Yes                          | Yes  | Yes    | Standard Web API                  |

---

## 7. Build & Deploy Pipeline

### 7.1 Development Workflow

```bash
# Initial setup
cd extension-v2
npm install              # Or bun install

# Development with hot reload
wxt dev                  # Opens Chrome with extension loaded, HMR enabled
wxt dev --browser firefox  # Dev mode for Firefox

# Run TypeScript checks
npm run typecheck

# Run tests
npm run test             # Vitest unit tests
npm run test:e2e         # Playwright extension tests
```

**Hot Module Replacement (HMR):**

- **Popup/Options:** Full HMR (component changes reflect instantly).
- **Content scripts:** Quick reload (script re-injected without full page reload).
- **Background service worker:** Automatic reload on change.

**Developer tools integration:**

- Chrome DevTools for popup inspection (`chrome-extension://[id]/popup.html`).
- Content script debugging via Sources panel (source maps enabled in dev).
- Background service worker inspection via `chrome://extensions` > "Inspect views: service worker".

### 7.2 WXT Configuration

```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',
  entrypointsDir: 'entrypoints',
  outDir: '.output',

  manifest: {
    name: 'IntelliFill - Smart Form Autofill',
    description:
      'Automatically fill forms using your stored profile data from documents you have uploaded',
    version: '2.0.0',
    permissions: ['storage', 'alarms'],
    host_permissions: ['https://app.intellifill.com/api/*'],
    icons: {
      '16': 'icons/icon-16.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },

  // Environment-specific overrides
  runner: {
    startUrls: ['https://example.com'], // Open test page on dev start
  },
});
```

### 7.3 Production Build

```bash
# Build for Chrome Web Store
wxt build

# Build for Firefox Add-ons
wxt build --browser firefox

# Package as ZIP for store submission
wxt zip                  # Chrome
wxt zip --browser firefox # Firefox
```

**Build output:**

```
.output/
├── chrome-mv3/          # Chrome Manifest V3 build
│   ├── manifest.json    # Auto-generated
│   ├── background.js    # Bundled service worker
│   ├── content-scripts/
│   │   └── content.js
│   ├── popup.html
│   ├── popup.js
│   ├── icons/
│   └── ...
└── chrome-mv3.zip       # Ready for Chrome Web Store upload
```

**Build optimizations (handled by Vite/WXT):**

- Tree shaking (dead code elimination).
- Minification (Terser).
- Source maps (excluded from production ZIP, kept for debugging).
- Chunk splitting where beneficial (popup vs content script).

### 7.4 Chrome Web Store Submission

**Automation via `wxt submit`:**

WXT has a built-in `wxt submit` command that automates store submission:

```bash
# First-time setup: configure API keys
wxt submit init

# Submit to Chrome Web Store
wxt submit --chrome-zip .output/chrome-mv3.zip

# Submit to Firefox Add-ons
wxt submit --firefox-zip .output/firefox-mv2.zip --firefox-sources-zip .output/sources.zip
```

**Required store assets (manual preparation):**

- 5 screenshots (1280x800 or 640x400).
- Short description (132 chars max).
- Detailed description.
- Privacy policy URL.
- Category: Productivity.

### 7.5 Version Management

**Versioning strategy:** Semantic versioning (`MAJOR.MINOR.PATCH`).

- `manifest.version` in `wxt.config.ts` is the source of truth.
- Chrome Web Store requires version to be incremented on every submission.
- Use `wxt build --manifest-version` flag or CI script to auto-increment patch version.

**Git tagging:**

```bash
# Tag releases
git tag extension-v2.0.0
git push origin extension-v2.0.0
```

### 7.6 CI/CD Pipeline (Future)

```yaml
# .github/workflows/extension.yml (conceptual)
name: Extension CI
on:
  push:
    paths: ['extension-v2/**']

jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: cd extension-v2 && npm ci
      - run: cd extension-v2 && npm run typecheck
      - run: cd extension-v2 && npm run test
      - run: cd extension-v2 && wxt build
      - run: cd extension-v2 && wxt zip
      - uses: actions/upload-artifact@v4
        with:
          name: extension-zip
          path: extension-v2/.output/chrome-mv3.zip

  publish: # Only on release tags
    needs: build
    if: startsWith(github.ref, 'refs/tags/extension-')
    steps:
      - run: cd extension-v2 && wxt submit --chrome-zip .output/chrome-mv3.zip
```

---

## Appendix A: Migration Plan from v1 to v2

### Files to Port

| v1 File                                 | v2 Location                                                        | Changes                                                     |
| --------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| `background.js`                         | `entrypoints/background.ts`                                        | TypeScript, WXT storage, token refresh, typed messages      |
| `content-script.js`                     | `entrypoints/content.ts`                                           | TypeScript, Shadow DOM UI, improved field detection         |
| `lib/field-detector.js`                 | `lib/field-detector.ts`                                            | TypeScript, multi-signal scoring, autocomplete attr parsing |
| `lib/autocomplete-injector.js`          | `lib/autocomplete-engine.ts` + `entrypoints/content/overlay-ui.ts` | Split ranking logic from DOM rendering                      |
| `popup.html` + `popup.js` + `popup.css` | `entrypoints/popup/` (React app)                                   | Full React rewrite with Tailwind                            |
| `styles.css`                            | `entrypoints/content/overlay-ui.css`                               | Scoped in Shadow DOM                                        |
| `manifest.json`                         | `wxt.config.ts` (auto-generated)                                   | Removed; WXT generates from config + entrypoints            |

### Logic Preserved

The following algorithms from v1 are ported as-is (with TypeScript types):

- Levenshtein distance calculation (`autocomplete-injector.js:20-62`)
- Recency scoring (`autocomplete-injector.js:67-78`)
- Relevance score weighting (`autocomplete-injector.js:83-93`)
- Field pattern matching regexes (`field-detector.js:24-72`)
- Keyboard navigation handler (`autocomplete-injector.js:373-416`)

### Breaking Changes

- API endpoints updated from `/auth/login` to `/api/auth/v2/login`.
- Auth token storage key changes (WXT storage uses `local:authToken` convention).
- Content script no longer exposes global `FieldDetector` / `AutocompleteInjector` on `window`.

---

## Appendix B: Package Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "wxt": "latest",
    "@wxt-dev/module-react": "latest",
    "typescript": "^5.9.0",
    "tailwindcss": "^4.1.0",
    "@tailwindcss/postcss": "^4.1.0",
    "postcss": "^8.5.0",
    "vitest": "^4.0.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

**Bundle size estimate:**

- React + ReactDOM: ~42 KB (gzip) -- popup only, not injected into content scripts.
- Content script: ~15 KB (gzip) -- field detection + autocomplete overlay (vanilla TS).
- Background service worker: ~8 KB (gzip) -- API client + storage logic.
- Total extension size: ~80-100 KB (excluding icons).
