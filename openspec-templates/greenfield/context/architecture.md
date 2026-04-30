# 架构

## 架构决策

| 主题 | 决策 | 原因 |
|---|---|---|
| Java 版本 | `{java-version}` | `{reason}` |
| Spring Boot 版本 | `{spring-boot-version}` | `{reason}` |
| 构建工具 | `{maven}` | `{reason}` |
| 模块拆分 | `common/client/server` | 契约和运行时实现分离 |
| 根包名 | `{package-root}` | `{reason}` |
| HTTP API 风格 | `{REST/OpenAPI/other}` | `{reason}` |
| 跨系统调用方式 | `{Feign/RPC/MQ/other}` | `{reason}` |
| 契约测试 | `{OpenAPI/Pact/compile-only/none}` | `{reason}` |

## 模块依赖规则

```text
server -> client -> common
server -> common
```

禁止依赖：

```text
common -> client
common -> server
client -> server
```

## 模块职责

### common

- 公开 DTO。
- 共享枚举和常量。
- 错误码。
- validation group。
- 跨系统稳定值对象。

### client

- 公开 Java client 契约。
- 其他系统使用的 client adapter/configuration。
- 需要时提供 fallback 或错误映射约定。
- 不包含 server 实现和数据库访问。

### server

- controller。
- application/domain service。
- persistence adapter 和 downstream adapter。
- MQ、job、configuration。
- 全局异常处理。

## 运行时结构

```text
controller -> application -> domain
application -> infrastructure
```

## 配置

| Key | 用途 | 默认值 | 是否必填 |
|---|---|---|---|
| `{config.key}` | `{purpose}` | `{default}` | `{yes/no}` |

## 架构风险

- `{risk}`
