# harness-agentic-spec

团队专属的规格驱动开发工具包。

提供两个 skill + 一个 session hook，让任意 Java 项目具备完整的 AI 辅助开发闭环：
- 项目背景沉淀 → 需求分析 → 任务实现 → 验证 → 审查 → 归档
- 新开会话自动注入上下文，不靠记忆

## 包含内容

```
skills/
  local-spec-bootstrap/   项目初始化：扫描棕地代码，生成 openspec/ 背景文档
  local-spec-dev/         需求研发：proposal→impact→design→tasks→实现→验证→review

hooks/
  session-start-openspec.js   会话启动时自动加载进行中 change 的上下文

openspec-templates/
  changes/_template/      每个需求 change 的骨架文件
  templates/              能力规格和 review 矩阵模板
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

## 目录结构说明

安装后，每个项目的 `openspec/` 结构：

```
openspec/
  project.md              项目级背景（技术栈、模块、验证命令）
  context/
    code-map.md           代码地图（入口、Service、Mapper、MQ 等）
    verification.md       本地验证命令和注意事项
  specs/
    _index.md             长期能力规格索引
    {capability}/
      spec.md             单个能力的行为规格
  changes/
    _template/            新 change 的骨架（由 install.ps1 复制自 kit）
    {change-id}/          每个需求的完整工作目录
      proposal.md
      impact.md
      design.md
      tasks.md
      verification.md
      review.md
      run.json            阶段状态机
      agent-space/
        brief.md
        decisions.md
        checkpoints/      各阶段 checkpoint 文件
        ...
```
