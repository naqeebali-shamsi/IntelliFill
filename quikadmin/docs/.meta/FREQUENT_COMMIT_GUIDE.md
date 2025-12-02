# Frequent Commit Guide for Documentation

**Purpose:** Maintain clean, up-to-date documentation through frequent, focused commits

---

## 🎯 Commit Philosophy

**Commit Early, Commit Often** - Small, focused commits are better than large batches.

### Benefits
- ✅ Easier to review changes
- ✅ Easier to rollback if needed
- ✅ Clear history of what changed and why
- ✅ Reduces merge conflicts
- ✅ Better collaboration

---

## 📝 Commit Frequency Guidelines

### When to Commit Documentation

#### Immediate Commits (After Each Change)
- ✅ New document created
- ✅ Document moved to new location
- ✅ Metadata added/updated
- ✅ Broken link fixed
- ✅ Redundancy removed

#### Batch Commits (Small Groups)
- ✅ Related updates (e.g., all auth docs updated together)
- ✅ Section reorganization (e.g., all guides migrated)
- ✅ Cross-reference updates (e.g., all links to moved file)

#### Avoid Large Batches
- ❌ Don't wait to commit 20+ file changes
- ❌ Don't mix unrelated changes in one commit
- ❌ Don't commit "WIP" or incomplete work

---

## 🔄 Recommended Workflow

### Step 1: Make Focused Changes
```bash
# Work on one logical change
# Example: Update authentication docs
```

### Step 2: Review Changes
```bash
git status
git diff
# Review what changed
```

### Step 3: Stage Related Changes
```bash
# Stage only related files
git add docs/01-current-state/api/endpoints/authentication.md
git add docs/01-current-state/architecture/auth-flow.md
```

### Step 4: Commit with Clear Message
```bash
git commit -m "docs: update authentication API documentation

- Add new endpoint examples
- Update authentication flow diagram
- Fix broken cross-references"
```

### Step 5: Continue or Push
```bash
# Continue with next change, or push if ready
git push
```

---

## 📋 Commit Message Format

### Format
```
<type>: <short summary>

<detailed description>
- Bullet point 1
- Bullet point 2
```

### Types
- `docs:` - Documentation changes
- `docs(arch):` - Architecture documentation
- `docs(api):` - API documentation
- `docs(guide):` - Guide documentation
- `docs(meta):` - Metadata/index changes
- `docs(fix):` - Documentation fixes (links, typos)
- `docs(refactor):` - Documentation reorganization

### Examples

**Good:**
```
docs(arch): add security architecture metadata

- Add frontmatter to security.md
- Update cross-references
- Link to auth-flow.md
```

**Good:**
```
docs(fix): update broken references to CURRENT_ARCHITECTURE.md

- Update all references to new path: 01-current-state/architecture/system-overview.md
- Fix 12 broken links across documentation
```

**Good:**
```
docs(meta): add authentication docs to index.json

- Add api-authentication entry
- Add arch-auth-flow entry
- Update relationships
```

**Bad:**
```
docs: update stuff
```

**Bad:**
```
WIP: documentation changes
```

---

## 🎯 Commit Size Guidelines

### Small Commits (Preferred)
- 1-3 files changed
- Single logical change
- Easy to review
- Easy to understand

### Medium Commits (Acceptable)
- 4-10 files changed
- Related changes (e.g., all auth docs)
- Clear grouping
- Still reviewable

### Large Commits (Avoid)
- 10+ files changed
- Multiple unrelated changes
- Hard to review
- Hard to rollback

---

## 🔍 Pre-Commit Checklist

Before committing documentation:

- [ ] **No broken links** - All internal links work
- [ ] **No duplicate content** - Checked for redundancy
- [ ] **Metadata complete** - Frontmatter present and correct
- [ ] **Paths correct** - Using new numbered structure
- [ ] **References updated** - Old paths updated
- [ ] **Commit message clear** - Descriptive and specific
- [ ] **Related files grouped** - Logical grouping

---

## 📊 Commit Frequency Examples

### Scenario 1: Adding New Feature Documentation

```bash
# Change 1: Create new API endpoint doc
git add docs/01-current-state/api/endpoints/new-feature.md
git commit -m "docs(api): add new-feature endpoint documentation"

# Change 2: Update API index
git add docs/.meta/index.json
git commit -m "docs(meta): add new-feature to documentation index"

# Change 3: Add guide for using new feature
git add docs/02-guides/development/using-new-feature.md
git commit -m "docs(guide): add guide for using new-feature"

# Change 4: Update architecture overview
git add docs/01-current-state/architecture/system-overview.md
git commit -m "docs(arch): document new-feature in system overview"
```

**Result:** 4 focused commits, easy to review and understand

### Scenario 2: Fixing Broken References

```bash
# Fix all references in one commit (related change)
git add docs/getting-started/troubleshooting.md
git add docs/getting-started/first-run.md
git add docs/getting-started/installation.md
git add docs/meta/documentation-map.md
git commit -m "docs(fix): update all references from CURRENT_ARCHITECTURE.md to new path

- Update 12 files with broken references
- Change: CURRENT_ARCHITECTURE.md → 01-current-state/architecture/system-overview.md
- All links verified"
```

**Result:** One commit for related fixes, clear what changed

---

## 🚫 What NOT to Commit

### Don't Commit
- ❌ Work in progress (WIP)
- ❌ Incomplete changes
- ❌ Broken links
- ❌ Untested changes
- ❌ Mixed concerns (docs + code in same commit)

### Instead
- ✅ Complete logical changes
- ✅ Tested and verified
- ✅ All links working
- ✅ Separate commits for docs vs code

---

## 🔄 Daily Documentation Workflow

### Morning: Review and Plan
```bash
# Check for outdated docs
git log --since="7 days ago" -- docs/
# Review what changed
```

### During Work: Frequent Commits
```bash
# After each logical change
git add <files>
git commit -m "docs: <clear message>"
```

### End of Day: Push Changes
```bash
# Push all commits
git push
# Or push incrementally throughout day
```

---

## 📈 Commit Statistics

### Target Metrics
- **Commits per day:** 3-10 documentation commits
- **Files per commit:** 1-5 files (preferred)
- **Commit message length:** 50-200 characters summary + details
- **Time between commits:** 15-60 minutes of work

### Example Day
```
09:00 - docs(arch): add metadata to security.md
09:30 - docs(fix): fix broken link in auth-flow.md
10:00 - docs(api): update authentication endpoint examples
11:00 - docs(meta): update index.json with new docs
14:00 - docs(guide): add troubleshooting section
15:00 - docs(fix): update all CURRENT_ARCHITECTURE.md references
```

**Result:** 6 focused commits, clear history, easy to review

---

## ✅ Best Practices

1. **Commit after each logical change** - Don't wait
2. **Write clear commit messages** - Future you will thank you
3. **Group related changes** - But keep groups small
4. **Verify before committing** - Check links, test changes
5. **Push frequently** - Don't let commits pile up locally
6. **Review before pushing** - Quick check of what you're pushing

---

## 🎯 Quick Reference

### Commit Command Template
```bash
git add <files>
git commit -m "docs(<type>): <summary>

<details>
- Point 1
- Point 2"
```

### Common Patterns
```bash
# Single file update
git add docs/01-current-state/architecture/system-overview.md
git commit -m "docs(arch): update system overview with new service"

# Multiple related files
git add docs/01-current-state/api/endpoints/*.md
git commit -m "docs(api): update all endpoint docs with examples"

# Metadata update
git add docs/.meta/index.json
git commit -m "docs(meta): add new documents to index"
```

---

**Remember:** Small, frequent commits > Large, infrequent commits

---

**Last Updated:** 2025-01-XX

