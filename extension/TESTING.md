# IntelliFill Extension - Testing Guide

## Overview

This document provides comprehensive testing procedures for the IntelliFill Chrome Extension. Follow these tests before considering the extension production-ready.

## Test Environment Setup

### Prerequisites
- Google Chrome 120+ or Chromium-based browser
- IntelliFill backend server running (default: http://localhost:3000)
- Test user account with profile data uploaded
- Internet connection for API communication

### Installation Steps
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder
5. Verify extension appears in toolbar

## Test Categories

### 1. Installation & Setup Tests

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|----------------|--------|
| IS-01 | Load unpacked extension | Extension loads without errors | ⬜ |
| IS-02 | Extension icon appears in toolbar | Icon visible and clickable | ⬜ |
| IS-03 | Click extension icon | Popup opens showing login screen | ⬜ |
| IS-04 | Check manifest version | Manifest V3 detected | ⬜ |
| IS-05 | Check permissions | Only "storage" and "activeTab" requested | ⬜ |
| IS-06 | Browser console check | No errors on extension load | ⬜ |

### 2. Authentication Tests

| Test ID | Test Case | Input | Expected Result | Status |
|---------|-----------|-------|----------------|--------|
| AU-01 | Login with valid credentials | Email: test@example.com<br>Password: test123 | Login successful, main view shown | ⬜ |
| AU-02 | Login with invalid email | Email: invalid@test.com<br>Password: test123 | Error: "Invalid credentials" | ⬜ |
| AU-03 | Login with invalid password | Email: test@example.com<br>Password: wrong | Error: "Invalid credentials" | ⬜ |
| AU-04 | Login with empty fields | Email: (empty)<br>Password: (empty) | Error: "Please enter both email and password" | ⬜ |
| AU-05 | Login with network error | Email: test@example.com<br>Password: test123<br>(Backend offline) | Error: "Network error" | ⬜ |
| AU-06 | Profile data loaded after login | - | Profile fields count > 0 | ⬜ |
| AU-07 | Token stored in chrome.storage | - | Token exists in storage | ⬜ |
| AU-08 | Logout | Click "Sign Out" | Returns to login view, token cleared | ⬜ |
| AU-09 | Token persistence after browser restart | Login → Close browser → Reopen | Still authenticated | ⬜ |
| AU-10 | Auto-logout on 401 error | Expired token | Automatically redirected to login | ⬜ |

### 3. Field Detection Tests

Test on various field types and websites:

| Test ID | Test Case | Field Type | Expected Result | Status |
|---------|-----------|------------|----------------|--------|
| FD-01 | Detect text input | `<input type="text">` | Field detected and processed | ⬜ |
| FD-02 | Detect email input | `<input type="email">` | Field detected as EMAIL type | ⬜ |
| FD-03 | Detect phone input | `<input type="tel">` | Field detected as PHONE type | ⬜ |
| FD-04 | Detect date input | `<input type="date">` | Field detected as DATE type | ⬜ |
| FD-05 | Detect number input | `<input type="number">` | Field detected as NUMBER type | ⬜ |
| FD-06 | Detect textarea | `<textarea>` | Field detected | ⬜ |
| FD-07 | Detect select dropdown | `<select>` | Field detected | ⬜ |
| FD-08 | Ignore password fields | `<input type="password">` | Field NOT detected | ⬜ |
| FD-09 | Ignore hidden fields | `<input type="hidden">` | Field NOT detected | ⬜ |
| FD-10 | Ignore disabled fields | `<input disabled>` | Field NOT detected | ⬜ |
| FD-11 | Detect fields with name attribute | `<input name="email">` | Field identified by name | ⬜ |
| FD-12 | Detect fields with id attribute | `<input id="email">` | Field identified by id | ⬜ |
| FD-13 | Detect fields with placeholder | `<input placeholder="Email">` | Field identified by placeholder | ⬜ |
| FD-14 | Detect fields with aria-label | `<input aria-label="Email">` | Field identified by aria-label | ⬜ |
| FD-15 | Detect fields with associated label | `<label for="email">Email</label>` | Label text extracted | ⬜ |

### 4. Autocomplete Injection Tests

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|----------------|--------|
| AI-01 | Focus on detected field | Dropdown appears with suggestions | ⬜ |
| AI-02 | Dropdown positioning | Dropdown positioned below field | ⬜ |
| AI-03 | Dropdown width | Dropdown matches field width | ⬜ |
| AI-04 | Dropdown z-index | Dropdown appears above other elements | ⬜ |
| AI-05 | Suggestion count | Max 5 suggestions shown | ⬜ |
| AI-06 | Suggestion ranking | Suggestions sorted by relevance | ⬜ |
| AI-07 | Confidence badges | High/Medium/Low badges displayed | ⬜ |
| AI-08 | Source count | "X sources" displayed for multi-source values | ⬜ |
| AI-09 | Empty state | "No suggestions available" shown when no matches | ⬜ |
| AI-10 | Loading state | Loading indicator shown while fetching | ⬜ |

### 5. Suggestion Selection Tests

| Test ID | Test Case | Action | Expected Result | Status |
|---------|-----------|--------|----------------|--------|
| SS-01 | Click on suggestion | Click any suggestion | Field filled with value, dropdown closes | ⬜ |
| SS-02 | Keyboard navigation - Down arrow | Press ↓ | Next suggestion highlighted | ⬜ |
| SS-03 | Keyboard navigation - Up arrow | Press ↑ | Previous suggestion highlighted | ⬜ |
| SS-04 | Keyboard navigation - Enter | Select item → Press Enter | Field filled, dropdown closes | ⬜ |
| SS-05 | Keyboard navigation - Escape | Press Esc | Dropdown closes, field unchanged | ⬜ |
| SS-06 | Keyboard navigation - Tab | Press Tab | Dropdown closes, focus moves to next field | ⬜ |
| SS-07 | Input event triggered | Select suggestion | Input event fires on field | ⬜ |
| SS-08 | Change event triggered | Select suggestion | Change event fires on field | ⬜ |
| SS-09 | Field value updated | Select suggestion | Field.value === suggestion.value | ⬜ |
| SS-10 | Focus returns to field | Select suggestion | Field still focused after selection | ⬜ |

### 6. Filtering Tests

| Test ID | Test Case | Input | Expected Result | Status |
|---------|-----------|-------|----------------|--------|
| FT-01 | Filter by partial match | Type "joh" | Shows "John", "Johnson", etc. | ⬜ |
| FT-02 | Filter case-insensitive | Type "JOHN" | Shows "john", "John", "JOHN" | ⬜ |
| FT-03 | Filter by substring | Type "doe" | Shows "john.doe@email.com" | ⬜ |
| FT-04 | Filter updates on input | Type each letter | Suggestions update in real-time | ⬜ |
| FT-05 | Debounced filtering | Type quickly | Waits 300ms before filtering | ⬜ |
| FT-06 | No matches | Type "xyz123" | Shows "No suggestions available" | ⬜ |
| FT-07 | Clear filter | Delete all input | Shows all suggestions again | ⬜ |

### 7. Dynamic Form Tests

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|----------------|--------|
| DF-01 | Detect AJAX-loaded forms | Form loads after page load | Fields detected and processed | ⬜ |
| DF-02 | Detect React/Vue forms | SPA form components | Fields detected | ⬜ |
| DF-03 | Detect modal forms | Open modal with form | Fields detected | ⬜ |
| DF-04 | Detect iframe forms | Embedded form in iframe | Fields detected (if same origin) | ⬜ |
| DF-05 | Multi-step forms | Navigate to next step | New fields detected | ⬜ |
| DF-06 | Infinite scroll forms | Scroll to load more fields | New fields detected | ⬜ |
| DF-07 | Form field removal | Field removed from DOM | Dropdown cleaned up | ⬜ |

### 8. Keyboard Shortcut Tests

| Test ID | Test Case | Shortcut | Expected Result | Status |
|---------|-----------|----------|----------------|--------|
| KS-01 | Force show suggestions | Focus field → Ctrl+Shift+F | Dropdown appears | ⬜ |
| KS-02 | Refresh profile | Ctrl+Shift+R | Profile refreshed, notification shown | ⬜ |
| KS-03 | Navigate suggestions | ↑↓ keys | Highlighted item changes | ⬜ |
| KS-04 | Select suggestion | Enter key | Field filled | ⬜ |
| KS-05 | Close dropdown | Esc key | Dropdown closes | ⬜ |

### 9. Profile Management Tests

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|----------------|--------|
| PM-01 | Profile cached | Login → Check storage | Profile in chrome.storage.local | ⬜ |
| PM-02 | Cache expiry | Wait 5+ minutes | Profile refetched from API | ⬜ |
| PM-03 | Manual refresh | Click refresh button | Profile refetched immediately | ⬜ |
| PM-04 | Profile stats displayed | Open popup | Field count and document count shown | ⬜ |
| PM-05 | Profile update propagates | Refresh profile | Content scripts get updated data | ⬜ |

### 10. UI/UX Tests

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|----------------|--------|
| UX-01 | Popup dimensions | Open popup | Width: 380px, readable content | ⬜ |
| UX-02 | Popup branding | Open popup | IntelliFill logo and gradient header | ⬜ |
| UX-03 | Loading states | Login, refresh | Spinner shown during loading | ⬜ |
| UX-04 | Error messages | Invalid login | Clear, helpful error messages | ⬜ |
| UX-05 | Toggle switch | Click enable/disable | Visual feedback, state changes | ⬜ |
| UX-06 | Status indicator | Extension active | Green dot pulsing | ⬜ |
| UX-07 | Dropdown styling | Open dropdown | Matches design, readable, accessible | ⬜ |
| UX-08 | Confidence badges | View suggestions | Color-coded badges (green/yellow/gray) | ⬜ |
| UX-09 | Hover effects | Hover over suggestions | Background color changes | ⬜ |
| UX-10 | Focus states | Tab through popup | Clear focus indicators | ⬜ |

### 11. Performance Tests

| Test ID | Test Case | Metric | Target | Status |
|---------|-----------|--------|--------|--------|
| PF-01 | Extension load time | Time to initialize | < 100ms | ⬜ |
| PF-02 | Field detection time | 100 fields on page | < 200ms | ⬜ |
| PF-03 | Dropdown render time | Show suggestions | < 50ms | ⬜ |
| PF-04 | Suggestion filter time | Type in field | < 50ms | ⬜ |
| PF-05 | Memory usage | Extension running | < 50MB | ⬜ |
| PF-06 | CPU usage (idle) | Extension running | < 1% | ⬜ |
| PF-07 | CPU usage (active) | Typing in field | < 5% | ⬜ |
| PF-08 | Network requests | Page load | Only necessary API calls | ⬜ |
| PF-09 | Cache effectiveness | Repeated field focus | No API calls (within 5 min) | ⬜ |
| PF-10 | Page load impact | With vs without extension | < 50ms difference | ⬜ |

### 12. Cross-Website Compatibility Tests

Test the extension on 20+ popular websites:

#### E-commerce Websites
| Website | Test | Result | Notes | Status |
|---------|------|--------|-------|--------|
| Amazon | Checkout form | Fields detected, autofill works | | ⬜ |
| eBay | Registration | Fields detected, autofill works | | ⬜ |
| Etsy | Seller signup | Fields detected, autofill works | | ⬜ |

#### Social Media
| Website | Test | Result | Notes | Status |
|---------|------|--------|-------|--------|
| Facebook | Signup form | Fields detected, autofill works | | ⬜ |
| LinkedIn | Profile edit | Fields detected, autofill works | | ⬜ |
| Twitter/X | Settings | Fields detected, autofill works | | ⬜ |
| Instagram | Signup | Fields detected, autofill works | | ⬜ |

#### Job Portals
| Website | Test | Result | Notes | Status |
|---------|------|--------|-------|--------|
| Indeed | Job application | Fields detected, autofill works | | ⬜ |
| LinkedIn Jobs | Apply | Fields detected, autofill works | | ⬜ |
| Monster | Resume upload | Fields detected, autofill works | | ⬜ |
| ZipRecruiter | Application | Fields detected, autofill works | | ⬜ |

#### Government Forms
| Website | Test | Result | Notes | Status |
|---------|------|--------|-------|--------|
| USCIS.gov | Immigration forms | Fields detected, autofill works | | ⬜ |
| IRS.gov | Tax forms | Fields detected, autofill works | | ⬜ |
| DMV websites | State forms | Fields detected, autofill works | | ⬜ |

#### Email Services
| Website | Test | Result | Notes | Status |
|---------|------|--------|-------|--------|
| Gmail | Compose, settings | Fields detected, autofill works | | ⬜ |
| Outlook | Compose, settings | Fields detected, autofill works | | ⬜ |
| Yahoo Mail | Settings | Fields detected, autofill works | | ⬜ |

#### Form Builders
| Website | Test | Result | Notes | Status |
|---------|------|--------|-------|--------|
| Google Forms | Any form | Fields detected, autofill works | | ⬜ |
| Microsoft Forms | Any form | Fields detected, autofill works | | ⬜ |
| Typeform | Any form | Fields detected, autofill works | | ⬜ |
| JotForm | Any form | Fields detected, autofill works | | ⬜ |

#### Developer Sites
| Website | Test | Result | Notes | Status |
|---------|------|--------|-------|--------|
| GitHub | Profile settings | Fields detected, autofill works | | ⬜ |
| GitLab | Profile settings | Fields detected, autofill works | | ⬜ |
| Stack Overflow | Profile | Fields detected, autofill works | | ⬜ |

### 13. Error Handling Tests

| Test ID | Test Case | Trigger | Expected Result | Status |
|---------|-----------|---------|----------------|--------|
| EH-01 | Network timeout | Slow/no network | Timeout error, retry option | ⬜ |
| EH-02 | API server down | Backend offline | Clear error message | ⬜ |
| EH-03 | Invalid API response | Malformed JSON | Error caught, logged | ⬜ |
| EH-04 | Missing profile data | Profile with no fields | "No suggestions available" | ⬜ |
| EH-05 | Expired token | Old token | Auto-logout, redirect to login | ⬜ |
| EH-06 | CORS error | Wrong origin | Error logged, user notified | ⬜ |
| EH-07 | Storage quota exceeded | Large profile | Error handled gracefully | ⬜ |
| EH-08 | Extension update | Mid-session update | Graceful reload | ⬜ |

### 14. Security Tests

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|----------------|--------|
| SC-01 | Token in storage | Check chrome.storage.local | Token encrypted by browser | ⬜ |
| SC-02 | Token in network requests | Check headers | Bearer token in Authorization | ⬜ |
| SC-03 | Password fields excluded | Check detection | Password fields NOT processed | ⬜ |
| SC-04 | XSS prevention | Malicious profile data | Content escaped, no script execution | ⬜ |
| SC-05 | HTTPS enforcement | API calls | All production calls use HTTPS | ⬜ |
| SC-06 | No external scripts | Check manifest | All scripts bundled | ⬜ |
| SC-07 | CSP compliance | Check inline scripts | No inline scripts or eval() | ⬜ |

### 15. Accessibility Tests

| Test ID | Test Case | Expected Result | Status |
|---------|-----------|----------------|--------|
| AC-01 | Keyboard navigation | Tab through UI | All interactive elements reachable | ⬜ |
| AC-02 | Screen reader support | ARIA attributes | Role="listbox", aria-expanded, etc. | ⬜ |
| AC-03 | Focus indicators | Tab through UI | Clear focus outlines | ⬜ |
| AC-04 | Color contrast | All text | WCAG AA compliance | ⬜ |
| AC-05 | Text scaling | Zoom to 200% | UI remains usable | ⬜ |

## Test Execution

### Test Status Key
- ⬜ Not Started
- 🔄 In Progress
- ✅ Passed
- ❌ Failed
- ⚠️ Partial/Notes

### Running the Tests

1. **Preparation**
   - Install extension in development mode
   - Create test account with sample profile data
   - Start backend server
   - Open browser DevTools console

2. **Execution**
   - Follow tests in order
   - Mark status in checklist
   - Document any issues in Notes column
   - Take screenshots for failed tests

3. **Reporting**
   - Create GitHub issues for failures
   - Include steps to reproduce
   - Attach screenshots/logs
   - Reference test ID

## Automated Testing (Future)

Planned automated tests:
- Unit tests (Jest) for utility functions
- Integration tests for API communication
- E2E tests (Playwright) for user flows
- Visual regression tests
- Performance benchmarks

## Chrome Web Store Pre-Submission Checklist

Before submitting to Chrome Web Store:

- [ ] All critical tests passed (100%)
- [ ] All high-priority tests passed (90%+)
- [ ] Tested on 20+ websites
- [ ] No console errors or warnings
- [ ] Proper icons (16x16, 48x48, 128x128)
- [ ] Privacy policy published
- [ ] Screenshots prepared (5 images)
- [ ] Store description written
- [ ] Promotional images created
- [ ] Version number incremented
- [ ] Changelog documented

## Known Issues

Document known issues here:

| Issue ID | Description | Severity | Workaround | Planned Fix |
|----------|-------------|----------|------------|-------------|
| - | - | - | - | - |

## Browser Compatibility

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | 120+ | ✅ Supported | Primary target |
| Edge | 120+ | 🔄 Testing | Chromium-based |
| Brave | Latest | 🔄 Testing | Chromium-based |
| Opera | Latest | 🔄 Testing | Chromium-based |
| Firefox | - | ❌ Not Supported | Different API |
| Safari | - | ❌ Not Supported | Different API |

## Performance Benchmarks

Target metrics:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Extension load | < 100ms | - | 🔄 |
| Field detection (100 fields) | < 200ms | - | 🔄 |
| Dropdown render | < 50ms | - | 🔄 |
| Memory usage | < 50MB | - | 🔄 |
| CPU usage (idle) | < 1% | - | 🔄 |

## Test Reports

Create dated test reports in this format:

### Test Report: YYYY-MM-DD

**Tester**: [Name]
**Version**: 1.0.0
**Environment**: Chrome 120, Windows 11
**Duration**: 3 hours

**Summary**:
- Total Tests: 200
- Passed: 185 (92.5%)
- Failed: 10 (5%)
- Skipped: 5 (2.5%)

**Critical Issues**: 2
**High Priority Issues**: 5
**Medium Priority Issues**: 3

**Notes**: [Additional observations]

---

## Conclusion

This testing guide ensures the IntelliFill Chrome Extension meets quality standards before release. Complete all tests before considering the extension production-ready.
