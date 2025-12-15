<#
.SYNOPSIS
    MCP Server Toggle Script for Claude Code Context Optimization

.DESCRIPTION
    Toggles between different MCP server configurations to optimize context usage.
    Based on research from: https://scottspence.com/posts/optimising-mcp-server-context-usage-in-claude-code

.PARAMETER Mode
    The MCP configuration mode:
    - minimal: Only essential servers (taskmaster, context7) ~2.8k tokens
    - standard: Common development servers ~8k tokens
    - full: All servers including UI tools ~18k tokens
    - browser: Enable browser automation (puppeteer) for testing
    - ui: Enable UI component tools (magic/21st.dev)

.EXAMPLE
    .\mcp-toggle.ps1 -Mode minimal

.EXAMPLE
    .\mcp-toggle.ps1 -Mode browser
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("minimal", "standard", "full", "browser", "ui", "status")]
    [string]$Mode
)

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$McpConfigPath = Join-Path $ProjectRoot ".mcp.json"
$GlobalConfigPath = "$env:APPDATA\Claude\claude_desktop_config.json"

# Configuration templates
$MinimalConfig = @{
    mcpServers = @{
        "task-master-ai" = @{
            type = "stdio"
            command = "npx"
            args = @("-y", "task-master-ai")
            env = @{
                ANTHROPIC_API_KEY = "`${ANTHROPIC_API_KEY}"
                PERPLEXITY_API_KEY = "`${PERPLEXITY_API_KEY}"
            }
        }
        "context7" = @{
            command = "npx"
            args = @("-y", "@upstash/context7-mcp@latest")
        }
    }
}

$StandardConfig = @{
    mcpServers = @{
        "task-master-ai" = @{
            type = "stdio"
            command = "npx"
            args = @("-y", "task-master-ai")
            env = @{
                ANTHROPIC_API_KEY = "`${ANTHROPIC_API_KEY}"
                PERPLEXITY_API_KEY = "`${PERPLEXITY_API_KEY}"
            }
        }
        "context7" = @{
            command = "npx"
            args = @("-y", "@upstash/context7-mcp@latest")
        }
        "sequential-thinking" = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-sequential-thinking@latest")
        }
    }
}

$FullConfig = @{
    mcpServers = @{
        "task-master-ai" = @{
            type = "stdio"
            command = "npx"
            args = @("-y", "task-master-ai")
            env = @{
                ANTHROPIC_API_KEY = "`${ANTHROPIC_API_KEY}"
                PERPLEXITY_API_KEY = "`${PERPLEXITY_API_KEY}"
            }
        }
        "context7" = @{
            command = "npx"
            args = @("-y", "@upstash/context7-mcp@latest")
        }
        "sequential-thinking" = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-sequential-thinking@latest")
        }
        "magic" = @{
            command = "npx"
            args = @("-y", "@21st-dev/magic@latest")
        }
        "puppeteer" = @{
            command = "npx"
            args = @("-y", "puppeteer-mcp-server")
        }
    }
}

$BrowserConfig = @{
    mcpServers = @{
        "task-master-ai" = @{
            type = "stdio"
            command = "npx"
            args = @("-y", "task-master-ai")
            env = @{
                ANTHROPIC_API_KEY = "`${ANTHROPIC_API_KEY}"
                PERPLEXITY_API_KEY = "`${PERPLEXITY_API_KEY}"
            }
        }
        "context7" = @{
            command = "npx"
            args = @("-y", "@upstash/context7-mcp@latest")
        }
        "puppeteer" = @{
            command = "npx"
            args = @("-y", "puppeteer-mcp-server")
        }
    }
}

$UIConfig = @{
    mcpServers = @{
        "task-master-ai" = @{
            type = "stdio"
            command = "npx"
            args = @("-y", "task-master-ai")
            env = @{
                ANTHROPIC_API_KEY = "`${ANTHROPIC_API_KEY}"
                PERPLEXITY_API_KEY = "`${PERPLEXITY_API_KEY}"
            }
        }
        "context7" = @{
            command = "npx"
            args = @("-y", "@upstash/context7-mcp@latest")
        }
        "magic" = @{
            command = "npx"
            args = @("-y", "@21st-dev/magic@latest")
        }
    }
}

function Get-TokenEstimate {
    param([hashtable]$Config)

    $estimates = @{
        "task-master-ai" = 0  # Loaded as agents, not MCP tools
        "context7" = 1844
        "sequential-thinking" = 1600
        "magic" = 3406
        "puppeteer" = 4777
    }

    $total = 0
    foreach ($server in $Config.mcpServers.Keys) {
        if ($estimates.ContainsKey($server)) {
            $total += $estimates[$server]
        }
    }
    return $total
}

function Show-Status {
    Write-Host "`n=== Claude Code MCP Configuration Status ===" -ForegroundColor Cyan

    if (Test-Path $McpConfigPath) {
        $currentConfig = Get-Content $McpConfigPath | ConvertFrom-Json -AsHashtable
        Write-Host "`nProject Config ($McpConfigPath):" -ForegroundColor Green
        $servers = $currentConfig.mcpServers.Keys
        foreach ($server in $servers) {
            Write-Host "  - $server" -ForegroundColor White
        }
        $tokens = Get-TokenEstimate $currentConfig
        Write-Host "`nEstimated MCP token usage: ~$tokens tokens" -ForegroundColor Yellow
    } else {
        Write-Host "`nNo project-level .mcp.json found" -ForegroundColor Yellow
    }

    if (Test-Path $GlobalConfigPath) {
        $globalConfig = Get-Content $GlobalConfigPath | ConvertFrom-Json -AsHashtable
        Write-Host "`nGlobal Config ($GlobalConfigPath):" -ForegroundColor Blue
        if ($globalConfig.mcpServers) {
            foreach ($server in $globalConfig.mcpServers.Keys) {
                Write-Host "  - $server" -ForegroundColor White
            }
        }
    }

    Write-Host "`n=== Token Savings Guide ===" -ForegroundColor Cyan
    Write-Host "  minimal:  ~2.8k tokens  (taskmaster + context7)"
    Write-Host "  standard: ~4.4k tokens  (+ sequential-thinking)"
    Write-Host "  browser:  ~7.6k tokens  (+ puppeteer)"
    Write-Host "  ui:       ~6.2k tokens  (+ magic)"
    Write-Host "  full:     ~11.6k tokens (all servers)"
}

# Main execution
switch ($Mode) {
    "status" {
        Show-Status
    }
    "minimal" {
        $MinimalConfig | ConvertTo-Json -Depth 10 | Set-Content $McpConfigPath
        Write-Host "Switched to MINIMAL mode (~2.8k tokens)" -ForegroundColor Green
        Write-Host "Active: taskmaster, context7" -ForegroundColor White
        Write-Host "`nRestart Claude Code for changes to take effect" -ForegroundColor Yellow
    }
    "standard" {
        $StandardConfig | ConvertTo-Json -Depth 10 | Set-Content $McpConfigPath
        Write-Host "Switched to STANDARD mode (~4.4k tokens)" -ForegroundColor Green
        Write-Host "Active: taskmaster, context7, sequential-thinking" -ForegroundColor White
        Write-Host "`nRestart Claude Code for changes to take effect" -ForegroundColor Yellow
    }
    "full" {
        $FullConfig | ConvertTo-Json -Depth 10 | Set-Content $McpConfigPath
        Write-Host "Switched to FULL mode (~11.6k tokens)" -ForegroundColor Green
        Write-Host "Active: taskmaster, context7, sequential-thinking, magic, puppeteer" -ForegroundColor White
        Write-Host "`nRestart Claude Code for changes to take effect" -ForegroundColor Yellow
    }
    "browser" {
        $BrowserConfig | ConvertTo-Json -Depth 10 | Set-Content $McpConfigPath
        Write-Host "Switched to BROWSER mode (~7.6k tokens)" -ForegroundColor Green
        Write-Host "Active: taskmaster, context7, puppeteer" -ForegroundColor White
        Write-Host "`nRestart Claude Code for changes to take effect" -ForegroundColor Yellow
    }
    "ui" {
        $UIConfig | ConvertTo-Json -Depth 10 | Set-Content $McpConfigPath
        Write-Host "Switched to UI mode (~6.2k tokens)" -ForegroundColor Green
        Write-Host "Active: taskmaster, context7, magic" -ForegroundColor White
        Write-Host "`nRestart Claude Code for changes to take effect" -ForegroundColor Yellow
    }
}

Write-Host "`nTip: Use '/mcp' in Claude Code to toggle servers during a session without restart" -ForegroundColor Cyan
