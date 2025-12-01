---
title: "AI Agent Setup Guide"
id: "ai-agent-setup"
version: "1.0.0"
last_updated: "2025-01-XX"
created: "2025-01-XX"
status: "active"
phase: "current"
maintainer: "team"
depends_on: []
related_to:
  - "project-overview"
  - "arch-quick-reference"
ai_priority: "critical"
ai_context_level: "foundational"
ai_required_reading: true
ai_auto_update: true
category: "guide"
tags:
  - "ai-agents"
  - "onboarding"
  - "setup"
audience:
  - "ai-agents"
  - "developers"
verified_against_code: "2025-01-XX"
code_references: []
---

# AI Agent Setup Guide

**Status:** [![Status](https://img.shields.io/badge/status-active-green)]()  
**Last Updated:** 2025-01-XX  
**Version:** 1.0.0

---

## Initialization Sequence

When starting work on this codebase, follow this exact sequence:

### Step 1: Read This Document
You are here. This document provides the foundation for understanding the documentation structure.

### Step 2: Read Project Overview
**Next:** [`project-overview.md`](./project-overview.md) (5-minute overview)

### Step 3: Read Architecture Quick Reference
**Next:** [`../01-current-state/architecture/quick-reference.md`](../01-current-state/architecture/quick-reference.md) (5-minute architecture summary)

### Step 4: Load Documentation Index
**Load:** [`../.meta/index.json`](../.meta/index.json) for complete documentation index

### Step 5: Verify Against Code
**Verify:** Check code against [`../01-current-state/`](../01-current-state/) documentation

---

## Critical Rules for AI Agents

### ⚠️ ALWAYS Follow These Rules

1. **ALWAYS** verify features exist in code before claiming they exist
2. **NEVER** assume features from `docs/04-future-vision/` are implemented
3. **ALWAYS** check `docs/01-current-state/` for actual implementation
4. **ALWAYS** update documentation when modifying code
5. **NEVER** duplicate content - link to canonical source

### Documentation Structure Priority

```
00-quick-start/     → Read first (onboarding)
01-current-state/   → What EXISTS (reality) ⭐
02-guides/          → How to do things
03-reference/       → Technical lookup
04-future-vision/   → What WILL BE (not implemented) ⚠️
05-decisions/       → Why decisions were made
06-archive/         → Deprecated content
```

---

## Quick Navigation

### For Architecture Questions
- **Quick Overview:** [`../01-current-state/architecture/quick-reference.md`](../01-current-state/architecture/quick-reference.md)
- **Complete Details:** [`../01-current-state/architecture/system-overview.md`](../01-current-state/architecture/system-overview.md)

### For Implementation Guides
- **Development:** [`../02-guides/development/`](../02-guides/development/)
- **Deployment:** [`../02-guides/deployment/`](../02-guides/deployment/)

### For API Reference
- **Endpoints:** [`../01-current-state/api/endpoints/`](../01-current-state/api/endpoints/)
- **Contracts:** [`../01-current-state/api/contracts/`](../01-current-state/api/contracts/)

### For Technical Reference
- **Configuration:** [`../03-reference/configuration/`](../03-reference/configuration/)
- **Types:** [`../03-reference/types/`](../03-reference/types/)

---

## Before Implementation Checklist

Before implementing any feature:

- [ ] Read relevant architecture docs in `01-current-state/`
- [ ] Check if feature already exists (search docs + codebase)
- [ ] Review implementation guides in `02-guides/development/`
- [ ] Check API reference for existing patterns
- [ ] Verify code matches documented patterns
- [ ] Plan documentation updates

---

## After Implementation Checklist

After implementing any feature:

- [ ] Update relevant docs in `01-current-state/`
- [ ] Add/update API reference if new endpoints
- [ ] Update `.meta/index.json` if new doc created
- [ ] Verify no redundancy introduced
- [ ] Link new code references in doc metadata
- [ ] Update related documents if needed

---

## Common Pitfalls to Avoid

### ❌ Don't Do This

- Assume features from `04-future-vision/` exist
- Duplicate content instead of linking
- Skip documentation updates
- Reference outdated documentation
- Make assumptions without verifying in code

### ✅ Do This Instead

- Always check `01-current-state/` first
- Link to canonical sources
- Update docs with code changes
- Verify documentation matches code
- Ask for clarification if unclear

---

## Documentation Metadata

Every document includes frontmatter with:

- **Status** - active, deprecated, draft, archived
- **Phase** - current, vision, legacy
- **AI Priority** - high, medium, low
- **Code References** - Links to actual code
- **Dependencies** - Related documents

See [`../.meta/templates/document-template.md`](../.meta/templates/document-template.md) for template.

---

## Related Documentation

- [Project Overview](./project-overview.md)
- [Architecture Quick Reference](../01-current-state/architecture/quick-reference.md)
- [Documentation Index](../.meta/index.json)
- [Documentation Architecture Recommendation](../../DOCUMENTATION_ARCHITECTURE_RECOMMENDATION.md)

---

**Document ID:** `ai-agent-setup`  
**Maintained By:** Team  
**Questions?** See [Documentation Guide](../README.md)

