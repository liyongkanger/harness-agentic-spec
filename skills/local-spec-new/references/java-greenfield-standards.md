# Java 新项目规范

创建新的 Java 后端服务时使用本参考。目标是让新项目一开始就具备清晰模块边界、稳定跨系统契约、可验证的最小骨架。

## 默认技术栈

除非用户或仓库已有明确约束，否则默认：

- Java 17。
- Maven 多模块项目。
- Spring Boot 3.x。
- JUnit 5。
- `common/client/server` 三层模块。

如果组织要求 Spring Boot 2.x、Java 8/11 或 Gradle，先把原因写入 `openspec/context/architecture.md`，再生成骨架。

## Maven 结构

推荐结构：

```text
pom.xml
{service}-common/pom.xml
{service}-client/pom.xml
{service}-server/pom.xml
```

依赖方向：

```text
server -> client -> common
server -> common
```

禁止：

```text
common -> client
common -> server
client -> server
```

父 `pom.xml` 负责统一：

- Java / Spring Boot / Spring Cloud 版本。
- 编译插件和测试插件。
- dependency management。
- 模块列表。

业务依赖尽量放在实际使用的子模块，不要把 server 运行时依赖泄漏到 common/client。

## 包结构

使用统一根包，例如：

```text
com.company.{domain}.{service}
```

推荐包结构：

```text
common
  dto
  enums
  constants
  error
  validation

client
  api
  config
  fallback

server
  controller
  application
  domain
  infrastructure
    persistence
    client
    mq
    job
  config
  exception
```

## common 模块

`common` 只放跨模块或跨系统稳定契约：

- 公开 API 使用的 request/response DTO。
- 公开 DTO 使用的枚举。
- 错误码常量。
- validation group。
- 无基础设施依赖的小型值对象。

不要放：

- JPA / MyBatis entity。
- mapper 接口。
- service 实现。
- controller。
- Feign / HTTP 具体实现细节。

DTO 规则：

- 公开 DTO 默认向后兼容。
- 优先新增可空字段。
- 不复用持久化 entity 作为 DTO。
- 内部状态枚举不能随意暴露；暴露后就属于接口契约。
- 金额、时间、枚举、分页、排序字段要有明确格式。

## client 模块

`client` 是其他系统依赖本服务时使用的模块。

可以包含：

- 描述 provider API 的 Java interface。
- 组织标准的 HTTP/RPC client 注解或适配器。
- client configuration。
- fallback 接口或降级约定。
- 错误码映射 helper。

不能包含：

- server controller 实现。
- 数据库访问。
- 业务实现逻辑。

client 契约检查清单：

- 方法名描述 provider 能力，不描述传输细节。
- request/response 类型放在 `common`。
- 显式记录 timeout。
- 显式记录 retry；写接口只有具备幂等性才允许重试。
- 写接口定义幂等键，或说明为什么不需要。
- 错误码映射到稳定 provider 语义。
- 需要对外发布时，保证依赖体积小，不引入 server 运行时包。

## server 模块

`server` 拥有运行时行为：

- 启动类。
- controller。
- application service / use case。
- domain service。
- persistence adapter。
- MQ producer/consumer。
- scheduled job。
- configuration。
- 全局异常处理。

server 内部推荐调用方向：

```text
controller -> application -> domain
application -> infrastructure
infrastructure -> external systems/database/mq
```

避免 controller 直接访问 repository。编排逻辑放在 application service。

## API First 与契约来源

跨系统接口要先有契约，再有实现。契约可以来自：

- `client` 模块中的 Java interface。
- OpenAPI 文件。
- MQ topic / event schema 文档。
- gRPC / RPC IDL。

HTTP API 面向外部团队或多语言消费者时，优先保留 OpenAPI 契约；Java 内部调用可以以 `client` 模块作为主契约。重要 provider/consumer 关系建议补 Pact 或等价消费者驱动契约测试。

每个公开 API 都要记录到 `openspec/context/interfaces.md`。

## API 兼容性

兼容变更：

- 新增可选 response 字段。
- 新增有默认值的 request 字段。
- 新增枚举值，但 consumer 已明确按未知枚举兜底。
- 新增 endpoint 或新增非强制能力。

破坏性变更：

- 新增必填 request 字段且没有默认值。
- 删除字段或 endpoint。
- 重命名字段。
- 改变字段类型、单位、精度或时间格式。
- 改变枚举含义。
- 改变错误码语义。
- 改变分页、排序、幂等、权限语义。

版本策略：

- 普通兼容新增不升版本。
- 破坏性变更必须走新版本、灰度迁移或消费者确认。
- 不兼容版本需要能并存时，再引入 URI/header 版本。
- 废弃接口要记录 deprecation 计划和 consumer 迁移清单。

## 错误处理

写代码前定义服务级错误码格式。推荐响应结构：

```json
{
  "code": "ORDER_400001",
  "message": "Invalid request",
  "traceId": "..."
}
```

规则：

- 不返回 stack trace、SQL、内部类名。
- 用户提示和内部诊断必要时分开。
- 下游错误显式映射，不直接透传原始错误码。
- 平台支持时，日志和响应都包含 traceId / correlationId。
- 错误码要能区分参数错误、权限错误、业务拒绝、下游失败、系统异常。

## 跨系统调用

每个下游系统都要定义：

- owner 和用途。
- client interface。若只是本服务内部下游调用，放在 `server.infrastructure.client`；若是本服务对外暴露给其他系统，放在 `client`。
- connect timeout 和 read timeout。
- retry 策略。
- circuit breaker / fallback 策略。
- 错误码映射。
- 日志、指标、trace 透传。

规则：

- controller 不直接调用下游系统。
- 不把下游写失败包装成成功。
- 写接口重试必须有幂等。
- 批量调用必须有大小限制和部分失败策略。
- fallback 只能返回明确降级结果，不能伪造真实成功。
- timeout/retry/fallback 的默认值必须可配置，不能硬编码在业务逻辑中。

## 配置

环境相关值不能写死在代码里：

- URL。
- 账号和密钥。
- timeout。
- feature switch。
- MQ topic / queue。
- 分页大小、批处理大小、重试次数。

必需配置记录到 `openspec/context/architecture.md` 或 `verification.md`。

## 测试与验证

新项目最低测试：

- `server` context-load test 或应用冒烟测试。
- health/smoke endpoint controller test。
- 有业务逻辑时，至少一个 application service 单元测试。
- client 契约编译检查。
- 关键跨系统接口的 OpenAPI/Pact/等价契约校验。

验证命令：

```powershell
mvn test
mvn compile
```

如果依赖不可用导致命令不能运行，记录准确原因，并记录能运行的最小命令。

## 新项目质量门禁

进入业务开发前必须满足：

- `common/client/server` 依赖方向正确。
- 公开 DTO 不复用 entity。
- public API 已登记到 `openspec/context/interfaces.md`。
- 下游调用已登记 timeout/retry/fallback/error mapping。
- `mvn test` 或 `mvn compile` 有结果。
- 第一条 walking skeleton change 已完成 proposal/design/tasks/verification/review。
