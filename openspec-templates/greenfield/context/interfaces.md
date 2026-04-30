# 接口契约

## 本服务对外提供的 API

| API | Consumer | Request DTO | Response DTO | 契约来源 | 兼容策略 |
|---|---|---|---|---|---|
| `{api}` | `{consumer}` | `{Request}` | `{Response}` | `{client/OpenAPI/MQ schema/RPC IDL}` | 只做兼容性新增 |

## 本服务调用的下游系统

| System | 用途 | Timeout | Retry | Fallback/熔断 | 幂等 | 错误映射 |
|---|---|---|---|---|---|---|
| `{system}` | `{purpose}` | `{timeout}` | `{policy}` | `{fallback}` | `{key/policy}` | `{mapping}` |

## 兼容性规则

- 新增可选 response 字段是兼容变更。
- 新增有默认值的 request 字段是兼容变更。
- 新增必填 request 字段且没有默认值是破坏性变更。
- 重命名字段、删除字段、改变字段类型是破坏性变更。
- 改变枚举含义、错误码语义、分页/排序/权限语义是破坏性变更。
- 写接口必须具备幂等键，或明确说明为什么不需要。

## 错误契约

```json
{
  "code": "{SERVICE}_400001",
  "message": "Invalid request",
  "traceId": "..."
}
```

## 契约测试

| Contract | Provider | Consumer | 校验方式 | 命令 |
|---|---|---|---|---|
| `{contract}` | `{provider}` | `{consumer}` | `{OpenAPI/Pact/compile-only/manual}` | `{command}` |
