# Compatibility installer for harness-agentic-spec.
# Prefer plugin install plus scripts/plugin-install.ps1.

param(
    [switch]$SkipClaude,
    [switch]$SkipCodex,
    [switch]$SkipAutoUpdate,
    [switch]$VerifyOnly,
    [string]$UserProfile = $env:USERPROFILE
)

$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "scripts\plugin-install.ps1"

if (-not (Test-Path $script)) {
    throw "Missing plugin initializer: $script"
}

& $script -SkipClaude:$SkipClaude -SkipCodex:$SkipCodex -SkipAutoUpdate:$SkipAutoUpdate -VerifyOnly:$VerifyOnly -UserProfile $UserProfile
