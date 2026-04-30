# P5：哪些场景必须人工介入，如何处理

**状态**：❌ 未开始

---

## 问题描述

当前体系假设 agent 能自主完成大多数开发任务，但存在一些场景 agent 无法或不应该独立处理：

1. **需求本身有歧义**：验收标准写不清楚，agent 做完了但方向可能是错的
2. **未知变更类型**：需求超出已知的 playbook 范围，agent 没有历史样本参考
3. **设计决策有重大风险**：影响核心架构或数据安全，不应该靠 agent 自行拍板
4. **子 Agent 多轮阻塞无法解决**：questions.md 里的问题 N 轮没有被主 Agent 处理
5. **验证失败超过阈值**：同一任务修正超过 3 轮还没通过，说明有更深层的问题

如果这些场景没有明确的介入机制，要么 agent 硬撑出错误结果，要么卡死在循环里，用户浑然不知。

---

## 解决方案设计（待实现）

### 原则：明确升级路径，不让 agent 在不确定时自作主张

### 场景分类和处理方式

#### 场景 A：需求歧义（在 proposal 阶段）

**触发条件**：proposal.md 中的验收标准包含模糊词（"合理"、"尽量"、"视情况"），或 agent 无法写出可观察的验收标准。

**期望行为**：
- agent 写出歧义清单到 `agent-space/questions.md`
- 停止推进，明确提示用户："以下问题需要您确认后才能继续"
- 用户回答后，更新 proposal.md，继续流程

**当前状态**：❌ 没有自动识别歧义的机制，agent 可能跳过继续做

---

#### 场景 B：未知变更类型

**触发条件**：需求无法映射到任何已知 playbook 的变更类型（protocol / lifecycle / push-routing / ACK / new-api 等）。

**期望行为**：
- agent 在 proposal.md 里明确标注 `变更类型：未知`
- 生成一份变更类型推测和风险说明，写入 `agent-space/questions.md`
- 停止推进，等用户确认或补充变更类型

**当前状态**：❌ 没有变更类型分类器，agent 会自行推断

---

#### 场景 C：高风险设计决策

**触发条件**：设计方案涉及以下任意一项：
- 删除或重命名数据库字段（会破坏历史数据）
- 修改公共 API 签名（影响外部调用方）
- 引入新的分布式事务或锁机制
- 修改认证/鉴权核心逻辑

**期望行为**：
- agent 在 design.md 里标记 `[HIGH RISK]`
- 在 `agent-space/questions.md` 写明风险和备选方案
- 不进入 implementation 阶段，等用户在 design.md 里明确批准

**当前状态**：❌ 没有风险识别机制，agent 可能直接实现

---

#### 场景 D：子 Agent 阻塞超时

**触发条件**：`agent-space/questions.md` 中某个问题超过 2 个任务轮次未被主 Agent 处理。

**期望行为**：
- 主 Agent 检查 questions.md 时发现超时问题
- 如果主 Agent 也无法裁决，上报人工："以下问题已阻塞 {N} 个任务，需要您介入"
- 人工回答后，写入 decisions.md，子 Agent 继续

**当前状态**：❌ questions.md 写了无人处理的问题可能永久存在

---

#### 场景 E：任务修正超过阈值

**触发条件**：`run.json.task_iterations.{Tn}` >= 3（同一任务修正超过 3 轮）。

**期望行为**：
- agent 停止修正循环
- 在 `agent-space/questions.md` 写明：已修正 N 轮、每次失败原因、当前卡点
- 提示用户："T{n} 已修正 {N} 轮，可能存在设计级问题，请介入"
- 等待人工判断：是继续修正、还是回退到 design 阶段

**当前状态**：❌ SKILL.md 定义了修正循环，但没有超过阈值时的升级机制

---

## 实现方案（规划中）

### 方案一：在 SKILL.md 里加明确的升级规则（低成本）

在 local-spec-dev 的"两层循环"章节加：

```
修正次数 >= 3：必须停止，写 questions.md，等人工介入
design 阶段识别到 HIGH RISK 标记：不得进入 implementation，等用户批准
proposal 阶段发现验收标准不可观察：写歧义清单，等用户确认
```

### 方案二：PreToolUse Hook 强制门禁（高成本，高可靠）

在编辑代码文件前，hook 检查：
- `run.json.task_iterations.{active_task}` 是否 >= 3
- `agent-space/questions.md` 是否有未解决问题
- 如果是，block 编辑，提示上报

---

## 下一步

| 优先级 | 行动 | 负责 |
|---|---|---|
| 高 | 在 SKILL.md 加方案一：修正阈值规则 + HIGH RISK 标记 + 歧义清单 | skill 更新 |
| 高 | 明确"人工介入提示"的标准格式（用户看到什么、需要做什么） | 规范设计 |
| 中 | PreToolUse hook：检查 task_iterations 阈值 | hook 开发 |
| 低 | 变更类型分类器（自动识别变更类型，匹配 playbook） | 未来规划 |
