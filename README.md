# harness-agentic-spec

团队专属的规格驱动开发工具包。

提供三个 skill + 一个 session hook，让任意 Java 项目具备完整的 AI 辅助开发闭环：
- 0 到 1 新项目：产品意图 → 架构决策 → common/client/server 骨架 → walking skeleton
- 老项目：项目背景沉淀 → 需求分析 → 任务实现 → 验证 → 审查 → 归档
- 新开会话自动注入上下文，不靠记忆

## 目录结构

### 1. 本仓库（kit 源码）

```
harness-agentic-spec/
│
├── .codex-plugin/
│   └── plugin.json                  Codex 插件标准 manifest
│
├── .agents/plugins/
│   └── marketplace.json             本仓库作为本地 marketplace 的示例入口
│
├── install.ps1                      兼容安装入口，转调 scripts/plugin-install.ps1
│
├── scripts/
│   └── plugin-install.ps1           插件安装后的初始化脚本，部署必要全局资产和 hooks
│
├── skills/                          AI 工作流定义（安装后复制到 ~/.codex/skills/ 和 ~/.claude/skills/）
│   ├── local-spec-bootstrap/
│   │   └── SKILL.md                 老项目初始化：扫描代码，生成 openspec/ 背景文档
│   ├── local-spec-new/
│   │   └── SKILL.md                 新项目初始化：定义 Java 规范并创建 common/client/server 骨架
│   └── local-spec-dev/
│       └── SKILL.md                 需求研发主流程：proposal→impact→design→tasks→实现→验证→review
│
├── hooks/                           会话自动化脚本和插件 hook 配置
│   ├── plugin-hooks.json            Codex 插件模式下的 hook 声明
│   ├── bootstrap-install.js         SessionStart 前自动更新插件并同步 Codex 侧资产
│   └── session-start-openspec.js    会话启动时检测 openspec/，自动注入进行中 change 的上下文
│
├── tools/                           机器校验和状态查询工具
│   └── harness-spec.js              status/validate CLI，校验 run.json、阶段门禁、产物和 checkpoint
│
├── openspec-templates/              每个项目 openspec/ 的骨架来源（安装后复制到 ~/.codex/openspec-templates/）
│   ├── greenfield/                   0 到 1 新项目的产品、架构、接口和 walking skeleton 模板
│   ├── changes/
│   │   └── _template/               新需求 change 的空白骨架，local-spec-dev 开始新需求时复制
│   │       ├── run.json             阶段状态机（proposal/impact/design/.../archive）
│   │       ├── proposal.md          需求意图、验收标准、非目标
│   │       ├── impact.md            代码影响面分析（文件、模块、风险）
│   │       ├── design.md            技术方案和关键设计决策
│   │       ├── tasks.md             功能点任务拆分和执行状态
│   │       ├── verification.md      编译/测试命令执行结果
│   │       ├── review.md            需求级总审查和风险评估
│   │       └── agent-space/         多 Agent 协作共享空间
│   │           ├── brief.md         主 Agent 写，所有 Agent 读；当前任务简报
│   │           ├── assignments.md   任务分配和文件所有权声明
│   │           ├── decisions.md     已确定的关键决策（不可回头）
│   │           ├── questions.md     子 Agent 向主 Agent 提问的队列
│   │           ├── checkpoints/     各阶段完成时的上下文快照（≤30 行）
│   │           ├── findings/        影响面调研输出
│   │           ├── reviews/         各任务审查报告（T1-review.md 等）
│   │           └── verification/    验证命令日志
│   └── templates/
│       ├── spec.md                  长期能力规格模板（系统行为描述格式）
│       └── review-matrix.md        需求级 review 对照矩阵模板
│
└── config/                          手动配置参考（install.ps1 已自动处理）
    ├── claude-settings-snippet.json settings.json 中 SessionStart hook 的写法
    └── codex-hooks-snippet.json     hooks.json 中 SessionStart hook 的写法
```

### 2. 插件模式下的仓库资产

标准插件入口：

```
.codex-plugin/plugin.json
```

插件会暴露：

```
skills/                              local-spec-new / local-spec-bootstrap / local-spec-dev
hooks/plugin-hooks.json              SessionStart + Java PostToolUse hooks
hooks/*.js                           hook runtime scripts（含 Codex 侧自动 bootstrap）
tools/harness-spec.js                status / validate / gate / agents CLI
openspec-templates/                  项目 openspec/ 模板资产
scripts/plugin-install.ps1           安装后初始化和完整性验证脚本
```

插件安装后必须运行 `scripts/plugin-install.ps1`。它会校验插件源资产，把 skills、hooks、tools 和 openspec 模板初始化到稳定全局路径，并在结束前验证落地资产完整。标准 Codex 插件的 SessionStart hook 也会做 Codex 侧自动 bootstrap，但完整安装仍以该脚本为准。

### 3. 兼容安装后的全局位置

`scripts/plugin-install.ps1` 或兼容入口 `install.ps1` 执行后，文件被部署到以下位置：

```
~/.codex/skills/
  local-spec-bootstrap/SKILL.md      ← 来自 skills/
  local-spec-dev/SKILL.md            ← 来自 skills/

~/.claude/skills/
  local-spec-bootstrap/SKILL.md      ← 同上（Claude Code 也能用）
  local-spec-dev/SKILL.md

~/.claude/hooks/
  session-start-openspec.js          ← 来自 hooks/

~/.codex/harness-spec/hooks/
  bootstrap-install.js               ← Codex 侧自动初始化兜底
  session-start-openspec.js          ← 来自 hooks/（Codex hook runtime）

~/.codex/openspec-templates/         ← 来自 openspec-templates/
  changes/_template/
  templates/

~/.codex/harness-spec/tools/
  harness-spec.js                    ← 来自 tools/
```

同时自动写入：
- `~/.claude/settings.json` — 注册 SessionStart hook（Claude Code）
- `~/.codex/hooks.json` — 注册 SessionStart hook（Codex）
- `~/.codex/config.toml` — 开启 `codex_hooks = true`

### 4. 每个项目里的 openspec/（由 local-spec-bootstrap 生成）

```
{your-project}/
└── openspec/
    │
    ├── project.md                   项目级稳定背景：用途、模块职责、技术栈、验证命令
    │                                → 由 local-spec-bootstrap 生成，人工维护更新
    │
    ├── context/
    │   ├── code-map.md              代码地图：Controller/Service/Mapper/MQ/Job 入口证据
    │   │                            → 由 local-spec-bootstrap 扫描生成
    │   └── verification.md         本地验证命令和注意事项（mvn compile/test 等）
    │                                → 由 local-spec-bootstrap 生成
    │
    ├── specs/                       长期能力规格（系统行为的持久化描述）
    │   ├── _index.md                能力域索引和置信度评估
    │   │                            → 由 local-spec-bootstrap 生成候选，人工确认后补正式 spec
    │   └── {capability}/
    │       └── spec.md              单个能力的行为规格（需求 → 场景 → 验收）
    │                                → 需求归档后由 local-spec-dev 更新
    │
    ├── templates/                   → 由 install.ps1 从 kit 复制
    │   ├── spec.md                  写能力规格时的参考格式
    │   └── review-matrix.md        做需求级 review 时的对照矩阵
    │
    └── changes/                     每个需求的工作目录
        ├── _template/               → 由 install.ps1 从 kit 复制；新需求开始时复制此骨架
        ├── README.md                change 目录使用说明
        └── {change-id}/             一个需求对应一个目录（如 example-change-id）
            ├── run.json             当前阶段和任务状态（local-spec-dev 维护）
            ├── proposal.md          需求意图和验收标准
            ├── impact.md            代码影响面分析
            ├── design.md            技术方案
            ├── tasks.md             任务列表和执行状态
            ├── verification.md      验证命令执行结果
            ├── review.md            需求级总审查
            └── agent-space/         Agent 协作空间（生命周期同 change）
                ├── brief.md         当前任务简报（主 Agent 持续更新）
                ├── assignments.md   文件所有权分配
                ├── decisions.md     已确定决策（append-only）
                ├── questions.md     待裁决问题
                ├── checkpoints/     阶段快照，新会话的上下文基准
                │   └── {phase}-done.md   每个阶段结束时写入，≤30 行
                ├── findings/        影响面调研详情
                ├── reviews/         各任务审查报告
                └── verification/    验证日志
```

## 快速开始

完整安装、验证、更新和卸载说明见 [安装手册](docs/installation.md)。

### 1. 安装插件

推荐使用标准 Codex 插件模式。本仓库根目录已经是插件根目录，入口是 `.codex-plugin/plugin.json`。

首次安装后运行初始化脚本，它会部署 skills、hooks、CLI、OpenSpec 模板，并写入 Codex/Claude 的 hook 配置：

```powershell
git clone <this-repo> D:\metadata\harness-agentic-spec
cd D:\metadata\harness-agentic-spec
.\scripts\plugin-install.ps1
.\scripts\plugin-install.ps1 -VerifyOnly
```

兼容入口等价可用：

```powershell
.\install.ps1
.\install.ps1 -VerifyOnly
```

### 2. 自动更新机制

默认打开 Codex 新会话时，SessionStart hook 会自动尝试更新插件：

- 插件源是 git 仓库，并且当前分支有 upstream。
- tracked 文件没有本地改动。
- 远端更新可以 `git pull --ff-only` 快进。
- 更新成功后自动同步 `skills/`、`hooks/`、`tools/`、`openspec-templates/` 到 `~/.codex/...`。

如果本地有改动、没有远端、网络失败或远端不是快进更新，会跳过自动更新并继续使用当前本地版本。关闭自动更新：

```powershell
$env:HARNESS_SPEC_AUTO_UPDATE = "off"
```

手动更新仍然可用：

```powershell
cd D:\metadata\harness-agentic-spec
git pull --ff-only
.\scripts\plugin-install.ps1
.\scripts\plugin-install.ps1 -VerifyOnly
```

### 3. 给一个项目初始化 OpenSpec

老项目进入任意 Java 项目根目录：

```powershell
cd D:\your-project
```

然后对 Codex 说：

```text
初始化 openspec
```

这一步会扫描当前项目，生成或补全：

```text
openspec/project.md
openspec/context/code-map.md
openspec/context/verification.md
openspec/specs/_index.md
```

### 4. 从 0 到 1 创建新 Java 项目

在一个空目录或准备作为新服务根目录的目录里对 Codex 说：

```text
从0到1创建一个Java服务：订单导出服务，采用 common/client/server 三层结构
```

`local-spec-new` 会先写 OpenSpec，再创建代码骨架。默认结构：

```text
{service}-common
{service}-client
{service}-server
```

职责边界：

- `common`：跨系统 DTO、枚举、错误码、校验分组。
- `client`：其他系统依赖的接口契约和客户端适配。
- `server`：Controller、应用服务、领域服务、持久化、MQ、Job、配置。

新项目会先完成 walking skeleton：父 POM、三层模块、Spring Boot 启动类、健康检查接口、样例 DTO/client contract、基础验证命令。这个骨架通过验证后，再用 `local-spec-dev` 开始业务需求。

### 5. 开始一个需求

在同一个项目里对 Codex 说：

```text
开始开发：给订单列表增加导出按钮，导出字段和页面筛选条件一致
```

工作流会创建一个 change 目录：

```text
openspec/changes/{change-id}/
```

然后按阶段推进：

```text
proposal -> impact -> design -> tasks -> implementation -> verification -> review -> archive
```

每个阶段会写入对应文档，并通过 `harness-spec` 做机器校验。

### 6. 继续中断的需求

新开会话时，hook 会自动读取当前项目中进行中的 change，并注入最近 checkpoint。你可以直接说：

```text
继续
```

或指定 change：

```text
继续 export-order-list
```

### 7. 常用命令

| 场景 | 操作 |
|---|---|
| 开始新需求 | 说 "开始开发 xxx" |
| 创建新 Java 服务 | 说 "从0到1创建一个Java服务：xxx" |
| 恢复中断的需求 | 说 "继续" 或 "继续 [change-id]" |
| 新开会话 | 自动注入当前 change 上下文（hook 自动触发） |
| 查看 change 状态 | `node ~/.codex/harness-spec/tools/harness-spec.js status` |
| 校验状态机和产物 | `node ~/.codex/harness-spec/tools/harness-spec.js validate --strict` |
| 阶段门禁 | `node ~/.codex/harness-spec/tools/harness-spec.js gate review <change-id>` |
| Agent 协作校验 | `node ~/.codex/harness-spec/tools/harness-spec.js agents verify <change-id> --strict` |
| 手动更新插件 | `git pull --ff-only && .\scripts\plugin-install.ps1 && .\scripts\plugin-install.ps1 -VerifyOnly` |

## 机器校验

`harness-spec.js` 提供类似 OpenSpec CLI 的本地状态查询和校验能力，避免状态机只靠文字约束。

```powershell
# 在目标项目根目录执行
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js status
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js status --json
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js validate
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js validate --strict
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js validate my-change-id --json
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js gate design my-change-id
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js gate review my-change-id --json
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js agents init my-change-id
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js agents verify my-change-id
```

当前校验范围：

- `openspec/changes/{change-id}/run.json` 必须可解析，`change_id` 必须匹配目录名。
- `current_stage`、阶段状态和阶段顺序必须合法。
- 已进入后续阶段时，前置阶段必须是 `passed`。
- 必需产物文件必须存在：`proposal.md`、`impact.md`、`design.md`、`tasks.md`、`verification.md`、`review.md`。
- `agent-space/` 基础目录和共享文件必须存在。
- `tasks.md` 中任务状态必须属于允许枚举。
- 已通过阶段应有 `{stage}-done.md` checkpoint；`--strict` 下缺失 checkpoint 或残留占位符会报错。

### 阶段质量门禁

`gate <stage> <change-id>` 用于判断“某阶段完成后能不能进入下一阶段”，输出四种决策：

- `pass`：允许进入下一阶段。
- `warn`：允许继续，但必须记录风险。
- `block`：不允许推进，必须修正后重跑。
- `waived`：人工豁免，必须通过 `--waive "<reason>"` 写明原因。

阶段门禁按阶段逐步收紧：

| 阶段 | 门禁目标 | 关键检查 |
|---|---|---|
| `proposal` | 需求可执行 | `proposal.md` 章节完整、无占位符、阶段已 `passed`、有 `proposal-done.md` |
| `impact` | 影响面可信 | `impact.md` 有代码证据、影响模块、风险、无占位符、前置阶段通过 |
| `design` | 方案可落地 | `design.md` 有决策、实现方案、契约/数据影响、边界和测试策略 |
| `tasks` | 任务可执行 | `tasks.md` 有 Tn 任务、任务状态合法、验收/验证/审查结构完整 |
| `implementation` | 单任务可交付 | 所有任务状态为 `done`，实现阶段通过，有实现 checkpoint |
| `verification` | 验证可信 | 所有任务 `done`，`verification.md` 有命令、测试、静态检查和结论 |
| `review` | 需求可交付 | 自动严格模式，所有任务 `done`，验收和审查产物无占位符 |
| `archive` | 长期知识沉淀 | 自动严格模式，review 已完成，归档前无结构缺口 |

### Agent 协作协议

`agent-space/assignments.json` 是机器可校验的 Agent 分工协议，`assignments.md` 保留为人读说明。

```powershell
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js agents init my-change-id
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js agents status my-change-id
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js agents verify my-change-id
node $env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js agents verify my-change-id --strict
```

协作校验覆盖：

- 写代码 Agent 必须声明 `owned_paths`。
- 不同写代码 Agent 的 `owned_paths` 不能重叠。
- Agent 不能拥有 `run.json`、`agent-space/decisions.md`、`agent-space/assignments.json` 这类主 Agent 文件。
- 每个有 worker 的任务必须有独立 verifier 和 reviewer。
- `required_outputs` 必须声明；`--strict` 或后期 gate 下必须真实存在。
- `verification/review` gate 会要求相关 Agent 状态为 `done`。

## 开发规范

每个阶段结束写 checkpoint（`agent-space/checkpoints/{phase}-done.md`），格式：

```markdown
---
change: xxx
stage: tasks passed
next: implementation
task: T1
---

## 关键决策
...

## 已确认影响文件
...

## 当前阻塞
无
```

checkpoint 是新会话的上下文基准，30 行以内。
