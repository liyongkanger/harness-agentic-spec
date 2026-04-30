# Agent 分工

默认采用 Agent Team 方式推进：

- 主 Agent：总控、状态机、分工、合并、裁决。
- 专项 Agent：影响面扫描、实现、验证、审查。
- 共享空间：`agent-space/`。

## 分工规则

每个分工必须写清：

- 角色
- 模式：`read_only / write_allowed`
- 输入
- 输出
- 文件所有权
- 必须报告的内容

## 推荐角色

| 角色 | 适用阶段 | 模式 | 输出 |
|---|---|---|---|
| `impact-api` | impact | read_only | `agent-space/findings/impact-api.md` |
| `impact-db` | impact | read_only | `agent-space/findings/impact-db.md` |
| `impact-job-mq` | impact | read_only | `agent-space/findings/impact-job-mq.md` |
| `worker-Tn` | implementation | write_allowed | 代码文件、`tasks.md` 证据 |
| `reviewer-Tn` | review | read_only | `agent-space/reviews/Tn-review.md` |
| `verifier` | verification | read_only/write_docs | `agent-space/verification/*.md` |
| `requirement-reviewer` | review | read_only | `review.md` 草稿或审查发现 |

## 硬约束

- `proposal/impact/design/tasks` 完成前，不分配代码实现任务。
- 写代码任务必须声明 `owned_code_paths`。
- 审查任务不得修改业务代码。
- 验证任务只记录命令、结果和失败摘要。
- 所有阻塞问题写入 `questions.md`。

## 分工模板

```yaml
agent: impact-api
role: Controller/client/DTO 影响面扫描
mode: read_only
input:
  - proposal.md
  - openspec/context/code-map.md
owned_outputs:
  - agent-space/findings/impact-api.md
allowed_paths:
  - scrm-waba-client/src/main/java
  - scrm-waba-common/src/main/java
  - scrm-waba-server/src/main/java/**/controller
must_report:
  - 证据路径
  - 影响文件
  - 风险
  - 待确认问题
```

```yaml
agent: worker-T1
role: 实现 T1
mode: write_allowed
input:
  - proposal.md
  - impact.md
  - design.md
  - tasks.md
owned_code_paths:
  - 待填写
owned_outputs:
  - tasks.md
  - agent-space/verification/T1.md
conflict_rule: 不允许修改 owned_code_paths 之外的文件
must_report:
  - 修改文件
  - 验收覆盖
  - 验证结果
  - 风险
```
