# Documentation Structure Diagram

Visual representation of the proposed documentation architecture.

---

## Directory Tree

```
docs/
│
├── README.md                          # Main hub (entry point)
│
├── .meta/                             # Documentation metadata
│   ├── index.json                     # Complete documentation index
│   ├── relationships.json             # Document dependencies
│   ├── status.json                    # Status tracking
│   ├── ai-context.json                # AI agent hints
│   ├── DOCUMENTATION_MIGRATION_GUIDE.md
│   └── templates/
│       ├── document-template.md
│       └── adr-template.md
│
├── 00-quick-start/                    # ⭐ START HERE
│   ├── README.md                      # Quick start hub
│   ├── ai-agent-setup.md              # AI agent initialization
│   ├── project-overview.md            # 5-minute overview
│   └── first-steps.md                 # Immediate actions
│
├── 01-current-state/                   # ✅ WHAT EXISTS (Reality)
│   ├── README.md                      # Current state hub
│   │
│   ├── architecture/                  # System architecture
│   │   ├── README.md
│   │   ├── system-overview.md         # Complete architecture
│   │   ├── quick-reference.md         # 5-minute summary
│   │   ├── security.md                # Security architecture
│   │   ├── data-flow.md               # Current data flow
│   │   └── components/                # Component docs
│   │       ├── README.md
│   │       └── [component].md
│   │
│   ├── api/                           # API documentation
│   │   ├── README.md                  # API hub
│   │   ├── endpoints/                  # Endpoint docs
│   │   │   ├── README.md
│   │   │   └── [endpoint].md
│   │   └── contracts/                  # API contracts
│   │       └── [contract].md
│   │
│   ├── database/                       # Database docs
│   │   ├── schema.md                  # Current schema
│   │   ├── migrations/                # Migration history
│   │   └── relationships.md            # Entity relationships
│   │
│   └── codebase/                       # Code organization
│       ├── structure.md               # Code structure
│       ├── patterns.md                # Coding patterns
│       └── conventions.md             # Code conventions
│
├── 02-guides/                          # 📖 HOW-TO GUIDES
│   ├── README.md                      # Guides hub
│   │
│   ├── development/                    # Development guides
│   │   ├── README.md
│   │   ├── setup-environment.md
│   │   ├── adding-features.md
│   │   ├── testing.md
│   │   └── debugging.md
│   │
│   ├── deployment/                     # Deployment guides
│   │   ├── README.md
│   │   ├── local.md
│   │   ├── staging.md
│   │   └── production.md
│   │
│   └── maintenance/                    # Maintenance guides
│       ├── README.md
│       ├── updating-docs.md
│       └── troubleshooting.md
│
├── 03-reference/                       # 📚 TECHNICAL REFERENCE
│   ├── README.md                      # Reference hub
│   │
│   ├── configuration/                  # Configuration reference
│   │   ├── environment-variables.md
│   │   ├── feature-flags.md
│   │   └── settings.md
│   │
│   ├── types/                          # Type definitions
│   │   ├── README.md
│   │   └── [types].md
│   │
│   └── commands/                       # Command reference
│       ├── README.md
│       └── [commands].md
│
├── 04-future-vision/                   # 🔮 WHAT WILL BE (⚠️ NOT IMPLEMENTED)
│   ├── README.md                      # Vision hub (with warnings)
│   │
│   ├── architecture/                   # Future architecture
│   │   ├── system-design.md           # Future system design
│   │   ├── migration-path.md          # How to get there
│   │   └── specifications/
│   │       └── [specs].md
│   │
│   └── roadmap/                        # Product roadmap
│       ├── README.md
│       └── [roadmap-items].md
│
├── 05-decisions/                       # 🎯 ARCHITECTURE DECISIONS
│   ├── README.md                      # ADR hub
│   ├── template.md                    # ADR template
│   └── [adr-number]-[name].md         # Individual ADRs
│
└── 06-archive/                         # 📦 DEPRECATED CONTENT
    ├── README.md                      # Archive index
    └── old-numbered-sections/         # Old 100-700 structure
        ├── 100-getting-started/
        ├── 200-architecture/
        ├── 300-api/
        └── ...
```

---

## Reading Flow for AI Agents

```
START
  │
  ├─→ 00-quick-start/ai-agent-setup.md
  │     │
  │     ├─→ 00-quick-start/project-overview.md
  │     │
  │     └─→ 01-current-state/architecture/quick-reference.md
  │           │
  │           ├─→ 01-current-state/architecture/system-overview.md
  │           │
  │           └─→ .meta/index.json (load full index)
  │
  └─→ [Continue based on task]
        │
        ├─→ 02-guides/ (if procedural)
        ├─→ 03-reference/ (if lookup)
        └─→ 01-current-state/ (if implementation)
```

---

## Priority Levels

### 🔴 Critical (Read First)
- `00-quick-start/ai-agent-setup.md`
- `00-quick-start/project-overview.md`
- `01-current-state/architecture/quick-reference.md`

### 🟡 Important (Read Before Implementation)
- `01-current-state/architecture/system-overview.md`
- `01-current-state/api/endpoints/`
- `02-guides/development/`

### 🟢 Reference (Lookup as Needed)
- `03-reference/configuration/`
- `03-reference/types/`
- `01-current-state/database/`

### ⚠️ Vision (Do NOT Assume Implemented)
- `04-future-vision/` (Everything here is NOT implemented)

---

## Document Relationships

```
system-overview.md
  ├─→ quick-reference.md (summary)
  ├─→ security.md (related)
  ├─→ data-flow.md (related)
  └─→ components/ (children)

api/endpoints/
  ├─→ depends on: architecture/system-overview.md
  └─→ related to: reference/types/

guides/development/
  ├─→ depends on: architecture/system-overview.md
  └─→ references: api/endpoints/
```

---

## Status Indicators

- ✅ **Active** - Current, maintained documentation
- ⚠️ **Deprecated** - Still exists but being phased out
- 📝 **Draft** - Work in progress
- 📦 **Archived** - Moved to archive, not deleted
- 🔮 **Vision** - Future plans, NOT implemented

---

## File Naming Convention

```
[category]-[descriptive-name].md

Categories:
- arch-*     Architecture
- api-*      API documentation
- guide-*    How-to guides
- ref-*      Reference
- dec-*      Decision records
- spec-*     Specifications
```

Examples:
- `arch-system-overview.md`
- `api-authentication-endpoints.md`
- `guide-setting-up-environment.md`
- `ref-environment-variables.md`
- `dec-001-auth-strategy.md`

---

## Metadata Flow

```
Document Created
  │
  ├─→ Add frontmatter metadata
  │
  ├─→ Set status, phase, priority
  │
  ├─→ Link code references
  │
  ├─→ Define relationships
  │
  └─→ Update .meta/index.json
```

---

**Last Updated:** 2025-01-XX  
**Status:** Proposal

