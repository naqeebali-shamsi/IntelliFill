# IntelliFill Puppeteer Test Suite

Comprehensive end-to-end testing suite for IntelliFill using Puppeteer MCP (Model Context Protocol) integration.

## 📋 Overview

This test suite provides automated browser testing for all major user scenarios in the IntelliFill application, leveraging Puppeteer MCP tools for reliable and maintainable test automation.

## 🚀 Features

- **Authentication Testing**: Registration, login, logout, password reset, session management
- **Document Upload Testing**: Single/multiple uploads, drag-and-drop, validation, progress tracking
- **Form Filling Testing**: Intelligent field mapping, auto-population, validation, submission
- **Navigation Testing**: Menu navigation, routing, breadcrumbs, deep linking
- **Error Handling**: Network errors, validation errors, timeouts, recovery
- **Performance Testing**: Load times, response times, concurrent operations

## 🛠️ Setup

### Prerequisites

1. Chrome browser with remote debugging enabled:
```bash
# Start Chrome with remote debugging
google-chrome --remote-debugging-port=9222
```

2. IntelliFill application running:
```bash
# Start the application
docker-compose up -d
```

3. Install test dependencies:
```bash
npm install --save-dev jest puppeteer @types/jest
```

## 📁 Test Structure

```
tests/e2e/puppeteer-scenarios/
├── test-config.ts           # Test configuration and selectors
├── test-helpers.ts          # Utility functions using Puppeteer MCP
├── auth.test.ts            # Authentication test scenarios
├── document-upload.test.ts # Document upload test scenarios
├── form-filling.test.ts    # Form filling test scenarios
├── navigation.test.ts      # Navigation test scenarios (to be added)
├── error-handling.test.ts  # Error handling scenarios (to be added)
├── performance.test.ts     # Performance test scenarios (to be added)
├── run-tests.ts           # Test runner and reporter
└── README.md              # This file
```

## 🎯 Using Puppeteer MCP Tools

The test suite uses Puppeteer MCP tools for browser automation:

### Available MCP Tools

- `mcp__puppeteer__puppeteer_connect_active_tab` - Connect to Chrome instance
- `mcp__puppeteer__puppeteer_navigate` - Navigate to URLs
- `mcp__puppeteer__puppeteer_screenshot` - Take screenshots
- `mcp__puppeteer__puppeteer_click` - Click elements
- `mcp__puppeteer__puppeteer_fill` - Fill form fields
- `mcp__puppeteer__puppeteer_select` - Select dropdown options
- `mcp__puppeteer__puppeteer_hover` - Hover over elements
- `mcp__puppeteer__puppeteer_evaluate` - Execute JavaScript in browser

### Example Usage

```typescript
// Connect to browser
await mcp__puppeteer__puppeteer_connect_active_tab({ 
  debugPort: 9222 
});

// Navigate to page
await mcp__puppeteer__puppeteer_navigate({ 
  url: 'http://localhost:3001/login' 
});

// Fill login form
await mcp__puppeteer__puppeteer_fill({ 
  selector: 'input[name="email"]', 
  value: 'user@example.com' 
});

// Click login button
await mcp__puppeteer__puppeteer_click({ 
  selector: 'button[type="submit"]' 
});

// Take screenshot
await mcp__puppeteer__puppeteer_screenshot({ 
  name: 'login-success',
  selector: '.dashboard' 
});
```

## 🧪 Running Tests

### Run All Tests
```bash
npm run test:e2e
```

### Run Specific Test Suite
```bash
npm run test:e2e -- auth.test.ts
```

### Run with Test Runner
```bash
npx ts-node tests/e2e/puppeteer-scenarios/run-tests.ts
```

### Run in Watch Mode
```bash
npm run test:e2e:watch
```

## 📊 Test Scenarios

### Authentication Tests
- ✅ User registration with validation
- ✅ Login with valid/invalid credentials
- ✅ Password reset flow
- ✅ Session management and timeout
- ✅ Role-based access control
- ✅ Remember me functionality

### Document Upload Tests
- ✅ Single file upload
- ✅ Multiple file upload
- ✅ Drag and drop upload
- ✅ File type validation
- ✅ File size validation
- ✅ Upload progress tracking
- ✅ Upload cancellation
- ✅ Metadata extraction

### Form Filling Tests
- ✅ Intelligent field mapping
- ✅ Auto-population of form fields
- ✅ Field validation
- ✅ Manual field editing
- ✅ Confidence level indicators
- ✅ Form submission
- ✅ PDF generation
- ✅ Draft saving

### Navigation Tests (Planned)
- Menu navigation
- Breadcrumb navigation
- Deep linking
- Back/forward navigation
- Protected routes

### Error Handling Tests (Planned)
- Network errors
- API failures
- Validation errors
- Timeout handling
- Error recovery

## 📸 Screenshots

Screenshots are automatically captured for:
- Test failures
- Important test milestones
- Visual regression testing

Screenshots are saved to: `tests/screenshots/`

## 📈 Test Reports

### Console Report
Shows real-time test execution with pass/fail status.

### HTML Report
Generated at: `tests/reports/test-report.html`

Includes:
- Test summary statistics
- Suite-wise results
- Error details
- Execution timing
- Success rate

## 🔧 Configuration

Edit `test-config.ts` to customize:

```typescript
export const TEST_CONFIG = {
  urls: {
    base: 'http://localhost:3001',
    api: 'http://localhost:3000/api'
  },
  browser: {
    debugPort: 9222,
    headless: false,
    slowMo: 50
  },
  waits: {
    short: 1000,
    medium: 3000,
    long: 5000
  }
};
```

## 🐛 Debugging

### Enable Debug Mode
```bash
DEBUG=puppeteer:* npm run test:e2e
```

### Run in Non-Headless Mode
```typescript
// In test-config.ts
browser: {
  headless: false,
  slowMo: 100  // Slow down actions
}
```

### Check Browser Console
```typescript
// In test
const logs = await Helper.checkForConsoleErrors();
console.log('Browser errors:', logs);
```

## 🔐 Test Data

### Test Users
- Admin: `admin@intellifill.test` / `AdminPass123!`
- Standard: `user@intellifill.test` / `UserPass123!`
- New User: `newuser@intellifill.test` / `NewUser123!`

### Test Files
- Sample PDF: `tests/fixtures/sample-invoice.pdf`
- Sample Form: `tests/fixtures/tax-form.pdf`
- Large File: `tests/fixtures/large-document.pdf`
- Invalid File: `tests/fixtures/invalid.txt`

## ✅ Best Practices

1. **Use Page Object Model**: Encapsulate page-specific selectors and actions
2. **Wait for Elements**: Always wait for elements before interacting
3. **Take Screenshots**: Capture evidence for test steps
4. **Clean State**: Clear browser data between tests
5. **Meaningful Assertions**: Use descriptive assertion messages
6. **Error Recovery**: Handle and report errors gracefully
7. **Parallel Execution**: Run independent tests in parallel

## 🤝 Contributing

When adding new tests:

1. Follow the existing test structure
2. Update selectors in `test-config.ts`
3. Add helper functions to `test-helpers.ts`
4. Document test scenarios in this README
5. Ensure tests are independent and repeatable
6. Add appropriate screenshots for verification

## 📝 License

Part of the IntelliFill project - MIT License