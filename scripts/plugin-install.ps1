# harness-agentic-spec plugin initializer.
# Usage: .\scripts\plugin-install.ps1 [-SkipClaude] [-SkipCodex] [-SkipAutoUpdate] [-VerifyOnly] [-UserProfile <path>]

param(
    [switch]$SkipClaude,
    [switch]$SkipCodex,
    [switch]$SkipAutoUpdate,
    [switch]$VerifyOnly,
    [string]$UserProfile = $env:USERPROFILE
)

$ErrorActionPreference = "Stop"
$PluginRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$User = $UserProfile

if ([string]::IsNullOrWhiteSpace($User)) {
    throw "USERPROFILE is empty. Pass -UserProfile <path> or set USERPROFILE."
}

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!]  $msg" -ForegroundColor Yellow }

function Assert-PathExists($path, $label) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing $label`: $path"
    }
}

function Assert-JsonFile($path, $label) {
    Assert-PathExists $path $label
    try {
        [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8) | ConvertFrom-Json | Out-Null
    } catch {
        throw "Invalid JSON in $label ($path): $($_.Exception.Message)"
    }
}

function Has-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Invoke-NodeCheck($path, $label) {
    if (-not (Has-Command "node")) {
        Write-Warn "node not found; skipped syntax check for $label"
        return
    }
    & node --check $path | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Node syntax check failed for $label`: $path"
    }
}

function Invoke-BootstrapAutoUpdate($pluginRoot) {
    if ($SkipAutoUpdate) {
        Write-Warn "auto-update skipped by -SkipAutoUpdate"
        return
    }
    if (-not (Has-Command "node")) {
        Write-Warn "node not found; skipped bootstrap auto-update"
        return
    }
    $bootstrap = Join-Path $pluginRoot "hooks\bootstrap-install.js"
    if (-not (Test-Path -LiteralPath $bootstrap)) {
        Write-Warn "bootstrap installer not found; skipped auto-update"
        return
    }

    $code = @"
const b = require(process.argv[1]);
const r = b.tryAutoUpdatePlugin(process.argv[2], {});
console.log(JSON.stringify(r));
if (r.status === 'failed') process.exitCode = 1;
"@
    $json = & node -e $code $bootstrap $pluginRoot
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "auto-update failed; continuing with local plugin source"
        if ($json) { Write-Warn $json }
        return
    }
    if (-not $json) {
        Write-Warn "auto-update returned no status"
        return
    }
    try {
        $result = $json | ConvertFrom-Json
        if ($result.status -eq "updated") {
            Write-Ok "auto-updated plugin $($result.before) -> $($result.after)"
        } elseif ($result.status -eq "up-to-date") {
            Write-Warn "auto-update: already up to date"
        } else {
            Write-Warn "auto-update skipped: $($result.reason)"
        }
    } catch {
        Write-Warn "auto-update status parse failed: $json"
    }
}

function Get-GitRevision($pluginRoot) {
    if (-not (Has-Command "git")) {
        return $null
    }
    $revision = & git -C $pluginRoot rev-parse --short=12 HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and $revision) {
        return [string]$revision
    }
    return $null
}

function Write-InstallState($statePath, $pluginRoot, $targets) {
    New-Item -ItemType Directory -Force -Path (Split-Path $statePath) | Out-Null
    $state = [PSCustomObject]@{
        plugin = "harness-agentic-spec"
        pluginRoot = $pluginRoot
        initializedAt = (Get-Date).ToUniversalTime().ToString("o")
        revision = Get-GitRevision $pluginRoot
        autoUpdate = [PSCustomObject]@{
            enabled = -not $SkipAutoUpdate
            source = "plugin-install.ps1"
        }
        targets = $targets
    }
    $state | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $statePath -Encoding utf8
}

function Copy-DirectoryContents($source, $destination, $label) {
    Assert-PathExists $source $label
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    Get-ChildItem -LiteralPath $source -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
    }
}

function Ensure-ObjectProperty($object, $name, $value) {
    $prop = $object.PSObject.Properties[$name]
    if ($null -eq $prop) {
        $object | Add-Member -NotePropertyName $name -NotePropertyValue $value
    } elseif ($null -eq $prop.Value) {
        $prop.Value = $value
    }
}

function Has-HookCommand($entries, $pattern) {
    foreach ($entry in @($entries)) {
        foreach ($hook in @($entry.hooks)) {
            if ($hook.command -like $pattern) {
                return $true
            }
        }
    }
    return $false
}

function Add-FeatureFlag($configPath) {
    if (-not (Test-Path -LiteralPath $configPath)) {
        New-Item -ItemType Directory -Force -Path (Split-Path $configPath) | Out-Null
        Set-Content -LiteralPath $configPath "[features]`ncodex_hooks = true`n" -Encoding utf8
        Write-Ok "config.toml created with codex_hooks = true"
        return
    }

    $content = Get-Content -LiteralPath $configPath -Raw
    if ($content -match "codex_hooks\s*=\s*true") {
        Write-Warn "config.toml: codex_hooks already enabled, skipped"
        return
    }

    if ($content -match "(?m)^\s*\[features\]\s*$") {
        $content = $content -replace "(?m)^(\s*\[features\]\s*)$", "`$1`ncodex_hooks = true"
    } else {
        $content = "[features]`ncodex_hooks = true`n`n" + $content
    }
    Set-Content -LiteralPath $configPath $content -Encoding utf8
    Write-Ok "config.toml: codex_hooks = true"
}

function Test-SourceAssets() {
    Write-Step "Verify plugin source assets"

    Assert-JsonFile (Join-Path $PluginRoot ".codex-plugin\plugin.json") "plugin manifest"
    Assert-JsonFile (Join-Path $PluginRoot "hooks\plugin-hooks.json") "plugin hooks manifest"

    Assert-PathExists (Join-Path $PluginRoot "skills\local-spec-bootstrap\SKILL.md") "local-spec-bootstrap skill"
    Assert-PathExists (Join-Path $PluginRoot "skills\local-spec-dev\SKILL.md") "local-spec-dev skill"
    Assert-PathExists (Join-Path $PluginRoot "skills\local-spec-new\SKILL.md") "local-spec-new skill"
    Assert-PathExists (Join-Path $PluginRoot "skills\local-spec-new\references\java-greenfield-standards.md") "greenfield Java standards"
    Assert-PathExists (Join-Path $PluginRoot "hooks\bootstrap-install.js") "bootstrap installer"
    Assert-PathExists (Join-Path $PluginRoot "hooks\session-start-openspec.js") "session hook"
    Assert-PathExists (Join-Path $PluginRoot "hooks\post-java-check.js") "Java hook"
    Assert-PathExists (Join-Path $PluginRoot "openspec-templates\changes\_template\run.json") "change template run.json"
    Assert-PathExists (Join-Path $PluginRoot "openspec-templates\changes\_template\agent-space\assignments.json") "Agent assignments template"
    Assert-PathExists (Join-Path $PluginRoot "openspec-templates\greenfield\project.md") "greenfield project template"
    Assert-PathExists (Join-Path $PluginRoot "openspec-templates\greenfield\context\architecture.md") "greenfield architecture template"
    Assert-PathExists (Join-Path $PluginRoot "openspec-templates\greenfield\context\interfaces.md") "greenfield interfaces template"
    Assert-PathExists (Join-Path $PluginRoot "openspec-templates\templates\spec.md") "spec template"
    Assert-PathExists (Join-Path $PluginRoot "tools\harness-spec.js") "harness-spec CLI"

    Invoke-NodeCheck (Join-Path $PluginRoot "hooks\bootstrap-install.js") "bootstrap installer"
    Invoke-NodeCheck (Join-Path $PluginRoot "hooks\session-start-openspec.js") "session hook"
    Invoke-NodeCheck (Join-Path $PluginRoot "hooks\post-java-check.js") "Java hook"
    Invoke-NodeCheck (Join-Path $PluginRoot "tools\harness-spec.js") "harness-spec CLI"

    Write-Ok "plugin source assets are complete"
}

function Test-InstalledAssets($includeClaudeConfig, $includeCodexConfig) {
    Write-Step "Verify initialized assets"

    Assert-PathExists (Join-Path $User ".codex\skills\local-spec-bootstrap\SKILL.md") "Codex local-spec-bootstrap skill"
    Assert-PathExists (Join-Path $User ".codex\skills\local-spec-dev\SKILL.md") "Codex local-spec-dev skill"
    Assert-PathExists (Join-Path $User ".codex\skills\local-spec-new\SKILL.md") "Codex local-spec-new skill"
    Assert-PathExists (Join-Path $User ".codex\skills\local-spec-new\references\java-greenfield-standards.md") "Codex greenfield Java standards"
    Assert-PathExists (Join-Path $User ".claude\skills\local-spec-bootstrap\SKILL.md") "Claude local-spec-bootstrap skill"
    Assert-PathExists (Join-Path $User ".claude\skills\local-spec-dev\SKILL.md") "Claude local-spec-dev skill"
    Assert-PathExists (Join-Path $User ".claude\skills\local-spec-new\SKILL.md") "Claude local-spec-new skill"
    Assert-PathExists (Join-Path $User ".claude\hooks\session-start-openspec.js") "Claude session hook"
    Assert-PathExists (Join-Path $User ".claude\hooks\post-java-check.js") "Claude Java hook"
    Assert-PathExists (Join-Path $User ".codex\harness-spec\hooks\bootstrap-install.js") "Codex bootstrap installer"
    Assert-PathExists (Join-Path $User ".codex\harness-spec\hooks\session-start-openspec.js") "Codex session hook runtime"
    Assert-PathExists (Join-Path $User ".codex\harness-spec\hooks\post-java-check.js") "Codex Java hook runtime"
    Assert-PathExists (Join-Path $User ".codex\openspec-templates\changes\_template\run.json") "OpenSpec change template"
    Assert-PathExists (Join-Path $User ".codex\openspec-templates\changes\_template\agent-space\assignments.json") "Agent assignments template"
    Assert-PathExists (Join-Path $User ".codex\openspec-templates\greenfield\project.md") "greenfield project template"
    Assert-PathExists (Join-Path $User ".codex\openspec-templates\greenfield\context\architecture.md") "greenfield architecture template"
    Assert-PathExists (Join-Path $User ".codex\openspec-templates\greenfield\context\interfaces.md") "greenfield interfaces template"
    Assert-PathExists (Join-Path $User ".codex\harness-spec\tools\harness-spec.js") "harness-spec CLI"
    Assert-JsonFile (Join-Path $User ".codex\harness-spec\install-state.json") "install state"

    if ($includeClaudeConfig) {
        Assert-JsonFile (Join-Path $User ".claude\settings.json") "Claude settings.json"
    }
    if ($includeCodexConfig) {
        Assert-JsonFile (Join-Path $User ".codex\hooks.json") "Codex hooks.json"
        Assert-PathExists (Join-Path $User ".codex\config.toml") "Codex config.toml"
        $configToml = Get-Content -LiteralPath (Join-Path $User ".codex\config.toml") -Raw
        if ($configToml -notmatch "codex_hooks\s*=\s*true") {
            throw "Codex config.toml does not enable codex_hooks = true"
        }
    }

    Invoke-NodeCheck (Join-Path $User ".codex\harness-spec\hooks\bootstrap-install.js") "installed bootstrap installer"
    Invoke-NodeCheck (Join-Path $User ".codex\harness-spec\hooks\session-start-openspec.js") "installed Codex session hook"
    Invoke-NodeCheck (Join-Path $User ".codex\harness-spec\hooks\post-java-check.js") "installed Codex Java hook"
    Invoke-NodeCheck (Join-Path $User ".codex\harness-spec\tools\harness-spec.js") "installed harness-spec CLI"

    Write-Ok "initialized assets are complete"
}

Write-Step "Initialize harness-agentic-spec plugin"
Write-Ok "plugin root -> $PluginRoot"
Write-Ok "user profile -> $User"

Write-Step "Auto-update plugin source"
Invoke-BootstrapAutoUpdate $PluginRoot

Test-SourceAssets

# Stable global asset paths used by current skills and docs.
$codexSkills = Join-Path $User ".codex\skills"
$claudeSkills = Join-Path $User ".claude\skills"
$claudeHooks = Join-Path $User ".claude\hooks"
$templatesDir = Join-Path $User ".codex\openspec-templates"
$toolsDir = Join-Path $User ".codex\harness-spec\tools"
$codexHookRuntime = Join-Path $User ".codex\harness-spec\hooks"

if ($VerifyOnly) {
    Test-InstalledAssets (-not $SkipClaude) (-not $SkipCodex)
    Write-Host "`nVerify-only check passed." -ForegroundColor Green
    return
}

Write-Step "Install global assets"

Copy-DirectoryContents (Join-Path $PluginRoot "skills") $codexSkills "skills"
Copy-DirectoryContents (Join-Path $PluginRoot "skills") $claudeSkills "skills"
Copy-DirectoryContents (Join-Path $PluginRoot "hooks") $codexHookRuntime "hook runtime"
New-Item -ItemType Directory -Force -Path $claudeHooks | Out-Null
Copy-Item -Path (Join-Path $PluginRoot "hooks\*.js") -Destination $claudeHooks -Force
Copy-DirectoryContents (Join-Path $PluginRoot "openspec-templates") $templatesDir "OpenSpec templates"
Copy-DirectoryContents (Join-Path $PluginRoot "tools") $toolsDir "tools"

Write-InstallState (Join-Path $User ".codex\harness-spec\install-state.json") $PluginRoot @(
    ($codexSkills -replace '\\','/'),
    ($codexHookRuntime -replace '\\','/'),
    ($toolsDir -replace '\\','/'),
    ($templatesDir -replace '\\','/')
)

Write-Ok "skills -> $codexSkills"
Write-Ok "skills -> $claudeSkills"
Write-Ok "hooks -> $codexHookRuntime"
Write-Ok "hooks -> $claudeHooks"
Write-Ok "templates -> $templatesDir"
Write-Ok "tools -> $toolsDir"

if (-not $SkipClaude) {
    Write-Step "Update Claude Code settings.json"

    $claudeSettings = Join-Path $User ".claude\settings.json"
    $sessionHookCmd = "node `"$($claudeHooks -replace '\\','/')/session-start-openspec.js`""
    $javaHookCmd = "node `"$($claudeHooks -replace '\\','/')/post-java-check.js`""

    if (Test-Path -LiteralPath $claudeSettings) {
        $json = Get-Content -LiteralPath $claudeSettings -Raw | ConvertFrom-Json
    } else {
        New-Item -ItemType Directory -Force -Path (Split-Path $claudeSettings) | Out-Null
        $json = [PSCustomObject]@{}
    }

    Ensure-ObjectProperty $json "hooks" ([PSCustomObject]@{})
    Ensure-ObjectProperty $json.hooks "SessionStart" @()
    Ensure-ObjectProperty $json.hooks "PostToolUse" @()

    if (-not (Has-HookCommand $json.hooks.SessionStart "*session-start-openspec*")) {
        $json.hooks.SessionStart = @($json.hooks.SessionStart) + [PSCustomObject]@{
            matcher = ".*"
            hooks = @([PSCustomObject]@{ type = "command"; command = $sessionHookCmd })
        }
        Write-Ok "SessionStart hook added to settings.json"
    } else {
        Write-Warn "SessionStart hook already exists, skipped"
    }

    if (-not (Has-HookCommand $json.hooks.PostToolUse "*post-java-check*")) {
        $json.hooks.PostToolUse = @($json.hooks.PostToolUse) + [PSCustomObject]@{
            matcher = "Edit|Write"
            hooks = @([PSCustomObject]@{ type = "command"; command = $javaHookCmd; timeout = 120 })
        }
        Write-Ok "PostToolUse Java hook added to settings.json"
    } else {
        Write-Warn "PostToolUse Java hook already exists, skipped"
    }

    $json | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $claudeSettings -Encoding utf8
}

if (-not $SkipCodex) {
    Write-Step "Update Codex hooks.json"

    $codexHooks = Join-Path $User ".codex\hooks.json"
    $sessionHookCmd = "node `"$($codexHookRuntime -replace '\\','/')/session-start-openspec.js`""

    if (Test-Path -LiteralPath $codexHooks) {
        $existing = Get-Content -LiteralPath $codexHooks -Raw | ConvertFrom-Json
    } else {
        New-Item -ItemType Directory -Force -Path (Split-Path $codexHooks) | Out-Null
        $existing = [PSCustomObject]@{}
    }

    Ensure-ObjectProperty $existing "hooks" ([PSCustomObject]@{})
    Ensure-ObjectProperty $existing.hooks "SessionStart" @()

    if (Has-HookCommand $existing.hooks.SessionStart "*session-start-openspec*") {
        Write-Warn "Codex SessionStart hook already exists, skipped"
    } else {
        $existing.hooks.SessionStart = @($existing.hooks.SessionStart) + [PSCustomObject]@{
            matcher = "startup|resume"
            hooks = @([PSCustomObject]@{
                type = "command"
                command = $sessionHookCmd
                statusMessage = "Loading OpenSpec context..."
                timeout = 15
            })
        }
        Write-Ok "OpenSpec SessionStart hook appended to hooks.json"
    }

    $existing | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $codexHooks -Encoding utf8
    Add-FeatureFlag (Join-Path $User ".codex\config.toml")
}

Test-InstalledAssets (-not $SkipClaude) (-not $SkipCodex)

Write-Host "`n===================================" -ForegroundColor Cyan
Write-Host "  harness-agentic-spec initialized" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Cyan
Write-Host @"

Validation:
  node "$($toolsDir -replace '\\','/')/harness-spec.js" --help

Next:
  1. Restart Codex / Claude Code if needed.
  2. Open a target project.
  3. Say "initialize openspec".
"@
