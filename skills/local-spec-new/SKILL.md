---
name: local-spec-new
description: 从 0 到 1 创建新的 Java 后端项目。适用于用户要新建服务/系统/工程骨架、在没有老代码的情况下先定义 OpenSpec、按 common/client/server 三层模块搭建 Java/Spring 服务、设计跨系统接口契约、生成可运行 walking skeleton 的场景。
---

# 新项目构建

## 职责

把一个新 Java 后端项目从空仓库推进到可运行的 walking skeleton，然后再交给 `local-spec-dev` 做具体业务需求。

当仓库还没有有效业务代码，或者用户明确说“新建项目 / 新建服务 / 从 0 到 1 / 初始化系统”时使用本 skill。不要用 `local-spec-bootstrap` 处理这个路径；`bootstrap` 只适合已有老项目。

## 核心原则

在项目契约写清楚之前，不要直接生成业务功能代码。新项目必须先定义：

- 产品目标和非目标。
- 系统边界、上游系统、下游系统。
- `common`、`client`、`server` 三层模块结构。
- API、DTO、错误码、版本和兼容性契约。
- 持久化、配置、日志、校验、异常处理约定。
- 本地构建、测试、启动、冒烟命令。
- 第一个 walking skeleton 切片。

选择 Java 版本、模块、包名、API 风格、跨系统调用方式时，先读取 `references/java-greenfield-standards.md`。

## 工作流

### 1. 判断项目类型

先判断目标属于哪一类：

- `service`：一个可部署后端服务，默认采用 `common/client/server` 三层模块。
- `library`：共享 Java 库，没有可部署 server。
- `aggregator`：一个父仓库，包含多个服务或库。

用户没有说明时，默认按 `service` 处理。

### 2. 初始化 OpenSpec

创建或更新：

```text
openspec/project.md
openspec/context/product.md
openspec/context/architecture.md
openspec/context/interfaces.md
openspec/context/verification.md
openspec/specs/_index.md
openspec/changes/
```

如果 `~/.codex/openspec-templates/greenfield/` 存在，优先从模板复制；否则手工创建同等结构。

### 3. 写清新项目决策

写代码前，必须把以下决策记录到 `openspec/context/architecture.md`：

- groupId / artifactId 命名。
- Java 版本和 Spring Boot 版本。
- 模块名称。
- 根包名。
- HTTP API 风格和版本策略。
- 跨系统调用方式。
- 错误码格式。
- DTO 归属规则。
- 测试策略。
- 是否采用 OpenAPI / Pact / 其他契约测试方式。

一旦创建了 change，把不可逆或影响协作的决策追加到 `openspec/changes/{change-id}/agent-space/decisions.md`。

### 4. 生成 Walking Skeleton

创建第一个 change，例如 `init-walking-skeleton`。它必须生成一个最小可运行项目：

```text
{artifact}-common/
{artifact}-client/
{artifact}-server/
pom.xml
README.md
openspec/
```

骨架至少包含：

- 父 Maven 配置和 dependency management。
- `server` Spring Boot 启动类。
- health 或等价冒烟接口。
- 全局响应和错误约定。
- `common` 中的一个示例请求/响应 DTO。
- `client` 中的一个示例 API 契约。
- `server` 中实现该契约的 controller。
- 栈支持时，至少一个单元测试或 context-load 测试。
- `openspec/context/verification.md` 中记录本地验证命令。

### 5. 业务开发前门禁

满足以下条件前，不要进入业务功能开发：

- 已运行 `mvn test`，至少也要运行 `mvn compile`；无法运行时记录准确原因。
- `openspec/context/architecture.md` 足够让后续开发理解项目结构。
- `openspec/context/interfaces.md` 已定义跨系统接口契约规则。
- 第一个 change 已包含 `proposal.md`、`design.md`、`tasks.md`、`verification.md`、`review.md`。
- `harness-spec validate {change-id}` 通过，或每个失败项都有明确解释。

### 6. 交接到业务需求开发

walking skeleton 验收后：

- 标记 skeleton change 已 review。
- 更新 `openspec/specs/_index.md` 中的已确认能力。
- 后续业务需求使用 `local-spec-dev`。

## Java 三层模块契约

默认服务结构：

```text
{service}-common
{service}-client
{service}-server
```

职责边界：

- `common`：DTO、枚举、常量、错误码、共享校验分组、跨系统稳定值对象。
- `client`：其他系统调用本服务所依赖的接口契约和客户端适配；不能暴露 server 内部实现。
- `server`：controller、application service、domain service、repository/mapper、job、MQ consumer/producer、配置。

依赖规则：

- `server` 可以依赖 `client` 和 `common`。
- `client` 可以依赖 `common`。
- `common` 禁止依赖 `client` 或 `server`。
- 其他系统只能依赖 `client`，不能依赖 `server`。
- 跨系统共享 DTO 放在 `common`；持久化实体、mapper、内部领域对象留在 `server`。

## 跨系统接口规则

每个公开跨系统接口都要记录：

- provider 系统和 consumer 系统。
- endpoint / RPC / MQ topic 名称。
- request / response DTO。
- 认证、租户、用户上下文传递方式。
- 写接口的幂等键；没有幂等时说明原因。
- 超时、重试、熔断、降级策略。
- 错误码映射。
- 兼容性策略。
- 是否需要消费者驱动契约测试。

DTO 演进默认只做兼容性新增。删除字段、重命名字段、改变枚举含义、改变错误码语义，都必须在 `architecture.md` 或当前 change design 中写明兼容性决策。

## 借鉴的成熟实践

执行时吸收这些公共实践：

- Spring 多模块项目做法：把可复用契约或库做成独立 jar，再由应用模块依赖。
- API First 做法：跨系统接口先有 OpenAPI / Java client contract / MQ contract，再实现 server。
- OpenAPI 工具链做法：外部 HTTP API 优先保持可生成文档、客户端或 server stub 的契约。
- Pact 做法：关键跨系统接口需要 consumer/provider 契约测试，而不是只靠联调。
- REST API 规范做法：明确兼容变更和破坏性变更，新增字段优先，删除/重命名/语义变化要走版本或迁移。
- OpenFeign 做法：每个下游 client 必须显式定义 timeout、retry、fallback/circuit breaker 的策略。

## 多智能体协作

新项目可以用多智能体协作，但必须先有架构边界：

- `architect` 架构智能体：负责架构、模块、依赖和不可逆决策。
- `api-designer` 接口智能体：负责 public API、`common` DTO、`client` 契约。
- `scaffold-worker` 骨架实现智能体：负责 Maven 模块和最小可运行代码。
- `verification-agent` 验证智能体：负责编译、测试、契约校验和证据记录。
- `reviewer` 评审智能体：检查模块边界、依赖方向、接口兼容性。

在模块归属和写入边界没有定义前，不要并行启动多个写代码 Agent。

## 完成输出

完成后报告：

- 项目类型和模块结构。
- 创建的 OpenSpec 文件。
- 创建的代码文件。
- 验证命令和结果。
- 未解决的架构决策。
- 下一步建议进入的业务 change。
