# harness-agentic-spec installer
# 用法：在仓库根目录执行 .\install.ps1
# 可选参数：
#   -SkipClaude   不写入 Claude Code 配置
#   -SkipCodex    不写入 Codex 配置

param(
    [switch]$SkipClaude,
    [switch]$SkipCodex
)

$ErrorActionPreference = "Stop"
$KitRoot = $PSScriptRoot
$User    = $env:USERPROFILE

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!]  $msg" -ForegroundColor Yellow }

# ── 1. Skills ─────────────────────────────────────────────────────────────────
Write-Step "安装 skills"

$skillSrc = "$KitRoot\skills"

# Codex
$codexSkills = "$User\.codex\skills"
New-Item -ItemType Directory -Force -Path $codexSkills | Out-Null
Copy-Item "$skillSrc\*" $codexSkills -Recurse -Force
Write-Ok "skills → $codexSkills"

# Claude Code
$claudeSkills = "$User\.claude\skills"
New-Item -ItemType Directory -Force -Path $claudeSkills | Out-Null
Copy-Item "$skillSrc\*" $claudeSkills -Recurse -Force
Write-Ok "skills → $claudeSkills"

# ── 2. Hooks ──────────────────────────────────────────────────────────────────
Write-Step "安装 hooks"

$hooksDir = "$User\.claude\hooks"
New-Item -ItemType Directory -Force -Path $hooksDir | Out-Null
Copy-Item "$KitRoot\hooks\*" $hooksDir -Force
Write-Ok "hooks → $hooksDir"

# ── 3. Templates ──────────────────────────────────────────────────────────────
Write-Step "安装 openspec-templates"

$templatesDir = "$User\.codex\openspec-templates"
New-Item -ItemType Directory -Force -Path $templatesDir | Out-Null
Copy-Item "$KitRoot\openspec-templates\*" $templatesDir -Recurse -Force
Write-Ok "templates → $templatesDir"

# ── 4. Claude Code settings.json ──────────────────────────────────────────────
if (-not $SkipClaude) {
    Write-Step "更新 Claude Code settings.json"

    $claudeSettings = "$User\.claude\settings.json"
    $hookCmd = "node `"$($hooksDir -replace '\\','/')/session-start-openspec.js`""

    if (Test-Path $claudeSettings) {
        $json = Get-Content $claudeSettings -Raw | ConvertFrom-Json

        # 确保 hooks 结构存在
        if (-not $json.hooks) { $json | Add-Member -NotePropertyName hooks -NotePropertyValue ([PSCustomObject]@{}) }
        if (-not $json.hooks.SessionStart) {
            $json.hooks | Add-Member -NotePropertyName SessionStart -NotePropertyValue @()
        }

        # 检查是否已有 openspec hook
        $alreadyAdded = $json.hooks.SessionStart | Where-Object {
            $_.hooks | Where-Object { $_.command -like "*session-start-openspec*" }
        }

        if (-not $alreadyAdded) {
            $newEntry = [PSCustomObject]@{
                matcher = ".*"
                hooks   = @([PSCustomObject]@{ type = "command"; command = $hookCmd })
            }
            $json.hooks.SessionStart += $newEntry
            $json | ConvertTo-Json -Depth 10 | Set-Content $claudeSettings -Encoding utf8
            Write-Ok "SessionStart hook 已写入 settings.json"
        } else {
            Write-Warn "SessionStart hook 已存在，跳过"
        }
    } else {
        Write-Warn "settings.json 不存在，请手动参考 config/claude-settings-snippet.json"
    }
}

# ── 5. Codex hooks.json + config.toml ─────────────────────────────────────────
if (-not $SkipCodex) {
    Write-Step "更新 Codex hooks.json"

    $codexHooks = "$User\.codex\hooks.json"
    $hookCmd    = "node `"$($hooksDir -replace '\\','/')/session-start-openspec.js`""

    $newHooks = [PSCustomObject]@{
        hooks = [PSCustomObject]@{
            SessionStart = @(
                [PSCustomObject]@{
                    matcher = "startup|resume"
                    hooks   = @([PSCustomObject]@{
                        type          = "command"
                        command       = $hookCmd
                        statusMessage = "Loading OpenSpec context..."
                        timeout       = 15
                    })
                }
            )
        }
    }

    if (Test-Path $codexHooks) {
        # 检查是否已有
        $existing = Get-Content $codexHooks -Raw | ConvertFrom-Json
        $alreadyAdded = $false
        if ($existing.hooks.SessionStart) {
            $alreadyAdded = $existing.hooks.SessionStart | Where-Object {
                $_.hooks | Where-Object { $_.command -like "*session-start-openspec*" }
            }
        }
        if ($alreadyAdded) {
            Write-Warn "Codex SessionStart hook 已存在，跳过"
        } else {
            $newHooks | ConvertTo-Json -Depth 10 | Set-Content $codexHooks -Encoding utf8
            Write-Ok "hooks.json 已更新"
        }
    } else {
        $newHooks | ConvertTo-Json -Depth 10 | Set-Content $codexHooks -Encoding utf8
        Write-Ok "hooks.json 已创建"
    }

    # 开启 codex_hooks feature flag
    $codexConfig = "$User\.codex\config.toml"
    if (Test-Path $codexConfig) {
        $content = Get-Content $codexConfig -Raw
        if ($content -notmatch "codex_hooks\s*=\s*true") {
            $content = "[features]`ncodex_hooks = true`n`n" + $content
            Set-Content $codexConfig $content -Encoding utf8
            Write-Ok "config.toml: codex_hooks = true"
        } else {
            Write-Warn "config.toml: codex_hooks 已启用，跳过"
        }
    }
}

# ── 完成 ──────────────────────────────────────────────────────────────────────
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  harness-agentic-spec 安装完成" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host @"

下一步：
  1. 进入任意项目目录
  2. 说 "初始化 openspec" → 运行 local-spec-bootstrap
  3. 说 "开始开发 xxx"   → 运行 local-spec-dev

更新：git pull && .\install.ps1
"@
