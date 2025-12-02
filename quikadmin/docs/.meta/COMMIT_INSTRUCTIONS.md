# Documentation Commit Instructions

**Purpose:** Quick reference for frequent, focused documentation commits

---

## 🎯 Quick Commit Guide

### When to Commit

**Commit immediately after:**
- ✅ Creating new documentation
- ✅ Moving/renaming documentation
- ✅ Updating metadata
- ✅ Fixing broken links
- ✅ Removing redundancy
- ✅ Updating cross-references

**Commit frequency:** 3-10 commits per day (small, focused)

---

## 📝 Commit Message Format

```
docs(<type>): <short summary>

<detailed description>
- Bullet point 1
- Bullet point 2
```

### Types
- `docs:` - General documentation
- `docs(arch):` - Architecture docs
- `docs(api):` - API docs
- `docs(guide):` - Guide docs
- `docs(meta):` - Metadata/index
- `docs(fix):` - Fixes (links, typos, references)

---

## ✅ Pre-Commit Checklist

- [ ] No broken links
- [ ] No duplicate content
- [ ] Metadata complete
- [ ] Paths correct (00-06 structure)
- [ ] References updated
- [ ] Commit message clear
- [ ] Related files grouped

---

## 🔄 Common Patterns

### Single File Update
```bash
git add docs/01-current-state/architecture/system-overview.md
git commit -m "docs(arch): update system overview with new service"
```

### Related Files Update
```bash
git add docs/01-current-state/api/endpoints/authentication.md
git add docs/01-current-state/architecture/auth-flow.md
git commit -m "docs(auth): update authentication documentation

- Add new endpoint
- Update flow diagram
- Fix references"
```

### Fix Broken References
```bash
git add docs/getting-started/troubleshooting.md
git add docs/getting-started/first-run.md
git commit -m "docs(fix): update broken references

- Update CURRENT_ARCHITECTURE.md → system-overview.md
- Fix 5 broken links"
```

---

## 🚫 Don't Commit

- ❌ WIP or incomplete work
- ❌ Broken links
- ❌ Untested changes
- ❌ Mixed docs + code

---

## 📊 Target Metrics

- **Commits per day:** 3-10
- **Files per commit:** 1-5 (preferred)
- **Time between commits:** 15-60 minutes

---

**Remember:** Small, frequent commits > Large batches

---

**See Also:**
- [Frequent Commit Guide](./FREQUENT_COMMIT_GUIDE.md) - Detailed guide
- [Maintenance Workflow](./MAINTENANCE_WORKFLOW.md) - Daily workflow

