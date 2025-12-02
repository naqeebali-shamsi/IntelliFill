# Documentation Maintenance Guide

This guide establishes practices for keeping IntelliFill documentation accurate, current, and useful.

---

## Documentation Philosophy

> **Living Documentation**: These docs are not static artifacts. They evolve with the codebase and should always reflect the current state of the system.

---

## Maintenance Responsibilities

### For AI Agents

When making code changes, you **MUST** update documentation:

| Code Change | Documentation Update |
|-------------|---------------------|
| New API endpoint | `docs/reference/api/endpoints.md` |
| Changed API response | `docs/reference/api/endpoints.md` |
| New environment variable | `docs/reference/configuration/environment.md` |
| Database schema change | `docs/reference/database/schema.md` |
| New feature | Appropriate tutorial or how-to guide |
| Architecture change | `docs/explanation/` + `system-overview.md` |
| Bug fix for documented issue | Remove/update `CLAUDE.local.md` known issues |
| New known issue | Add to `CLAUDE.local.md` |

### For Developers

1. **Before PR merge**: Verify documentation is updated
2. **During code review**: Check for doc updates
3. **After deployment**: Update any environment-specific docs

---

## Update Triggers

### Immediate Updates Required

These changes require immediate documentation updates:

- [ ] API endpoint added/modified/removed
- [ ] Environment variable added/modified/removed
- [ ] Database schema changed
- [ ] Authentication flow changed
- [ ] Breaking changes introduced
- [ ] Known issue discovered or resolved

### Periodic Review

These should be reviewed quarterly:

- [ ] Getting started tutorial still works
- [ ] All tutorials complete successfully
- [ ] Links between documents work
- [ ] Code examples compile/run
- [ ] Technology versions accurate

---

## Documentation Standards

### Frontmatter

All documentation files should have YAML frontmatter:

```yaml
---
title: Document Title
description: One-line description
category: tutorials|how-to|reference|explanation|ai-development
tags: [relevant, tags]
lastUpdated: YYYY-MM-DD
---
```

### Content Rules

1. **Be specific**: Include actual values, paths, commands
2. **Be current**: Update timestamps when modifying
3. **Be consistent**: Follow existing patterns
4. **Be complete**: Don't leave TODOs in published docs
5. **Be accurate**: Test all code examples

### Code Examples

All code examples must:
- Be syntactically correct
- Use current API/patterns
- Include necessary imports
- Have comments for clarity

```typescript
// ✅ Good: Complete, runnable example
import { useDocumentStore } from '@/stores/documentStore';

export function DocumentList() {
  const documents = useDocumentStore(state => state.documents);
  return <ul>{documents.map(d => <li key={d.id}>{d.filename}</li>)}</ul>;
}

// ❌ Bad: Incomplete, won't work
const docs = getDocuments();
docs.map(d => <li>{d.name}</li>)
```

---

## AI Agent Instructions

### Before Making Changes

1. Read `CLAUDE.local.md` for current known issues
2. Check if your change affects documented behavior
3. Identify which docs need updates

### During Implementation

1. Note any documentation that becomes incorrect
2. Track new features/APIs being added
3. Record any issues encountered

### After Implementation

1. Update all affected documentation
2. Update `lastUpdated` in frontmatter
3. If fixing a known issue, update `CLAUDE.local.md`
4. If finding a new issue, add to `CLAUDE.local.md`

### Documentation Update Checklist

```markdown
## Documentation Checklist

- [ ] API changes reflected in `docs/reference/api/endpoints.md`
- [ ] Config changes in `docs/reference/configuration/environment.md`
- [ ] Schema changes in `docs/reference/database/schema.md`
- [ ] Known issues updated in `CLAUDE.local.md`
- [ ] Cross-references still valid
- [ ] Code examples still work
- [ ] lastUpdated timestamps updated
```

---

## Stale Documentation Detection

### Signs of Stale Docs

- Code examples that don't compile
- References to non-existent files/endpoints
- Incorrect version numbers
- Outdated screenshots
- Broken links
- Known issues that are fixed

### Automated Checks (Future)

Consider implementing:
- Link checker in CI/CD
- Code example validator
- Frontmatter validator
- Timestamp staleness warning

---

## Document Lifecycle

### Creating New Documents

1. Choose correct Diátaxis quadrant
2. Use consistent file naming
3. Add complete frontmatter
4. Add to parent README.md index
5. Cross-reference related docs

### Updating Documents

1. Preserve document structure
2. Update `lastUpdated` timestamp
3. Verify cross-references still work
4. Test code examples

### Deprecating Documents

1. Add deprecation notice at top
2. Point to replacement document
3. Keep for 1-2 release cycles
4. Remove and update references

### Removing Documents

1. Update all referencing documents
2. Remove from index/README
3. Consider redirect if URL is shared

---

## Diátaxis Quadrant Guidelines

### Tutorials (Learning-Oriented)

**Keep updated when:**
- Setup steps change
- UI changes significantly
- Prerequisites change

**Review frequency:** Monthly

### How-To Guides (Problem-Oriented)

**Keep updated when:**
- Procedures change
- New solutions discovered
- Common issues resolved

**Review frequency:** With each release

### Reference (Information-Oriented)

**Keep updated when:**
- Any API/config/schema changes
- Immediately with code changes

**Review frequency:** Continuous

### Explanation (Understanding-Oriented)

**Keep updated when:**
- Architecture decisions change
- New patterns introduced
- Security model updates

**Review frequency:** Quarterly

---

## Known Issues Section (CLAUDE.local.md)

### Adding Issues

```markdown
### Issue N: Brief Title

**Symptoms**:
- What users/developers see

**Cause**: Why this happens

**Workaround**: How to mitigate

**Files to Fix**: Where the fix should go

**Status**: Open/In Progress/Blocked
```

### Removing Issues

When fixing an issue:
1. Verify fix works
2. Remove from Known Issues
3. Note in commit message: "Fixes known issue: [title]"

---

## Quality Metrics

Track these for documentation health:

| Metric | Target | Check |
|--------|--------|-------|
| All tutorials pass | 100% | Monthly test |
| Links valid | 100% | Automated check |
| Docs < 6 months old | 90% | Timestamp audit |
| Code examples valid | 100% | Manual/automated |
| Known issues current | 100% | Weekly review |

---

## Contact & Ownership

| Area | Owner |
|------|-------|
| API Reference | Backend team |
| Frontend Guides | Frontend team |
| Tutorials | DevRel/Onboarding |
| Architecture | Tech Lead |
| AI Development | AI/ML team |

---

## Related Documentation

- [Documentation Hub](./README.md)
- [CLAUDE.local.md](../CLAUDE.local.md)
- [AGENTS.md](../AGENTS.md)
- [Agentic Workflows](./ai-development/agentic-workflows.md)

