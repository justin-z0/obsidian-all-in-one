# 测试策略

> **本文回答**：哪些逻辑必须自动化测试？如何在不启动 Obsidian 的情况下测试生命周期？哪些内容只能手动验收？
>
> 当前实际测试参考：[附件管理](features/attachments.md) 对应的 `tests/features/attachments/`，以及[笔记漫游](features/note-roaming.md) 对应的 `tests/features/note-roaming/`。

## 1. 测试原则

1. **核心逻辑与 Obsidian 运行时解耦**：通过 `PluginHost` 窄接口和 `Component` mock，在 Node 中测试。
2. **设置页映射是纯数据**：直接断言原生 `SettingDefinitionItem[]` 的结构和谓词，不渲染 DOM。
3. **生命周期用契约测试**：每个特性都必须证明“启用后有资源、关闭后回到基线”。
4. **不把 Obsidian GUI 自动化作为主测试手段**：成本高、稳定性差；用单元测试覆盖逻辑，用固定清单覆盖真实交互。
5. **测试行为，不测试实现细节**：断言资源是否注册/清理、设置是否持久化，而不是私有方法调用次数。

## 2. 测试分层

```text
┌──────────────────────────────────────┐
│ 手动验收（真实 Obsidian + 测试 Vault）│
├──────────────────────────────────────┤
│ 集成测试（Store + Manager + FakeHost）│
├──────────────────────────────────────┤
│ 单元测试（纯函数、映射、校验、迁移）  │
└──────────────────────────────────────┘
```

- **单元测试**：默认值合并、控件键解析、迁移、i18n、注册表校验、设置定义映射。
- **集成测试**：`FeatureManager` + `SettingsStore` + `FakeHost` + 真实特性定义（如 `example`）。
- **手动验收**：真实 Obsidian 渲染、搜索、移动端、插件重载。

## 3. 测试替身

### 3.1 FakeHost

```ts
import type { App, Command, Extension } from 'obsidian';
import type { PluginHost } from '../../src/core/plugin-host';

function fakeElement(): HTMLElement {
  return {
    remove: vi.fn(),
    setText: vi.fn(),
  } as unknown as HTMLElement;
}

export class FakeHost implements PluginHost {
  readonly commands = new Map<string, Command>();
  readonly extensionContainers: Extension[][] = [];
  readonly removedCommands: string[] = [];

  get editorExtensions(): Extension[] {
    return this.extensionContainers.flat();
  }

  readonly app = {
    workspace: {
      updateOptions: vi.fn(),
    },
  } as unknown as App;

  addCommand(command: Command): Command {
    this.commands.set(command.id, command);
    return command;
  }

  removeCommand(commandId: string): void {
    this.commands.delete(commandId);
    this.removedCommands.push(commandId);
  }

  registerEditorExtension(extension: Extension): void {
    // 核心会注册一个可变的共享数组，这里保留引用而不是复制。
    this.extensionContainers.push(extension as Extension[]);
  }

  addRibbonIcon(): HTMLElement {
    return fakeElement();
  }

  addStatusBarItem(): HTMLElement {
    return fakeElement();
  }

  loadData(): Promise<unknown> {
    return Promise.resolve(null);
  }

  saveData(): Promise<void> {
    return Promise.resolve();
  }
}
```

`FakeHost` 记录所有注册行为，测试可以直接断言“命令是否还在”“编辑器扩展数组是否为空”。

### 3.2 Component mock

`FeatureContext` 继承 Obsidian `Component`。在 `tests/mocks/obsidian.ts` 中提供最小实现：

```ts
export class Component {
  private cleanups: Array<() => void> = [];

  load(): void {}
  unload(): void {
    for (const cleanup of this.cleanups.splice(0)) {
      cleanup();
    }
  }

  register(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  registerEvent(ref: { off?: () => void }): void {
    this.register(() => ref.off?.());
  }

  registerInterval(id: number): number {
    this.register(() => clearInterval(id));
    return id;
  }

  registerDomEvent(
    el: { addEventListener: Function; removeEventListener: Function },
    type: string,
    cb: EventListener,
  ): void {
    el.addEventListener(type, cb);
    this.register(() => el.removeEventListener(type, cb));
  }

  addChild<T extends Component>(child: T): T {
    this.register(() => child.unload());
    return child;
  }
}
```

> **意图**：让生命周期测试不依赖 Electron/Obsidian，同时保留 `Component` 的清理语义。
>
> **代价**：mock 需要跟随 Obsidian `Component` API 更新。
>
> **重新评估条件**：Obsidian 改变 `Component` 生命周期，或核心改为自研作用域容器时。

## 4. 测试矩阵

| 模块 | 必须覆盖 |
|---|---|
| `SettingsStore` | 无数据加载默认值；已知选项合并；未知键保留；非法类型回退；dropdown 值域；保存防抖；保存串行化；`flush`；保存失败不破坏内存 |
| `migrations` | 缺失版本视为 0；按顺序执行；版本高于当前不迁移；迁移抛错回退；迁移结果版本号正确 |
| `FeatureManager` | 初始启用只启动 enabled；开关幂等；快速开关最终状态；`setup` 失败回滚；`teardown` 失败仍清理；逆序卸载；命令/扩展清理 |
| `FeatureContext` | 命令自动加前缀；命令关闭时移除；Ribbon/状态栏元素移除；编辑器扩展加入/移除；事件/定时器/DOM 清理；`setTimeout` 清理；`signal` abort；关闭后调用注册 API 抛错 |
| `settings/control-keys` | 全局/开关/选项键生成与解析；非法键报错；保留前缀 |
| `settings/definitions` | 每特性一个 group；开关键正确；关闭时设置 `visible === false`；`apply` 元数据保留；自定义 render 注入 ctx |
| `registry` | 重复 ID；非法 ID；默认值覆盖所有设置键；禁止 `$enabled`；`global` 保留 |
| `i18n` | en/zh 键集合一致；插值；缺键回退 |
| 文档检查 | 相对链接存在；Mermaid 块非空且闭合；ADR 索引完整 |

## 5. 生命周期契约测试

每个特性至少一个：

```ts
import { describe, expect, it } from 'vitest';
import { FeatureManager } from '../../src/core/feature-manager';
import { SettingsStore } from '../../src/core/settings-store';
import { exampleFeature } from '../../src/features/example';
import { FakeHost } from '../mocks/fake-host';

describe('example feature lifecycle', () => {
  it('registers resources when enabled and removes them when disabled', async () => {
    const host = new FakeHost();
    const store = await SettingsStore.load(host, [exampleFeature]);
    const manager = new FeatureManager(host, [exampleFeature], store);

    await manager.setEnabled('example', true);

    expect(host.commands.has('example-greet')).toBe(true);

    await manager.setEnabled('example', false);

    expect(host.commands.has('example-greet')).toBe(false);
    expect(host.editorExtensions).toHaveLength(0);
    expect(host.removedCommands).toContain('example-greet');
  });

  it('rolls back when setup throws', async () => {
    const badFeature = {
      ...exampleFeature,
      id: 'bad-example',
      setup() {
        throw new Error('boom');
      },
    };

    const host = new FakeHost();
    const store = await SettingsStore.load(host, [badFeature]);
    const manager = new FeatureManager(host, [badFeature], store);

    await expect(manager.setEnabled('bad-example', true)).rejects.toThrow('boom');
    expect(store.isFeatureEnabled('bad-example')).toBe(false);
  });

  it('ends in the last requested state after rapid toggles', async () => {
    const host = new FakeHost();
    const store = await SettingsStore.load(host, [exampleFeature]);
    const manager = new FeatureManager(host, [exampleFeature], store);

    await Promise.all([
      manager.setEnabled('example', true),
      manager.setEnabled('example', false),
      manager.setEnabled('example', true),
    ]);

    expect(manager.isEnabled('example')).toBe(true);
    expect(host.commands.size).toBe(1);
  });
});
```

要点：

- 关闭后不仅检查 `manager.isEnabled`，还要检查 `FakeHost` 里的真实资源。
- 快速开关测试必须断言“没有重复命令”。
- `setup` 抛错后要检查持久化状态和残留资源。

## 6. 导入纯净性测试

特性模块只应在导入时定义数据，不应注册资源或启动定时器：

```ts
import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

it('does not start timers when feature modules are imported', async () => {
  await import('../../src/features/index');
  expect(vi.getTimerCount()).toBe(0);
});
```

更严格的版本可以配合 ESLint 的 `no-restricted-syntax`，禁止特性目录中的顶层注册调用。

> **意图**：防止“导入即副作用”，保证特性只在启用时生效。
>
> **代价**：只能发现定时器这类可观测副作用；直接全局赋值仍需 lint/review。
>
> **重新评估条件**：引入第三方特性模块时，需要更强的模块加载隔离。

## 7. 设置页映射测试

不需要渲染 DOM，直接断言定义：

```ts
it('creates one group per feature with a toggle row', () => {
  const items = buildSettingDefinitions({
    features: [exampleFeature],
    store,
    manager,
  });

  const group = items.find(
    (item) => item.type === 'group' && item.heading === exampleFeature.name,
  );

  expect(group).toBeDefined();
  expect(group?.items?.[0]).toMatchObject({
    control: { type: 'toggle', key: 'example.$enabled' },
  });
});

it('hides feature settings when disabled', () => {
  const items = buildSettingDefinitions({ features: [exampleFeature], store, manager });
  const group = items.find((item) => item.type === 'group');
  const setting = group?.items?.find(
    (item) => 'control' in item && item.control?.key === 'example.greeting',
  );

  expect(typeof setting?.visible === 'function' ? setting.visible() : setting?.visible)
    .toBe(false);
});
```

建议把 `getControlValue` / `setControlValue` 的键解析和路由抽成纯函数，分别测试，避免依赖完整 `PluginSettingTab` 实例。

## 8. 手动验收清单

在真实 Obsidian 测试 Vault 中执行：

- [ ] 全新安装：设置页显示 General 和所有特性章节。
- [ ] 每个关闭的特性只显示“启用”一行。
- [ ] 打开示例特性：命令、Ribbon、状态栏、事件行为立即出现。
- [ ] 修改普通设置：无需重启，行为按预期变化。
- [ ] 修改 `reload` 设置：特性自动重建，配置保留。
- [ ] 关闭示例特性：所有行为消失，命令面板无残留。
- [ ] 关闭后重启 Obsidian：开关保持关闭，配置未丢失。
- [ ] 再次开启：原配置恢复。
- [ ] 设置搜索：能搜到特性名、描述和已启用特性的设置项。
- [ ] 快速连续开关 10 次：最终状态正确，无重复命令/监听器。
- [ ] 手工破坏 `data.json`：插件仍能启动，非法值回退默认。
- [ ] 从旧版本 `data.json` 启动：迁移成功，无配置丢失。
- [ ] 禁用/重新启用插件：无控制台错误，资源无残留。
- [ ] 移动端（如支持）：设置页布局可用，开关可操作。

## 9. CI

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

或合并为：

```bash
pnpm check && pnpm build
```

要求：

- PR 必须通过全部检查。
- 测试失败不允许合并。
- 构建产物不提交，由 Release workflow 生成。

> **意图**：把类型、规范、生命周期行为和构建都放进合并门槛，避免“本地能跑、发布坏了”。
>
> **代价**：CI 时间增加。
>
> **重新评估条件**：CI 成为瓶颈时，拆分为快速单元测试和完整集成检查。

## 10. 设计意图小结

| 选择 | 意图 | 代价 | 重新评估条件 |
|---|---|---|---|
| FakeHost + Component mock | 核心逻辑脱离 Obsidian 测试 | mock 需要维护 | Obsidian API 变化时 |
| 设置页只测映射 | UI 逻辑纯数据化，测试稳定 | 不覆盖真实渲染 | 原生设置 API 行为异常时 |
| 每特性生命周期契约测试 | 强制证明资源可清理 | 每个特性多一个测试 | 特性数量很多时可模板化 |
| 导入纯净性测试 | 防止模块顶层副作用 | 覆盖有限 | 引入第三方模块时 |
| 手动验收清单 | 覆盖真实渲染和交互 | 无法自动化 | 出现稳定 GUI 自动化方案时 |
| CI 全量检查 | 统一质量门槛 | 时间成本 | CI 成为瓶颈时 |

## 11. 相关文档

- [架构设计](architecture.md)
- [生命周期](lifecycle.md)
- [设置页](settings.md)
- [新增特性](feature-development.md)
- [开发指南](development.md)
