---
title: "Project Overview"
id: "project-overview"
version: "1.0.0"
last_updated: "2025-01-XX"
created: "2025-01-XX"
status: "active"
phase: "current"
maintainer: "team"
depends_on: []
related_to:
  - "ai-agent-setup"
  - "arch-quick-reference"
ai_priority: "high"
ai_context_level: "foundational"
ai_required_reading: true
ai_auto_update: true
category: "guide"
tags:
  - "overview"
  - "introduction"
audience:
  - "ai-agents"
  - "developers"
  - "new-users"
verified_against_code: "2025-01-XX"
code_references: []
---

# QuikAdmin (IntelliFill) - Project Overview

**Status:** [![Status](https://img.shields.io/badge/status-active-green)]()  
**Last Updated:** 2025-01-XX  
**Version:** 1.0.0

---

## What is QuikAdmin?

QuikAdmin (formerly IntelliFill) is an **intelligent document processing platform** that automates PDF form filling using AI-powered field mapping.

### Core Value Proposition

**Problem:** Manual PDF form filling is time-consuming, error-prone, and expensive.

**Solution:** Upload source documents (invoices, IDs, receipts, statements) + target PDF form → AI extracts data → Auto-fills form → Download completed PDF.

---

## Current Status

**Phase:** Early MVP Development / Pre-Production  
**Architecture:** Monolithic Express.js API + React SPA  
**Environment:** Windows-native development (Docker optional)

### What Exists ✅

- ✅ OCR & Data Extraction (Tesseract.js)
- ✅ PDF Form Field Detection
- ✅ Intelligent Field Mapping (TensorFlow.js, 85-90% accuracy)
- ✅ Batch Processing
- ✅ JWT Authentication
- ✅ Document Processing Pipeline
- ✅ Job Queue System (Bull)

### What's Planned ⏳

- ⏳ OpenAI GPT-4o-mini integration (99%+ accuracy)
- ⏳ Supabase Auth migration (2FA, OAuth)
- ⏳ Production deployment strategy
- ⏳ Enhanced observability

---

## Technology Stack

### Backend
- **Runtime:** Node.js 20 + TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (Prisma ORM)
- **Queue:** Redis + Bull 4.11.5
- **Auth:** Custom JWT

### Frontend
- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **State:** Zustand
- **UI:** Radix UI + Tailwind CSS

### Document Processing
- **PDF:** pdf-lib, pdfjs-dist
- **OCR:** Tesseract.js
- **ML:** TensorFlow.js (→ OpenAI planned)

---

## Project Structure

```
IntelliFill/
├── quikadmin/          # Backend API
│   ├── src/            # Source code
│   ├── prisma/         # Database schema
│   ├── tests/          # Test suites
│   └── docs/           # Documentation
├── quikadmin-web/      # Frontend SPA
│   ├── src/            # React components
│   └── docs/           # Frontend docs
└── extension/          # Chrome extension
```

---

## Quick Start

### For AI Agents

1. Read [`ai-agent-setup.md`](./ai-agent-setup.md)
2. Read [`../01-current-state/architecture/quick-reference.md`](../01-current-state/architecture/quick-reference.md)
3. Load [`../.meta/index.json`](../.meta/index.json)

### For Developers

1. Read [`../getting-started/prerequisites.md`](../getting-started/prerequisites.md)
2. Follow [`../getting-started/installation.md`](../getting-started/installation.md)
3. Review [`../01-current-state/architecture/system-overview.md`](../01-current-state/architecture/system-overview.md)

---

## Key Documentation

### Architecture
- **Quick Reference:** [`../01-current-state/architecture/quick-reference.md`](../01-current-state/architecture/quick-reference.md) (5 min)
- **Complete Overview:** [`../01-current-state/architecture/system-overview.md`](../01-current-state/architecture/system-overview.md) (30 min)

### Guides
- **Development:** [`../02-guides/development/`](../02-guides/development/)
- **Deployment:** [`../02-guides/deployment/`](../02-guides/deployment/)

### Reference
- **API Endpoints:** [`../01-current-state/api/endpoints/`](../01-current-state/api/endpoints/)
- **Configuration:** [`../03-reference/configuration/`](../03-reference/configuration/)

---

## Critical Distinctions

### ⚠️ Current State vs. Future Vision

- **`01-current-state/`** → What EXISTS (reality) ⭐
- **`04-future-vision/`** → What WILL BE (not implemented) ⚠️

**Always check `01-current-state/` for actual implementation.**

---

## Related Documentation

- [AI Agent Setup Guide](./ai-agent-setup.md)
- [Architecture Quick Reference](../01-current-state/architecture/quick-reference.md)
- [Documentation Index](../.meta/index.json)

---

**Document ID:** `project-overview`  
**Maintained By:** Team  
**Questions?** See [Documentation Guide](../README.md)

