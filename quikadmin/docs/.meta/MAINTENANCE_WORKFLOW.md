# Documentation Maintenance Workflow

**Purpose:** Guide for maintaining clean, non-redundant documentation with frequent commits

---

## 🔄 Daily Maintenance Workflow

### Morning Routine (5 minutes)

1. **Check for outdated docs**
   ```bash
   git log --since="7 days ago" -- docs/
   ```

2. **Review recent changes**
   ```bash
   git diff HEAD~5 HEAD -- docs/
   ```

3. **Check for broken links** (if tool available)
   ```bash
   # Run link checker if available
   ```

### During Development

#### Before Making Changes
- [ ] Check if documentation already exists
- [ ] Verify canonical location
- [ ] Check for duplicates

#### After Making Changes
- [ ] Update relevant documentation immediately
- [ ] Fix broken references
- [ ] Commit changes

---

## 📝 Commit Workflow

### Step-by-Step Process

#### 1. Make Focused Change
```bash
# Work on one logical change
# Example: Update authentication API docs
```

#### 2. Review Changes
```bash
git status
git diff
# Review what changed
```

#### 3. Stage Related Files
```bash
# Stage only related files (1-5 files)
git add docs/01-current-state/api/endpoints/authentication.md
git add docs/01-current-state/architecture/auth-flow.md
```

#### 4. Commit with Clear Message
```bash
git commit -m "docs(api): update authentication endpoint documentation

- Add new endpoint examples
- Update request/response schemas
- Fix broken cross-references"
```

#### 5. Push Frequently
```bash
# Push after 2-3 commits, or at end of session
git push
```

---

## 🎯 Commit Frequency Guidelines

### Target: 3-10 Documentation Commits Per Day

**When to Commit:**
- ✅ After each logical documentation change
- ✅ After fixing broken links
- ✅ After updating metadata
- ✅ After removing redundancy

**Commit Size:**
- ✅ **Small (Preferred):** 1-3 files
- ✅ **Medium (OK):** 4-10 related files
- ❌ **Large (Avoid):** 10+ files

---

## 🔍 Redundancy Prevention

### Before Creating New Doc

**Checklist:**
- [ ] Does similar documentation exist?
- [ ] Can I link instead of duplicating?
- [ ] Is this a different perspective or duplicate?
- [ ] Have I checked all relevant sections?

### Before Committing

**Checklist:**
- [ ] No duplicate content introduced
- [ ] All references use correct paths
- [ ] Old paths updated to new structure
- [ ] Links verified and working
- [ ] Metadata complete

---

## 📋 Common Commit Patterns

### Pattern 1: Single File Update
```bash
git add docs/01-current-state/architecture/system-overview.md
git commit -m "docs(arch): update system overview with new service

- Add DocumentProcessingService to architecture
- Update service count
- Add code reference"
```

### Pattern 2: Related Files Update
```bash
git add docs/01-current-state/api/endpoints/authentication.md
git add docs/01-current-state/architecture/auth-flow.md
git commit -m "docs(auth): update authentication documentation

- Add new refresh token endpoint
- Update authentication flow diagram
- Fix cross-references"
```

### Pattern 3: Metadata Update
```bash
git add docs/.meta/index.json
git commit -m "docs(meta): add new documents to index

- Add api-new-feature entry
- Update relationships
- Add tags"
```

### Pattern 4: Fix Broken References
```bash
git add docs/getting-started/troubleshooting.md
git add docs/getting-started/first-run.md
git commit -m "docs(fix): update broken references to CURRENT_ARCHITECTURE.md

- Update 5 files with broken references
- Change: CURRENT_ARCHITECTURE.md → 01-current-state/architecture/system-overview.md
- All links verified"
```

---

## 🚫 What NOT to Commit

### Don't Commit
- ❌ Work in progress (WIP)
- ❌ Incomplete changes
- ❌ Broken links
- ❌ Untested changes
- ❌ Mixed concerns (docs + code)

### Instead
- ✅ Complete logical changes
- ✅ Tested and verified
- ✅ All links working
- ✅ Separate commits for docs vs code

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

## 📊 Example Day

```
09:00 - docs(arch): add metadata to security.md
09:30 - docs(fix): fix broken link in auth-flow.md
10:00 - docs(api): update authentication endpoint examples
11:00 - docs(meta): update index.json with new docs
14:00 - docs(guide): add troubleshooting section
15:00 - docs(fix): update all CURRENT_ARCHITECTURE.md references
16:00 - git push
```

**Result:** 6 focused commits, clear history, easy to review

---

## 🔄 Weekly Review

### Every Monday Morning

1. **Check for outdated docs**
   ```bash
   git log --since="30 days ago" -- docs/
   ```

2. **Review redundancy**
   - Check for duplicate content
   - Verify canonical locations
   - Update cross-references

3. **Update index**
   ```bash
   # Update .meta/index.json if needed
   ```

---

**Remember:** Small, frequent commits > Large, infrequent commits

---

**Last Updated:** 2025-01-XX

