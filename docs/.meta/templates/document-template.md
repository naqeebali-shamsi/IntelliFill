---
# Document Template
# Copy this template when creating new documentation

title: "Document Title"
id: "doc-unique-id"                    # e.g., "arch-system-overview"
version: "1.0.0"                       # Semantic versioning
last_updated: "2025-01-XX"
created: "2025-01-XX"

# Status & Lifecycle
status: "active"                        # active | deprecated | draft | archived
phase: "current"                       # current | vision | legacy
maintainer: "team"                     # Who maintains this

# Relationships
depends_on:                            # Documents this depends on
  - "doc-id-1"
  - "doc-id-2"
related_to:                            # Related documents
  - "doc-id-3"
supersedes:                            # Documents this replaces
  - "old-doc-id"
superseded_by: null                    # Document that replaces this

# AI Agent Hints
ai_priority: "high"                    # high | medium | low
ai_context_level: "foundational"       # foundational | reference | guide
ai_required_reading: true              # Must read before implementation
ai_auto_update: true                    # Can be auto-updated by AI

# Content Metadata
category: "architecture"               # architecture | api | guide | reference
tags:
  - "system-design"
  - "backend"
audience:                              # Who should read this
  - "developers"
  - "ai-agents"
  - "architects"

# Verification
verified_against_code: "2025-01-XX"   # Last code verification date
code_references:                       # Links to actual code
  - "src/services/auth.ts"
  - "prisma/schema.prisma"
---

# Document Title

**Status:** [![Status](https://img.shields.io/badge/status-active-green)]()  
**Last Updated:** YYYY-MM-DD  
**Version:** 1.0.0

---

## Overview

Brief description of what this document covers.

## Table of Contents

1. [Section 1](#section-1)
2. [Section 2](#section-2)
3. [Related Documentation](#related-documentation)

---

## Section 1

Content here.

### Subsection

More content.

**Code Reference:** See [`src/path/to/file.ts`](../../../src/path/to/file.ts)

---

## Section 2

Content here.

---

## Related Documentation

- [Related Doc 1](../path/to/doc.md)
- [Related Doc 2](../path/to/doc2.md)

---

## Verification

- [x] Code references verified
- [x] Links tested
- [x] Content matches code
- [x] No duplicate content

---

**Document ID:** `doc-unique-id`  
**Maintained By:** Team  
**Questions?** See [Documentation Guide](../README.md)

