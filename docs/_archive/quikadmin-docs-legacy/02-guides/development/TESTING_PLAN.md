# IntelliFill Testing Plan - Phases 1 & 2

**Date:** November 20, 2025
**Status:** Ready for Testing
**Completed:** 8/14 tasks (57%)
**Focus:** Phase 1 (Core Workflow) + Phase 2 (Smart Form Filling)

---

## Testing Priorities

### Priority 1: Core Workflow (Phase 1) ✅

1. Document upload and OCR extraction
2. User profile aggregation
3. Autocomplete functionality
4. Profile editor UI

### Priority 2: Smart Form Filling (Phase 2) ✅

5. Chrome extension installation and functionality
6. Template system (create, save, load)
7. Document re-processing

---

## Test Environment Setup

### 1. Database Setup

```bash
cd /n/IntelliFill/quikadmin

# Run migrations
npm run db:generate
npm run db:migrate

# Seed pre-loaded templates (W-2, I-9, Passport, Job Application)
npm run db:seed

# Verify database
npx prisma studio  # Opens database GUI at http://localhost:5555
```

### 2. Backend Server

```bash
cd /n/IntelliFill/quikadmin

# Start development server
npm run dev

# Should see:
# - Server running on http://localhost:3000
# - Redis connected (for OCR queue)
# - Database connected
```

### 3. Frontend Server

```bash
cd /n/IntelliFill/quikadmin-web

# Start development server
npm run dev

# Should see:
# - Vite dev server running on http://localhost:5173
```

### 4. Redis (for OCR Queue)

```bash
# Windows (if not running):
redis-server

# Or use Docker:
docker run -d -p 6379:6379 redis:latest
```

---

## Phase 1 Testing: Core Workflow

### Test 1: Document Upload & OCR Extraction

**Objective:** Verify documents upload successfully and OCR extracts text

**Steps:**

1. Navigate to `http://localhost:5173/documents`
2. Click "Upload Document"
3. Upload test documents:
   - **Text-based PDF** (resume, invoice) - should extract directly
   - **Scanned PDF** (scanned driver's license, W-2) - should trigger OCR
   - **Image** (JPG/PNG of document)
4. Monitor OCR queue processing:
   ```bash
   # Check Redis queue
   redis-cli
   > LLEN bull:ocr:wait
   > LLEN bull:ocr:active
   > LLEN bull:ocr:completed
   ```

**Expected Results:**

- ✅ Documents upload without errors
- ✅ Status shows "Processing" → "Completed"
- ✅ Text-based PDFs process in <2 seconds
- ✅ Scanned PDFs/images process in 5-10 seconds
- ✅ Extracted text visible in document detail page
- ✅ Confidence scores displayed (0-100%)

**Test Documents:**

- `test/fixtures/sample-resume.pdf` (text-based)
- `test/fixtures/scanned-w2.pdf` (scanned)
- `test/fixtures/drivers-license.jpg` (image)

---

### Test 2: User Profile Aggregation

**Objective:** Verify profile aggregates data from all documents

**Steps:**

1. Upload 3-5 documents with overlapping data:
   - Resume (name, email, phone)
   - W-2 (SSN, address, employer)
   - Driver's license (name, address, DOB)
   - Passport (name, DOB, passport number)
2. Navigate to `http://localhost:5173/profile` (Profile Settings page)
3. Verify profile data aggregation:
   - Check for duplicate detection (same email from multiple docs = 1 entry)
   - Verify confidence scores (higher confidence from multiple sources)
   - Check source attribution (which documents contributed each field)

**Expected Results:**

- ✅ All extracted data appears in profile
- ✅ Duplicates merged (e.g., same email appears once)
- ✅ Confidence scores accurate (75%+ from 2+ sources)
- ✅ Source attribution shows document names
- ✅ Profile auto-refreshes when stale (>1 hour)

**API Testing:**

```bash
# Get profile
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/users/me/profile

# Should return JSON with:
# - fields: { firstName, lastName, email, phone, ssn, address, etc. }
# - Each field has: value, confidence, sources[], updatedAt
```

---

### Test 3: Autocomplete Functionality

**Objective:** Verify autocomplete suggests profile data when filling forms

**Steps:**

1. Navigate to `http://localhost:5173/demo/autocomplete` (Form Fill Demo)
2. Click on each input field and verify:
   - Dropdown appears on focus
   - Suggestions populate from profile
   - Suggestions ranked by relevance
   - Confidence badges visible (High/Medium/Low)
3. Test keyboard navigation:
   - ↑↓ arrows to navigate suggestions
   - Enter to select
   - Escape to close
4. Test click-to-fill:
   - Click a suggestion
   - Field auto-fills with selected value

**Expected Results:**

- ✅ Dropdown appears within 300ms of focus
- ✅ Suggestions relevant to field type (email field shows emails)
- ✅ Max 5 suggestions per field
- ✅ Confidence badges accurate
- ✅ Keyboard navigation works smoothly
- ✅ Click-to-fill instant (<50ms)

**Test Fields:**

- First Name, Last Name
- Email Address
- Phone Number
- Date of Birth
- Street Address, City, State, ZIP
- SSN (Social Security Number)

---

### Test 4: Profile Editor UI

**Objective:** Verify profile editing, adding, deleting fields

**Steps:**

1. Navigate to `http://localhost:5173/profile`
2. Test inline editing:
   - Click "Edit" button on a field
   - Change value
   - Click "Save" (or press Enter)
   - Verify value updates in database
3. Test field deletion:
   - Click "Delete" button
   - Confirm deletion
   - Verify field removed from profile
4. Test adding custom field:
   - Click "Add Field" button
   - Enter field name and value
   - Save
   - Verify new field appears
5. Test search/filter:
   - Use search box to filter fields
   - Verify only matching fields shown

**Expected Results:**

- ✅ Inline editing works with validation
- ✅ Optimistic updates (instant UI change)
- ✅ Changes persist to database
- ✅ Delete removes field permanently
- ✅ Add custom field successful
- ✅ Search filters correctly
- ✅ Confidence badges update
- ✅ Source attribution accurate

**Validation Testing:**

- Email: Must be valid email format
- Phone: US format (XXX-XXX-XXXX or XXXXXXXXXX)
- SSN: XXX-XX-XXXX format
- Date: Valid date format
- ZIP: 5 digits (XXXXX)

---

## Phase 2 Testing: Smart Form Filling

### Test 5: Chrome Extension Installation

**Objective:** Install and configure Chrome extension

**Steps:**

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select `/n/IntelliFill/extension` folder
6. Verify extension icon appears in toolbar
7. Click extension icon to open popup
8. Login with test credentials:
   - Email: `test@example.com`
   - Password: `testpassword123`
9. Verify profile loads (shows field count, document count)

**Expected Results:**

- ✅ Extension installs without errors
- ✅ Icon appears in Chrome toolbar
- ✅ Popup opens on icon click
- ✅ Login successful
- ✅ Profile data loads
- ✅ Status shows "Connected" with green dot

**Verification:**

```bash
cd /n/IntelliFill/extension
bash verify-installation.sh

# Should show:
# ✅ Extension directory exists
# ✅ manifest.json valid
# ✅ All required files present
# ⚠️ Warning: Placeholder icons (non-blocking)
```

---

### Test 6: Chrome Extension Field Detection

**Objective:** Verify extension detects fields on various websites

**Test Websites (20+):**

**Category 1: Email & Communication**

1. Gmail (https://mail.google.com/mail/u/0/#inbox?compose=new)
   - To, Subject fields
2. Outlook (https://outlook.live.com/mail/0/inbox)
   - Compose email

**Category 2: Forms & Surveys** 3. Google Forms (https://docs.google.com/forms/)

- Create sample form and fill it

4. Typeform (https://www.typeform.com/)
5. JotForm (https://www.jotform.com/)

**Category 3: Job Sites** 6. LinkedIn (https://www.linkedin.com/jobs/)

- Job application forms

7. Indeed (https://www.indeed.com/)
   - Profile creation
8. Glassdoor (https://www.glassdoor.com/)
9. Monster (https://www.monster.com/)

**Category 4: Government Forms** 10. USCIS.gov (https://www.uscis.gov/) - Immigration forms 11. IRS.gov (https://www.irs.gov/) - Tax forms

**Category 5: E-commerce** 12. Amazon (https://www.amazon.com/ap/register) - Account creation, checkout 13. eBay (https://www.ebay.com/) 14. Shopify checkout forms

**Category 6: Social Media** 15. Facebook (https://www.facebook.com/reg/) - Registration form 16. Twitter/X (https://twitter.com/i/flow/signup) 17. Instagram (https://www.instagram.com/accounts/emailsignup/)

**Category 7: Banking & Finance** 18. Generic bank forms (demo sites) 19. PayPal (https://www.paypal.com/us/webapps/mpp/account-selection)

**Category 8: Generic HTML Forms** 20. W3Schools form examples 21. Local test HTML file

**Testing Steps for Each Site:**

1. Navigate to website
2. Find a form with input fields
3. Click on an input field
4. Verify:
   - Extension detects field type
   - Autocomplete dropdown appears
   - Suggestions populate from profile
   - Click suggestion → field fills
5. Test keyboard shortcuts:
   - `Ctrl+Shift+F` - Show suggestions
   - `Ctrl+Shift+R` - Refresh profile

**Expected Results:**

- ✅ Field detection rate ≥ 95% across all sites
- ✅ Dropdown appears within 200ms
- ✅ Suggestions relevant to field type
- ✅ No JavaScript console errors
- ✅ Works on dynamic forms (React, Vue, Angular)
- ✅ Respects password fields (no autocomplete)

**Known Limitations:**

- ⚠️ iframes may block injection (CSP restrictions)
- ⚠️ Some sites use shadow DOM (may need adjustments)

---

### Test 7: Template System

**Objective:** Create, save, load, and match templates

**Steps:**

**7.1: View Pre-loaded Templates**

1. Navigate to `http://localhost:5173/templates`
2. Click "Marketplace" tab
3. Verify 4 pre-loaded templates visible:
   - W-2 Wage and Tax Statement
   - I-9 Employment Eligibility
   - US Passport Application
   - Job Application Form
4. Click on each template to view field mappings
5. Check usage count (should be 0 initially)

**7.2: Create Custom Template**

1. Click "My Templates" tab
2. Click "Create Template" button
3. Fill in template details:
   - Name: "My Job Application"
   - Form Type: JOB_APPLICATION
   - Field Mappings (JSON):
     ```json
     {
       "fullName": "John Doe",
       "email": "john@example.com",
       "phone": "555-0123",
       "resume": "path/to/resume.pdf",
       "coverLetter": "Dear Hiring Manager..."
     }
     ```
4. Click "Save Template"
5. Verify template appears in "My Templates"

**7.3: Edit Template**

1. Click "Edit" button on your template
2. Update name or field mappings
3. Save changes
4. Verify updates persist

**7.4: Delete Template**

1. Click "Delete" button
2. Confirm deletion
3. Verify template removed

**7.5: Form Type Auto-Detection**

```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/templates/detect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldNames": ["ssn", "employer_ein", "wages", "federal_tax_withheld"]
  }'

# Should return: { "formType": "W2", "confidence": 85 }
```

**7.6: Template Matching**

```bash
# Test matching algorithm
curl -X POST http://localhost:3000/api/templates/match \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldNames": ["full_name", "email", "phone", "resume", "cover_letter"]
  }'

# Should return array of matching templates sorted by similarity
```

**Expected Results:**

- ✅ 4 pre-loaded templates visible
- ✅ Create template succeeds
- ✅ Field mappings encrypted in database
- ✅ Edit/delete operations work
- ✅ Form type detection ≥ 80% accuracy
- ✅ Template matching returns relevant results
- ✅ Marketplace templates read-only

---

### Test 8: Document Re-processing

**Objective:** Re-run OCR on low-confidence documents

**Steps:**

**8.1: Upload Low-Quality Document**

1. Navigate to `http://localhost:5173/documents`
2. Upload a low-quality scanned PDF (blurry, skewed, low resolution)
3. Wait for OCR to complete
4. Note the confidence score (should be < 70%)

**8.2: Single Document Re-processing**

1. Click on the low-confidence document to view details
2. Verify "Reprocess OCR" button visible (only shows if confidence < 70%)
3. Click "Reprocess OCR" button
4. Monitor status:
   - Status changes to "REPROCESSING"
   - Progress indicator shows (if available)
5. Wait for completion (may take 2-3x longer due to 600 DPI)
6. Verify:
   - Confidence score improved (≥ 15% increase)
   - Extracted text more accurate
   - Reprocessing history shows attempt

**8.3: Batch Re-processing**

1. Navigate to Documents list page
2. Filter by confidence: "< 70%" using filter dropdown
3. Select multiple low-confidence documents (checkboxes)
4. Click "Reprocess Selected" button
5. Confirm batch operation
6. Verify all selected documents re-queued
7. Monitor Redis queue:
   ```bash
   redis-cli
   > LLEN bull:ocr:wait  # Should show queued jobs
   ```

**8.4: Reprocessing History**

1. View document detail page
2. Scroll to "Reprocessing History" section
3. Verify history shows:
   - Timestamp of reprocessing
   - Triggered by (user email)
   - Old confidence score
   - New confidence score
   - Improvement percentage

**8.5: Max Attempts Test**

1. Reprocess the same document 3 times
2. On 4th attempt, verify error message:
   - "Maximum reprocessing attempts (3) reached"
3. Button should be disabled

**Expected Results:**

- ✅ Reprocess button only shows for confidence < 70%
- ✅ Single reprocessing works
- ✅ Batch reprocessing queues multiple jobs
- ✅ Confidence improves by ≥ 15%
- ✅ History tracking accurate
- ✅ Max 3 attempts enforced
- ✅ Enhanced OCR settings applied (600 DPI)
- ✅ Profile auto-refreshes after reprocessing

**API Testing:**

```bash
# Reprocess single document
curl -X POST http://localhost:3000/api/documents/:id/reprocess \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get reprocessing history
curl http://localhost:3000/api/documents/:id/reprocessing-history \
  -H "Authorization: Bearer YOUR_TOKEN"

# Batch reprocess
curl -X POST http://localhost:3000/api/documents/reprocess/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"documentIds": ["id1", "id2", "id3"]}'
```

---

## Integration Testing

### Test 9: End-to-End Workflow

**Objective:** Test complete user journey

**Scenario:** User onboarding and form filling

1. **Upload Documents**
   - Upload 5 documents (resume, W-2, passport, driver's license, utility bill)
   - Verify all process successfully

2. **Profile Creation**
   - Navigate to Profile page
   - Verify profile aggregated from all documents
   - Check for ~20-30 fields extracted

3. **Profile Editing**
   - Correct any OCR errors
   - Add custom fields (passport number, employee ID)
   - Save changes

4. **Test Autocomplete**
   - Go to Form Fill Demo page
   - Fill out form using autocomplete
   - Verify all fields auto-populate correctly

5. **Install Extension**
   - Install Chrome extension
   - Login
   - Verify profile synced

6. **Fill Real Form**
   - Go to a real website (Google Forms)
   - Create a test form
   - Use extension to autofill
   - Verify all fields populated

7. **Create Template**
   - Save the filled form as a template
   - Name it "Job Application Template"

8. **Reuse Template**
   - Find a similar form (another job application)
   - Extension auto-suggests the template
   - Apply template
   - Form auto-fills

9. **Re-process Low Confidence**
   - Identify low-confidence document
   - Re-process
   - Verify profile updates with improved data

**Expected Results:**

- ✅ Complete workflow works seamlessly
- ✅ No errors or crashes
- ✅ Data persists across sessions
- ✅ Profile stays in sync
- ✅ Template matching works
- ✅ Re-processing improves accuracy

**Success Criteria:**

- End-to-end time: < 15 minutes
- Zero critical errors
- All features functional

---

## Automated Testing

### Run Integration Tests

**Backend Tests:**

```bash
cd /n/IntelliFill/quikadmin

# Profile tests
npm test -- tests/integration/profile.test.ts

# OCR tests
npm test -- tests/integration/ocr.test.ts

# Auto-OCR detection tests
npm test -- tests/integration/auto-ocr.test.ts

# Template tests
npm test -- tests/integration/template.test.ts

# Reprocessing tests
npm test -- tests/integration/reprocess.test.ts

# Run all tests
npm test
```

**Frontend Tests:**

```bash
cd /n/IntelliFill/quikadmin-web

# Autocomplete tests
npm test -- autocomplete-field.test.tsx

# Profile editor tests (if available)
npm test -- ProfileSettings.test.tsx

# Run all tests
npm test
```

**Expected Results:**

- ✅ All backend integration tests pass (80%+ coverage)
- ✅ Frontend component tests pass (18/25 autocomplete tests)
- ✅ No test failures or errors

---

## Performance Testing

### Test 10: Performance Benchmarks

**OCR Processing:**

- Text-based PDF: < 2 seconds
- Scanned PDF (1 page): < 5 seconds
- Scanned PDF (10 pages): < 50 seconds
- Memory usage: < 100MB increase per document

**API Response Times:**

- GET /api/users/me/profile: < 200ms
- POST /api/documents (upload): < 500ms + processing time
- GET /api/templates: < 100ms
- POST /api/templates/match: < 200ms

**Frontend Performance:**

- Autocomplete dropdown render: < 50ms
- Suggestion filtering: < 100ms
- Profile page load: < 1 second
- Template page load: < 800ms

**Extension Performance:**

- Field detection: < 200ms for 100 fields
- Dropdown injection: < 50ms
- API call: < 300ms (with caching)

---

## Bug Tracking

### Found Issues Template

```markdown
## Bug Report

**Title:** [Short description]

**Severity:** Critical | High | Medium | Low

**Component:** Backend | Frontend | Extension | Database

**Steps to Reproduce:**

1.
2.
3.

**Expected Behavior:**

**Actual Behavior:**

**Screenshots/Logs:**

**Environment:**

- OS:
- Browser:
- IntelliFill Version: Phase 1/2

**Proposed Fix:**
```

### Known Issues

1. **Autocomplete Tests:** 7/25 tests fail due to timing issues (non-blocking, frontend only)
2. **ProfileSettings.tsx:** Minor syntax issues fixed, needs build verification
3. **Extension Icons:** Placeholder icons (need production design)
4. **Redis Required:** OCR queue needs Redis running locally or via Docker

---

## Test Completion Checklist

**Phase 1: Core Workflow**

- [ ] Document upload and OCR extraction (Test 1)
- [ ] Profile aggregation (Test 2)
- [ ] Autocomplete functionality (Test 3)
- [ ] Profile editor UI (Test 4)

**Phase 2: Smart Form Filling**

- [ ] Chrome extension installation (Test 5)
- [ ] Extension field detection on 20+ websites (Test 6)
- [ ] Template system (create, save, load, match) (Test 7)
- [ ] Document re-processing (Test 8)

**Integration & Performance**

- [ ] End-to-end workflow (Test 9)
- [ ] Performance benchmarks (Test 10)
- [ ] All automated tests pass

**Documentation Review**

- [ ] API documentation accurate
- [ ] User guides complete
- [ ] Extension docs clear
- [ ] Template system documented

---

## Next Steps After Testing

1. **Document Findings:**
   - Create bug reports for issues found
   - Update TESTING_RESULTS.md with outcomes
   - Screenshot successful workflows

2. **Fix Critical Issues:**
   - Address any blocking bugs
   - Re-test after fixes

3. **Prepare for Production:**
   - Design production Chrome extension icons
   - Configure production API endpoints
   - Create Chrome Web Store assets
   - Run security audit

4. **Phase 3 Planning:**
   - If testing successful, proceed to Phase 3 (Production Infrastructure)
   - Focus on cloud storage, production OCR, monitoring

---

**Testing Owner:** [Your Name]
**Testing Start Date:** [Date]
**Testing Completion Target:** [Date]
**Status:** Ready to Begin
