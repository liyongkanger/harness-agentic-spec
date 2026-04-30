# 安装手册

本文说明 `harness-agentic-spec` 的推荐安装方式、兼容安装方式、验证、更新和卸载。

## 安装方式选择

优先使用标准 Codex 插件模式。当前仓库根目录已经是插件根目录，入口文件为：

```text
.codex-plugin/plugin.json
```

插件安装后必须运行初始化脚本。脚本会先校验插件源资产，再把当前流程需要的 `skills/`、`hooks/`、`tools/` 和 `openspec-templates/` 安装到稳定位置，最后验证落地资产是否完整。标准 Codex 插件的 SessionStart hook 也会做 Codex 侧自动 bootstrap，但完整安装、Claude 兼容和 hook 配置仍以该脚本为准：

```powershell
.\scripts\plugin-install.ps1
```

## 方式一：标准插件模式

### 1. 获取仓库

```powershell
git clone <this-repo> D:\metadata\harness-agentic-spec
cd D:\metadata\harness-agentic-spec
```

### 2. 确认插件入口

```powershell
Test-Path .codex-plugin\plugin.json
node -e "JSON.parse(require('fs').readFileSync('.codex-plugin/plugin.json','utf8')); console.log('plugin.json OK')"
```

插件 manifest 声明：

- `skills`: `./skills/`
- `hooks`: `./hooks/plugin-hooks.json`

仓库内附加资产：

- `tools/harness-spec.js`
- `openspec-templates/`
- `openspec-templates/greenfield/`
- `scripts/plugin-install.ps1`
- `hooks/bootstrap-install.js`

### 3. 使用本地 marketplace 示例

本仓库提供一个本地 marketplace 示例：

```text
.agents/plugins/marketplace.json
```

该示例将当前仓库根目录作为插件源：

```json
{
  "name": "harness-agentic-spec",
  "source": {
    "source": "local",
    "path": "."
  }
}
```

如果你的 Codex 本地 marketplace 约定要求插件位于 `./plugins/<plugin-name>`，可以采用外层目录结构：

```text
workspace/
  .agents/plugins/marketplace.json
  plugins/
    harness-agentic-spec/     ← 本仓库
```

对应 marketplace 条目：

```json
{
  "name": "harness-agentic-spec",
  "source": {
    "source": "local",
    "path": "./plugins/harness-agentic-spec"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Productivity"
}
```

### 4. 验证插件资产

```powershell
node --check tools\harness-spec.js
node --check hooks\bootstrap-install.js
node --check hooks\session-start-openspec.js
node --check hooks\post-java-check.js
node -e "JSON.parse(require('fs').readFileSync('hooks/plugin-hooks.json','utf8')); console.log('hooks OK')"
```

### 5. 初始化插件资产

插件安装完成后执行。这个步骤是必须的，因为当前技能会从稳定全局路径读取 CLI、模板和 hook runtime：

```powershell
.\scripts\plugin-install.ps1
```

可选参数：

```powershell
.\scripts\plugin-install.ps1 -SkipClaude
.\scripts\plugin-install.ps1 -SkipCodex
.\scripts\plugin-install.ps1 -SkipAutoUpdate
.\scripts\plugin-install.ps1 -VerifyOnly
```

初始化会部署：

```text
~/.codex/skills/
~/.claude/skills/
~/.claude/hooks/
~/.codex/openspec-templates/
~/.codex/harness-spec/hooks/
~/.codex/harness-spec/tools/
```

同时会更新：

- `~/.claude/settings.json`
- `~/.codex/hooks.json`
- `~/.codex/config.toml`

### 6. 使用命令

初始化后，优先使用稳定全局 CLI：

```powershell
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js status --root <your-project>
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js validate <change-id> --root <your-project>
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js gate review <change-id> --root <your-project>
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js agents verify <change-id> --root <your-project>
```

## 方式二：兼容复制式安装

兼容入口 `install.ps1` 会转调 `scripts/plugin-install.ps1`，用于旧习惯或手动安装场景。它和插件初始化脚本使用同一套校验、复制和验证逻辑。

```powershell
cd D:\metadata\harness-agentic-spec
.\install.ps1
```

可选参数：

```powershell
.\install.ps1 -SkipClaude
.\install.ps1 -SkipCodex
.\install.ps1 -SkipAutoUpdate
.\install.ps1 -VerifyOnly
```

安装后位置：

```text
~/.codex/skills/
~/.claude/skills/
~/.claude/hooks/
~/.codex/openspec-templates/
~/.codex/harness-spec/hooks/
~/.codex/harness-spec/tools/
```

安装脚本还会尝试更新：

- `~/.claude/settings.json`
- `~/.codex/hooks.json`
- `~/.codex/config.toml`

脚本会保留已有 hooks，只追加 OpenSpec 相关 hook。

### 验证兼容安装

```powershell
.\install.ps1 -VerifyOnly
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js --help
Test-Path $env:USERPROFILE\.codex\openspec-templates\changes\_template\run.json
Test-Path $env:USERPROFILE\.claude\hooks\session-start-openspec.js
```

## 新项目接入

进入目标项目：

```powershell
cd <your-project>
```

初始化项目背景：

```text
初始化 openspec
```

从 0 到 1 创建新 Java 服务：

```text
从0到1创建一个Java服务：<服务描述>
```

开始需求：

```text
开始开发：<需求描述>
```

常用校验：

```powershell
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js status
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js validate <change-id>
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js gate <stage> <change-id>
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js agents verify <change-id>
```

## 更新

### 自动更新

默认打开 Codex 新会话时，SessionStart hook 会自动尝试更新插件源仓库，然后同步 Codex 侧安装资产。

自动更新只在以下条件同时满足时执行：

- 插件源是 git 仓库。
- 当前分支有 upstream。
- tracked 文件没有本地改动。
- 远端更新可以 `git pull --ff-only` 快进。

如果本地有改动、无 upstream、网络失败或远端不能快进，自动更新会跳过，不阻塞会话启动。

关闭自动更新：

```powershell
$env:HARNESS_SPEC_AUTO_UPDATE = "off"
```

安装脚本也可跳过自动更新：

```powershell
.\scripts\plugin-install.ps1 -SkipAutoUpdate
.\install.ps1 -SkipAutoUpdate
```

### 手动更新

插件模式：

```powershell
cd D:\metadata\harness-agentic-spec
git pull --ff-only
.\scripts\plugin-install.ps1
.\scripts\plugin-install.ps1 -VerifyOnly
```

兼容入口：

```powershell
cd D:\metadata\harness-agentic-spec
git pull --ff-only
.\scripts\plugin-install.ps1
```

## 卸载

插件模式：

- 从本地 marketplace 或插件列表中移除 `harness-agentic-spec`。
- 删除本仓库目录。

兼容复制式安装需要手工删除复制出的文件：

```powershell
Remove-Item -Recurse -Force $env:USERPROFILE\.codex\skills\local-spec-bootstrap
Remove-Item -Recurse -Force $env:USERPROFILE\.codex\skills\local-spec-dev
Remove-Item -Recurse -Force $env:USERPROFILE\.claude\skills\local-spec-bootstrap
Remove-Item -Recurse -Force $env:USERPROFILE\.claude\skills\local-spec-dev
Remove-Item -Recurse -Force $env:USERPROFILE\.codex\openspec-templates
Remove-Item -Recurse -Force $env:USERPROFILE\.codex\harness-spec
Remove-Item -Force $env:USERPROFILE\.claude\hooks\session-start-openspec.js
Remove-Item -Force $env:USERPROFILE\.claude\hooks\post-java-check.js
```

卸载脚本不会自动修改 `settings.json`、`hooks.json`、`config.toml`。如需完全清理，请手动删除其中包含 `session-start-openspec` 和 `post-java-check` 的 hook 条目。

## 故障排查

### PowerShell 无法执行脚本

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

### hooks 没生效

检查：

```powershell
Get-Content $env:USERPROFILE\.codex\hooks.json
Get-Content $env:USERPROFILE\.claude\settings.json
```

确认包含：

- `session-start-openspec.js`
- `post-java-check.js`

### CLI 找不到 openspec

确认当前目录或 `--root` 指向目标项目根目录：

```powershell
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js status --root <your-project>
```
