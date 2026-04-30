# Agent 简报：{变更标题}

## 目标

待填写。

## 当前阶段

- 阶段：`proposal`
- 当前任务：无

## 执行顺序

代码实现前必须先完成：

```text
proposal -> impact -> design -> tasks
```

进入实现后，每个任务必须执行：

```text
开发 -> 验证 -> 审查 -> 反思 -> 修正 -> 再验证 -> 再审查
```

## 必读文件

- `proposal.md`
- `impact.md`
- `design.md`
- `tasks.md`
- `openspec/project.md`
- `openspec/context/code-map.md`
- `openspec/context/verification.md`

## 全局约束

- 不做非目标中的内容。
- 不修改未授权文件。
- 所有判断必须写证据来源。
- 遇到冲突写入 `questions.md`，等待主 Agent 决策。
- 子 Agent 不直接推进 `run.json` 全局状态，由主 Agent 统一更新。
