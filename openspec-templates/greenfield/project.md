# 项目概览

## 项目目标

{说明这个系统为什么存在，负责哪一块业务能力。}

## 项目类型

- 类型：`{service|library|aggregator}`
- 服务名：`{service-name}`
- 根包名：`{package-root}`
- Java 版本：`{java-version}`
- 构建工具：`{maven|gradle}`

## 模块结构

```text
{service-name}-common
{service-name}-client
{service-name}-server
```

## 归属

- 产品负责人：`{owner}`
- 技术负责人：`{owner}`
- 上游系统：`{systems}`
- 下游系统：`{systems}`

## 本地验证

```powershell
mvn test
```

## 工作约定

- 跨系统契约放在 `common` 和 `client`。
- 运行时实现放在 `server`。
- 大规模生成代码前先记录架构决策。
- walking skeleton 之后，每个业务功能都通过 OpenSpec change 推进。
