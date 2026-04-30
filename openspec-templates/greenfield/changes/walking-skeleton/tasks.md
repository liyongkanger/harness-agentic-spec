# 任务

## 实现任务

- [ ] T1. 创建父工程和模块 POM。
  - 状态：`pending`
  - 负责路径：`pom.xml`, `{service}-common/pom.xml`, `{service}-client/pom.xml`, `{service}-server/pom.xml`
  - 验证：`mvn -q -DskipTests compile`

- [ ] T2. 创建 common/client/server 骨架代码。
  - 状态：`pending`
  - 负责路径：`{service}-common/src/**`, `{service}-client/src/**`, `{service}-server/src/**`
  - 验证：`mvn test`

- [ ] T3. 记录验证方式和接口契约。
  - 状态：`pending`
  - 负责路径：`openspec/context/verification.md`, `openspec/context/interfaces.md`
  - 验证：对照生成代码 review 文档。

- [ ] T4. 校验跨系统接口治理项。
  - 状态：`pending`
  - 负责路径：`openspec/context/interfaces.md`, `{service}-client/src/**`, `{service}-server/src/**`
  - 验证：确认 timeout、retry、fallback、幂等、错误映射、兼容策略都有记录。

## 最终门禁

- 所有任务状态为 `done`。
- 构建命令结果已记录。
- review 确认模块边界。
- review 确认公开接口契约没有绕过 common/client。
