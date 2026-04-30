# 提案

## 背景

在实现业务功能前，先创建一个可运行、可验证、边界清晰的 Java 服务骨架。

## 变更内容

- 创建 `common`、`client`、`server` 三层模块。
- 添加最小 Spring Boot 应用。
- 添加 health / smoke 接口。
- 添加初始 DTO 和 client 契约示例。
- 添加构建和验证命令。
- 记录跨系统接口和下游调用治理规则。

## 验收标准

- `mvn compile` 或 `mvn test` 成功运行，或者准确记录阻塞原因。
- server 模块有启动入口。
- 依赖方向符合 `server -> client -> common`。
- OpenSpec 架构文档和接口契约文档已存在。
- public DTO 不复用持久化 entity。
- 下游调用策略包含 timeout、retry、fallback、错误映射。

## 非目标

- 不实现生产业务功能。
- 不创建数据库 schema，除非 walking skeleton 必须依赖。
- 不真正集成外部系统，只保留清晰占位和契约。

## 待确认问题

- `{question}`
