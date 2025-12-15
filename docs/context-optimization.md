# Claude Code Context Optimization Guide

This guide documents strategies to reduce Claude Code context usage for the IntelliFill project.

## Problem

Claude Code loads all configured MCP servers, agents, and memory files at startup. Before any conversation begins, significant context is consumed:

| Component | Tokens | % of 200k |
|-----------|--------|-----------|
| System prompt | ~3.1k | 1.5% |
| System tools | ~19.4k | 9.7% |
| MCP tools | ~11.6k | 5.8% |
| Custom agents | ~3.2k | 1.6% |
| Memory files | ~3.2k | 1.6% |
| **Total overhead** | **~40.5k** | **20%+** |

This leaves less context for actual conversation and code.

## Quick Solutions

### 1. Use `/mcp` Command (Session-Level)

Toggle MCP servers during your session without restart:

```
/mcp                    # Opens interactive MCP manager
@puppeteer disable      # Disable puppeteer for this session
@magic disable          # Disable magic/21st.dev tools
```

### 2. Use MCP Toggle Script (Persistent)

```powershell
# Switch to minimal config (saves ~9k tokens)
.\scripts\mcp-toggle.ps1 -Mode minimal

# Check current status
.\scripts\mcp-toggle.ps1 -Mode status

# Available modes:
# - minimal:  ~2.8k tokens (taskmaster + context7)
# - standard: ~4.4k tokens (+ sequential-thinking)
# - browser:  ~7.6k tokens (+ puppeteer for testing)
# - ui:       ~6.2k tokens (+ magic for UI components)
# - full:     ~11.6k tokens (all servers)
```

Restart Claude Code after running the script.

### 3. Optimize Memory Files

The CLAUDE.local.md file at project root is loaded on every session. Keep it concise - use links to detailed docs instead of inline content.

## MCP Server Token Usage

| Server | Tools | Tokens | When Needed |
|--------|-------|--------|-------------|
| task-master-ai | (agents) | ~0 | Always - task management |
| context7 | 2 | ~1.8k | Often - docs lookup |
| sequential-thinking | 1 | ~1.6k | Rarely - complex reasoning |
| magic | 4 | ~3.4k | Sometimes - UI generation |
| puppeteer | 8 | ~4.8k | Rarely - browser testing |

## Custom Agent Token Usage

| Agent | Tokens | When Needed |
|-------|--------|-------------|
| taskmaster agents (3) | ~889 | Task-driven development |
| frontend-developer | ~327 | React/UI work |
| devops-automator | ~334 | CI/CD setup |
| n8n-workflow-builder | ~464 | Automation workflows |
| mobile-* agents | ~600+ | Mobile development |

## Recommended Configurations

### Daily Development
```powershell
.\scripts\mcp-toggle.ps1 -Mode minimal
```
- taskmaster for task tracking
- context7 for documentation lookup
- ~2.8k tokens, saves ~9k vs full

### UI Component Work
```powershell
.\scripts\mcp-toggle.ps1 -Mode ui
```
- Add magic/21st.dev for component generation
- ~6.2k tokens

### Browser Testing
```powershell
.\scripts\mcp-toggle.ps1 -Mode browser
```
- Add puppeteer for automated testing
- ~7.6k tokens

### Complex Analysis
```powershell
.\scripts\mcp-toggle.ps1 -Mode standard
```
- Add sequential-thinking for complex reasoning
- ~4.4k tokens

## Manual Global Config

If you need to edit the global config directly:

**Location**: `%APPDATA%\Claude\claude_desktop_config.json`

Remove servers you don't need:
```json
{
  "mcpServers": {
    "context7": { ... },
    "sequential-thinking": { ... }
  }
}
```

## Project-Level Override

The `.mcp.json` file in the project root overrides global config. Edit it directly or use the toggle script.

**Location**: `N:\IntelliFill\.mcp.json`

## Best Practices

1. **Start minimal, add as needed** - Begin with minimal config, enable specific servers when needed
2. **Use `/mcp` for quick toggles** - No restart needed for session-level changes
3. **Keep memory files lean** - Link to docs instead of embedding content
4. **Use `/clear` frequently** - Reset context between different types of tasks
5. **Split complex tasks** - Use git worktrees with separate Claude sessions

## References

- [Optimising MCP Server Context Usage in Claude Code](https://scottspence.com/posts/optimising-mcp-server-context-usage-in-claude-code)
- [Claude Code MCP Feature Request #7336](https://github.com/anthropics/claude-code/issues/7336)
- [McPick - MCP Server Manager](https://github.com/spences10/mcpick)
- [Tool Search Tool - Anthropic](https://www.anthropic.com/engineering/advanced-tool-use)
