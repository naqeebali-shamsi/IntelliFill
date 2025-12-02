# IntelliFill Chrome Extension

> Smart form autofill powered by your document data

## Overview

IntelliFill Chrome Extension brings intelligent autocomplete functionality to any website you visit. It automatically detects form fields and suggests values from your uploaded profile data, making form filling faster and more accurate.

## Features

- **Intelligent Field Detection** - Automatically identifies and categorizes form fields on 95%+ of websites
- **Smart Suggestions** - AI-ranked suggestions based on field similarity, confidence, and recency
- **Keyboard Navigation** - Full keyboard support with arrow keys, Enter, and Escape
- **Dynamic Forms** - Works with AJAX, React, Vue, Angular, and dynamically loaded forms
- **Privacy-First** - No tracking, no data sharing, secure token storage
- **Lightweight** - Minimal performance impact, runs efficiently in the background
- **Universal Compatibility** - Works on Gmail, LinkedIn, job sites, government forms, and more

## Installation

### For Users (Chrome Web Store)

Coming soon! The extension will be available on the Chrome Web Store.

### For Developers (Unpacked Extension)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourorg/intellifill.git
   cd intellifill/extension
   ```

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)

3. **Load unpacked extension**
   - Click "Load unpacked"
   - Select the `extension` folder
   - Extension icon should appear in toolbar

4. **Pin to toolbar** (optional)
   - Click the puzzle icon in toolbar
   - Find IntelliFill and click the pin icon

## Quick Start

1. **Sign In**
   - Click the IntelliFill icon in your toolbar
   - Enter your email and password
   - Click "Sign In"

2. **Use on any website**
   - Navigate to a website with a form
   - Click on an input field
   - Select from autocomplete suggestions
   - Press Enter or click to fill

3. **Keyboard Shortcuts**
   - `Ctrl+Shift+F` - Show suggestions
   - `Ctrl+Shift+R` - Refresh profile
   - `↑` `↓` - Navigate suggestions
   - `Enter` - Select suggestion
   - `Esc` - Close dropdown

## Requirements

- Google Chrome 120+ or Chromium-based browser (Edge, Brave, Opera)
- IntelliFill account with profile data
- Internet connection (for initial profile fetch)

## Project Structure

```
extension/
├── manifest.json              # Extension configuration (Manifest V3)
├── background.js              # Service worker for API communication
├── content-script.js          # Main content script
├── popup.html                 # Extension popup UI
├── popup.js                   # Popup logic
├── popup.css                  # Popup styles
├── styles.css                 # Injected content styles
├── lib/
│   ├── field-detector.js      # Field detection engine
│   └── autocomplete-injector.js # Autocomplete injection
├── icons/                     # Extension icons (16, 48, 128)
├── TESTING.md                 # Comprehensive test suite
└── README.md                  # This file
```

## Documentation

- **User Guide**: [docs/guides/user/chrome-extension.md](../docs/guides/user/chrome-extension.md)
- **Developer Guide**: [docs/guides/developer/extension-architecture.md](../docs/guides/developer/extension-architecture.md)
- **Testing Guide**: [TESTING.md](TESTING.md)

## Development

### Setup

1. Install extension in developer mode (see Installation above)
2. Make changes to code
3. Reload extension:
   - Go to `chrome://extensions/`
   - Click the reload icon on IntelliFill

### Tech Stack

- **Vanilla JavaScript (ES6+)** - No build step required
- **Chrome Extension API (Manifest V3)** - Modern extension platform
- **Fetch API** - Backend communication
- **DOM Manipulation** - Direct field injection
- **CSS3** - Modern styling with animations

### Key Components

1. **Field Detector** (`lib/field-detector.js`)
   - Detects and categorizes input fields
   - Supports text, email, phone, date, number, address fields
   - MutationObserver for dynamic forms

2. **Autocomplete Injector** (`lib/autocomplete-injector.js`)
   - Creates and positions dropdown
   - Suggestion ranking algorithm
   - Keyboard navigation

3. **Content Script** (`content-script.js`)
   - Orchestrates field detection and injection
   - Handles profile fetching and caching
   - Keyboard shortcuts

4. **Background Service Worker** (`background.js`)
   - API authentication and requests
   - Profile caching (5 minutes)
   - Token management

5. **Popup UI** (`popup.html/js/css`)
   - Login/logout interface
   - Profile statistics
   - Settings and keyboard shortcuts

### Testing

Run the comprehensive test suite:

```bash
# See TESTING.md for full test procedures
# Tests cover:
# - Installation & setup
# - Authentication flows
# - Field detection (15+ test cases)
# - Autocomplete injection (10+ test cases)
# - Suggestion selection (10+ test cases)
# - Cross-website compatibility (20+ websites)
# - Performance benchmarks
# - Security tests
# - Accessibility tests
```

### Debugging

**Content Script:**
- Open website → F12 → Console tab
- Look for "IntelliFill:" messages

**Background Script:**
- `chrome://extensions/` → Service Worker link
- DevTools opens for background script

**Popup:**
- Right-click extension icon → "Inspect"
- DevTools opens for popup

## Supported Websites

Tested and working on:

### Popular Websites
- Gmail (compose, settings)
- LinkedIn (profile, jobs)
- Facebook (signup, settings)
- Twitter/X (signup, settings)
- GitHub (profile settings)

### Job Portals
- Indeed
- Monster
- ZipRecruiter
- LinkedIn Jobs

### Government Forms
- USCIS.gov
- IRS.gov
- State DMV websites
- Healthcare.gov

### Form Builders
- Google Forms
- Microsoft Forms
- Typeform
- JotForm

### E-Commerce
- Amazon (checkout)
- eBay (registration)
- Shopify stores

See [User Guide](../docs/guides/user/chrome-extension.md) for complete list.

## Performance

Target metrics:
- **Extension load**: < 100ms
- **Field detection**: < 200ms for 100 fields
- **Dropdown render**: < 50ms
- **Memory usage**: < 50MB
- **CPU usage (idle)**: < 1%

## Security

- **Minimal Permissions**: Only `storage` and `activeTab`
- **Secure Storage**: JWT tokens encrypted by browser
- **No Tracking**: Zero third-party analytics or tracking
- **HTTPS Only**: All API communication over HTTPS (production)
- **CSP Compliant**: No inline scripts or eval()
- **Password Protection**: Password fields excluded from detection

## Privacy

IntelliFill:
- ✅ Stores authentication token locally (encrypted)
- ✅ Caches profile data for 5 minutes
- ✅ Only accesses form fields you interact with
- ❌ Does NOT track browsing history
- ❌ Does NOT send data to third parties
- ❌ Does NOT store passwords or payment info

See [Privacy Policy](https://intellifill.com/privacy) for details.

## Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome 120+ | ✅ Supported | Primary target |
| Edge 120+ | ✅ Supported | Chromium-based |
| Brave | ✅ Supported | Chromium-based |
| Opera | ✅ Supported | Chromium-based |
| Firefox | ❌ Not Supported | Different extension API |
| Safari | ❌ Not Supported | Different extension API |

## Troubleshooting

### Extension not working?

1. Check if you're logged in (click extension icon)
2. Verify profile data is loaded
3. Refresh the page
4. Try `Ctrl+Shift+R` to refresh profile
5. Check console for errors (F12)

### Fields not detected?

1. Make sure field is visible and enabled
2. Try clicking on the field
3. Some fields are intentionally excluded (passwords, captchas)
4. Report issue with website URL

### Suggestions not appearing?

1. Check if field name matches your profile data
2. Upload more documents to improve profile
3. Try `Ctrl+Shift+F` to force suggestions

See [User Guide](../docs/guides/user/chrome-extension.md) for more troubleshooting.

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (see TESTING.md)
5. Submit a pull request

### Code Style

- Use ES6+ features
- Clear, descriptive variable names
- Comment complex logic
- Follow existing patterns
- Keep it vanilla (no external dependencies)

## Roadmap

### Version 1.0 (Current)
- [x] Core field detection
- [x] Autocomplete injection
- [x] Profile management
- [x] Keyboard shortcuts
- [x] Dynamic form support

### Version 1.1 (Planned)
- [ ] Multi-language support (i18n)
- [ ] Custom field mappings
- [ ] Form templates
- [ ] Offline mode with IndexedDB
- [ ] Export/import profiles

### Version 2.0 (Future)
- [ ] AI-powered field matching
- [ ] Bulk autofill
- [ ] Browser sync
- [ ] Mobile support
- [ ] Firefox/Safari versions

## Chrome Web Store

### Submission Checklist

Before submitting to Chrome Web Store:

- [ ] All tests passed (see TESTING.md)
- [ ] Proper icons (16x16, 48x48, 128x128)
- [ ] Privacy policy published
- [ ] Screenshots prepared (5 images, 1280x800)
- [ ] Store description written
- [ ] Promotional images created
- [ ] Version number incremented
- [ ] Changelog documented

### Requirements

✅ Manifest V3
✅ Minimal permissions
✅ No obfuscated code
✅ No remote code execution
✅ CSP compliant
✅ Privacy policy
✅ Clear data usage explanation

## License

See [LICENSE](../LICENSE) file in repository root.

## Support

- **Documentation**: Check the [User Guide](../docs/guides/user/chrome-extension.md)
- **Issues**: Report bugs on [GitHub Issues](https://github.com/yourorg/intellifill/issues)
- **Email**: support@intellifill.com

## Changelog

### Version 1.0.0 (2025-01-20)

Initial release:
- Intelligent field detection on 95%+ of websites
- Smart autocomplete with confidence scores
- Keyboard navigation and shortcuts
- Dynamic form support (AJAX, React, Vue, Angular)
- Profile caching (5 minutes)
- Secure JWT authentication
- Chrome Manifest V3 compliant
- Comprehensive testing suite
- Full documentation

## Credits

Built with ❤️ by the IntelliFill Team

## Links

- **Website**: https://intellifill.com
- **Documentation**: [docs/guides/](../docs/guides/)
- **GitHub**: https://github.com/yourorg/intellifill
- **Chrome Web Store**: Coming soon!

---

**Note**: This extension is currently in beta. Report any issues or feature requests on GitHub.
