---
title: 'IntelliFill Product Requirements Document'
description: 'Core PRD for IntelliFill - Intelligent Form Filling for PRO Agencies'
category: 'reference'
lastUpdated: '2025-12-30'
status: 'active'
---

# IntelliFill - Product Requirements Document

## Document Info

- **Version:** 1.0
- **Last Updated:** 2025-11-28
- **Status:** Active

---

## 1. Overview

### 1.1 Product Name

**IntelliFill** - Intelligent Form Filling for PRO Agencies

### 1.2 Problem Statement

PRO (Public Relations Officer) agencies in the UAE handle company formation and visa processing for multiple clients. Each client requires numerous government forms to be filled with data from their documents (passports, Emirates IDs, trade licenses, etc.).

**Current Pain:**

- Manual data entry from scanned documents into forms
- Repetitive typing of the same client information across multiple forms
- Risk of typos and inconsistencies
- Time-consuming process that doesn't scale

### 1.3 Solution

IntelliFill allows PRO agencies to:

1. Upload client documents once
2. Automatically extract and store client data
3. Instantly auto-fill any form for that client
4. Maintain a permanent client database for repeat use

### 1.4 Target Users

- UAE-based PRO agencies
- Business setup consultants
- Visa processing companies
- Corporate services providers

---

## 2. Core Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTELLIFILL MVP                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CREATE CLIENT                                               │
│     └── "New Client: ABC Trading LLC"                          │
│                                                                 │
│  2. UPLOAD DOCUMENTS                                            │
│     └── Passport, Emirates ID, Trade License                   │
│                                                                 │
│  3. EXTRACT & STORE                                             │
│     └── OCR extracts data → Saved to client profile            │
│     └── User can review and correct extracted data             │
│                                                                 │
│  4. FILL FORMS                                                  │
│     └── Select client → Select form → Auto-fill → Download     │
│                                                                 │
│  5. REPEAT                                                      │
│     └── Client data persists for all future forms              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. User Stories

### 3.1 Client Management

| ID  | Story                                                                  | Priority |
| --- | ---------------------------------------------------------------------- | -------- |
| U1  | As a PRO agent, I can create a new client with basic info (name, type) | P0       |
| U2  | As a PRO agent, I can view a list of all my clients                    | P0       |
| U3  | As a PRO agent, I can search/filter clients by name                    | P1       |
| U4  | As a PRO agent, I can archive inactive clients                         | P2       |
| U5  | As a PRO agent, I can delete a client and all their data               | P1       |

### 3.2 Document Management

| ID  | Story                                                                    | Priority |
| --- | ------------------------------------------------------------------------ | -------- |
| D1  | As a PRO agent, I can upload documents for a client (PDF, images)        | P0       |
| D2  | As a PRO agent, I can view all documents for a client                    | P0       |
| D3  | As a PRO agent, I can categorize documents (Passport, Emirates ID, etc.) | P1       |
| D4  | As a PRO agent, I can delete a document                                  | P1       |
| D5  | As a PRO agent, I can preview uploaded documents                         | P1       |

### 3.3 Data Extraction

| ID  | Story                                                                      | Priority |
| --- | -------------------------------------------------------------------------- | -------- |
| E1  | As a PRO agent, I can trigger OCR extraction on an uploaded document       | P0       |
| E2  | As a PRO agent, I can view extracted data from a document                  | P0       |
| E3  | As a PRO agent, I can edit/correct extracted data                          | P0       |
| E4  | As a PRO agent, I can see extraction confidence scores                     | P2       |
| E5  | As a PRO agent, extracted data is automatically merged into client profile | P0       |

### 3.4 Client Profile (Extracted Data Store)

| ID  | Story                                                                   | Priority |
| --- | ----------------------------------------------------------------------- | -------- |
| P1  | As a PRO agent, I can view all extracted data for a client in one place | P0       |
| P2  | As a PRO agent, I can manually add/edit client data fields              | P0       |
| P3  | As a PRO agent, I can see which document each data field came from      | P1       |
| P4  | As a PRO agent, client data persists across sessions                    | P0       |

### 3.5 Form Templates

| ID  | Story                                                          | Priority |
| --- | -------------------------------------------------------------- | -------- |
| T1  | As a PRO agent, I can upload a fillable PDF form as a template | P0       |
| T2  | As a PRO agent, I can map form fields to client data fields    | P0       |
| T3  | As a PRO agent, I can save form templates for reuse            | P0       |
| T4  | As a PRO agent, I can view a list of my form templates         | P0       |
| T5  | As a PRO agent, I can delete a form template                   | P1       |

### 3.6 Form Filling

| ID  | Story                                                          | Priority |
| --- | -------------------------------------------------------------- | -------- |
| F1  | As a PRO agent, I can select a client and a form template      | P0       |
| F2  | As a PRO agent, I can preview the auto-filled form             | P0       |
| F3  | As a PRO agent, I can manually adjust values before generating | P1       |
| F4  | As a PRO agent, I can download the filled PDF                  | P0       |
| F5  | As a PRO agent, filled forms are saved to client history       | P1       |

### 3.7 Authentication

| ID  | Story                                                | Priority |
| --- | ---------------------------------------------------- | -------- |
| A1  | As a PRO agent, I can register an account            | P0       |
| A2  | As a PRO agent, I can log in securely                | P0       |
| A3  | As a PRO agent, I can reset my password              | P1       |
| A4  | As a PRO agent, my data is isolated from other users | P0       |

---

## 4. Data Model

### 4.1 Entity Relationship

```
┌──────────────┐
│     User     │
│  (Agency)    │
└──────┬───────┘
       │ owns many
       ▼
┌──────────────┐
│    Client    │
│ (Company or  │
│   Person)    │
└──────┬───────┘
       │ has many
       ▼
┌──────────────────────────────────────────────────┐
│                                                  │
│  ┌────────────┐    ┌─────────────────┐          │
│  │  Document  │───▶│  ExtractedData  │          │
│  │  (files)   │    │  (OCR output)   │          │
│  └────────────┘    └────────┬────────┘          │
│                             │                    │
│                             ▼ merges into        │
│                    ┌─────────────────┐          │
│                    │  ClientProfile  │          │
│                    │ (unified data)  │          │
│                    └─────────────────┘          │
│                                                  │
└──────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐
│ FormTemplate │────────▶│  FilledForm  │
│  (reusable)  │ used to │  (output)    │
└──────────────┘ create  └──────────────┘
```

### 4.2 Core Entities

#### User

```typescript
{
  id: string
  email: string
  passwordHash: string
  fullName: string
  companyName?: string  // Agency name
  createdAt: Date
  updatedAt: Date
}
```

#### Client

```typescript
{
  id: string
  userId: string        // Owner (the PRO agent)
  name: string          // "ABC Trading LLC" or "John Smith"
  type: 'company' | 'individual'
  status: 'active' | 'archived'
  notes?: string
  createdAt: Date
  updatedAt: Date
}
```

#### Document

```typescript
{
  id: string
  clientId: string
  userId: string
  fileName: string
  fileType: string      // 'application/pdf', 'image/jpeg', etc.
  fileSize: number
  storageUrl: string
  category?: string     // 'passport', 'emirates_id', 'trade_license', etc.
  status: 'uploaded' | 'processing' | 'extracted' | 'failed'
  createdAt: Date
  updatedAt: Date
}
```

#### ExtractedData

```typescript
{
  id: string
  documentId: string
  clientId: string
  rawText?: string      // Full OCR text
  fields: {             // Structured extracted fields
    [fieldName: string]: {
      value: string
      confidence: number
      source: string    // Which part of document
    }
  }
  status: 'pending' | 'completed' | 'reviewed'
  extractedAt: Date
  reviewedAt?: Date
}
```

#### ClientProfile

```typescript
{
  id: string
  clientId: string
  data: {               // Unified client data from all documents
    // Personal
    fullName?: string
    fullNameArabic?: string
    nationality?: string
    dateOfBirth?: string
    gender?: string

    // Passport
    passportNumber?: string
    passportIssueDate?: string
    passportExpiryDate?: string
    passportIssuePlace?: string

    // Emirates ID
    emiratesId?: string
    emiratesIdExpiry?: string

    // Company (if client is a company)
    tradeLicenseNumber?: string
    tradeLicenseExpiry?: string
    companyNameEn?: string
    companyNameAr?: string
    legalType?: string
    activities?: string[]

    // Contact
    email?: string
    phone?: string
    address?: string

    // Custom fields
    [key: string]: any
  }
  fieldSources: {       // Track which document each field came from
    [fieldName: string]: {
      documentId: string
      extractedAt: Date
      manuallyEdited: boolean
    }
  }
  updatedAt: Date
}
```

#### FormTemplate

```typescript
{
  id: string
  userId: string
  name: string          // "MOL Work Permit Application"
  description?: string
  category?: string     // 'visa', 'company_formation', 'labor', etc.
  fileUrl: string       // The blank PDF form
  fieldMappings: {      // Map form fields to client profile fields
    [formFieldName: string]: string  // e.g., "applicant_name" -> "fullName"
  }
  createdAt: Date
  updatedAt: Date
}
```

#### FilledForm

```typescript
{
  id: string;
  clientId: string;
  templateId: string;
  userId: string;
  fileUrl: string; // The generated filled PDF
  dataSnapshot: object; // Copy of data used at generation time
  createdAt: Date;
}
```

---

## 5. Key Screens (UI)

### 5.1 Screen List

| Screen           | Purpose                             | Priority |
| ---------------- | ----------------------------------- | -------- |
| Login/Register   | Authentication                      | P0       |
| Dashboard        | Overview, quick actions             | P1       |
| Client List      | View/search all clients             | P0       |
| Client Detail    | Single client view with tabs        | P0       |
| ├─ Documents Tab | Upload/view client documents        | P0       |
| ├─ Profile Tab   | View/edit extracted data            | P0       |
| └─ Forms Tab     | Fill forms, view history            | P0       |
| Form Templates   | Manage form templates               | P0       |
| Template Editor  | Map form fields to data fields      | P0       |
| Form Preview     | Preview filled form before download | P0       |

### 5.2 Screen Wireframes (Text)

#### Client List Screen

```
┌─────────────────────────────────────────────────────────────┐
│  IntelliFill                              [User Menu ▼]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Clients                              [+ New Client]        │
│                                                             │
│  [Search clients...]                  [Filter ▼] [Sort ▼]  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📁 ABC Trading LLC                    Company       │   │
│  │    3 documents · Last updated 2 days ago            │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 👤 Mohammed Al Rashid                 Individual    │   │
│  │    5 documents · Last updated today                 │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📁 Gulf Services DMCC                 Company       │   │
│  │    2 documents · Last updated 1 week ago            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Client Detail Screen

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Clients                        [User Menu ▼]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Mohammed Al Rashid                         Individual      │
│  Created: Jan 15, 2025                                      │
│                                                             │
│  ┌────────────┬────────────┬────────────┐                  │
│  │ Documents  │  Profile   │   Forms    │                  │
│  └────────────┴────────────┴────────────┘                  │
│  ─────────────────────────────────────────                  │
│                                                             │
│  [DOCUMENTS TAB CONTENT]                                    │
│                                                             │
│  [+ Upload Document]                                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 📄 passport_scan.pdf              Passport           │  │
│  │    Uploaded Jan 15 · Extracted ✓  [View] [Extract]   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 📄 emirates_id.jpg                Emirates ID        │  │
│  │    Uploaded Jan 15 · Extracted ✓  [View] [Extract]   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Client Profile Tab

```
┌─────────────────────────────────────────────────────────────┐
│  [PROFILE TAB CONTENT]                                      │
│                                                             │
│  Client Data                                    [Edit Mode] │
│                                                             │
│  Personal Information                                       │
│  ├─ Full Name:        Mohammed Al Rashid        📄         │
│  ├─ Name (Arabic):    محمد الراشد               📄         │
│  ├─ Nationality:      United Arab Emirates      📄         │
│  ├─ Date of Birth:    15/03/1985               📄         │
│  └─ Gender:           Male                      📄         │
│                                                             │
│  Passport Details                                           │
│  ├─ Passport No:      A12345678                📄         │
│  ├─ Issue Date:       01/01/2020               📄         │
│  ├─ Expiry Date:      01/01/2030               📄         │
│  └─ Issue Place:      Abu Dhabi                📄         │
│                                                             │
│  Emirates ID                                                │
│  ├─ Emirates ID:      784-1985-1234567-1       📄         │
│  └─ Expiry Date:      15/03/2027               📄         │
│                                                             │
│  📄 = Click to see source document                         │
│                                                             │
│  [+ Add Custom Field]                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Form Filling Flow

```
┌─────────────────────────────────────────────────────────────┐
│  [FORMS TAB CONTENT]                                        │
│                                                             │
│  Fill New Form                                              │
│                                                             │
│  1. Select Form Template                                    │
│     ┌─────────────────────────────────────────────────┐    │
│     │ [Search templates...]                       ▼   │    │
│     ├─────────────────────────────────────────────────┤    │
│     │ ○ MOL Work Permit Application                   │    │
│     │ ● Visa Application Form                         │    │
│     │ ○ Trade License Renewal                         │    │
│     └─────────────────────────────────────────────────┘    │
│                                                             │
│  2. Review Data to Fill                                     │
│     ┌─────────────────────────────────────────────────┐    │
│     │ applicant_name     → Mohammed Al Rashid    ✓    │    │
│     │ passport_number    → A12345678             ✓    │    │
│     │ nationality        → UAE                   ✓    │    │
│     │ sponsor_name       → [Missing - enter]     ⚠    │    │
│     └─────────────────────────────────────────────────┘    │
│                                                             │
│                              [Preview Form] [Generate PDF]  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Form History                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 📄 Visa Application - Jan 16, 2025      [Download]   │  │
│  │ 📄 Work Permit - Jan 10, 2025           [Download]   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Technical Requirements

### 6.1 Stack (Current)

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Zustand
- **Backend:** Node.js, Express, TypeScript, Prisma
- **Database:** PostgreSQL (Neon Serverless)
- **Auth:** Supabase Auth
- **OCR:** Tesseract.js
- **PDF:** pdf-lib

### 6.2 API Endpoints (MVP)

#### Clients

```
POST   /api/clients              Create client
GET    /api/clients              List clients (with search/filter)
GET    /api/clients/:id          Get client details
PUT    /api/clients/:id          Update client
DELETE /api/clients/:id          Delete client
```

#### Documents

```
POST   /api/clients/:clientId/documents     Upload document
GET    /api/clients/:clientId/documents     List client documents
GET    /api/documents/:id                   Get document
DELETE /api/documents/:id                   Delete document
POST   /api/documents/:id/extract           Trigger OCR extraction
```

#### Client Profile

```
GET    /api/clients/:clientId/profile       Get client profile data
PUT    /api/clients/:clientId/profile       Update profile data
```

#### Form Templates

```
POST   /api/templates                       Create template
GET    /api/templates                       List templates
GET    /api/templates/:id                   Get template
PUT    /api/templates/:id                   Update template
DELETE /api/templates/:id                   Delete template
POST   /api/templates/:id/mappings          Update field mappings
```

#### Form Generation

```
POST   /api/clients/:clientId/forms/generate    Generate filled form
GET    /api/clients/:clientId/forms             List client's filled forms
GET    /api/forms/:id/download                  Download filled form
```

### 6.3 OCR Requirements

#### Document Types to Support (MVP)

1. **Passport** (UAE, Indian, Pakistani, Filipino - common nationalities)
   - Extract: Name, Nationality, DOB, Passport #, Issue/Expiry dates

2. **Emirates ID** (front and back)
   - Extract: Name (En/Ar), ID number, Expiry date

3. **Trade License**
   - Extract: License #, Company name (En/Ar), Activities, Expiry

#### Extraction Quality

- Confidence score for each extracted field
- Highlight low-confidence extractions for user review
- Support manual correction of any field

### 6.4 Security Requirements

- All client data encrypted at rest
- User data isolation (users can only see their own clients)
- Secure file storage
- Session management with token refresh
- Audit logging for sensitive operations

---

## 7. MVP Scope

### 7.1 Phase 1: Core Client Management (Week 1-2)

- [ ] User authentication (login/register) - EXISTS, needs cleanup
- [ ] Client CRUD operations
- [ ] Client list with search
- [ ] Basic client detail view

### 7.2 Phase 2: Document Upload & OCR (Week 3-4)

- [ ] Document upload to client
- [ ] Document preview
- [ ] OCR extraction (passport, Emirates ID)
- [ ] Extracted data review/edit
- [ ] Auto-merge to client profile

### 7.3 Phase 3: Form Filling (Week 5-6)

- [ ] Form template upload
- [ ] Field mapping interface
- [ ] Form generation with client data
- [ ] PDF download
- [ ] Form history per client

### 7.4 Phase 4: Polish & Launch (Week 7-8)

- [ ] UI/UX refinement
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] Testing & bug fixes
- [ ] Documentation

---

## 8. Out of Scope (MVP)

The following are explicitly NOT included in MVP:

- Multi-user teams / role-based access
- Batch processing multiple clients
- Online form portal integration
- Mobile app
- API for third-party integrations
- Advanced analytics / reporting
- Document version history
- Automated form template detection
- Multi-language UI (English only for MVP)

---

## 9. Success Metrics

| Metric                          | Target                       |
| ------------------------------- | ---------------------------- |
| Time to fill a form (vs manual) | 80% reduction                |
| OCR extraction accuracy         | >90% for supported documents |
| Forms filled per client         | Unlimited, instant           |
| User onboarding time            | <10 minutes                  |

---

## 10. Open Questions

1. **Pricing model?** - Subscription tiers, per-document, per-form?
2. **Specific government forms to prioritize?** - Get list from target users
3. **Data retention policy?** - How long to keep client data?
4. **Backup/export?** - Can users export all their client data?

---

## Appendix A: Current Codebase Assessment

### What Exists (Needs Refactoring)

- ✅ Authentication (Supabase) - works but has redundant code
- ✅ Document upload - works
- ✅ OCR extraction (Tesseract) - works
- ✅ PDF form filling (pdf-lib) - works
- ⚠️ User/document models - need to add Client entity
- ⚠️ API routes - need restructuring around clients

### What's Missing

- ❌ Client entity and management
- ❌ Client profile (unified extracted data)
- ❌ Form template management with field mappings
- ❌ Form history per client
- ❌ Client-centric UI

### What Should Be Removed

- Mock data endpoints
- Unused routes and components
- Redundant auth stores
- Dead code from previous iterations

---

_End of PRD_
