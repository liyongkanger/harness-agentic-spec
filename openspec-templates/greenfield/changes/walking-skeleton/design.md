# 设计

## 概览

构建最小可运行服务结构，并记录新项目的关键架构决策。

## 模块设计

```text
{service}-common
{service}-client
{service}-server
```

## API 设计

- Health endpoint：`{method} {path}`
- 示例 client 契约：`{interface}`
- 示例 DTO：`{request}`, `{response}`
- 契约来源：`{client/OpenAPI/MQ schema/RPC IDL}`

## 错误处理

- 使用 `openspec/context/interfaces.md` 中定义的服务错误码约定。
- 下游错误必须映射成本服务稳定错误语义。

## 跨系统接口策略

- 本服务对外接口先定义契约，再实现 server。
- 写接口必须定义幂等策略。
- 下游 client 必须定义 timeout、retry、fallback/circuit breaker、错误映射。
- 关键 provider/consumer 关系需要 OpenAPI/Pact/等价契约校验。

## 验证策略

- 编译所有模块。
- 依赖可用时运行测试。
- 能启动 server 或运行 context-load test。
- 校验 common/client/server 依赖方向。

## 设计门禁

- 架构决策已记录。
- 模块依赖方向清晰。
- 接口兼容策略清晰。
- 契约测试或替代校验方式已说明。
