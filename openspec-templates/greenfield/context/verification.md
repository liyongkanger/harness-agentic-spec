# 验证

## 必跑命令

```powershell
mvn test
```

## 冒烟检查

- server 能启动。
- health 接口返回成功。
- client 模块能编译。
- common/client/server 依赖方向正确。
- 公开接口契约已经登记到 `openspec/context/interfaces.md`。

## 本地环境要求

- JDK：`{version}`
- Maven：`{version}`
- 外部服务：`{none/list}`

## 当前限制

- `{limitation}`
