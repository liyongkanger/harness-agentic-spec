# Agent 协作空间

这里是同一个 change 下多个 Agent 的共享空间。

默认规则：

- 主 Agent 维护全局状态和最终决策。
- 子 Agent 只写自己被分配的输出文件。
- 子 Agent 不直接覆盖其他 Agent 的输出。
- 有冲突或问题写入 `questions.md`。
- 主 Agent 在 `decisions.md` 中裁决。

目录：

- `brief.md`：主 Agent 写的需求简报，所有 Agent 读。
- `assignments.md`：任务分工、输入、输出、文件所有权。
- `questions.md`：阻塞问题和冲突。
- `decisions.md`：主 Agent 决策记录。
- `findings/`：影响面和调研结果。
- `reviews/`：任务级审查记录。
- `verification/`：验证日志和结果。

