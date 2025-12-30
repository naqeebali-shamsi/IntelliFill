# Proposed Documentation Structure

**Date:** 2025-12-30
**Status:** Approved for Implementation

## Decision: Keep Diataxis Structure

After analysis, the current `docs/` Diataxis structure is **correct and industry-standard**.

**DO NOT** migrate to numbered prefixes (00-06) as suggested in old MIGRATION_GUIDE.

## Final Structure

```
IntelliFill/
├── CLAUDE.local.md              # Root AI context (64 lines) ✓
├── AGENTS.md                    # Agent integration guide ✓
│
├── docs/                        # SINGLE SOURCE OF TRUTH
│   ├── README.md                # Main hub with navigation
│   ├── MAINTENANCE.md           # Maintenance guide
│   │
│   ├── tutorials/               # Learning-oriented (Diataxis)
│   │   ├── README.md
│   │   ├── getting-started.md
│   │   ├── first-document.md
│   │   └── understanding-workflow.md
│   │
│   ├── how-to/                  # Problem-oriented (Diataxis)
│   │   ├── README.md
│   │   ├── deployment/
│   │   │   ├── docker-deployment.md
│   │   │   ├── render-deployment.md
│   │   │   └── upstash-redis-setup.md
│   │   ├── development/
│   │   │   ├── local-setup.md
│   │   │   ├── database-setup.md
│   │   │   └── testing.md
│   │   └── troubleshooting/
│   │       ├── auth-issues.md
│   │       ├── database-issues.md
│   │       └── deployment-issues.md
│   │
│   ├── reference/               # Information-oriented (Diataxis)
│   │   ├── README.md
│   │   ├── api/
│   │   │   └── endpoints.md
│   │   ├── architecture/
│   │   │   ├── system-overview.md
│   │   │   ├── extracted-data-lifecycle.md
│   │   │   ├── dynamic-pii-architecture.md      # MOVED from docs/architecture/
│   │   │   └── dynamic-pii-architecture-options.md
│   │   ├── configuration/
│   │   │   └── environment.md
│   │   ├── database/
│   │   │   └── schema.md
│   │   ├── monitoring/
│   │   │   └── instrumentation-strategy.md
│   │   └── security/
│   │       └── field-level-encryption.md
│   │
│   ├── explanation/             # Understanding-oriented (Diataxis)
│   │   ├── README.md
│   │   ├── architecture-decisions.md
│   │   ├── security-model.md
│   │   ├── data-flow.md
│   │   └── adr/
│   │       ├── ADR-001-document-processing-pipeline.md
│   │       └── ADR-001-document-relationship-design.md  # MOVED from docs/decisions/
│   │
│   ├── ai-development/          # AI agent guides
│   │   ├── README.md
│   │   ├── agentic-workflows.md
│   │   └── mcp-integration.md
│   │
│   ├── prd/                     # Product requirements
│   │   ├── PRD.md
│   │   ├── PRD-vector-search-implementation.md
│   │   └── PRD-vector-search-implementation-v2.md
│   │
│   ├── strategy/                # Strategic docs
│   │   ├── go-to-market-plan-2025-12.md
│   │   ├── UNIFIED_IMPLEMENTATION_STRATEGY.md
│   │   └── MULTI_AGENT_FEASIBILITY_ANALYSIS.md
│   │
│   ├── guides/                  # Specialized guides
│   │   ├── user/
│   │   │   └── chrome-extension.md
│   │   └── developer/
│   │       └── extension-architecture.md
│   │
│   ├── .meta/                   # Documentation metadata
│   │   ├── inventory.json
│   │   ├── inventory-summary.md
│   │   ├── quality-report.md
│   │   ├── proposed-structure.md
│   │   ├── migration-plan.md
│   │   └── templates/
│   │
│   └── _archive/                # Archived/deprecated content
│       ├── README.md
│       ├── claude-audit/
│       ├── debug/
│       ├── sales/
│       └── tech-debt/
│
├── quikadmin/
│   ├── CLAUDE.md                # Backend context (TARGET: <500 lines)
│   └── docs/                    # TO BE DEPRECATED
│       └── (121 files -> review for unique content, then archive)
│
├── quikadmin-web/
│   ├── CLAUDE.md                # Frontend context (555 lines) ✓
│   └── docs/                    # TO BE DEPRECATED
│       └── (44 files -> review for unique content, then archive)
│
└── .claude/
    └── skills/                  # AI agent skills (15 files) ✓
```

## Key Decisions

### 1. Single Source of Truth: `docs/`

All project documentation lives in `docs/`. Package-specific details go in CLAUDE.md files.

### 2. Diataxis Framework

- **tutorials/** - Learning-oriented (newcomers)
- **how-to/** - Problem-oriented (specific tasks)
- **reference/** - Information-oriented (lookup)
- **explanation/** - Understanding-oriented (concepts)

### 3. CLAUDE.md Purpose

- Essential context only (commands, paths, patterns)
- Link to `docs/` for detailed information
- Target: <500 lines each

### 4. Archive Strategy

- Move temporary/one-off docs to `_archive/`
- Keep for reference but mark as not maintained
- Include README explaining archive purpose

## Directories to Consolidate

| Source               | Target                         | Action       |
| -------------------- | ------------------------------ | ------------ |
| `docs/architecture/` | `docs/reference/architecture/` | Move 2 files |
| `docs/decisions/`    | `docs/explanation/adr/`        | Move 1 file  |
| `docs/claude-audit/` | `docs/_archive/claude-audit/`  | Archive      |
| `docs/debug/`        | `docs/_archive/debug/`         | Archive      |
| `docs/sales/`        | `docs/_archive/sales/`         | Archive      |
| `docs/tech-debt/`    | `docs/_archive/tech-debt/`     | Archive      |

## Files to Delete/Update

| File                                          | Action                              |
| --------------------------------------------- | ----------------------------------- |
| `docs/.meta/DOCUMENTATION_MIGRATION_GUIDE.md` | Update to reflect Diataxis decision |
| `docs/.meta/STRUCTURE_DIAGRAM.md`             | Update with final structure         |
