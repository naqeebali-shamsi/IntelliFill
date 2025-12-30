# Task Master Provider Configuration Check

**Created**: 2025-12-19
**Purpose**: Document Task Master AI provider configuration for standardization

---

## 1. Current Configuration

### File: `quikadmin/.taskmaster/config.json`

```json
{
  "models": {
    "main": {
      "provider": "anthropic",
      "modelId": "claude-sonnet-4-5-20250929",
      "maxTokens": 64000,
      "temperature": 0.2
    },
    "research": {
      "provider": "perplexity",
      "modelId": "sonar-pro",
      "maxTokens": 8700,
      "temperature": 0.1
    },
    "fallback": {
      "provider": "claude-code",
      "modelId": "opus",
      "maxTokens": 32000,
      "temperature": 0.2
    }
  },
  "global": {
    "logLevel": "info",
    "debug": false,
    "defaultNumTasks": 10,
    "defaultSubtasks": 5,
    "defaultPriority": "medium",
    "projectName": "Taskmaster",
    "ollamaBaseURL": "http://localhost:11434/api",
    "bedrockBaseURL": "https://bedrock.us-east-1.amazonaws.com",
    "responseLanguage": "English",
    "enableCodebaseAnalysis": true,
    "enableProxy": false,
    "defaultTag": "master",
    "azureOpenaiBaseURL": "https://your-endpoint.openai.azure.com/",
    "userId": "<REDACTED>"
  },
  "claudeCode": {},
  "codexCli": {},
  "grokCli": {
    "timeout": 120000,
    "workingDirectory": null,
    "defaultModel": "grok-4-latest"
  }
}
```

### Current Provider Summary

| Role     | Provider    | Model                      | Status |
| -------- | ----------- | -------------------------- | ------ |
| Main     | anthropic   | claude-sonnet-4-5-20250929 | Active |
| Research | perplexity  | sonar-pro                  | Active |
| Fallback | claude-code | opus                       | Active |

**Note**: Gemini is **not currently configured** in any role.

---

## 2. API Keys / Model Setup (from CLAUDE.md)

### Section: Configuration & Setup

> ### API Keys Required
>
> At least **one** of these API keys must be configured:
>
> - `ANTHROPIC_API_KEY` (Claude models) - **Recommended**
> - `PERPLEXITY_API_KEY` (Research features) - **Highly recommended**
> - `OPENAI_API_KEY` (GPT models)
> - `GOOGLE_API_KEY` (Gemini models)
> - `MISTRAL_API_KEY` (Mistral models)
> - `OPENROUTER_API_KEY` (Multiple models)
> - `XAI_API_KEY` (Grok models)
>
> An API key is required for any provider used across any of the 3 roles defined in the `models` command.

### Section: Model Configuration

> ```bash
> # Interactive setup (recommended)
> task-master models --setup
>
> # Set specific models
> task-master models --set-main claude-3-5-sonnet-20241022
> task-master models --set-research perplexity-llama-3.1-sonar-large-128k-online
> task-master models --set-fallback gpt-4o-mini
> ```

### Section: MCP Integration (env vars)

> ```json
> {
>   "mcpServers": {
>     "task-master-ai": {
>       "env": {
>         "ANTHROPIC_API_KEY": "your_key_here",
>         "PERPLEXITY_API_KEY": "your_key_here",
>         "OPENAI_API_KEY": "OPENAI_API_KEY_HERE",
>         "GOOGLE_API_KEY": "GOOGLE_API_KEY_HERE",
>         "XAI_API_KEY": "XAI_API_KEY_HERE",
>         "OPENROUTER_API_KEY": "OPENROUTER_API_KEY_HERE",
>         "MISTRAL_API_KEY": "MISTRAL_API_KEY_HERE",
>         "AZURE_OPENAI_API_KEY": "AZURE_OPENAI_API_KEY_HERE",
>         "OLLAMA_API_KEY": "OLLAMA_API_KEY_HERE"
>       }
>     }
>   }
> }
> ```

---

## 3. Gemini Standardization Note

### Target Provider: **Gemini (Google)**

### Environment Variable Name

Task Master uses: **`GOOGLE_API_KEY`**

(Not `GEMINI_API_KEY`)

### Current State

- Gemini is **not configured** in `config.json`
- The config uses Anthropic (main), Perplexity (research), and Claude Code (fallback)
- To switch to Gemini, would need to:
  1. Set `GOOGLE_API_KEY` in environment
  2. Run `task-master models --setup` or manually update config
  3. Change provider to `google` with appropriate Gemini model ID

### Available Gemini Models (typical)

| Model ID         | Use Case             |
| ---------------- | -------------------- |
| gemini-2.0-flash | Fast, cost-effective |
| gemini-1.5-pro   | High capability      |
| gemini-1.5-flash | Balanced             |

### Migration Command

```bash
# To switch main model to Gemini
task-master models --set-main gemini-2.0-flash

# Or use interactive setup
task-master models --setup
```

### Required Environment Variable

```bash
# In .env or shell
GOOGLE_API_KEY=<your-google-api-key>
```

---

## Summary

| Item                 | Value                                       |
| -------------------- | ------------------------------------------- |
| Recommended provider | Gemini (Google)                             |
| Environment variable | `GOOGLE_API_KEY`                            |
| Currently configured | No (using Anthropic/Perplexity/Claude Code) |
| Config location      | `quikadmin/.taskmaster/config.json`         |
| Setup command        | `task-master models --setup`                |
