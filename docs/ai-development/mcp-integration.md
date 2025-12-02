---
title: MCP Integration
description: Model Context Protocol setup and usage for IntelliFill
category: ai-development
tags: [mcp, integration, task-master, ai]
lastUpdated: 2025-11-25
---

# MCP Integration

This guide covers the Model Context Protocol (MCP) integration for IntelliFill, primarily through Task Master for task-driven development.

---

## What is MCP?

Model Context Protocol (MCP) is a standard for AI agents to interact with external tools and services. IntelliFill uses MCP primarily through Task Master for managing development tasks.

---

## Task Master MCP Setup

### Configuration

MCP is configured in `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "your-api-key",
        "PERPLEXITY_API_KEY": "your-perplexity-key"
      }
    }
  }
}
```

### Required API Keys

| Key | Purpose | Required |
|-----|---------|----------|
| ANTHROPIC_API_KEY | Claude models for task generation | Yes |
| PERPLEXITY_API_KEY | Research-backed task expansion | Recommended |
| OPENAI_API_KEY | Alternative model support | Optional |

---

## MCP Tools

### Task Management Tools

```javascript
// Initialize project
initialize_project

// Parse PRD to create tasks
parse_prd

// List all tasks
get_tasks

// Get next available task
next_task

// Get specific task details
get_task

// Set task status
set_task_status

// Add new task
add_task

// Expand task into subtasks
expand_task

// Update task details
update_task
update_subtask
update  // Update multiple tasks

// Analyze complexity
analyze_project_complexity
complexity_report
```

### Tool Usage Examples

```javascript
// List pending tasks
get_tasks({ status: "pending" });

// Get next task
next_task();

// View task details
get_task({ id: "1" });

// Mark task complete
set_task_status({ id: "1", status: "done" });

// Add new task with research
add_task({ 
  prompt: "Implement password reset flow",
  research: true 
});

// Expand complex task
expand_task({ 
  id: "5", 
  research: true,
  force: true 
});
```

---

## CLI Fallback

If MCP is unavailable, use the Task Master CLI:

```bash
# Initialize
task-master init

# List tasks
task-master list

# Get next task
task-master next

# Show task
task-master show <id>

# Set status
task-master set-status --id=<id> --status=done

# Add task
task-master add-task --prompt="description" --research

# Expand task
task-master expand --id=<id> --research --force
```

---

## Task Workflow

### Standard Development Loop

```
1. Get available tasks
   └── MCP: get_tasks() or CLI: task-master list

2. Select next task
   └── MCP: next_task() or CLI: task-master next

3. Review task details
   └── MCP: get_task({id}) or CLI: task-master show <id>

4. Implement task
   └── Write code, tests, documentation

5. Complete task
   └── MCP: set_task_status({id, status:"done"})
   └── CLI: task-master set-status --id=<id> --status=done

6. Repeat
```

### Task Creation Flow

```
1. Analyze complexity
   └── MCP: analyze_project_complexity({research: true})

2. Create tasks from PRD
   └── MCP: parse_prd({input: "prd.md"})

3. Expand complex tasks
   └── MCP: expand_task({id, research: true})

4. Begin development loop
```

---

## Task Structure

Tasks have the following structure:

```json
{
  "id": "1",
  "title": "Implement user authentication",
  "description": "Set up JWT-based auth system",
  "status": "pending",
  "priority": "high",
  "dependencies": [],
  "details": "Implementation notes...",
  "testStrategy": "Unit tests for auth functions",
  "subtasks": []
}
```

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Ready to work on |
| `in-progress` | Currently being worked on |
| `done` | Completed and verified |
| `deferred` | Postponed |
| `cancelled` | No longer needed |
| `blocked` | Waiting on external factors |

---

## File Structure

Task Master creates these files:

```
.taskmaster/
├── tasks/
│   ├── tasks.json     # Main task database
│   ├── task-1.md      # Individual task files
│   └── task-2.md
├── docs/
│   └── prd.md         # Product requirements
├── reports/
│   └── task-complexity-report.json
├── templates/
│   └── example_prd.md
└── config.json        # AI model configuration
```

---

## Integration with Development

### Pre-Implementation

1. Review task with `get_task` or `task-master show`
2. Understand dependencies
3. Read related documentation
4. Plan implementation approach

### During Implementation

1. Update subtask progress with `update_subtask`
2. Log findings and decisions
3. Handle implementation drift

### Post-Implementation

1. Mark task complete with `set_task_status`
2. Update documentation
3. Move to next task

---

## Research Mode

Task Master supports research-backed operations:

```bash
# Add research to any command
task-master add-task --prompt="..." --research
task-master expand --id=<id> --research
task-master update --from=<id> --prompt="..." --research
```

Research mode:
- Uses Perplexity API for current information
- Improves task quality with real-world context
- Recommended for complex technical tasks

---

## Troubleshooting

### MCP Connection Issues

1. **Check configuration**:
   ```bash
   cat .mcp.json
   ```

2. **Verify API keys**:
   ```bash
   echo $ANTHROPIC_API_KEY
   ```

3. **Use CLI fallback**:
   ```bash
   task-master list
   ```

### Task Sync Issues

```bash
# Regenerate task files
task-master generate

# Fix dependency issues
task-master fix-dependencies
```

### Model Configuration

```bash
# View current models
task-master models

# Interactive setup
task-master models --setup

# Set specific model
task-master models --set-main claude-3-5-sonnet
```

---

## Best Practices

### Do

- Use MCP tools when available (faster, structured)
- Fall back to CLI when needed
- Use research mode for complex tasks
- Update task progress regularly
- Mark tasks complete promptly

### Don't

- Manually edit `tasks.json`
- Manually edit `.taskmaster/config.json`
- Re-initialize existing projects
- Skip task documentation
- Leave tasks in-progress when done

---

## AI-Powered Operations

These operations make AI calls (may take up to a minute):

| Operation | MCP Tool | CLI Command |
|-----------|----------|-------------|
| Parse PRD | `parse_prd` | `task-master parse-prd` |
| Analyze complexity | `analyze_project_complexity` | `task-master analyze-complexity` |
| Expand task | `expand_task` | `task-master expand` |
| Add task | `add_task` | `task-master add-task` |
| Update tasks | `update`, `update_task`, `update_subtask` | `task-master update*` |

---

## Related Documentation

- [Agentic Workflows](./agentic-workflows.md)
- [AGENTS.md](../../AGENTS.md) - Unified agent guide
- [Task Master Guide](../../quikadmin/AGENTS.md) - Detailed Task Master reference

