---
title: 'Chrome Extension User Guide'
description: 'User guide for installing and using the IntelliFill Chrome Extension for intelligent form autofill'
category: 'tutorials'
lastUpdated: '2025-12-30'
status: 'active'
---

# IntelliFill Chrome Extension - User Guide

## Overview

The IntelliFill Chrome Extension brings intelligent form autofill capabilities to any website you visit. Using your uploaded profile data, it automatically suggests values for form fields, saving you time and reducing typing errors.

## Installation

### From Unpacked Source (Development)

1. **Download the Extension**
   - Navigate to the `extension` folder in the IntelliFill project
   - Or download the extension folder as a ZIP and extract it

2. **Open Chrome Extensions**
   - Open Google Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top-right corner)

3. **Load Unpacked Extension**
   - Click "Load unpacked"
   - Select the `extension` folder
   - The IntelliFill icon should appear in your browser toolbar

4. **Pin the Extension** (Optional)
   - Click the puzzle icon in the toolbar
   - Find IntelliFill and click the pin icon

### From Chrome Web Store (Coming Soon)

Once published, you'll be able to install directly from the Chrome Web Store with one click.

## Getting Started

### 1. Sign In

1. Click the IntelliFill icon in your browser toolbar
2. Enter your email and password
3. Click "Sign In"

Your profile data will be automatically fetched and cached.

### 2. Using Autofill

1. **Navigate to any website** with a form (e.g., Gmail, LinkedIn, job applications)
2. **Click on an input field**
3. **View suggestions** - IntelliFill will display a dropdown with matching values from your profile
4. **Select a suggestion** - Click on a suggestion or use keyboard navigation

### 3. Keyboard Shortcuts

IntelliFill supports several keyboard shortcuts for power users:

| Shortcut       | Action                                   |
| -------------- | ---------------------------------------- |
| `Ctrl+Shift+F` | Force show suggestions for focused field |
| `Ctrl+Shift+R` | Refresh profile data from server         |
| `↑` / `↓`      | Navigate through suggestions             |
| `Enter`        | Select highlighted suggestion            |
| `Esc`          | Close suggestion dropdown                |
| `Tab`          | Close dropdown and move to next field    |

## Features

### Intelligent Field Detection

IntelliFill automatically detects various field types:

- **Text fields** - Names, addresses, descriptions
- **Email fields** - Email addresses
- **Phone fields** - Phone numbers, mobile numbers
- **Date fields** - Birth dates, expiry dates
- **Number fields** - Account numbers, IDs
- **Address fields** - Street, city, state, ZIP codes
- **Select dropdowns** - Predefined options

### Smart Suggestions

Suggestions are ranked by:

1. **Field Name Similarity** (40%) - How closely the field name matches your profile data
2. **Confidence Score** (30%) - How confident we are about the data quality
3. **Recency** (20%) - When the data was last updated
4. **Source Count** (10%) - How many documents contain this value

### Confidence Indicators

Each suggestion shows a confidence badge:

- **High** (Green) - 80%+ confidence, data from multiple recent sources
- **Medium** (Yellow) - 50-79% confidence, data from at least one source
- **Low** (Gray) - Below 50% confidence, older or single-source data

### Dynamic Form Support

IntelliFill works with:

- Static HTML forms
- Dynamically loaded forms (AJAX, React, Vue, Angular)
- Single-page applications (SPAs)
- iFrames and embedded forms
- Modal dialogs and popups

## Supported Websites

IntelliFill has been tested on:

### Email & Communication

- Gmail (compose, settings)
- Outlook.com
- Yahoo Mail

### Social Media

- Facebook (signup, profile)
- LinkedIn (profile, job applications)
- Twitter/X (signup, settings)

### Job Portals

- Indeed (job applications)
- LinkedIn Jobs
- Monster.com
- ZipRecruiter

### Government Forms

- USCIS.gov (immigration forms)
- IRS.gov (tax forms)
- State DMV websites
- Healthcare.gov

### E-Commerce

- Amazon (checkout, address)
- eBay (registration)
- Shopify stores

### Productivity

- Google Forms
- Microsoft Forms
- Typeform
- JotForm

### Development

- GitHub (profile settings)
- GitLab
- Stack Overflow

## Privacy & Security

### Data Storage

- **Local Storage**: Authentication token and cached profile (5-minute cache)
- **No External Tracking**: IntelliFill does not send data to third parties
- **HTTPS Only**: All API communication uses HTTPS (in production)

### Permissions Explained

- **storage** - Store authentication token and cached profile locally
- **activeTab** - Detect form fields on the current tab when you click the extension icon
- **host_permissions** - Communicate with IntelliFill backend API

### What Data is Collected?

IntelliFill only accesses:

- Form field names/labels (to match against your profile)
- Your uploaded profile data (from your documents)

IntelliFill does NOT:

- Track your browsing history
- Collect form data you type
- Send data to third parties
- Store passwords or payment information

## Troubleshooting

### Extension Not Working

**Problem**: Suggestions don't appear

**Solutions**:

1. Check if you're logged in (click extension icon)
2. Verify you have profile data uploaded
3. Refresh the page
4. Try `Ctrl+Shift+R` to refresh profile
5. Check browser console for errors (F12 → Console)

**Problem**: "Not authenticated" error

**Solutions**:

1. Click the extension icon and sign in again
2. Clear browser cache and cookies
3. Check if the backend server is running

### Field Detection Issues

**Problem**: Some fields aren't detected

**Solutions**:

1. Check if the field is visible and enabled
2. Try clicking on the field to trigger detection
3. Some fields may be intentionally excluded (passwords, captchas)

**Problem**: Wrong suggestions appear

**Solutions**:

1. The field name might not match your profile data well
2. Update your profile with more accurate data
3. Use the keyboard shortcut to see all available suggestions

### Performance Issues

**Problem**: Extension slows down the page

**Solutions**:

1. Disable the extension on specific sites (Settings → Manage Extensions)
2. Clear cached profile data
3. Reduce the number of open tabs

## Managing the Extension

### Disable on Specific Sites

1. Click the IntelliFill icon
2. Toggle the "Enabled" switch to OFF
3. Refresh the page

Or right-click the extension icon → "This site"

### Update Profile Data

Your profile data is cached for 5 minutes. To force an update:

1. Click the IntelliFill icon
2. Click the refresh button (↻)
3. Or use `Ctrl+Shift+R` shortcut

### Sign Out

1. Click the IntelliFill icon
2. Scroll to the bottom
3. Click "Sign Out"

## Best Practices

### 1. Keep Profile Updated

Upload new documents regularly to ensure your profile data is current and accurate.

### 2. Review Suggestions

Always review autofilled data before submitting forms, especially for:

- Legal documents
- Financial applications
- Government forms

### 3. Use Keyboard Shortcuts

Learn the keyboard shortcuts for faster form filling:

- `Ctrl+Shift+F` - Quick access to suggestions
- Arrow keys - Navigate suggestions
- Enter - Select and move on

### 4. Confidence Levels

Pay attention to confidence indicators:

- Prefer **High** confidence suggestions
- Verify **Medium** confidence values
- Double-check **Low** confidence entries

## FAQ

### Is IntelliFill free?

Yes, during the beta period. Pricing will be announced before the official release.

### Does it work offline?

Partially. Cached profile data works offline for 5 minutes. A network connection is required to fetch fresh profile data.

### Can I use it on mobile?

Currently, IntelliFill is only available as a Chrome desktop extension. Mobile support is planned for future releases.

### What about Firefox/Safari?

We're starting with Chrome. Firefox and Safari versions are planned based on user demand.

### How is this different from browser autofill?

IntelliFill is smarter:

- Uses your actual document data
- Provides confidence scores
- Works with complex field names
- Supports more field types
- Intelligently ranks suggestions

### Can I share my profile with others?

No, profiles are private and tied to your account.

## Support

### Getting Help

- **Documentation**: Check this guide and the [Developer Guide](../developer/extension-architecture.md)
- **GitHub Issues**: Report bugs or request features
- **Email**: support@intellifill.com (if configured)

### Reporting Issues

When reporting issues, include:

1. Chrome version (`chrome://version/`)
2. Extension version (from `chrome://extensions/`)
3. Website URL where the issue occurs
4. Steps to reproduce
5. Browser console errors (F12 → Console)
6. Screenshot (if applicable)

## Version History

### Version 1.0.0 (Current)

- Initial release
- Support for text, email, phone, date, number fields
- Intelligent suggestion ranking
- Keyboard navigation
- Dynamic form detection
- Profile caching
- Chrome Manifest V3

## What's Next?

Planned features:

- Multi-language support
- Custom field mappings
- Form templates
- Bulk autofill
- Browser sync across devices
- AI-powered field matching
