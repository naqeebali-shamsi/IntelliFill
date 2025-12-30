# Documentation Inventory Summary

**Generated:** 2025-12-30

## Overview

| Location              | Files   | Status                       |
| --------------------- | ------- | ---------------------------- |
| `docs/`               | 55      | Primary (Diataxis structure) |
| `quikadmin/docs/`     | 121     | Needs consolidation          |
| `quikadmin-web/docs/` | 44      | Needs review                 |
| `.claude/skills/`     | 15      | Active                       |
| **Total**             | **235** |                              |

## CLAUDE.md Files

| File                              | Lines | Status                    |
| --------------------------------- | ----- | ------------------------- |
| `CLAUDE.local.md`                 | 64    | Good - concise            |
| `quikadmin/CLAUDE.md`             | 1518  | **TOO LONG** - needs <500 |
| `quikadmin-web/CLAUDE.md`         | 555   | Acceptable                |
| `quikadmin/.taskmaster/CLAUDE.md` | 422   | Good                      |

## Critical Issues

### 1. Documentation Sprawl

- **3 separate docs directories** with overlapping content
- `quikadmin/docs/` (121 files) likely duplicates much of `docs/` (55 files)
- `quikadmin-web/docs/` (44 files) has frontend-specific content

### 2. Inconsistent Structure

- `docs/` uses Diataxis (tutorials, how-to, reference, explanation)
- `quikadmin/docs/` uses numbered prefixes (00-06)
- No single source of truth

### 3. CLAUDE.md Optimization

- Backend CLAUDE.md at **1518 lines** is 3x recommended limit
- Needs splitting into essential context + links to detailed docs

## Recommendations

1. **Consolidate to `docs/`** as single source of truth
2. **Archive** redundant content from `quikadmin/docs/` and `quikadmin-web/docs/`
3. **Split** `quikadmin/CLAUDE.md` into:
   - Essential context (~300 lines)
   - Links to `docs/` for details
4. **Standardize** on Diataxis structure throughout
5. **Add frontmatter** to all docs for AI discoverability

## Next Steps

See Task 158 for Quality and Gap Analysis.
