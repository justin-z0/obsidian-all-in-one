# ADR 0001：用显式注册表组织特性

- 状态：已接受
- 日期：2026-10-19
- 决策者：项目维护者
- 相关文档：[架构设计](../architecture.md)、[新增特性](../feature-development.md)

## 背景

插件会包含多个特性。每个特性都需要：

- 在设置页拥有独立章节和启用开关；
- 在启用时注册资源，关闭时清理；
- 有独立的默认配置和迁移路径；
- 能被单独测试，不依赖其他特性。

如果没有统一契约，每个特性会各自实现设置页、开关、清理和持久化，导致重复代码和行为不一致。

## 决策

每个特性对应一个目录和一个 `FeatureDefinition`：

```ts
export interface FeatureDefinition<T extends FeatureOptions> {
  id: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  defaultOptions: T;
  settings?: readonly FeatureSetting<T>[];
  setup(ctx: FeatureContext<T>): void | Promise<void>;
  teardown?(ctx: FeatureContext<T>): void | Promise<void>;
  onOptionsChange?(ctx: FeatureContext<T>, changed: readonly (keyof T & string)[]): void;
}
```

所有特性通过一个显式数组注册：

```ts
export const FEATURES = [
  exampleFeature,
  futureFeature,
] as const;
```

启动时校验注册表：

- ID 唯一且格式合法；
- `defaultOptions` 覆盖所有设置键；
- 禁止使用保留键 `$enabled`；
- 禁止使用 `global` 作为特性 ID。

设置页、`FeatureManager` 和测试都从同一份定义派生。

## 结果

### 正面

- 单一事实来源：设置、生命周期、默认值集中在一个文件。
- 类型安全：设置控件的 key 受选项类型约束。
- 可测试：给定定义即可构造 Manager 和 FakeHost。
- 新增特性只需新增目录 + 注册表一行。
- 启动时可校验，开发期错误尽早暴露。

### 负面 / 代价

- 必须手动维护注册表，不能“放进去就自动生效”。
- 所有特性静态打包，无法运行时安装。
- 定义文件可能变长；复杂特性需要拆分实现文件，但定义仍是入口。

## 备选方案

### 目录扫描 + 动态 import

看起来更自动，但需要运行时路径解析、打包器配合和额外校验；Obsidian 插件是单文件 CJS，动态加载的收益很低，反而增加复杂度。

### 类继承

用抽象基类强制生命周期：

```ts
class BaseFeature { ... }
```

问题是 TypeScript 单继承、设置类型难以泛型化，且容易把状态塞进类实例。函数式定义 + 显式 context 更灵活。

### 事件总线 / 服务容器

适合大型应用，但对一个插件来说引入了间接依赖和调试成本。特性之间应该独立，不需要事件总线来解耦。

## 重新评估条件

- 需要第三方或运行时加载特性；
- 特性数量增长到注册表难以维护；
- 出现真实的跨特性协作需求，单一定义无法表达。
