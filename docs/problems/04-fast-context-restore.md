# P4：新会话启动时如何最快恢复上下文

**状态**：🔧 部分解决

---

## 问题描述

新开一个会话时，agent 需要重新理解：
- 项目是什么（技术栈、模块结构）
- 正在做什么需求（当前阶段、任务状态）
- 已经做了哪些决策（不能推翻的）
- 还有什么阻塞

如果靠 agent 自己读所有文档，耗时长、容易漏、上下文窗口也会被大量"静态背景"占满，挤掉真正有用的工作内容。

---

## 解决方案设计

### 目标：30 秒内恢复，上下文注入 ≤ 100 行

### 三层信息按需加载

```
Layer 1（每次必加载，≤30行）：  最新 checkpoint
  → 当前状态 + 关键决策 + 影响文件 + 阻塞

Layer 2（无 checkpoint 时 fallback）：  brief.md（前100行）+ decisions.md
  → 任务简报 + 历史决策

Layer 3（按需读取）：  project.md / code-map.md / design.md
  → Agent 主动读取，不在启动时注入
```

### 触发机制：SessionStart Hook

```
新会话启动
  → session-start-openspec.js 自动触发
  → 检测当前目录是否有 openspec/
  → 找到进行中的 change（run.json 非 archive）
  → 加载 Layer 1 或 Layer 2
  → 输出到 agent 上下文
```

### Checkpoint 格式（Layer 1 的核心）

```markdown
---
change: {change-id}
stage: {当前阶段}
next: {下一阶段}
task: {active_task}
updated: {ISO 时间}
---

## 关键决策
<!-- 3-5 条，不回头的 -->

## 已确认影响文件
<!-- 路径 + 一句说明，≤10 条 -->

## 当前阻塞
<!-- 无则写"无" -->
```

**30 行以内，Agent 读完立刻知道下一步做什么。**

---

## 当前实现状态

### 已完成

- [x] `session-start-openspec.js` 实现并注册到 Claude Code + Codex
- [x] Hook 三层加载逻辑：checkpoint → brief+decisions → 空
- [x] Checkpoint 格式规范在 SKILL.md 和 P1 中定义
- [x] 示例项目首个 checkpoint（`review-done.md`）验证注入效果
- [x] 实测输出：启动即加载，30 行内完整上下文

### 未完成 / 缺口

- [ ] **Checkpoint 依赖手动写入**：没有 checkpoint 时 fallback 到 brief.md，内容可能很长（例如某个 change 的 brief.md 超过 100 行）
- [ ] **多 change 并行时的优先级**：同一项目有多个进行中 change 时，hook 全部加载，上下文可能过长
- [ ] **PreCompact hook 缺失**：会话中途上下文压缩时，checkpoint 不会自动写入，同一会话内也会失忆

---

## 下一步

| 优先级 | 行动 | 负责 |
|---|---|---|
| 高 | PreCompact hook：上下文压缩前自动写 `compact-{timestamp}.md` checkpoint | hook 开发 |
| 中 | 多 change 并行时只加载 `run.json.current_stage != archive` 且 `active_task != null` 的 change | hook 优化 |
| 低 | brief.md 格式规范化（强制 ≤50 行，超出自动截断） | template 更新 |
