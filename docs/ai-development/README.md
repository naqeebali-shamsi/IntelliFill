# AI Development

This section contains guides specifically for AI-assisted development of IntelliFill. It covers workflows, integrations, and best practices for working with AI agents.

---

## Available Guides

### [Agentic Workflows](./agentic-workflows.md)

Working effectively with AI agents:
- Session initialization
- Context management
- Task execution patterns
- Code review and validation

### [MCP Integration](./mcp-integration.md)

Model Context Protocol setup and usage:
- MCP server configuration
- Available tools
- Task Master integration
- Troubleshooting

---

## Key Context Files

AI agents should read these files in order:

| Order | File | Purpose |
|-------|------|---------|
| 1 | [CLAUDE.local.md](../../CLAUDE.local.md) | Local development context |
| 2 | [AGENTS.md](../../AGENTS.md) | Unified agent guide |
| 3 | [quikadmin/CLAUDE.md](../../quikadmin/CLAUDE.md) | Backend AI context |
| 4 | [quikadmin-web/CLAUDE.md](../../quikadmin-web/CLAUDE.md) | Frontend AI context |

---

## Quick Start for AI Agents

### 1. Verify Environment

```bash
# Check backend
curl http://localhost:3002/health

# Check frontend
curl http://localhost:8080
```

### 2. Understand Project Structure

```
IntelliFill/
├── quikadmin/          # Backend (Express + TypeScript)
├── quikadmin-web/      # Frontend (React + Vite)
├── docs/               # Documentation (you are here)
└── extension/          # Browser extension
```

### 3. Follow Development Standards

- **Backend**: Use npm, follow Express patterns
- **Frontend**: Use bun, follow React patterns
- **Both**: TypeScript strict mode, proper types

### 4. Update Documentation

When making changes:
- Update relevant docs in `docs/`
- Update API docs for endpoint changes
- Update context files if architecture changes

---

## Task Master Integration

IntelliFill uses Task Master for task-driven development:

```bash
# View available tasks
task-master list

# Get next task
task-master next

# Show task details
task-master show <id>

# Mark complete
task-master set-status --id=<id> --status=done
```

See [MCP Integration](./mcp-integration.md) for full details.

---

## AI Agent Best Practices

### Do

- Read context files before making changes
- Follow existing code patterns
- Write tests for new code
- Update documentation
- Use TypeScript properly

### Don't

- Make changes without understanding context
- Ignore existing patterns
- Skip tests
- Leave documentation outdated
- Use `any` type

---

## Related Documentation

- [CLAUDE.local.md](../../CLAUDE.local.md) - Local development context
- [AGENTS.md](../../AGENTS.md) - Unified agent guide
- [.cursorrules](../../.cursorrules) - Cursor IDE rules

