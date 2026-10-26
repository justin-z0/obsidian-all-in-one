# ADR 0002：使用 Obsidian 原生声明式设置

- 状态：已接受
- 日期：2026-10-19
- 决策者：项目维护者
- 相关文档：[设置页](../settings.md)、[架构设计](../architecture.md)

## 背景

设置页需要：

- 每个特性一个独立章节；
- 章节顶部有启用开关；
- 关闭特性时隐藏其他设置；
- 支持搜索、键盘操作、移动端和无障碍；
- 新增特性不修改设置页代码。

Obsidian 1.13 之前，插件通常继承 `PluginSettingTab` 并手写 `display()`，为每个设置创建 `Setting` 组件。特性数量增加后，会出现大量重复代码和显隐逻辑。

Obsidian 1.13 引入了声明式设置 API：

```ts
getSettingDefinitions(): SettingDefinitionItem[];
getControlValue(key: string): unknown;
setControlValue(key: string, value: unknown): void | Promise<void>;
update(): void;
refreshDomState(): void;
```

## 决策

使用原生声明式设置：

- 一个插件设置标签页；
- 每个特性映射为一个 `SettingDefinitionGroup`；
- 第一行是 `${featureId}.$enabled` 开关；
- 其他设置通过 `visible` 受启用状态控制；
- 设置页只负责键映射和刷新，不包含具体特性的 UI 逻辑；
- 自定义 UI 使用 `SettingDefinitionRender` 的 `render` 逃生口。

最低 Obsidian 版本设为 `1.13.1`，`obsidian` devDependency 也固定为 `1.13.1`，避免误用更高版本 API。

## 结果

### 正面

- 原生搜索、无障碍、移动端布局。
- 设置页代码大幅减少，新增特性无需改 UI。
- 定义是纯数据，可在 Node 环境测试。
- 开关、显隐、重置都可以通过统一映射实现。
- `update()` 与 `refreshDomState()` 提供结构刷新和轻量刷新的边界。

### 负面 / 代价

- 最低版本提高到 1.13.1，放弃旧版 Obsidian。
- 声明式 API 较新，行为细节需要在真实环境中验证。
- 复杂交互仍需 `render`，此时要自己处理清理。
- 开关后需要 `update()` 重建搜索索引，可能带来轻微重绘。

## 备选方案

### 手写 `display()`

兼容性最好，但每个特性都要写 UI 代码，显隐、搜索、无障碍和移动端都要自己处理；长期维护成本最高。

### 一个特性一个标签页

Obsidian 原生支持多个 `PluginSettingTab`，但：

- 开关分散在多个标签页；
- 需要动态注册/注销标签页；
- 不符合“一个配置页里每个特性一个章节”的要求。

### React / Svelte 自定义设置页

可以获得复杂交互能力，但增加包体、生命周期、样式隔离和构建复杂度；原生声明式设置已经覆盖大部分需求。

## 重新评估条件

- 必须支持 Obsidian 1.13 以下版本；
- 原生 API 无法满足关键交互；
- 设置页需要跨特性的复杂联动或可视化编辑器。
