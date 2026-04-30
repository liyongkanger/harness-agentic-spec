# Agent Handoffs

子 Agent 完成任务后在这里写交接说明，主 Agent 只根据交接说明、代码 diff、验证结果和 review 结论更新全局状态。

命名建议：

- `T1-worker.md`
- `T1-verifier.md`
- `T1-reviewer.md`
- `impact-api.md`
- `impact-db.md`
- `impact-job-mq.md`

每个 handoff 至少包含：

- Agent ID
- 输入文件
- 修改或检查的文件
- 完成结果
- 验证证据
- 风险和阻塞
