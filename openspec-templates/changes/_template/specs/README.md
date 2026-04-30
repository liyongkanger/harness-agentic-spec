# 规格变更

只有当本次需求会改变长期系统行为时，才需要使用这个目录。

推荐结构：

```text
specs/
  {capability}/
    spec.md
```

这里只写本次变更提出的规格增量。完成实现和审查后，再把被接受的行为合并到 `openspec/specs/{capability}/spec.md`。

