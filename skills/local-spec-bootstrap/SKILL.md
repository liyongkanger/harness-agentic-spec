---
name: local-spec-bootstrap
description: 扫描当前老项目/棕地代码库，并把项目背景、模块职责、技术栈、代码地图、能力候选和本地验证命令沉淀到仓库 openspec/ 下。适用于用户要求“初始化/补全 OpenSpec 项目背景”、“沉淀老项目上下文”、“梳理当前项目代码地图”、“把现有项目背景写入 openspec”时；默认只读扫描代码并更新 openspec 文档，不实现业务需求。
---

# Local Spec Bootstrap

## 目标

把老项目的稳定背景沉淀到 `openspec/`，为后续 `local-spec-dev` 按需求开发提供长期上下文。

本 skill 只做项目背景沉淀：

- 扫描仓库结构和技术栈。
- 梳理模块职责和代码入口。
- 识别能力域候选。
- 记录本地编译/测试/验证命令。
- 更新 `openspec/project.md` 和必要的背景文档。

默认不改业务代码、不创建需求 change、不跑外部系统。

## 输出位置

优先写入：

- `openspec/project.md`：项目级背景、模块职责、技术栈、验证命令、工作约定。
- `openspec/specs/_index.md`：长期规格索引和能力域候选。

按需创建本地扩展目录：

- `openspec/context/code-map.md`：代码地图，记录入口、Service、Mapper、Job、MQ、配置等证据。
- `openspec/context/verification.md`：本地可用验证命令和适用范围。

只有当某个能力行为有足够代码证据时，才创建：

- `openspec/specs/{capability}/spec.md`

不要把猜测写成长久规格。低置信度内容写入 `openspec/context/code-map.md` 的“待确认”部分。

## 启动检查

1. 确认当前目录是目标仓库。
2. 检查 `openspec/` 是否存在。
3. 若不存在：
   - 可以创建最小骨架；但如果用户只要求分析，不要强行写入。
4. 检查工作区状态。
   - 允许已有未提交改动。
   - 不回滚、不清理、不修改无关文件。
5. 读取 `pom.xml`、模块目录、已有 `openspec/project.md`。

## 扫描策略

优先使用 `rg` / `rg --files`。

### 结构扫描

收集：

- 顶层模块。
- 每个模块的 `pom.xml`。
- 主要 package。
- `src/main/java`、`src/main/resources`、`src/test` 是否存在。
- 配置文件：`*.yml`、`*.yaml`、`*.properties`、Apollo/配置类。

### 技术栈扫描

从 Maven 依赖、注解和配置中识别：

- Web 框架：Controller、REST、MVC。
- 数据访问：Mapper、MyBatis/XML、JPA 等。
- MQ：Rabbit/Kafka/自定义消费注解。
- 定时任务：Spring Scheduled、XXL-JOB 或其他调度。
- 缓存：Redis、本地缓存。
- 测试框架：JUnit、Mockito、SpringBootTest 等。

只记录有证据的技术栈，并给出来源文件。

### 代码地图扫描

按模块记录：

- Controller/API 入口。
- Service 核心类。
- Mapper/DAO/XML。
- DTO/VO/Request/Response。
- Enum/constant。
- Job/scheduler。
- MQ producer/consumer。
- 配置类。

不要追求一次扫全项目。优先建立能帮助后续需求定位的地图。

### 能力域识别

从以下信号识别能力域候选：

- Controller 路径和类名。
- Service/Mapper 包名和类名。
- 数据表名。
- `docs/`、`doc/` 下已有设计文档。
- 领域枚举、状态机、配置 key。

输出时区分：

- 已确认能力：有多个代码证据支持。
- 候选能力：只有命名线索，尚需人工确认。

## 写入规则

### 更新 `openspec/project.md`

只更新项目级稳定信息：

- 项目用途概述。
- 模块职责。
- 技术栈。
- 本地验证命令。
- OpenSpec 使用约定。

保留已有人工内容，不覆盖用户已写的判断。新增内容可以放到明确章节中，如：

```markdown
## 项目背景
## 技术栈
## 本地验证命令
## 模块职责
```

### 写入 `openspec/context/code-map.md`

按证据记录代码地图：

```markdown
# 代码地图

## 模块

### module-a

- Controller：...
- Service：...
- Mapper：...

## 能力域候选

| 能力 | 置信度 | 证据 | 待确认 |
```

每条关键判断必须带来源路径。

### 写入 `openspec/specs/_index.md`

记录长期规格索引：

```markdown
# 规格索引

## 已确认规格

| 能力 | 文件 | 来源 |

## 候选能力

| 能力 | 证据 | 是否需要补 spec |
```

### 创建能力规格

只有高置信度时才创建 `openspec/specs/{capability}/spec.md`。

能力规格必须写“系统行为”，不要写“代码结构”：

```markdown
# {能力名称}

## 目的

## 需求

### 需求：{行为}

系统应该……

#### 场景：{场景}

- 假如……
- 当……
- 那么……
```

如果只能识别代码结构但无法确认行为，先不要创建能力规格。

## 分批工作

老项目不要一次性试图沉淀全部背景。建议分批：

1. 第一批：项目结构、模块职责、技术栈、验证命令、粗代码地图。
2. 第二批：按能力域补 `specs/_index.md`。
3. 第三批：挑一个高价值能力，生成正式 `specs/{capability}/spec.md`。

每批结束都输出：

- 更新了哪些 openspec 文件。
- 依据了哪些代码证据。
- 哪些内容仍是待确认。
- 下一批建议扫描范围。

## 禁止事项

- 不要修改业务代码。
- 不要把推测写成已确认规格。
- 不要为了扫描而运行有副作用的命令。
- 不要清理、回滚或格式化用户已有改动。
- 不要把一次需求的临时设计写入 `openspec/specs/`。

## 完成输出

完成时简要说明：

- 已更新文件。
- 已识别模块/技术栈/能力候选数量。
- 高置信度结论和待确认项。
- 建议下一步：继续补某个能力 spec，或切换到 `local-spec-dev` 开始需求开发。
