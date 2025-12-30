# Documentation Migration Guide

> **DEPRECATED (2025-12-30)**: This guide proposed a numbered prefix structure (00-06).
> After review, we decided to keep the **Diataxis framework** structure (tutorials, how-to, reference, explanation).
> See `proposed-structure.md` and `migration-plan.md` for the current approach.

**Purpose:** Step-by-step guide for migrating to the new documentation architecture (DEPRECATED)

---

## Pre-Migration Checklist

- [ ] Review `DOCUMENTATION_ARCHITECTURE_RECOMMENDATION.md`
- [ ] Backup current documentation
- [ ] Identify all documentation files
- [ ] Map current structure to new structure
- [ ] Identify duplicates and redundancies

---

## Migration Mapping

### Current → Proposed Structure

| Current Location                               | Proposed Location                                       | Notes                                                      |
| ---------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| `docs/CURRENT_ARCHITECTURE.md`                 | `docs/01-current-state/architecture/system-overview.md` | Consolidate with `architecture/current/system-overview.md` |
| `docs/ARCHITECTURE_QUICK_REFERENCE.md`         | `docs/01-current-state/architecture/quick-reference.md` | Already exists, just move                                  |
| `docs/architecture/current/system-overview.md` | `docs/01-current-state/architecture/system-overview.md` | Consolidate with CURRENT_ARCHITECTURE.md                   |
| `docs/architecture/current/quick-reference.md` | `docs/01-current-state/architecture/quick-reference.md` | Keep as-is                                                 |
| `docs/getting-started/`                        | `docs/00-quick-start/`                                  | Rename and reorganize                                      |
| `docs/guides/`                                 | `docs/02-guides/`                                       | Keep structure, add metadata                               |
| `docs/api/reference/`                          | `docs/01-current-state/api/endpoints/`                  | Reorganize                                                 |
| `docs/reference/`                              | `docs/03-reference/`                                    | Keep structure                                             |
| `docs/architecture/vision/`                    | `docs/04-future-vision/architecture/`                   | Move with clear warnings                                   |
| `docs/100-getting-started/`                    | `docs/06-archive/old-numbered-sections/`                | Archive                                                    |
| `docs/200-architecture/`                       | `docs/06-archive/old-numbered-sections/`                | Archive                                                    |
| `docs/300-api/`                                | `docs/06-archive/old-numbered-sections/`                | Archive                                                    |

---

## Step-by-Step Migration

### Step 1: Create New Structure

```bash
# Create main directories
mkdir -p docs/00-quick-start
mkdir -p docs/01-current-state/{architecture,api,database,codebase}
mkdir -p docs/02-guides/{development,deployment,maintenance}
mkdir -p docs/03-reference/{configuration,types,commands}
mkdir -p docs/04-future-vision/{architecture,roadmap}
mkdir -p docs/05-decisions
mkdir -p docs/06-archive/old-numbered-sections
mkdir -p docs/.meta
```

### Step 2: Create AI Agent Setup Guide

Create `docs/00-quick-start/ai-agent-setup.md`:

```markdown
---
title: 'AI Agent Setup Guide'
id: 'ai-agent-setup'
version: '1.0.0'
status: 'active'
phase: 'current'
ai_priority: 'critical'
ai_context_level: 'foundational'
ai_required_reading: true
---

# AI Agent Setup Guide

## Initialization Sequence

When starting work on this codebase:

1. Read this document (you are here)
2. Read: `docs/00-quick-start/project-overview.md`
3. Read: `docs/01-current-state/architecture/quick-reference.md`
4. Load: `docs/.meta/index.json` for full documentation index
5. Verify: Check code against `docs/01-current-state/`

## Critical Rules

1. **ALWAYS** verify features exist in code before claiming they exist
2. **NEVER** assume features from `docs/04-future-vision/` are implemented
3. **ALWAYS** check `docs/01-current-state/` for actual implementation
4. **ALWAYS** update documentation when modifying code

## Documentation Structure

- `00-quick-start/` - Read first
- `01-current-state/` - What EXISTS (reality)
- `02-guides/` - How to do things
- `03-reference/` - Technical lookup
- `04-future-vision/` - What WILL BE (not implemented)
- `05-decisions/` - Why decisions were made
- `06-archive/` - Deprecated content

## Quick Links

- [Project Overview](./project-overview.md)
- [Architecture Quick Reference](../01-current-state/architecture/quick-reference.md)
- [Documentation Index](../.meta/index.json)
```

### Step 3: Consolidate Duplicate Architecture Docs

**Action:** Merge `CURRENT_ARCHITECTURE.md` and `architecture/current/system-overview.md`

1. Compare both files
2. Identify unique content in each
3. Create consolidated version
4. Place in `docs/01-current-state/architecture/system-overview.md`
5. Mark old files as deprecated with link to new location

### Step 4: Add Metadata to All Documents

For each document:

1. Add frontmatter with required fields
2. Set appropriate status
3. Add code references
4. Link related documents
5. Set AI priority and context level

### Step 5: Generate Documentation Index

Create `docs/.meta/index.json`:

```json
{
  "version": "1.0.0",
  "last_updated": "2025-01-XX",
  "documents": [
    {
      "id": "arch-system-overview",
      "path": "01-current-state/architecture/system-overview.md",
      "title": "System Architecture Overview",
      "status": "active",
      "phase": "current",
      "priority": "high",
      "dependencies": [],
      "related": ["arch-quick-reference"],
      "tags": ["architecture", "system-design"],
      "last_verified": "2025-01-XX"
    }
  ]
}
```

### Step 6: Update Cross-References

1. Find all internal links
2. Update to new paths
3. Verify links work
4. Update README files

### Step 7: Archive Old Structure

1. Move numbered directories to `docs/06-archive/old-numbered-sections/`
2. Add deprecation notices
3. Create archive index

### Step 8: Update AI Agent Configs

Update `CLAUDE.md`, `AGENTS.md`, etc.:

```markdown
## Documentation Structure

The documentation follows a numbered prefix system:

- `docs/00-quick-start/` - Start here
- `docs/01-current-state/` - What exists (reality)
- `docs/02-guides/` - How-to guides
- `docs/03-reference/` - Technical reference
- `docs/04-future-vision/` - Future plans (NOT implemented)
- `docs/05-decisions/` - Architecture decisions
- `docs/06-archive/` - Deprecated content

**Critical:** Always check `docs/01-current-state/` for actual implementation.
Never assume features from `docs/04-future-vision/` exist in code.
```

---

## Validation Steps

After migration:

- [ ] All documents have frontmatter
- [ ] All links work
- [ ] No duplicate content
- [ ] Index is complete
- [ ] AI agent configs updated
- [ ] Old structure archived
- [ ] README files updated

---

## Rollback Plan

If issues arise:

1. Old structure preserved in `docs/06-archive/`
2. Can restore from backup
3. Update AI configs to point to old paths
4. Document issues for future improvement

---

## Timeline Estimate

- **Week 1:** Structure setup and consolidation
- **Week 2:** Content migration
- **Week 3:** Metadata addition and index generation
- **Week 4:** Link updates and validation
- **Week 5:** Testing and cleanup

---

**Status:** Ready for implementation  
**Last Updated:** 2025-01-XX
