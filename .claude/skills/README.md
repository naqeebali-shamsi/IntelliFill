# IntelliFill Claude Code Skills

This directory contains Claude Code skills for the IntelliFill project. Skills provide specialized domain knowledge and patterns that **lazy-load on demand** instead of consuming context upfront.

## Context Optimization

**Skills vs MCP Servers**: Skills save significant context by loading only when needed.

| MCP Server | Tokens (upfront) | Skill Replacement | Tokens (lazy) |
|------------|------------------|-------------------|---------------|
| puppeteer | ~4,800 | browser-testing | 0 until invoked |
| magic/21st | ~3,400 | ui-components | 0 until invoked |
| sequential-thinking | ~1,600 | (removed) | 0 |
| **Total saved** | **~9,800** | | |

See [docs/context-optimization.md](../../docs/context-optimization.md) for full optimization guide.

## Available Skills

### Compact Skills (Context Optimized)

| Skill | Description | Replaces MCP |
|-------|-------------|--------------|
| **browser-testing** | Browser automation for testing. Puppeteer patterns for IntelliFill. | puppeteer (~4.8k tokens) |
| **ui-components** | React component patterns with CVA, Radix UI, TailwindCSS. | magic (~3.4k tokens) |

### Comprehensive Skills

| Skill | Description | Lines | Use When |
|-------|-------------|-------|----------|
| **backend-api** | Express.js API development with Prisma, Supabase auth, Joi validation, Bull queues | 716 | Creating API routes, services, or middleware |
| **frontend-component** | React component development with forwardRef, CVA variants, Radix UI, TailwindCSS | 759 | Creating UI components, forms, or pages |
| **zustand-store** | Zustand state management with immer, persist, and devtools middleware | 813 | Adding state management for features |
| **testing** | Jest (backend) and Vitest (frontend) testing patterns | 823 | Writing unit, integration, or component tests |
| **prisma-database** | Prisma ORM schema design and database operations | 832 | Modifying schema, writing queries, migrations |
| **docker-devops** | Docker orchestration and CI/CD pipelines | 848 | Configuring containers, writing workflows |
| **documentation** | Documentation maintenance following Diátaxis framework | 774 | Creating/updating docs, API references, guides |
| **e2e-testing** | Cypress and Playwright end-to-end testing | 793 | Writing E2E tests, custom commands, CI integration |

## Skill Structure

Each skill follows this structure:

```
[skill-name]/
└── SKILL.md          # Complete skill documentation
```

## SKILL.md Format

Each SKILL.md contains:

1. **Frontmatter** - YAML metadata with name and description
2. **Table of Contents** - Navigation for the skill
3. **Comprehensive Sections** - Detailed guidance for the domain
4. **Code Examples** - Real, working examples from IntelliFill
5. **Best Practices** - Proven patterns and conventions
6. **References** - Links to official documentation

## Using Skills

Claude Code automatically loads skills from this directory. When relevant to a task, the appropriate skill will be invoked to provide:

- Domain-specific patterns and conventions
- Code templates and examples
- Best practices and common pitfalls
- Testing strategies
- Integration guidelines

## Skill Coverage

### Backend Development
- **backend-api**: Route handlers, services, middleware
- **testing**: Jest unit and integration tests
- **prisma-database**: Schema design, migrations, queries

### Frontend Development
- **frontend-component**: React components, UI patterns
- **zustand-store**: State management patterns
- **testing**: Vitest component tests

### DevOps & Infrastructure
- **docker-devops**: Containers, orchestration, CI/CD
- **e2e-testing**: End-to-end test automation

### Documentation
- **documentation**: Diátaxis framework, API docs, guides

## Maintenance

Skills are living documents that should be updated when:

1. **Patterns change** - New conventions adopted
2. **Tools updated** - Dependencies upgraded
3. **Features added** - New capabilities introduced
4. **Best practices evolve** - Better approaches discovered

## Skill Invocation

Skills are automatically invoked when:

1. Task matches skill domain (e.g., "create API endpoint" → backend-api)
2. User explicitly requests skill assistance
3. Agent determines skill would improve quality
4. Complex task requires domain expertise

## Quality Standards

Each skill maintains:

- **Completeness**: 700+ lines of comprehensive guidance
- **Accuracy**: Code examples tested and working
- **Currency**: Updated with latest project patterns
- **Clarity**: Clear explanations and examples
- **Consistency**: Follows project conventions

## Integration with CLAUDE.md

Skills complement the CLAUDE.md files:

- **CLAUDE.md**: High-level project context and guidelines
- **Skills**: Deep, actionable domain-specific knowledge

Use CLAUDE.md for understanding the project, skills for implementing features.

## Contributing

When adding or updating skills:

1. Follow existing SKILL.md structure
2. Include frontmatter with name and description
3. Provide comprehensive code examples
4. Test all code examples
5. Update this README if adding new skills
6. Maintain 700+ lines for thoroughness

## Version

Created: 2025-12-12
Skills: 8 core domains
Total Lines: 6,358 (average 795 per skill)

## Related Documentation

- [CLAUDE.local.md](../../CLAUDE.local.md) - Local development context
- [quikadmin/CLAUDE.md](../../quikadmin/CLAUDE.md) - Backend AI context
- [quikadmin-web/CLAUDE.md](../../quikadmin-web/CLAUDE.md) - Frontend AI context
- [docs/](../../docs/) - Diátaxis documentation
- [AGENTS.md](../../AGENTS.md) - Task Master integration
