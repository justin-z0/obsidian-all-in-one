# ADR 0003：作用域 FeatureContext 与受管注册

- 状态：已接受
- 日期：2026-10-19
- 决策者：项目维护者
- 相关文档：[生命周期](../lifecycle.md)、[架构设计](../architecture.md)

## 背景

特性需要支持运行时启用和关闭。Obsidian 的资源注册 API 生命周期差异很大：

- 事件、定时器、DOM 监听可以注销；
- 命令从 1.7.2 起可以 `removeCommand`；
- Ribbon、状态栏返回 DOM 元素，可以移除；
- 编辑器扩展注册后不能单独删除，需要修改可变数组并 `updateOptions()`；
- 视图、Markdown 后处理器、协议处理器注册后不能单独注销；
- 异步任务可能在关闭后继续执行。

如果每个特性都直接调用 `plugin.*` 并自行清理，会出现：

- 关闭后事件仍在跑；
- 每次启用重复注册命令/监听器；
- `setup` 抛错后部分资源无法回滚；
- 不同特性对同一 API 的清理方式不一致；
- 核心无法测试或审计资源生命周期。

## 决策

引入 `FeatureContext`：

- 继承 Obsidian `Component`，资源注册通过 `ctx.register` / `registerEvent` / `registerInterval` / `registerDomEvent` 挂到作用域；
- 不暴露 `plugin`、`PluginHost`、`FeatureManager`；
- 只暴露受控能力：`addCommand`、`addRibbonIcon`、`addStatusBarItem`、`addEditorExtension`、`setTimeout`、`signal`、`setOption`、`reload`；
- 命令 ID 自动加特性前缀；
- 编辑器扩展进入插件级共享数组，关闭时移除并 `updateOptions()`；
- 关闭时 `ctx.unload()` 统一回收；
- 异步任务使用 `ctx.signal` 取消。

配套五层防绕过：

1. **结构隔离**：特性拿不到 `plugin`；`main.ts` 不导出单例。
2. **能力收口**：所有允许的注册都有 `ctx` 包装；新 API 先扩展核心。
3. **ESLint**：特性目录禁止直接调用 `addCommand`、`registerView`、`app.vault.on`、`setInterval` 等。
4. **运行时**：`assertActive`、`AbortSignal`、开发期资源快照。
5. **测试/CI**：生命周期契约测试、导入纯净性测试、lint 门槛。

规则不是“只能在 `setup()` 中注册”，而是：

> **特性启用期间，所有带生命周期的资源只能通过 `ctx` 注册；关闭后、模块顶层、插件 `onload` 中不得绕过 `ctx` 直接注册。**

## 结果

### 正面

- 关闭特性时资源回收是默认行为，不依赖作者自觉。
- `setup` 失败可以回滚已注册资源。
- 不同 Obsidian API 的清理差异集中在核心。
- 特性权限最小化，不能误用 `addSettingTab`、`saveData`。
- 生命周期可用 FakeHost 测试。
- lint 和测试让绕过行为可见。

### 负面 / 代价

- 特性不能直接使用 `Plugin` 的全部 API；新能力需要先加包装。
- 包装层和 lint 规则需要维护。
- 永久注册（视图/后处理器）只能“注册一次 + 守卫”，不能完全按开关动态注销。
- 同 bundle 无法真正沙箱，`any` 和动态访问仍可能绕过静态检查。

## 备选方案

### 直接调用 `plugin.*` + 手工清理

实现最快，但把生命周期正确性交给每个特性作者；随特性数量增加，泄漏和重复注册几乎不可避免。

### 每个特性独立插件实例

Obsidian 不支持在单个插件内创建多个 `Plugin` 实例来获得独立生命周期；不可行。

### Worker / iframe 沙箱

能提供真正隔离，但 Obsidian API 无法跨沙箱直接使用，通信和 UI 集成成本极高，不适合当前规模。

### 服务容器 / 依赖注入框架

可以管理生命周期，但引入额外抽象和学习成本；`Component` + 显式 context 已经足够。

## 重新评估条件

- 需要支持第三方特性代码或运行时安装；
- Obsidian 提供更完整的注册/注销 API；
- 包装层膨胀到影响开发效率；
- 出现无法用现有 `ctx` 表达的核心能力。
