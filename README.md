# harness-agentic-spec

团队专属的规格驱动开发工具包。

提供两个 skill + 一个 session hook，让任意 Java 项目具备完整的 AI 辅助开发闭环：
- 项目背景沉淀 → 需求分析 → 任务实现 → 验证 → 审查 → 归档
- 新开会话自动注入上下文，不靠记忆

## 目录结构

### 1. 本仓库（kit 源码）

```
harness-agentic-spec/
│
├── install.ps1                      一键安装脚本，把下面所有内容部署到正确位置
│
├── skills/                          AI 工作流定义（安装后复制到 ~/.codex/skills/ 和 ~/.claude/skills/）
│   ├── local-spec-bootstrap/
│   │   └── SKILL.md                 老项目初始化：扫描代码，生成 openspec/ 背景文档
│   └── local-spec-dev/
│       └── SKILL.md                 需求研发主流程：proposal→impact→design→tasks→实现→验证→review
│
├── hooks/                           会话自动化脚本（安装后复制到 ~/.claude/hooks/）
│   └── session-start-openspec.js    会话启动时检测 openspec/，自动注入进行中 change 的上下文
│
├── openspec-templates/              每个项目 openspec/ 的骨架来源（安装后复制到 ~/.codex/openspec-templates/）
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

### 2. 安装后的全局位置

`install.ps1` 执行后，文件被部署到以下位置：

```
~/.codex/skills/
  local-spec-bootstrap/SKILL.md      ← 来自 skills/
  local-spec-dev/SKILL.md            ← 来自 skills/

~/.claude/skills/
  local-spec-bootstrap/SKILL.md      ← 同上（Claude Code 也能用）
  local-spec-dev/SKILL.md

~/.claude/hooks/
  session-start-openspec.js          ← 来自 hooks/

~/.codex/openspec-templates/         ← 来自 openspec-templates/
  changes/_template/
  templates/
```

同时自动写入：
- `~/.claude/settings.json` — 注册 SessionStart hook（Claude Code）
- `~/.codex/hooks.json` — 注册 SessionStart hook（Codex）
- `~/.codex/config.toml` — 开启 `codex_hooks = true`

### 3. 每个项目里的 openspec/（由 local-spec-bootstrap 生成）

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
        └── {change-id}/             一个需求对应一个目录（如 waba-quality-monitoring）
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

## 安装

```powershell
git clone <this-repo> D:\metadata\harness-agentic-spec
cd D:\metadata\harness-agentic-spec
.\install.ps1
```

安装完成后重启 Claude Code / Codex 生效。

### 可选参数

```powershell
.\install.ps1 -SkipClaude   # 跳过 Claude Code 配置
.\install.ps1 -SkipCodex    # 跳过 Codex 配置
```

## 新项目接入

```
1. cd 到任意项目目录
2. 说 "初始化 openspec"          → local-spec-bootstrap 扫描项目，生成 openspec/
3. 说 "开始开发 [需求描述]"       → local-spec-dev 启动完整研发流程
```

## 日常使用

| 场景 | 操作 |
|---|---|
| 开始新需求 | 说 "开始开发 xxx" |
| 恢复中断的需求 | 说 "继续" 或 "继续 [change-id]" |
| 新开会话 | 自动注入当前 change 上下文（hook 自动触发） |
| 更新 kit | `git pull && .\install.ps1` |

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

