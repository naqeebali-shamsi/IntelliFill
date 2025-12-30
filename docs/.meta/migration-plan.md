# Documentation Migration Plan

**Date:** 2025-12-30
**Status:** Ready for Execution (Task 160)

## Overview

This plan consolidates documentation from 3 locations into a single `docs/` directory following Diataxis framework.

## Phase 1: Create Archive Structure

```bash
# Create archive directories
mkdir -p docs/_archive/{claude-audit,debug,sales,tech-debt}

# Create archive README
cat > docs/_archive/README.md << 'EOF'
# Archived Documentation

This directory contains documentation that is no longer actively maintained but retained for historical reference.

## Contents

- **claude-audit/** - One-time setup audit reports (Dec 2025)
- **debug/** - Debugging session evidence
- **sales/** - Sales prompt experiments
- **tech-debt/** - Technical debt audits

## Note

These documents are NOT kept up-to-date. For current information, see the main documentation in parent directories.
EOF
```

## Phase 2: Move to Archive

```bash
# Move claude-audit (3 files)
mv docs/claude-audit/claude_setup_report.md docs/_archive/claude-audit/
mv docs/claude-audit/claude_setup_addendum.md docs/_archive/claude-audit/
mv docs/claude-audit/taskmaster_provider_check.md docs/_archive/claude-audit/
rmdir docs/claude-audit

# Move debug (1 file)
mv docs/debug/evidence_bundle.md docs/_archive/debug/
rmdir docs/debug

# Move sales (1 file)
mv docs/sales/gemini-prompts.md docs/_archive/sales/
rmdir docs/sales

# Move tech-debt (1 file)
mv docs/tech-debt/tech-stability-audit-2025-12.md docs/_archive/tech-debt/
rmdir docs/tech-debt
```

## Phase 3: Consolidate Architecture Docs

```bash
# Move architecture docs to reference/architecture/
mv docs/architecture/dynamic-pii-architecture.md docs/reference/architecture/
mv docs/architecture/dynamic-pii-architecture-options.md docs/reference/architecture/
rmdir docs/architecture

# Move ADR to explanation/adr/
mv docs/decisions/ADR-001-document-relationship-design.md docs/explanation/adr/
rmdir docs/decisions
```

## Phase 4: Update Cross-References

Files needing link updates:

| File                                                      | Old Link                       | New Link               |
| --------------------------------------------------------- | ------------------------------ | ---------------------- |
| `docs/reference/architecture/dynamic-pii-architecture.md` | `./compliance-requirements.md` | Remove (doesn't exist) |
| `docs/.meta/DOCUMENTATION_MIGRATION_GUIDE.md`             | `docs/01-current-state/*`      | Remove file or update  |
| Various                                                   | `../path/to/doc.md`            | Fix placeholder links  |

## Phase 5: Add Frontmatter to Key Files

Priority files for frontmatter:

```yaml
# Template
---
title: Document Title
description: One-line description
category: tutorials|how-to|reference|explanation
lastUpdated: 2025-12-30
status: active
---
```

Files to update:

1. `docs/tutorials/README.md`
2. `docs/how-to/README.md`
3. `docs/reference/README.md`
4. `docs/explanation/README.md`
5. `docs/ai-development/README.md`
6. All moved files

## Phase 6: Update Documentation Hub

Update `docs/README.md`:

- Add \_archive section
- Update lastUpdated
- Verify all navigation links

## Phase 7: Validate

```bash
# Check for broken links (if markdown-link-check is installed)
npx markdown-link-check docs/**/*.md

# Verify no empty directories
find docs -type d -empty

# Count files in archive
find docs/_archive -name "*.md" | wc -l  # Should be 6

# Verify structure
tree docs -L 2
```

## Rollback Plan

If issues arise:

```bash
# Git can restore any changes
git checkout -- docs/
```

## Post-Migration Tasks

1. [ ] Update `CLAUDE.local.md` if needed
2. [ ] Review `quikadmin/docs/` for unique content
3. [ ] Review `quikadmin-web/docs/` for unique content
4. [ ] Consider optimizing `quikadmin/CLAUDE.md` (1518 -> 500 lines)

## Estimated Impact

| Metric            | Before | After                       |
| ----------------- | ------ | --------------------------- |
| docs/ files       | 55     | 55 (same, just reorganized) |
| Broken links      | 15+    | 0                           |
| Archived files    | 0      | 6                           |
| Empty directories | 0      | 0                           |
