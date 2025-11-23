# Documentation Maintenance Guide

**Purpose:** Complete guide for maintaining clean, non-redundant documentation with frequent commits

---

## 📚 Quick Links

- **[Redundancy Check](./REDUNDANCY_CHECK.md)** - How to check for redundancy
- **[Frequent Commit Guide](./FREQUENT_COMMIT_GUIDE.md)** - Detailed commit instructions
- **[Commit Instructions](./COMMIT_INSTRUCTIONS.md)** - Quick reference
- **[Maintenance Workflow](./MAINTENANCE_WORKFLOW.md)** - Daily workflow
- **[Redundancy Summary](./REDUNDANCY_SUMMARY.md)** - What was fixed

---

## 🎯 Core Principles

### 1. Single Source of Truth
- Each concept documented **once** in canonical location
- All other references **link** to canonical source
- No copy-paste of content

### 2. Frequent Commits
- Commit after each logical change
- Small commits (1-5 files) preferred
- Clear commit messages
- Push frequently (3-10 commits/day)

### 3. No Redundancy
- Check before creating new docs
- Link instead of duplicating
- Remove duplicates immediately
- Monitor weekly

---

## ✅ Pre-Commit Checklist

Before every documentation commit:

- [ ] **No broken links** - All internal links work
- [ ] **No duplicate content** - Checked for redundancy
- [ ] **Metadata complete** - Frontmatter present and correct
- [ ] **Paths correct** - Using new numbered structure (00-06)
- [ ] **References updated** - Old paths updated
- [ ] **Commit message clear** - Descriptive and specific
- [ ] **Related files grouped** - Logical grouping

---

## 🔄 Daily Workflow

### Morning (5 minutes)
1. Check for outdated docs
2. Review recent changes
3. Check for broken links

### During Development
1. Update docs immediately after code changes
2. Fix broken references as you find them
3. Commit frequently (after each logical change)

### End of Day
1. Push all commits
2. Quick review of what changed

---

## 📝 Commit Message Format

```
docs(<type>): <short summary>

<detailed description>
- Bullet point 1
- Bullet point 2
```

**Types:** `docs:`, `docs(arch):`, `docs(api):`, `docs(guide):`, `docs(meta):`, `docs(fix):`

---

## 🔍 Redundancy Prevention

### Before Creating New Doc
- [ ] Does similar documentation exist?
- [ ] Can I link instead of duplicating?
- [ ] Is this a different perspective or duplicate?
- [ ] Have I checked all relevant sections?

### Before Committing
- [ ] No duplicate content introduced
- [ ] All references use correct paths
- [ ] Old paths updated to new structure
- [ ] Links verified and working

---

## 📊 Target Metrics

- **Commits per day:** 3-10
- **Files per commit:** 1-5 (preferred)
- **Time between commits:** 15-60 minutes
- **Commit message length:** 50-200 chars summary + details

---

## 🚫 What NOT to Commit

- ❌ Work in progress (WIP)
- ❌ Incomplete changes
- ❌ Broken links
- ❌ Untested changes
- ❌ Mixed concerns (docs + code)

---

## ✅ What Was Fixed

### Broken References
- ✅ 14 files with `CURRENT_ARCHITECTURE.md` → Updated to `01-current-state/architecture/system-overview.md`
- ✅ 6 files with `architecture/current/` → Updated to `01-current-state/architecture/`

### Duplicates Removed
- ✅ `SETUP_GUIDE_WINDOWS.md` → Removed (duplicate of `windows-setup.md`)
- ✅ `README-old.md` → Archived

### Path Updates
- ✅ 20+ references updated to new numbered structure

---

## 📋 Setup Guides (No Redundancy)

| File | Purpose | Status |
|------|---------|--------|
| `getting-started/installation.md` | General cross-platform installation | ✅ Keep |
| `getting-started/windows-setup.md` | Windows-specific setup with nginx | ✅ Keep |
| `02-guides/development/DEV_SETUP.md` | Development workflow & scripts | ✅ Keep |

**All serve distinct purposes, no redundancy.**

---

## 🔄 Weekly Review

Every Monday:
1. Check for outdated docs (30 days)
2. Review redundancy
3. Update index if needed
4. Fix any broken references

---

## 📚 Related Documentation

- **[AI Agent Setup](../00-quick-start/ai-agent-setup.md)** - Initial setup for AI agents
- **[Project Overview](../00-quick-start/project-overview.md)** - Project overview
- **[System Overview](../01-current-state/architecture/system-overview.md)** - Architecture truth

---

**Remember:** Small, frequent commits > Large batches

---

**Last Updated:** 2025-01-XX

