# 新增特性

> **本文回答**：新增一个特性需要改哪些文件？模板长什么样？哪些事情不能做？如何判断设置应该实时生效还是重建特性？
>
> 当前实际参考实现：[附件管理](features/attachments.md)（`src/features/attachments/`）、[笔记漫游](features/note-roaming.md)（`src/features/note-roaming/`）和 [Markdown 演示](features/slides.md)（`src/features/slides/`）。

## 1. 开始之前

先确认你已经读过：

- [架构设计](architecture.md) — 模块边界和核心契约。
- [生命周期](lifecycle.md) — 资源必须通过 `ctx` 注册。
- [设置页](settings.md) — 控件键和 `live` / `reload` 的规则。

一个特性必须满足：

- 有稳定的 `id`，使用 kebab-case，发布后不可变。
- 提供所有选项的默认值。
- 所有设置控件的 `key` 都存在于默认值中。
- 只通过 `FeatureContext` 注册资源。
- 不导入其他特性，不导入 `main.ts`、`FeatureManager`、`PluginHost`。

## 2. 标准步骤

### 第一步：创建目录

```text
src/features/<id>/
├── index.ts        # FeatureDefinition + setup
├── styles.css      # 可选，特性样式
└── ...             # 特性的其他实现文件
```

### 第二步：定义选项和设置

```ts
type ExampleOptions = {
  greeting: string;
  showRibbon: boolean;
  output: 'notice' | 'status';
};
```

- 选项尽量使用扁平基础类型。
- 设置控件的 `key` 必须属于该类型。
- 每个选项都要有默认值。

### 第三步：实现 FeatureDefinition

完整模板见下一节。

### 第四步：加入注册表

```ts
// src/features/index.ts
import { exampleFeature } from './example';

export const FEATURES = [
  exampleFeature,
  // 新特性追加在这里
] as const;
```

### 第五步：补文案和样式

- 文案加到 `src/i18n/en.ts` 和 `src/i18n/zh.ts`，保持键集合一致。
- 样式放在特性目录，并从 `src/styles/index.css` `@import`。
- CSS 类名使用 `aio-<feature>-*` 前缀。

### 第六步：写测试

至少覆盖：

- 默认值包含所有设置键。
- 启用后资源注册成功。
- 关闭后资源回到基线。
- 快速开关不重复注册。
- 设置变化触发正确的 hook 或 reload。

### 第七步：手动验收

在测试 Vault 中：

1. 启用特性，确认命令/图标/状态栏/行为出现。
2. 修改每个设置，确认生效方式符合预期。
3. 关闭特性，确认所有行为消失，命令面板无残留。
4. 重启 Obsidian，确认开关和设置保留。
5. 删除 `data.json`，确认默认值可用。

## 3. 完整模板

```ts
// src/features/example/index.ts
import { Notice } from 'obsidian';
import type { FeatureDefinition } from '../../core/feature';
import { t } from '../../i18n';

type ExampleOptions = {
  greeting: string;
  showRibbon: boolean;
  output: 'notice' | 'status';
};

export const exampleFeature: FeatureDefinition<ExampleOptions> = {
  id: 'example',
  name: t('features.example.name'),
  description: t('features.example.description'),

  defaultEnabled: false,

  defaultOptions: {
    greeting: 'Hello',
    showRibbon: true,
    output: 'notice',
  },

  settings: [
    {
      name: t('features.example.greeting'),
      desc: t('features.example.greetingDesc'),
      control: {
        type: 'text',
        key: 'greeting',
        placeholder: 'Hello',
      },
    },
    {
      name: t('features.example.showRibbon'),
      control: {
        type: 'toggle',
        key: 'showRibbon',
      },
      apply: 'reload',
    },
    {
      name: t('features.example.output'),
      control: {
        type: 'dropdown',
        key: 'output',
        options: {
          notice: t('common.notice'),
          status: t('common.statusBar'),
        },
      },
      apply: 'reload',
    },
  ],

  setup(ctx) {
    let statusEl: HTMLElement | null = null;

    if (ctx.options.output === 'status') {
      statusEl = ctx.addStatusBarItem();
      statusEl.setText(ctx.options.greeting);
    }

    const showGreeting = () => {
      if (statusEl) {
        statusEl.setText(ctx.options.greeting);
        return;
      }
      new Notice(ctx.options.greeting);
    };

    ctx.addCommand({
      id: 'greet',
      name: t('features.example.command'),
      callback: showGreeting,
    });

    if (ctx.options.showRibbon) {
      ctx.addRibbonIcon(
        'sparkles',
        t('features.example.ribbon'),
        showGreeting,
      );
    }

    ctx.registerEvent(
      ctx.app.workspace.on('file-open', () => {
        ctx.logger.debug('file opened');
      }),
    );
  },
};
```

## 4. 模板拆解

### 4.1 id 和名称

```ts
id: 'example',
name: t('features.example.name'),
description: t('features.example.description'),
```

- `id` 是持久化键和命令前缀，发布后不要改。
- `name` / `description` 在模块加载时本地化；语言切换后重载插件。

### 4.2 默认状态

```ts
defaultEnabled: false,
defaultOptions: { ... },
```

- 新特性默认关闭，升级不改变用户行为。
- 默认值必须覆盖所有设置键。
- 默认值用于类型检查和首次加载合并。

### 4.3 设置

```ts
control: { type: 'text', key: 'greeting' }
```

- `key` 是特性内相对键，设置页会自动加上 `<featureId>.` 前缀。
- 需要自定义 UI 时使用 `render`，见后文。
- 需要在校验失败时提示用户时，使用原生 `validate`。

### 4.4 setup

```ts
setup(ctx) {
  ctx.addCommand(...);
  ctx.registerEvent(...);
}
```

- 只能通过 `ctx` 注册资源。
- `ctx.options` 是实时读取，不是快照；命令回调中读取会得到最新值。
- 不要在这里直接调用 `plugin.addCommand`、`app.vault.on`、`setInterval`。

## 5. live 还是 reload？

| 设置影响 | 建议 | 原因 |
|---|---|---|
| 回调内部读取的值（文本、开关判断） | `live` | 下次回调自然读到新值，无需重建 |
| 是否注册某个命令/图标/事件 | `reload` | 注册结构变化，需要清理后重建 |
| 编辑器扩展的行为参数 | `live` 或 `reload` | 如果扩展读取 `ctx.options` 可 live；否则 reload |
| 状态栏/Ribbon 是否存在 | `reload` | DOM 元素需要创建/移除 |
| 复杂服务初始化参数 | `reload` | 服务需要重新构造 |
| 只影响下一次操作的选项 | `live` | 无需立即重建 |

使用 `reload`：

```ts
{
  name: t('features.example.showRibbon'),
  control: { type: 'toggle', key: 'showRibbon' },
  apply: 'reload',
}
```

使用 `live` 并在回调中读取：

```ts
setup(ctx) {
  ctx.addCommand({
    id: 'greet',
    name: t('features.example.command'),
    callback: () => new Notice(ctx.options.greeting),
  });
}
```

> **意图**：默认用 `live`，只有注册结构真的变化时才重建特性，减少不必要的清理和重初始化。
>
> **代价**：特性作者要判断设置是否影响注册结构。
>
> **重新评估条件**：出现大量 reload 设置导致体验卡顿时，考虑更细粒度的动态注册。

## 6. Do / Don't

| 不要 | 应该 |
|---|---|
| `plugin.addCommand(...)` | `ctx.addCommand(...)` |
| `app.vault.on(...)` 后不清理 | `ctx.registerEvent(ctx.app.vault.on(...))` |
| `setInterval(...)` | `ctx.registerInterval(window.setInterval(...))` |
| `setTimeout(...)` | `ctx.setTimeout(...)` |
| 全局/长期存在的 DOM 监听直接 `addEventListener` | `ctx.registerDomEvent(...)`；局部设置行监听要在 cleanup 中移除 |
| `plugin.registerEditorExtension(...)` | `ctx.addEditorExtension(...)` |
| `plugin.registerView(...)` | 等待核心提供受管包装，或使用“注册一次 + 守卫”模式 |
| 模块顶层执行注册 | 只定义常量；注册放进 `setup` 或启用期间的回调 |
| 从特性 A 导入特性 B | 共享逻辑放 `src/lib/` |
| 直接读写 `data.json` | 通过 `ctx.setOption()` 或设置页 |

## 7. 常见场景

### 7.1 注册命令

```ts
ctx.addCommand({
  id: 'greet',
  name: t('features.example.command'),
  callback: () => new Notice(ctx.options.greeting),
});
```

实际命令 ID 为 `example-greet`，插件前缀由 Obsidian 自动添加。

### 7.2 Ribbon 和状态栏

```ts
if (ctx.options.showRibbon) {
  ctx.addRibbonIcon('sparkles', t('features.example.ribbon'), () => {
    new Notice(ctx.options.greeting);
  });
}

const status = ctx.addStatusBarItem();
status.setText(ctx.options.greeting);
```

关闭时元素会被自动移除。

### 7.3 Vault / Workspace 事件

```ts
ctx.registerEvent(
  ctx.app.vault.on('modify', (file) => {
    ctx.logger.debug('modified', file.path);
  }),
);
```

如果日志可能包含敏感路径，只记录事件类型，不记录路径。

### 7.4 编辑器扩展

```ts
import { ViewPlugin } from '@codemirror/view';

setup(ctx) {
  const plugin = ViewPlugin.fromClass(class {
    // ...
  });

  ctx.addEditorExtension(plugin);
}
```

核心会把扩展放进共享数组，关闭时移除并调用 `workspace.updateOptions()`。

### 7.5 自定义设置行

```ts
{
  name: t('features.example.greeting'),
  render(setting, group, ctx) {
    const input = setting.controlEl.createEl('input', {
      type: 'text',
      value: ctx.options.greeting,
    });

    const onChange = () => {
      void ctx.setOption('greeting', input.value);
    };

    input.addEventListener('input', onChange);
    return () => input.removeEventListener('input', onChange);
  },
}
```

- 返回清理函数。
- 使用 `ctx.setOption`，不要直接改 Store。
- 特性关闭后该行不会渲染；不要在这里注册永久资源。
- 局部元素监听可以在 `render` 里 `addEventListener`，但必须像示例一样在 cleanup 中移除；`window` / `document` 监听走 `ctx.registerDomEvent`。

### 7.6 异步任务

```ts
setup(ctx) {
  void (async () => {
    try {
      const result = await doSomething({ signal: ctx.signal });
      if (!ctx.isEnabled()) return;
      // 使用 result
    } catch (error) {
      if (ctx.signal.aborted) return;
      ctx.logger.error('task failed', error);
    }
  })();
}
```

- 关闭时 `ctx.signal` abort。
- 每次异步续写前检查 `isEnabled()`。
- 延时任务用 `ctx.setTimeout`。

## 8. 命名规范

| 对象 | 规范 | 示例 |
|---|---|---|
| 特性 ID | kebab-case，稳定 | `auto-tag` |
| 命令 ID | 相对 ID，ctx 自动加前缀 | `greet` → `auto-tag-greet` |
| 设置键 | camelCase | `showRibbon` |
| CSS 类名 | `aio-<feature>-*` | `aio-auto-tag-badge` |
| i18n 键 | `features.<id>.*` | `features.auto-tag.name` |
| 测试文件 | 与模块同名 | `feature-manager.test.ts` |

## 9. 测试清单

- [ ] `defaultOptions` 覆盖所有 `settings` 键。
- [ ] 特性 ID 唯一且格式合法。
- [ ] 启用后命令/事件/扩展按预期存在。
- [ ] 关闭后资源回到基线。
- [ ] 重复开关不会重复注册。
- [ ] `setup` 抛错时已注册资源被清理。
- [ ] `apply: 'reload'` 的设置修改后触发重载。
- [ ] `onOptionsChange` 的异常被隔离。
- [ ] 关闭后异步任务不会继续写入。

详细测试写法见 [测试策略](testing.md)。

## 10. PR 检查清单

- [ ] 新增特性已加入 `FEATURES`。
- [ ] 只通过 `ctx` 注册资源，没有直接 `plugin.*` / `app.*.on`。
- [ ] 没有导入其他特性、`main.ts`、`FeatureManager`、`PluginHost`。
- [ ] 默认关闭；默认值完整。
- [ ] i18n 键中英文齐全。
- [ ] CSS 有 `aio-` 前缀，没有硬编码主题色。
- [ ] 单元测试通过。
- [ ] 在测试 Vault 中完成手动验收。
- [ ] 更新相关文档和 ADR（如果有不可逆决策）。

## 11. 设计意图小结

| 选择 | 意图 | 代价 | 重新评估条件 |
|---|---|---|---|
| 一特性一目录 | 代码、设置、样式、测试就近维护 | 目录数量增加 | 特性数量爆炸时考虑分组 |
| 显式注册表 | 类型安全、可校验、无运行时扫描 | 手动加一行 | 需要动态加载时 |
| 默认关闭 | 升级不改变用户行为 | 用户需手动开启 | 核心必备特性可显式默认开启 |
| `live` 默认 | 减少重建，行为自然 | 需要读实时 `ctx.options` | 设置影响注册结构时改 `reload` |
| 设置键相对命名 | 特性代码不需要知道前缀 | 设置页层负责映射 | 键格式变化时 |
| 模板中包含命令/事件/状态栏 | 覆盖常见生命周期场景 | 模板稍长 | 出现新的常用资源类型时 |

## 12. 相关文档

- [架构设计](architecture.md)
- [生命周期](lifecycle.md)
- [设置页](settings.md)
- [数据与迁移](data-and-migrations.md)
- [测试策略](testing.md)
