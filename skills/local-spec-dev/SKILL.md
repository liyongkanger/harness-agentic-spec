---
name: local-spec-dev
description: 基于当前仓库 openspec/ 资料，以 Agent Team 方式推进本地规格驱动开发。适用于用户要求“按 OpenSpec/AI Spec 开发需求”、“继续某个 change”、“把需求拆成功能点并实现/验证/审查/修正”、“用本地 spec 工作流自动完成代码需求”时；默认只处理本地仓库代码，不处理飞书、阿拉丁、精卫、部署等外部系统。默认按主 Agent 总控 + 专项 Agent 角色组织，先生成 proposal/impact/design/tasks，再进入代码实现；每个任务必须经过开发、验证、审查、反思、修正循环。
---

# Local Spec Dev

## 职责边界

作为具体需求变更的本地开发总控：读取 `openspec/` 背景和当前 change，把需求推进到本地可交付状态。

默认采用 Agent Team 模式组织工作：

- 主 Agent 是总控，维护状态机、文件所有权、阶段门禁和最终决策。
- 专项 Agent 角色负责影响面扫描、任务实现、验证、审查等独立工作。
- 所有协作通过 change 下的 `agent-space/` 共享空间记录。
- 在代码实现前必须先完成 `proposal.md`、`impact.md`、`design.md`、`tasks.md`。
- 每个任务必须经过“开发 -> 验证 -> 审查 -> 反思 -> 修正 -> 再验证 -> 再审查”的循环，直到通过或阻塞。

负责：

- 创建或接管 `openspec/changes/{change-id}/`。
- 维护 `run.json` 状态机和当前任务。
- 推进 `proposal -> impact -> design -> tasks -> implementation -> verification -> review -> archive`。
- 执行任务级“开发 -> 验证 -> 审查 -> 修正”循环。
- 执行需求级总审查和反思。
- 将证据写回 `tasks.md`、`verification.md`、`review.md`、`agent-space/`。

不负责：

- 老项目首次背景沉淀；这属于 `local-spec-bootstrap`。
- 外部系统动作：飞书、阿拉丁、精卫、部署。
- 未经审查直接更新长期规格。

## 启动检查

1. 确认当前目录是目标仓库。
2. 读取 `openspec/project.md`、`openspec/context/`、`openspec/specs/_index.md`（存在时）。
3. 读取 `openspec/changes/README.md` 和当前 change 目录。
4. 若 `openspec/` 不存在，停止并建议初始化 OpenSpec 骨架。
5. 若工作区有未提交改动，识别但不回滚；只处理本次需求相关文件。
6. 读取 `agent-space/checkpoints/` 下最新的 checkpoint 文件（按文件名排序取最后一个）作为上下文基准，**优先于**重新推断阶段状态。若无 checkpoint，回退到读取 `agent-space/brief.md`。

## Change 选择

用户指定 change-id 时，使用 `openspec/changes/{change-id}/`。

用户给新需求时：

1. 生成简短 kebab-case `change-id`。
2. 从 `openspec/changes/_template/` 复制到 `openspec/changes/{change-id}/`。
3. 更新 `run.json` 的 `change_id`、`title`、`current_stage`、`updated_at`。
4. 初始化 `agent-space/brief.md`、`agent-space/assignments.md`。
5. 先填写 `proposal.md`，再进入 `impact/design/tasks`，不要直接改代码。

如果多个候选 change 无法判断，向用户确认。

## 状态机

全局阶段顺序：

```text
proposal -> impact -> design -> tasks -> implementation -> verification -> review -> archive
```

每个阶段结束必须更新 `run.json`：

- 当前阶段：`pending / running / passed / blocked`。
- `current_stage`：下个阶段或阻塞阶段。
- `active_task`：当前任务编号，空表示无任务级执行。
- `iteration`：需求级循环次数。
- `task_iterations`：每个任务的修正轮次。
- `last_error`：阻塞原因；无阻塞置空。
- `updated_at`：当前 ISO 时间。

**每个阶段结束，更新 `run.json` 的同时，必须写入 checkpoint**（见 `## Checkpoint 规范`）。

阶段推进后必须运行机器校验，不能只靠人工阅读：

```powershell
node "$env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js" validate {change-id}
node "$env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js" gate {completed-stage} {change-id}
```

上述稳定路径由插件初始化脚本 `scripts/plugin-install.ps1` 创建；若未初始化，先运行插件初始化。

进入 `review` 或 `archive` 前，使用严格模式：

```powershell
node "$env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js" validate {change-id} --strict
node "$env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js" gate review {change-id}
```

如校验失败，必须回到最小必要阶段修正 `run.json`、产物、任务状态或 checkpoint，再重新校验。

`gate` 决策含义：

- `pass`：允许进入下一阶段。
- `warn`：允许继续，但必须把风险写入当前阶段文档或 `review.md`。
- `block`：不允许推进，必须修正后重跑。
- `waived`：人工豁免，必须使用 `--waive "<reason>"`，并同步记录到 `agent-space/decisions.md`。

用户说”继续/直接做”只表示使用推荐路径，不表示跳过阶段。

## 两层循环

### 第一层：任务级循环

每个任务按这个闭环推进，直到通过：

```text
计划任务
  -> 实现
  -> 局部验证
  -> 任务审查
  -> 反思失败原因
  -> 修正
  -> 再验证
  -> 再审查
  -> done
```

任务状态只允许：

```text
pending -> in_progress -> implemented -> verified -> reviewed -> done
                         \-> blocked
                         \-> needs_fix
```

规则：

- 一次聚焦 1 个任务；复杂但强相关时最多 2-3 个。
- 每次实现前说明准备改哪些文件。
- 每次实现后必须验证和审查，不能直接标 done。
- 审查失败必须写“失败原因、修正计划、下一轮验证方式”。
- 修正后必须重新验证和重新审查。
- `tasks.md` 必须记录状态、文件证据、验证证据、审查结论、修正轮次。

### 第二层：需求级循环

所有任务 done 后，执行需求级总审查：

```text
汇总任务证据
  -> 全量验证
  -> 验收标准覆盖审查
  -> 跨任务业务流审查
  -> 非目标检查
  -> 风险反思
  -> 如失败，定位回具体任务/阶段
  -> 修正后再审查
```

需求级审查失败时，必须回到最小必要阶段：

- 需求不清楚 -> `proposal`
- 影响范围漏了 -> `impact`
- 方案不完整 -> `design`
- 任务拆分不合理 -> `tasks`
- 代码问题 -> `implementation`
- 验证不足 -> `verification`

## 子 Agent 协作

默认按 Agent Team 角色分工。若当前会话允许实际使用子 Agent，优先把独立、边界清晰、可并行的工作交给子 Agent；若工具或上下文不允许实际 spawn，则主 Agent 必须按同样角色顺序内联执行，并把角色输出写入 `agent-space/`。

实际 spawn 子 Agent 时必须满足：

- 子任务具体、边界清晰、输入输出明确。
- 不把当前关键路径的立即阻塞工作外包。
- 写代码的子 Agent 必须有明确文件所有权。
- 不同子 Agent 的写入范围不能冲突。
- 主 Agent 继续做非重叠工作，不空等。

主 Agent 职责：

- 维护 `run.json`。
- 写 `agent-space/brief.md` 和 `agent-space/assignments.md`。
- 分配任务和文件所有权。
- 合并子 Agent 输出。
- 处理冲突和用户提问。
- 决定是否进入下一阶段。

子 Agent 适合承担：

- `impact-api`：Controller、client、DTO 契约影响面。
- `impact-db`：Mapper、XML、表、字段影响面。
- `impact-job-mq`：Job、Scheduled、MQ、异步处理影响面。
- `worker-Tn`：在明确文件所有权内实现某个任务。
- `reviewer-Tn`：对照任务验收做代码审查。
- `verifier`：执行或整理编译/测试结果。
- `requirement-reviewer`：需求级总审查。

子 Agent 不负责：

- 改全局状态。
- 覆盖其他 Agent 输出。
- 修改未授权文件。
- 接受风险或改变需求边界。

## Checkpoint 规范

**写入时机**：每个阶段结束、进入下一阶段前。文件路径：`agent-space/checkpoints/{phase}-done.md`。

**必须包含**（控制在 30 行以内）：

```markdown
---
change: {change-id}
stage: {完成的阶段}
next: {下一阶段}
task: {active_task 或 none}
updated: {ISO 时间}
---

## 关键决策
<!-- 已确定、不再回头的决策，3-5 条，带一句理由 -->

## 已确认影响文件
<!-- 路径 + 一句说明其作用，不超过 10 条 -->

## 当前阻塞
<!-- 无则写"无" -->
```

**不写**：实现过程细节、完整 impact 分析、对话历史、推测性内容。

**任务级 checkpoint**：每个任务进入 `done` 时，追加一行到 `agent-space/brief.md` 的"已完成任务"列表；若该任务产生新的架构决策，同步追加到 `agent-space/decisions.md`。

---

## agent-space 规范

每个 change 下使用：

```text
agent-space/
  brief.md
  assignments.md
  assignments.json
  questions.md
  decisions.md
  checkpoints/          ← 各阶段完成时的 checkpoint 文件
  findings/
  reviews/
  verification/
  handoffs/
```

通信规则：

- `brief.md`：主 Agent 写，所有 Agent 读。
- `assignments.md`：主 Agent 写，定义角色、输入、输出、文件所有权。
- `assignments.json`：主 Agent 写，机器可校验的 Agent 分工、文件所有权和 required outputs。
- `questions.md`：子 Agent 追加阻塞问题。
- `decisions.md`：主 Agent 写最终决策，子 Agent 必须服从。
- `findings/`：影响面和调研输出。
- `reviews/`：任务级审查输出。
- `verification/`：验证日志和结果。
- `handoffs/`：子 Agent 完成后的交接说明。

子 Agent 之间不直接互相协调；有冲突写入 `questions.md`，由主 Agent 在 `decisions.md` 裁决。

机器协作规则：

- 进入 `tasks` 后，主 Agent 必须运行 `harness-spec agents init {change-id}` 或手工维护 `assignments.json`。
- 写代码 Agent 必须声明 `owned_paths`，不同写代码 Agent 的路径不得重叠。
- 子 Agent 不得拥有 `run.json`、`decisions.md`、`assignments.json`。
- 每个有 worker 的任务必须有独立 verifier 和 reviewer。
- 子 Agent 完成后必须写 required outputs；后期 gate 会校验这些输出存在。
- 每次进入 `implementation`、`verification`、`review` 前运行 `harness-spec agents verify {change-id}`。

## 阶段规则

### proposal

写清为什么做、改什么、验收标准、非目标、开放问题。验收标准必须可观察、可验证。

门禁：`harness-spec gate proposal {change-id}` 必须通过，确保 `proposal.md` 章节完整、无占位符、`proposal` 阶段已 passed，且有 `proposal-done.md`。

### impact

基于 `proposal.md` 和 `openspec/context/` 扫描真实代码。

- 优先用 `rg` / `rg --files`。
- 判断必须带来源：文件路径、类名、方法名、XML id、配置 key。
- 可拆成 `impact-api`、`impact-db`、`impact-job-mq` 子 Agent。

输出：`impact.md` 和必要的 `agent-space/findings/*.md`。

门禁：`harness-spec gate impact {change-id}` 必须通过，确保影响面有代码证据、影响模块、风险和 checkpoint。

### design

基于影响面形成实现方案。

必须覆盖：

- 关键设计决策。
- 主业务流变化。
- API/DTO、数据库/Mapper、配置、Job/MQ 影响。
- 错误处理和边界场景。
- 测试策略。

每条验收标准必须能映射到设计行为。

门禁：`harness-spec gate design {change-id}` 必须通过，确保设计章节完整、无占位符、前置阶段已通过。

### tasks

按可独立验收的功能点拆任务，不按文件机械拆。

每个任务必须包含：

- 状态。
- 验收项。
- 文件所有权。
- 验证方式。
- 审查要求。
- 修正记录。

门禁：`harness-spec gate tasks {change-id}` 必须通过，确保存在 Tn 任务、任务状态合法、前置阶段已通过。
任务拆分完成后必须初始化或更新 Agent 分工：

```powershell
node "$env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js" agents init {change-id}
node "$env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js" agents verify {change-id}
```

### implementation

按 `tasks.md` 逐任务执行任务级循环。

实现必须受 `proposal.md`、`impact.md`、`design.md`、`tasks.md` 约束。不做非目标，不顺手重构无关代码。

门禁：`harness-spec gate implementation {change-id}` 必须通过，确保所有任务状态为 `done`，且实现阶段有 checkpoint。
implementation gate 会要求 `assignments.json` 合法，并在该阶段开始要求子 Agent required outputs 已存在。

### verification

记录本地命令和结果。优先：

- `mvn compile`
- 相关模块测试或相关单测
- DTO/API 兼容检查
- Mapper 字段覆盖检查
- Job/MQ 幂等和失败分支检查

命令无法运行时写明原因，不假装通过。

同时必须运行 OpenSpec 状态机校验，并把结果写入 `verification.md`：

```powershell
node "$env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js" validate {change-id}
node "$env:USERPROFILE\.codex\harness-spec\tools\harness-spec.js" gate verification {change-id}
```

### review

分两部分：

1. 任务级审查：写到 `agent-space/reviews/Tn-review.md`，并摘要回 `tasks.md`。
2. 需求级总审查：写到 `review.md`。

审查必须包含反思：

- 这轮失败/风险来自需求理解、影响面、设计、实现、验证，还是测试数据？
- 是否有相同类型问题会影响其他任务？
- 下一轮修正如何证明问题已经消除？

需求级 review 通过前必须满足：

- `harness-spec validate {change-id} --strict` 通过。
- `harness-spec gate review {change-id}` 通过。
- 所有任务状态为 `done`。
- 已通过阶段都有对应 checkpoint。

### archive

只有需求级 review 通过后才归档。若本次改变长期系统行为，把被接受的行为合并到 `openspec/specs/`。

## 输出习惯

工作中简短说明当前阶段、当前任务、是否处于修正轮次。

完成时输出：

- change-id。
- 当前阶段和任务状态。
- 修改的 OpenSpec 文件。
- 修改的代码文件（如果已实现）。
- 验证结果。
- 审查结论。
- 阻塞问题或下一步建议。
