---
title: 'Documentation Hub'
description: 'Central navigation hub for all IntelliFill documentation organized by the Diataxis framework'
category: 'reference'
lastUpdated: '2026-01-25'
status: 'active'
---

# IntelliFill Documentation Hub

Welcome to the IntelliFill documentation. This documentation follows the [Diátaxis framework](https://diataxis.fr/) to organize content by user needs.

---

## Documentation Structure

### [Tutorials](./tutorials/) - Learning-Oriented

Step-by-step lessons for newcomers to learn by doing.

- [Developer Quickstart](./tutorials/developer-quickstart.md) - Get running in 15 minutes
- [Getting Started](./tutorials/getting-started.md) - Set up your development environment
- [Your First Document](./tutorials/first-document.md) - Upload and process a document
- [Understanding the Workflow](./tutorials/understanding-workflow.md) - Learn the OCR → Extract → Fill flow

### [How-To Guides](./how-to/) - Problem-Oriented

Practical guides to accomplish specific tasks.

- **Development**
  - [Local Setup](./how-to/development/local-setup.md) - Set up local development
  - [Database Setup](./how-to/development/database-setup.md) - Configure PostgreSQL/Neon
  - [Testing](./how-to/development/testing.md) - Run and write tests
- **Deployment**
  - [Docker Deployment](./how-to/deployment/docker-deployment.md) - Deploy with Docker
- **Troubleshooting**
  - [Database Issues](./how-to/troubleshooting/database-issues.md) - Fix connection problems
  - [Authentication Issues](./how-to/troubleshooting/auth-issues.md) - Resolve auth errors

### [Reference](./reference/) - Information-Oriented

Technical descriptions and specifications.

- **API**
  - [Endpoints](./reference/api/endpoints.md) - Complete API reference
  - [OpenAPI Specification](./reference/api/openapi.yaml) - OpenAPI 3.0 spec (Swagger)
- **Configuration**
  - [Environment Variables](./reference/configuration/environment.md) - All configuration options
- **Architecture**
  - [System Overview](./reference/architecture/system-overview.md) - Architecture documentation
  - [Core Algorithms](./reference/architecture/core-algorithms.md) - Algorithm deep dives
  - [Extension Points](./reference/architecture/extension-points.md) - How to extend IntelliFill
- **Database**
  - [Schema](./reference/database/schema.md) - Database schema reference

### [Explanation](./explanation/) - Understanding-Oriented

Conceptual discussions to deepen understanding.

- [Architecture Decisions](./explanation/architecture-decisions.md) - Why we built it this way
- [Security Model](./explanation/security-model.md) - How security works
- [Data Flow](./explanation/data-flow.md) - How data moves through the system

### [Business Documentation](./business/) - Investor & Stakeholder Materials

Documentation for investors, stakeholders, and business development.

- [Executive Summary](./business/executive-summary.md) - One-page overview for investors
- [Technical Differentiators](./business/technical-differentiators.md) - What sets IntelliFill apart
- [Pitch Deck Outline](./business/pitch-deck-outline.md) - Slide-by-slide outline for presentations

### [AI Development](./ai-development/) - AI Agent Guides

Specialized guides for AI-assisted development.

- [Agentic Workflows](./ai-development/agentic-workflows.md) - Working with AI agents
- [MCP Integration](./ai-development/mcp-integration.md) - Model Context Protocol setup

---

## Quick Links

### For New Developers

1. Start with [Getting Started](./tutorials/getting-started.md)
2. Then try [Your First Document](./tutorials/first-document.md)
3. Read [System Overview](./reference/architecture/system-overview.md)

### For AI Agents

1. Read [CLAUDE.local.md](../CLAUDE.local.md) first
2. Then [Agentic Workflows](./ai-development/agentic-workflows.md)
3. Check [AGENTS.md](../AGENTS.md) for integration

### For Contributors

1. [Local Setup](./how-to/development/local-setup.md)
2. [Testing Guide](./how-to/development/testing.md)
3. [API Reference](./reference/api/endpoints.md)

---

## Project Structure

```
IntelliFill/
├── quikadmin/              # Backend API (Express + TypeScript)
│   └── docs/               # Backend-specific docs
├── quikadmin-web/          # Frontend UI (React + Vite)
│   └── docs/               # Frontend-specific docs
├── extension/              # Browser extension
├── docs/                   # This unified documentation
│   ├── tutorials/          # Learning-oriented
│   ├── how-to/             # Problem-oriented
│   ├── reference/          # Information-oriented
│   ├── explanation/        # Understanding-oriented
│   └── ai-development/     # AI-specific guides
└── CLAUDE.local.md         # Local AI context
```

---

## Technology Stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| **Backend**  | Node.js, Express, TypeScript, Prisma    |
| **Frontend** | React 18, Vite, TypeScript, TailwindCSS |
| **Database** | PostgreSQL (Neon Serverless)            |
| **Auth**     | Supabase Auth + JWT                     |
| **OCR**      | Tesseract.js                            |
| **PDF**      | pdf-lib                                 |
| **State**    | Zustand                                 |
| **Testing**  | Jest, Vitest, Cypress                   |

---

## Related Documentation

- [Backend Docs](../quikadmin/docs/) - Express API documentation
- [Frontend Docs](../quikadmin-web/docs/) - React UI documentation
- [CLAUDE.local.md](../CLAUDE.local.md) - AI development context
- [AGENTS.md](../AGENTS.md) - AI agent integration guide

---

## Contributing

When updating documentation:

1. Follow Diátaxis principles for content placement
2. Update cross-references when moving content
3. Add YAML frontmatter to new documents
4. Test all code examples
5. Update `lastUpdated` in frontmatter

## Maintenance

**This is a living documentation system.** Documentation must be kept current with the codebase.

See [MAINTENANCE.md](./MAINTENANCE.md) for:

- Documentation update triggers
- Quality standards
- AI agent instructions
- Stale documentation detection

### Quick Reference: When to Update Docs

| Code Change             | Update                                   |
| ----------------------- | ---------------------------------------- |
| API change              | `reference/api/endpoints.md`             |
| Config change           | `reference/configuration/environment.md` |
| Schema change           | `reference/database/schema.md`           |
| Known issue found/fixed | `../CLAUDE.local.md`                     |

---

**Last Updated**: 2026-01-25
