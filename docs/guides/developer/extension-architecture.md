---
title: 'Chrome Extension Developer Guide'
description: 'Technical architecture and implementation details for the IntelliFill Chrome Extension'
category: 'how-to'
lastUpdated: '2025-12-30'
status: 'active'
---

# IntelliFill Chrome Extension - Developer Guide

## Architecture Overview

The IntelliFill Chrome Extension follows a standard Chrome Manifest V3 architecture with three main components:

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Popup UI   │  │   Content    │  │  Background  │      │
│  │  (popup.*)   │  │   Scripts    │  │Service Worker│      │
│  │              │  │(content-*.js)│  │(background.js)│      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                   chrome.runtime.sendMessage()              │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                   ┌─────────▼─────────┐
                   │  IntelliFill API  │
                   │  (Backend Server) │
                   └───────────────────┘
```

## Project Structure

```
extension/
├── manifest.json              # Extension configuration (Manifest V3)
├── background.js              # Service worker for API communication
├── content-script.js          # Main content script entry point
├── popup.html                 # Extension popup UI
├── popup.js                   # Popup logic
├── popup.css                  # Popup styles
├── styles.css                 # Injected content styles
├── lib/
│   ├── field-detector.js      # Field detection engine
│   └── autocomplete-injector.js # Autocomplete injection logic
├── icons/
│   ├── icon16.png             # 16x16 toolbar icon
│   ├── icon48.png             # 48x48 management icon
│   ├── icon128.png            # 128x128 store icon
│   └── icon.svg               # SVG source
└── assets/                    # Additional resources
```

## Component Details

### 1. Manifest (manifest.json)

**Purpose**: Extension configuration and permissions

**Key Features**:

- Manifest V3 compliance
- Minimal permissions (storage, activeTab)
- Content scripts injected on all URLs
- Background service worker for API calls

**Important Fields**:

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["http://localhost:3000/*"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "run_at": "document_end"
    }
  ]
}
```

### 2. Background Service Worker (background.js)

**Purpose**: Handle API communication, authentication, and caching

**Responsibilities**:

- Authentication (login/logout)
- API requests with JWT tokens
- Profile data caching (5 minutes)
- Handle 401 errors and token refresh
- Periodic profile refresh
- Message handling from content scripts and popup

**Key Functions**:

```javascript
// Authentication
async function login(email, password)
async function logout()
async function isAuthenticated()

// API Communication
async function apiRequest(endpoint, options)
async function fetchProfile(forceRefresh)
async function getCurrentUser()

// Storage Management
async function getAuthToken()
async function setAuthToken(token)
async function clearAuthToken()
```

**Message Handlers**:

| Action            | Description          | Response                   |
| ----------------- | -------------------- | -------------------------- |
| `login`           | Authenticate user    | `{ success, user, token }` |
| `logout`          | Clear authentication | `{ success }`              |
| `getProfile`      | Fetch user profile   | `{ success, profile }`     |
| `getCurrentUser`  | Get user details     | `{ success, user }`        |
| `isAuthenticated` | Check auth status    | `{ authenticated }`        |
| `clearCache`      | Clear profile cache  | `{ success }`              |

**Caching Strategy**:

- Cache duration: 5 minutes
- Cache key: `profile` in chrome.storage.local
- Cache timestamp: `profileTimestamp`
- Automatic refresh on alarm (every 5 minutes if authenticated)

### 3. Content Scripts

#### a. Field Detector (lib/field-detector.js)

**Purpose**: Detect and categorize form fields on web pages

**Key Features**:

- Detects input types: text, email, tel, date, number, textarea, select
- Auto-categorizes fields by analyzing name, id, placeholder, aria-label
- Filters out excluded fields (password, hidden, disabled)
- Checks field visibility and interactivity
- MutationObserver for dynamic forms

**Field Types**:

```javascript
const FieldType = {
  TEXT: 'text',
  EMAIL: 'email',
  PHONE: 'phone',
  DATE: 'date',
  ADDRESS: 'address',
  SSN: 'ssn',
  NUMBER: 'number',
  UNKNOWN: 'unknown',
};
```

**Detection Patterns**:

```javascript
const FIELD_PATTERNS = {
  [FieldType.EMAIL]: [/email/i, /e[-_]?mail/i, /mail/i],
  [FieldType.PHONE]: [/phone/i, /tel/i, /mobile/i, /cell/i],
  [FieldType.DATE]: [/date/i, /birth/i, /dob/i, /expire/i],
  // ... etc
};
```

**Public API**:

```javascript
FieldDetector.detectFields(); // Returns array of field metadata
FieldDetector.detectFieldType(element); // Returns FieldType
FieldDetector.getFieldIdentifier(element); // Returns field name/id
FieldDetector.observeDOMChanges(callback); // Monitor for new fields
```

#### b. Autocomplete Injector (lib/autocomplete-injector.js)

**Purpose**: Inject autocomplete dropdown into detected fields

**Key Features**:

- Suggestion ranking algorithm (ported from suggestionEngine.ts)
- Dropdown creation and positioning
- Keyboard navigation (arrows, enter, escape)
- Click-to-fill functionality
- Debounced input handling (300ms)
- Automatic repositioning on scroll/resize

**Suggestion Algorithm**:

```javascript
// Relevance Score Calculation
relevanceScore =
  (fieldSimilarity × 0.4) +
  (confidence × 0.3) +
  (recency × 0.2) +
  (sourceCount × 0.1)
```

**Similarity Calculation**:

- Exact match: 100
- Substring match: 90 × (shorter/longer)
- Levenshtein distance: 100 × (1 - distance/maxLength)

**Dropdown Structure**:

```html
<div class="intellifill-autocomplete-dropdown">
  <div class="intellifill-autocomplete-item" data-value="...">
    <div class="intellifill-autocomplete-item-content">
      <span class="intellifill-autocomplete-item-value">John Doe</span>
    </div>
    <div class="intellifill-autocomplete-item-meta">
      <span class="intellifill-autocomplete-badge-high">High</span>
      <span class="intellifill-autocomplete-source-count">3 sources</span>
    </div>
  </div>
</div>
```

**Public API**:

```javascript
AutocompleteInjector.injectAutocomplete(fieldData, profile);
AutocompleteInjector.removeAutocomplete(element);
AutocompleteInjector.getSuggestions(fieldName, fieldType, currentValue, profile);
```

#### c. Main Content Script (content-script.js)

**Purpose**: Entry point that orchestrates field detection and autocomplete injection

**Responsibilities**:

- Initialize extension on page load
- Fetch user profile from background script
- Detect and process all form fields
- Handle dynamic forms (MutationObserver)
- Manage keyboard shortcuts
- Handle messages from popup and background

**Lifecycle**:

1. **Initialization**

   ```javascript
   - Check if extension is enabled
   - Load cached profile or fetch fresh
   - Process existing fields
   - Set up MutationObserver
   ```

2. **Field Processing**

   ```javascript
   - Detect all fields using FieldDetector
   - Filter already processed fields
   - Inject autocomplete for each field
   - Mark as processed
   ```

3. **Dynamic Updates**
   ```javascript
   - MutationObserver watches for new DOM nodes
   - Detect new fields automatically
   - Process and inject autocomplete
   ```

**Keyboard Shortcuts**:

```javascript
Ctrl+Shift+F → Force show suggestions on focused field
Ctrl+Shift+R → Refresh profile from server
```

**Message Handlers**:
| Action | Description | Response |
|--------|-------------|----------|
| `refreshProfile` | Reload profile and re-process fields | `{ success }` |
| `toggleExtension` | Enable/disable extension | `{ success }` |
| `getStatus` | Get extension status | `{ enabled, hasProfile, fieldsProcessed }` |

### 4. Popup UI

**Purpose**: User interface for login, status, and settings

**Components**:

1. **Login View** (`loginView`)
   - Email/password form
   - Error messages
   - Loading state

2. **Main View** (`mainView`)
   - Status indicator (active/inactive)
   - Toggle switch (enable/disable)
   - User profile card
   - Statistics (field count, document count)
   - Settings (API endpoint)
   - Keyboard shortcuts reference
   - Sign out button

**State Management**:

```javascript
- currentUser: User object from API
- currentProfile: Profile object with fields
- isEnabled: Extension enabled state
```

**Interactions**:

- Login → Call background.login() → Show main view
- Logout → Call background.logout() → Show login view
- Toggle → Update storage → Notify all tabs
- Refresh → Force fetch profile → Update UI

## Data Flow

### 1. Authentication Flow

```
User enters credentials
       ↓
Popup sends to Background
       ↓
Background → API /auth/login
       ↓
Store JWT token in chrome.storage.local
       ↓
Fetch profile immediately
       ↓
Cache profile (5 min)
       ↓
Notify all content scripts
       ↓
Content scripts fetch cached profile
       ↓
Process and inject autocomplete
```

### 2. Suggestion Flow

```
User focuses on input field
       ↓
Content script detects focus
       ↓
Fetch suggestions from cached profile
       ↓
Calculate relevance scores
       ↓
Sort by score
       ↓
Show dropdown with top 5
       ↓
User selects suggestion
       ↓
Fill field value
       ↓
Trigger input & change events
```

### 3. Profile Refresh Flow

```
Periodic alarm (5 min) OR manual refresh
       ↓
Background checks if authenticated
       ↓
Fetch fresh profile from API
       ↓
Update cache in chrome.storage.local
       ↓
Notify active tabs
       ↓
Content scripts reload cached profile
       ↓
Re-process all fields with new data
```

## API Integration

### Base URL

```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

### Endpoints Used

| Endpoint            | Method | Purpose                     |
| ------------------- | ------ | --------------------------- |
| `/auth/login`       | POST   | User authentication         |
| `/users/me`         | GET    | Get current user details    |
| `/users/me/profile` | GET    | Get aggregated user profile |

### Request Format

```javascript
// With JWT token
fetch(`${API_BASE_URL}/endpoint`, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

### Response Format

```javascript
// Success
{
  success: true,
  data: { ... },
  message: "Success message"
}

// Error
{
  success: false,
  error: "Error message",
  code: "ERROR_CODE"
}
```

### Error Handling

- **401 Unauthorized**: Clear token, show login
- **Network error**: Show error, retry with exponential backoff
- **500 Server error**: Log error, show notification

## Storage

### chrome.storage.local

| Key                | Type    | Description              | Duration     |
| ------------------ | ------- | ------------------------ | ------------ |
| `authToken`        | string  | JWT authentication token | Until logout |
| `profile`          | object  | Cached user profile      | 5 minutes    |
| `profileTimestamp` | number  | Cache timestamp (ms)     | With profile |
| `enabled`          | boolean | Extension enabled state  | Persistent   |
| `apiEndpoint`      | string  | API base URL             | Persistent   |

### Data Lifecycle

```javascript
// Set data
chrome.storage.local.set({ key: value });

// Get data
chrome.storage.local.get(['key'], (result) => {
  const value = result.key;
});

// Remove data
chrome.storage.local.remove(['key']);

// Clear all
chrome.storage.local.clear();
```

## Security Considerations

### 1. Token Storage

- JWT tokens stored in `chrome.storage.local` (encrypted by browser)
- Tokens cleared on logout
- Automatic clearing on 401 errors

### 2. Content Security Policy (CSP)

- No `eval()` or inline scripts
- All scripts loaded from extension files
- No external script loading

### 3. Permissions

- **Minimal permissions**: Only `storage` and `activeTab`
- **Host permissions**: Only for API endpoints
- **No broad access**: No `<all_urls>` in permissions

### 4. Data Sanitization

- All user input sanitized before API requests
- All API responses validated before use
- DOM manipulation uses textContent (not innerHTML)

### 5. HTTPS

- Production API must use HTTPS
- No mixed content

## Performance Optimization

### 1. Debouncing

- Input events debounced (300ms)
- Prevents excessive API calls

### 2. Caching

- Profile cached for 5 minutes
- Reduces API load
- Faster suggestion display

### 3. Lazy Processing

- Fields processed on-demand
- Only visible fields processed
- Dynamic fields processed as they appear

### 4. Memory Management

- Dropdowns removed when fields removed
- MutationObserver cleaned up
- Event listeners properly removed

### 5. Throttling

- Scroll/resize events throttled
- Prevents excessive repositioning

## Testing

### Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] Login works with valid credentials
- [ ] Login fails with invalid credentials
- [ ] Profile data fetched successfully
- [ ] Fields detected on various websites
- [ ] Dropdown appears on focus
- [ ] Suggestions displayed correctly
- [ ] Click-to-fill works
- [ ] Keyboard navigation works (arrows, enter, esc)
- [ ] Dropdown repositions on scroll
- [ ] Dynamic forms detected
- [ ] Keyboard shortcuts work
- [ ] Profile refresh works
- [ ] Enable/disable toggle works
- [ ] Logout works
- [ ] No console errors

### Test Websites

**E-commerce**:

- Amazon checkout
- eBay registration

**Social Media**:

- Facebook signup
- LinkedIn profile
- Twitter settings

**Job Portals**:

- Indeed applications
- LinkedIn Jobs

**Government**:

- USCIS forms
- State DMV sites

**Email**:

- Gmail compose
- Outlook settings

**Forms**:

- Google Forms
- Microsoft Forms
- Typeform

**Development**:

- GitHub settings
- GitLab profile

### Browser Compatibility

Tested on:

- Chrome 120+ (Manifest V3)
- Chromium-based browsers (Edge, Brave, Opera)

Not supported:

- Firefox (different extension API)
- Safari (different extension API)

## Debugging

### Chrome DevTools

1. **Content Script Debugging**

   ```
   1. Open website
   2. Press F12
   3. Check Console tab for errors
   4. Use Sources tab to set breakpoints in content-script.js
   ```

2. **Background Script Debugging**

   ```
   1. Go to chrome://extensions/
   2. Find IntelliFill
   3. Click "Service worker" link
   4. DevTools opens for background script
   ```

3. **Popup Debugging**
   ```
   1. Right-click extension icon
   2. Select "Inspect"
   3. DevTools opens for popup
   ```

### Logging

```javascript
// Content scripts
console.log('IntelliFill:', message);

// Background script
console.log('IntelliFill Background:', message);

// Popup
console.log('IntelliFill Popup:', message);
```

### Common Issues

1. **Suggestions not appearing**
   - Check if authenticated
   - Check if profile has data
   - Check field name matching
   - Check console for errors

2. **Extension not loading**
   - Check manifest.json syntax
   - Check file paths
   - Check permissions
   - Reload extension

3. **API errors**
   - Check network tab
   - Verify API endpoint
   - Check authentication token
   - Verify CORS settings

## Building for Production

### 1. Update Manifest

```json
{
  "host_permissions": ["https://api.intellifill.com/*"]
}
```

### 2. Generate Icons

- Create proper 16x16, 48x48, 128x128 PNG icons
- Replace placeholder icons

### 3. Test Thoroughly

- Test on 20+ websites
- Test all features
- Check for console errors
- Verify performance

### 4. Prepare Store Assets

- 5 screenshots (1280x800 or 640x400)
- Promotional images
- Detailed description
- Privacy policy

### 5. Package Extension

```bash
# Create ZIP for Chrome Web Store
cd extension
zip -r ../intellifill-extension-v1.0.0.zip * -x "*.DS_Store" -x "node_modules/*"
```

### 6. Submit to Chrome Web Store

1. Create developer account ($5 fee)
2. Upload ZIP file
3. Fill in store listing details
4. Submit for review (1-3 days)

## Chrome Web Store Requirements

### Manifest Requirements

- ✅ Manifest V3
- ✅ Clear, concise description
- ✅ Minimal permissions
- ✅ No obfuscated code
- ✅ No remote code execution

### Code Requirements

- ✅ No eval() or Function() constructor
- ✅ No inline scripts (CSP compliant)
- ✅ All scripts bundled with extension
- ✅ No external libraries loaded at runtime

### Privacy Requirements

- ✅ Privacy policy published
- ✅ Clear explanation of data usage
- ✅ No tracking without user consent
- ✅ Secure data handling

### UI Requirements

- ✅ Professional icons
- ✅ Clear, user-friendly interface
- ✅ Helpful error messages
- ✅ Accessible design

## Future Enhancements

### Planned Features

- [ ] Multi-language support (i18n)
- [ ] Custom field mappings
- [ ] Form templates
- [ ] Bulk autofill
- [ ] Sync across devices
- [ ] AI-powered field matching
- [ ] Address autocomplete with Google Maps
- [ ] Credit card field support (PCI compliant)
- [ ] Password manager integration
- [ ] Export/import profiles
- [ ] Offline mode with IndexedDB
- [ ] Analytics dashboard

### Performance Improvements

- [ ] IndexedDB for larger profile data
- [ ] Web Workers for heavy computation
- [ ] Virtual scrolling for large dropdowns
- [ ] Intersection Observer for field detection
- [ ] Service Worker caching strategies

### Developer Experience

- [ ] TypeScript migration
- [ ] Build system (Webpack/Rollup)
- [ ] Automated testing (Jest, Playwright)
- [ ] CI/CD pipeline
- [ ] Linting and formatting
- [ ] Component library
- [ ] Hot module replacement

## Contributing

### Setup Development Environment

1. Clone repository

```bash
git clone https://github.com/yourorg/intellifill.git
cd intellifill/extension
```

2. Load extension in Chrome

```
chrome://extensions/ → Load unpacked → Select extension folder
```

3. Make changes and reload

```
chrome://extensions/ → Click reload icon
```

### Code Style

- Use ES6+ features
- Clear, descriptive names
- Comment complex logic
- Follow existing patterns
- No external dependencies (keep it vanilla JS)

### Submitting Changes

1. Fork repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Content Scripts Documentation](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)

## License

See LICENSE file in repository root.
