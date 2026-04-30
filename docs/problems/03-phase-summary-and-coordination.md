# P3：阶段摘要在哪里、Agent 如何分工、谁来决策

**状态**：🔧 部分解决

---

## 问题描述

一个需求的开发涉及多个 agent 协作，会产生三类混乱：

1. **阶段摘要散落**：impact 分析、design 决策、任务产出分散在各文件里，没有一个"这个阶段结束时我们达成了什么"的清晰总结
2. **Agent 分工不清**：多个 agent 可能同时写同一个文件，互相覆盖；或者不知道该谁来做某件事
3. **决策权不明**：子 Agent 遇到冲突时不知道找谁，主 Agent 没有强制的决策记录机制

---

## 解决方案设计

### 阶段摘要：checkpoints/

每个阶段（proposal / impact / design / tasks / implementation / verification / review）结束时，**必须**写一个 checkpoint：

```
agent-space/checkpoints/{phase}-done.md
```

格式严格控制在 30 行内，包含：
- 当前状态（change、阶段、下一阶段、当前任务）
- 关键决策（3-5 条，已确定不回头的）
- 已确认影响文件（路径 + 一句说明）
- 当前阻塞（无则写"无"）

**不写**：过程细节、完整分析、推测性内容。

---

### Agent 分工：agent-space/ 协作协议

```
agent-space/
  brief.md         主 Agent 写 → 所有 Agent 读（任务简报，当前焦点）
  assignments.md   主 Agent 写 → 明确每个子 Agent 的输入、输出、文件所有权
  questions.md     子 Agent 追加 → 阻塞问题，等主 Agent 决策
  decisions.md     主 Agent 写 → 所有已确定决策，子 Agent 必须服从
  findings/        子 Agent 写调研结果（impact-api、impact-db 等）
  reviews/         子 Agent 写任务审查报告（T1-review.md 等）
  checkpoints/     主 Agent 写阶段快照
```

**关键规则**：
- 子 Agent 之间不直接沟通，通过 agent-space 文件间接协调
- 每个文件有明确的写入者（文件所有权）
- 文件所有权在 assignments.md 里声明，冲突前检查

---

### 决策权：主 Agent 是唯一决策者

决策层级：

```
人（用户）
  ↓ 只在以下情况介入：
  - 未知变更类型（超出 playbook 范围）
  - 风险超过阈值（影响范围 > 设计边界）
  - 子 Agent 多轮无法解决的阻塞

主 Agent（local-spec-dev 总控）
  ↓ 负责：
  - 维护 run.json 状态机
  - 写 decisions.md
  - 读 questions.md 并在 decisions.md 裁决
  - 决定是否进入下一阶段

子 Agent（impact-api / worker-Tn / reviewer-Tn 等）
  ↓ 负责：
  - 在授权文件范围内执行
  - 遇到冲突写 questions.md，不自行决策
  - 不修改 run.json 全局状态
```

---

## 当前实现状态

### 已完成

- [x] agent-space/ 目录结构和各文件职责在 SKILL.md 中定义
- [x] checkpoints/ 格式规范在 SKILL.md 中定义
- [x] 主 Agent / 子 Agent 职责边界在 SKILL.md 中定义
- [x] questions.md → decisions.md 裁决流程在 SKILL.md 中定义
- [x] scrm-waba 实际使用验证（waba-quality-monitoring 有完整的 reviews/ 和 decisions.md）

### 未完成 / 缺口

- [ ] **checkpoints/ 写入是手动的**：没有 hook 在阶段切换时强制触发
- [ ] **assignments.md 实际很少被写**：agent 会跳过文件所有权声明直接做事
- [ ] **questions.md 裁决循环没有明确超时机制**：子 Agent 等待主 Agent 裁决时可能陷入死锁
- [ ] **没有 PreToolUse 门禁**：无法机械地阻止 agent 在没有 assignments.md 的情况下修改文件

---

## 下一步

| 优先级 | 行动 | 负责 |
|---|---|---|
| 高 | PreToolUse hook：实现阶段前检查（implementation 前必须有 proposal/impact/design/tasks） | hook 开发 |
| 高 | checkpoint 写入作为阶段门禁（不写不能推进 run.json） | skill 更新 |
| 中 | questions.md 超时机制：超过 N 轮未裁决时主动上报人工 | skill 更新 |
