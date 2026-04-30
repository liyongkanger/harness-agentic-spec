# P1：会话关闭后如何断点续传

**状态**：🔧 部分解决

---

## 问题描述

AI 会话关闭后，agent 对以下内容完全失忆：
- 当前在哪个阶段（proposal / design / implementation …）
- 已经做了哪些任务、每个任务的结论是什么
- 遇到过什么阻塞、当时是怎么解决的
- 改了哪些文件、为什么改

下次新开会话，agent 只能靠重读所有文档重建上下文，效率低且容易漏掉关键细节。

## 根本原因

Agent 的工作记忆 = 对话上下文。对话关闭，记忆清零。没有任何机制把"会话中产生的知识"自动持久化到文件。

---

## 解决方案设计

### 核心原则：Agent 无状态，文件有状态

所有需要跨会话存活的信息必须写入文件，不能只存在于对话历史里。

### 状态持久化分层

```
run.json                    阶段状态机（当前阶段、任务状态、迭代次数）
agent-space/decisions.md    已确定的关键决策（append-only）
agent-space/brief.md        当前任务简报（主 Agent 维护）
agent-space/checkpoints/    各阶段结束时的精简快照（≤30 行）
  {phase}-done.md           → 这是断点续传的核心文件
```

### 断点续传流程

```
上次会话结束时：
  每个阶段结束 → 写 checkpoints/{phase}-done.md

新会话启动时：
  SessionStart hook 自动触发
  → 找到进行中的 change
  → 读最新 checkpoint（30 行内包含当前状态、关键决策、影响文件、阻塞）
  → 注入到 agent 上下文
  → Agent 立即知道从哪里继续
```

---

## 当前实现状态

### 已完成

- [x] `run.json` 持久化阶段状态（SKILL.md 定义）
- [x] `agent-space/` 目录结构（brief / decisions / checkpoints）
- [x] Checkpoint 格式规范写入 SKILL.md
- [x] `session-start-openspec.js` hook 实现（加载 checkpoint → 注入上下文）
- [x] Claude Code `settings.json` 注册 SessionStart hook
- [x] Codex `hooks.json` 注册 SessionStart hook
- [x] scrm-waba `waba-quality-monitoring` 首个 checkpoint 验证通过

### 未完成 / 缺口

- [ ] **PreCompact hook 缺失**：会话中途上下文被压缩时，没有自动写 checkpoint 的机制，agent 在同一会话内也会失忆
- [ ] **Checkpoint 写入是手动的**：SKILL.md 要求写，但没有 hook 强制执行。Agent 忘了写就没有断点
- [ ] **新项目无历史 checkpoint**：第一次用时只能 fallback 到 brief.md，恢复质量较差

---

## 下一步

| 优先级 | 行动 | 负责 |
|---|---|---|
| 高 | 实现 PreCompact hook，在上下文压缩前自动写 checkpoint | hook 开发 |
| 中 | 在 local-spec-dev SKILL.md 中把 checkpoint 写入设为强制门禁（不写不能进入下一阶段） | skill 更新 |
