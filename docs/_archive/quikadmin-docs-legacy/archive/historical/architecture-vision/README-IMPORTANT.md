# ⚠️ IMPORTANT: Architecture Documentation Structure

## Two Types of Architecture Documentation

QuikAdmin maintains **two separate architecture documentation systems**:

### 1. **CURRENT ARCHITECTURE** (Reality)

**Location:** [`docs/CURRENT_ARCHITECTURE.md`](../CURRENT_ARCHITECTURE.md)

**Purpose:** Document the **actual, implemented architecture** as it exists today

**Contains:**

- Real technology stack (actual package.json dependencies)
- Implemented services and their line counts
- Current deployment setup (Windows native dev, Docker optional)
- Actual database schema from Prisma
- Real API endpoints that exist in code
- Known limitations and technical debt
- Measured performance (or "unknown" if not measured)

**When to Update:**

- ✅ Code changes (new services, refactoring)
- ✅ Technology stack changes (dependency upgrades)
- ✅ Deployment changes (new hosting provider)
- ✅ Database schema migrations
- ❌ Planning discussions (not implementation)
- ❌ Feature ideas (not yet built)

**Audience:** Developers, Claude Code, new team members who need to understand **what we have built**

---

### 2. **ARCHITECTURE VISION** (Aspirational)

**Location:** [`docs/architecture/`](./README.md)

**Purpose:** Document the **target architecture** for enterprise scale (100k+ users)

**Contains:**

- Microservices architecture design
- Kubernetes orchestration
- Kong API Gateway
- ELK logging stack
- Service mesh (Istio)
- Multi-region deployment
- Auto-scaling strategies
- Advanced observability

**When to Update:**

- ✅ Long-term planning sessions
- ✅ Scalability research
- ✅ Enterprise requirements analysis
- ✅ Technology evaluation
- ❌ Day-to-day development work

**Audience:** Architects, investors, stakeholders who need to understand **where we're going**

---

## Critical Distinction

| Aspect               | Current Architecture     | Architecture Vision            |
| -------------------- | ------------------------ | ------------------------------ |
| **Represents**       | What IS built            | What WILL BE built             |
| **Accuracy**         | 100% accurate to code    | Aspirational design            |
| **Technology**       | Express monolith         | Microservices                  |
| **Scale**            | <1000 users              | >100k users                    |
| **Deployment**       | Windows/Docker           | Kubernetes multi-region        |
| **Auth**             | Custom JWT (429 LOC)     | Auth service                   |
| **ML**               | Custom TF.js (85-90%)    | ML service cluster             |
| **Queue**            | Bull 4.11.5              | Distributed message bus        |
| **Monitoring**       | Winston logs             | Prometheus + Grafana + ELK     |
| **Update Frequency** | Weekly (as code changes) | Quarterly (strategic planning) |

---

## For Claude Code and Developers

**When answering questions about QuikAdmin's architecture:**

1. **ALWAYS read `docs/CURRENT_ARCHITECTURE.md` first**
2. **DO NOT assume** features from `docs/architecture/` exist in code
3. **Verify in actual code** before making architectural claims
4. **Reference package.json** for real dependencies, not aspirational docs

**Example Scenarios:**

❌ **WRONG:**

> "QuikAdmin uses Kubernetes for orchestration and Kong as an API gateway."

✅ **CORRECT:**

> "QuikAdmin currently uses a monolithic Express API with nginx reverse proxy. The architecture vision includes Kubernetes and Kong for future enterprise scale."

❌ **WRONG:**

> "The system has 6 microservices: Document Input, Data Extraction, Intelligence, Form Processing, Validation, and Orchestration."

✅ **CORRECT:**

> "QuikAdmin is currently a monolithic Express API with all services in a single codebase (src/services/). The architecture vision plans for microservices at enterprise scale."

---

## File Naming Convention

- **`CURRENT_ARCHITECTURE.md`** - Always singular, always at `docs/` root
- **`architecture/`** - Contains aspirational designs for future scale
- **`architecture-vision/`** - Alternative name if clarity needed

---

## Maintenance Checklist

### After Major Code Changes:

- [ ] Update `docs/CURRENT_ARCHITECTURE.md` with actual changes
- [ ] Verify technology stack section matches `package.json`
- [ ] Update service descriptions with new line counts (`wc -l`)
- [ ] Document new API endpoints that were implemented
- [ ] Add new technical debt to "Known Issues" section

### After Strategic Planning:

- [ ] Update `docs/architecture/` vision documents
- [ ] Keep future roadmap aligned with business goals
- [ ] Do NOT mark vision features as "implemented" prematurely

---

## Questions?

If you're unsure whether something belongs in **Current** vs **Vision**:

**Ask yourself:** _"Can I point to the actual code that implements this?"_

- **YES** → Update `CURRENT_ARCHITECTURE.md`
- **NO** → Update `architecture/` vision docs

---

**Last Updated:** 2025-01-10
**Maintained By:** Development team + Claude Code
