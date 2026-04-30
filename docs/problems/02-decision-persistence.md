# P2：关键决策需要沉淀，不能只活在对话里

**状态**：🔧 部分解决

---

## 问题描述

开发过程中会产生大量技术决策：
- 为什么选方案 A 而不是方案 B
- 某个字段类型为什么这样设计
- 某个边界条件为什么不处理

这些决策如果只存在于对话中，会话一关就消失。下次 agent 或新成员重新遇到同样问题，会重新讨论一遍，甚至得出相反结论，造成实现不一致。

## 根本原因

没有一个约定俗成的、agent 知道必须写的决策记录文件。"在哪写"和"什么值得写"没有明确定义。

---

## 解决方案设计

### 决策记录文件：`agent-space/decisions.md`

- **位置**：每个 change 的 `agent-space/decisions.md`
- **格式**：表格，append-only，不删改已有记录
- **写入时机**：
  1. 主 Agent 做出会影响其他任务或未来需求的决定时，立即追加
  2. 子 Agent 发现需要决策的问题，写入 `questions.md` → 主 Agent 裁决后写入 `decisions.md`
  3. 每个阶段结束的 checkpoint 里提取最重要的 3-5 条

### 决策表格格式

```markdown
| 时间 | 问题 | 决策 | 原因 | 影响范围 |
|---|---|---|---|---|
| 2026-04-30 | 质量链路架构 | BSP 主动同步，SCRM 主动查询 | 避免新增跨站点推送 | BSP 质量服务、SCRM 同步 |
```

### 长期沉淀

need 归档时，把本次 change 中被证明正确且具有长期价值的决策，合并到：
- `openspec/specs/{capability}/spec.md` 的"设计决策"章节
- 避免下次需求又要重新推断

---

## 当前实现状态

### 已完成

- [x] `decisions.md` 模板文件已加入 `_template/agent-space/`
- [x] local-spec-dev SKILL.md 定义了 decisions.md 的写入规则和时机
- [x] session-start hook 在无 checkpoint 时加载 decisions.md（作为 fallback）
- [x] scrm-waba `waba-quality-monitoring` 的 decisions.md 有 8 条真实决策记录

### 未完成 / 缺口

- [ ] **写入是依赖 agent 自觉**：没有门禁或 hook 强制要求写 decisions.md
- [ ] **长期沉淀未打通**：归档时没有把 decisions 合并到 specs/ 的流程
- [ ] **跨 change 检索缺失**：如果同一类型的决策在多个 change 里出现，无法聚合查看

---

## 下一步

| 优先级 | 行动 | 负责 |
|---|---|---|
| 高 | 在 local-spec-dev SKILL.md 加强约束：进入 design 阶段必须有 decisions.md 初始化记录 | skill 更新 |
| 中 | archive 阶段流程补充：decisions.md → specs/ 合并步骤 | skill 更新 |
| 低 | 建立跨 change 决策检索（按能力域聚合） | 未来规划 |
