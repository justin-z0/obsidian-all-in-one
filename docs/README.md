# 文档索引

本目录是插件设计与开发文档。建议先读架构，再看生命周期和设置页，最后按需查阅开发、测试和 ADR。

> **状态**：实现基线 v0.1（2026-10-26）；“Markdown 演示”于 2026-10-29 加入。当前已实现“附件管理”“笔记漫游”和“Markdown 演示”，文档中的架构仍是后续特性的约定。

## 推荐阅读顺序

### 第一次了解这个项目

1. [架构设计](architecture.md) — 全局分层、模块边界、核心契约、设计意图总表。
2. [生命周期](lifecycle.md) — 特性如何启用、关闭、失败回滚，以及资源为什么必须走 `FeatureContext`。
3. [设置页](settings.md) — 每个特性的配置章节如何生成，开关和设置如何映射到数据。
4. [数据与迁移](data-and-migrations.md) — 配置如何保存、校验、升级。
5. [ADR 索引](adr/README.md) — 关键决策为什么这样定，代价是什么。

### 了解现有特性

1. [特性文档](features/README.md) — 已实现特性的功能、设置、路径算法和手动验收。
2. [附件管理](features/attachments.md) — 粘贴图片、重命名弹窗、上传命令和链接生成。
3. [笔记漫游](features/note-roaming.md) — 路径限定、随机选择、侧边栏按钮和专用标签页阅读模式预览。
4. [Markdown 演示](features/slides.md) — H1/H2/H3 自动分页、H3 独立成页、长内容页内滚动、铺满屏幕、全屏演示和边界。

### 准备新增一个特性

1. [新增特性](feature-development.md) — 标准步骤和完整模板。
2. [生命周期](lifecycle.md) — 确认资源注册方式。
3. [设置页](settings.md) — 选择控件和 `live` / `reload` 策略。
4. [测试策略](testing.md) — 生命周期契约测试和手动验收。
5. [开发指南](development.md) — 构建、调试和发布。

### 排查问题

- 关闭特性后仍有行为：看 [生命周期](lifecycle.md) 的“常见错误与症状”一节。
- 设置不生效或页面不刷新：看 [设置页](settings.md) 的“update 与 refreshDomState 的边界”一节。
- 升级后配置异常：看 [数据与迁移](data-and-migrations.md)。
- 构建、同步、发布问题：看 [开发指南](development.md)。

## 文档地图

| 文档 | 回答什么问题 | 主要读者 |
|---|---|---|
| [architecture.md](architecture.md) | 整体怎么分层？模块之间允许怎么依赖？核心契约是什么？ | 所有人 |
| [features/](features/README.md) | 当前实现了哪些特性？各自的行为和验收是什么？ | 使用者、特性开发者 |
| [lifecycle.md](lifecycle.md) | 开关到底做了什么？资源怎么清理？为什么不能绕过 `ctx`？ | 特性开发者、维护者 |
| [settings.md](settings.md) | 设置页如何按特性分章节？控件键如何映射？何时刷新？ | 特性开发者、UI 维护者 |
| [data-and-migrations.md](data-and-migrations.md) | 数据长什么样？默认值、校验、迁移、保存怎么做？ | 维护者 |
| [development.md](development.md) | 本地怎么跑？怎么同步到 Vault？怎么发布？ | 开发者 |
| [feature-development.md](feature-development.md) | 新增特性一步一步怎么做？有哪些禁止项？ | 特性开发者 |
| [testing.md](testing.md) | 测什么、怎么测、手动验收清单是什么？ | 开发者、评审者 |
| [adr/](adr/README.md) | 关键决策的背景、备选方案、后果和重新评估条件。 | 维护者、评审者 |

## 术语

| 术语 | 含义 |
|---|---|
| 特性（Feature） | 一个可独立启用/关闭的功能模块，对应一个目录和一个 `FeatureDefinition`。 |
| 特性定义（FeatureDefinition） | 特性的元数据、默认设置、设置 schema、生命周期钩子的唯一来源。 |
| 特性上下文（FeatureContext） | 特性启用期间可用的受控能力集合；资源注册和清理都经过它。 |
| 设置存储（SettingsStore） | 负责默认值合并、校验、迁移、读写 `data.json` 的核心服务。 |
| 特性管理器（FeatureManager） | 负责启用/关闭、状态机、并发串行化、错误隔离。 |
| 设置页（SettingsTab） | 把特性定义映射为 Obsidian 原生声明式设置的 UI 层。 |
| 受管注册（Managed registration） | 通过 `ctx` 注册、由 `Component` 或显式清理逻辑回收的资源。 |
| 永久注册（Permanent registration） | Obsidian 不提供单独注销 API 的注册（如视图、后处理器）；只注册一次并用启用状态守卫。 |
| 设置章节（Settings group） | 设置页中一个特性对应的原生 `SettingDefinitionGroup`。 |
| 启用 / 关闭 | 运行时的开与关；关闭不删除已保存的配置。 |

## 文档维护规则

1. **行为变更必须同步文档**：改了生命周期、键格式、保存策略或 UI 行为，必须更新对应文档。
2. **不可逆决策写 ADR**：最低 Obsidian 版本、设置页实现方式、数据格式、资源注册模型等。
3. **图表用 Mermaid**：图源和文档一起版本管理，便于 diff 和评审；不提交无法追溯的截图。
4. **区分计划与现状**：明确标注“设计阶段”和“已实现”，避免把约定当成事实。
5. **保持术语一致**：统一使用“特性”“启用/关闭”“受管注册”等词，不混用“功能/插件模块/组件”。

## 文档检查

```bash
node scripts/check-docs.mjs
```

脚本会检查：

- `README.md` 与 `docs/**/*.md` 中的相对链接是否存在；
- Mermaid 代码块是否为空、是否正确闭合；
- ADR 索引是否覆盖所有 ADR 文件；
- 是否存在未被任何文档引用的孤立文档（以警告形式提示）。

Mermaid 的最终视觉渲染以 Obsidian 预览为准；本轮已用 `mermaid-cli` 对所有图做过渲染校验。脚本本身只做结构检查，不依赖 `mermaid-cli`。
