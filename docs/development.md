# 开发指南

> **状态**：实现基线 v0.1（2026-10-26）。脚手架、核心架构、附件管理和笔记漫游特性已落地；以下命令当前可用。

## 1. 目标

- 用尽量少的工具链完成开发、构建、测试和发布。
- 开发时自动构建并同步到测试 Vault。
- 构建产物符合 Obsidian 插件要求：`main.js`、`manifest.json`、`styles.css`。
- 类型检查、lint、测试在 CI 和本地使用同一套命令。
- 发布版本号、最低 Obsidian 版本和 Release 资产保持一致。

## 2. 环境要求

| 工具 | 建议版本 | 说明 |
|---|---|---|
| Node.js | ≥ 22 LTS | 本地当前为 Node 26；CI 使用 LTS |
| pnpm | 与 `packageManager` 一致 | 本地 npm 缓存存在权限问题，统一用 pnpm |
| Obsidian | ≥ 1.13.1 | 声明式设置 API 的最低版本 |
| TypeScript | 5.9.x | 严格模式 |
| esbuild | 0.25.x | 单文件 CJS 打包 |
| Vitest | 3.x | 单元测试 |
| ESLint | 9.x + `eslint-plugin-obsidianmd` | 代码规范与 Obsidian 规则 |

如果 `eslint-plugin-obsidianmd` 的 `obsidian` peer 版本与 1.13.1 冲突，可在 `pnpm-workspace.yaml` 的 `peerDependencyRules.allowedVersions` 中放宽；这不影响运行时。

## 3. 初始化与测试 Vault

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env`：

```dotenv
OBSIDIAN_PLUGIN_DIR=/absolute/path/to/Vault/.obsidian/plugins/all-in-one
```

要求：

- 路径指向测试 Vault 中的插件目录，不是整个 Vault。
- 目录不存在时，同步脚本会创建。
- `.env` 必须被 `.gitignore` 忽略，不能提交。
- Obsidian 需要先启用该插件，或至少存在 `manifest.json` 后在社区插件中启用。

## 4. 命令

```bash
pnpm install
pnpm dev          # watch 构建 + 同步到测试 Vault
pnpm build        # 类型检查 + 生产构建
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest run
pnpm check        # lint + typecheck + test
pnpm check:docs         # 文档链接、Mermaid 代码块、ADR 索引检查
pnpm check:release # 校验 package/manifest/versions/tag 版本一致
```

建议在提交前运行：

```bash
pnpm check && pnpm build
```

## 5. 项目结构

```text
src/
├── main.ts                 # 插件入口、组合根
├── core/
│   ├── feature.ts          # 契约类型
│   ├── feature-context.ts  # 作用域能力
│   ├── feature-manager.ts  # 生命周期
│   ├── settings-store.ts   # 数据加载/保存/迁移
│   ├── migrations.ts
│   ├── plugin-host.ts      # 窄宿主接口
│   ├── registry.ts         # 注册表校验
│   └── logger.ts
├── settings/
│   ├── definitions.ts      # 特性定义 → 原生设置
│   ├── control-keys.ts
│   ├── tab.ts
│   └── reset-modal.ts
├── features/
│   ├── index.ts            # FEATURES
│   ├── attachments/        # 附件管理特性
│   └── note-roaming/       # 笔记漫游特性
├── i18n/
├── lib/                    # 跨特性共享工具（按需添加）
└── styles/
tests/
scripts/
docs/
```

## 6. 构建管线

### 6.1 两个入口

```text
src/main.ts            → main.js
src/styles/index.css   → styles.css
```

- `main.js` 使用 esbuild 打包为 CJS，Obsidian 直接加载。
- `styles.css` 支持通过 `@import` 聚合各特性样式。
- `manifest.json`、`versions.json` 是源文件，不参与打包。

### 6.2 esbuild 关键配置

```js
{
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  outfile: 'main.js',
  sourcemap: dev ? 'inline' : false,
  logLevel: 'info',
}
```

> **意图**：用最小工具链产出 Obsidian 需要的单文件；把 Obsidian 和 CodeMirror 保持 external，避免重复打包运行时。
>
> **代价**：没有 HMR、没有代码分割；每次构建都是全量打包。
>
> **重新评估条件**：插件包体明显影响启动，或需要复杂前端框架时。

### 6.3 类型检查

esbuild 只转译、不做类型检查。`pnpm build` 必须先执行：

```bash
tsc --noEmit
```

TypeScript 配置建议：

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `noImplicitOverride: true`
- `verbatimModuleSyntax: true`
- `moduleResolution: "Bundler"`
- `target: "ES2022"`
- `lib: ["DOM", "ES2022"]`

> **意图**：在构建阶段暴露类型问题，而不是依赖运行时错误。
>
> **代价**：严格选项会增加少量类型标注和判空代码。
>
> **重新评估条件**：Obsidian 类型或第三方库与严格选项冲突时，逐项放宽并记录原因。

## 7. 开发同步

`scripts/sync-to-vault.mjs` 的职责：

1. 读取 `.env` 中的 `OBSIDIAN_PLUGIN_DIR`。
2. 若未配置，打印提示并正常退出，不阻塞构建。
3. 将 `main.js`、`manifest.json`、`styles.css` 复制到目标目录。
4. 目录不存在时创建。

开发模式：

```text
esbuild watch
   ├─ JS 构建成功 ─┐
   └─ CSS 构建成功 ─┴─→ onEnd → sync-to-vault
```

Obsidian 中重载插件：

- 使用社区插件 **Hot Reload**；或
- 在“设置 → 社区插件”中关闭再打开本插件；或
- `Cmd/Ctrl + R` 重载 Obsidian 窗口。

> **意图**：保持“保存即构建、构建即同步”，减少手动复制产物的错误。
>
> **代价**：开发依赖本地 `.env`，不适合直接提交或共享。
>
> **重新评估条件**：需要多人协作调试或远程开发时，改用统一的开发容器/脚本。

## 8. 调试

| 场景 | 方法 |
|---|---|
| 插件启动失败 | 打开开发者工具 Console，查看 `plugin onload` 错误 |
| 特性启用失败 | 查看带特性 ID 的错误日志；检查 `setup` 中注册的资源 |
| 设置不保存 | 检查 `data.json`、保存队列、`.env` 是否指向正确 Vault |
| 设置页不刷新 | 确认开关后调用 `tab.update()`，普通选项调用 `refreshDomState()` |
| 关闭后仍有行为 | 按 [生命周期](lifecycle.md) 的“常见错误与症状”一节排查 |
| 构建产物不更新 | 检查 watch 进程、同步脚本日志、Obsidian 是否重载 |

## 9. 版本与最低 Obsidian 版本

三处必须一致：

| 位置 | 字段 |
|---|---|
| `manifest.json` | `version`、`minAppVersion` |
| `versions.json` | `"<pluginVersion>": "<minAppVersion>"` |
| `obsidian` devDependency | 与 `minAppVersion` 对齐（本方案为 `1.13.1`） |

> **意图**：避免“类型使用了 1.14 的 API，但 manifest 声称支持 1.13.1”这种运行时崩溃。
>
> **代价**：升级最低版本需要同步修改三处，并重新验证。
>
> **重新评估条件**：需要新 API 时，先升级 `minAppVersion` 和 `obsidian` 类型，再改代码。

## 10. 发布流程

1. 更新 `package.json`、`manifest.json`、`versions.json` 的版本。
2. 运行 `pnpm check && pnpm build`。
3. 在测试 Vault 中做一次手动验收（见 [测试策略](testing.md)）。
4. 提交并打 tag，例如 `v0.1.0`。
5. CI 校验版本一致性，构建并上传：
   - `main.js`
   - `manifest.json`
   - `styles.css`
6. 在 GitHub Release 中填写变更说明。

发布前检查：

- `manifest.json` 的 `id` 与仓库目录/插件目录一致。
- `minAppVersion` 与 `obsidian` 类型版本一致。
- 没有提交 `.env`、`data.json`、`node_modules`、构建产物或密钥。
- `README` 和文档中的版本信息已更新。

> **意图**：把发布变成可重复的流水线，减少手工上传和版本错位。
>
> **代价**：需要维护 CI workflow 和版本检查脚本。
>
> **重新评估条件**：发布频率很低时，可简化 workflow，但保留版本一致性检查。

## 11. CI

仓库已提供两个 workflow：

### `ci.yml`

- 触发：push / pull request。
- 步骤：安装 pnpm → `pnpm install --frozen-lockfile` → `pnpm check` → `pnpm build` → `pnpm check:docs`。
- 失败即阻断合并。

### `release.yml`

- 触发：推送 `v*` tag。
- 步骤：安装 → `pnpm check` → `pnpm build` → `node scripts/check-release.mjs` → 创建 Release 并上传三个资产。

> **意图**：把类型、lint、测试和构建作为合并门槛；发布只做一次可信构建。
>
> **代价**：CI 时间增加；依赖缓存和 lockfile 需要维护。
>
> **重新评估条件**：CI 成为开发瓶颈时，拆分快速检查和完整检查。

## 12. 常见问题

### `.env` 没配置会怎样？

同步脚本打印提示并退出，`pnpm build` 仍然成功。产物在仓库根目录，手动复制即可。

### 为什么不用 npm？

本地 npm 缓存目录存在权限问题（EPERM）；pnpm 已验证可用。团队统一使用 pnpm 和 lockfile。

### 为什么不用 `obsidian-plugin-cli`？

自定义 esbuild 配置更透明，便于控制 external、CSS 聚合和同步脚本；依赖更少。

### 为什么 `styles.css` 也要构建？

Obsidian 只加载插件根目录的 `styles.css`。把特性样式放在各自目录并通过 CSS `@import` 聚合，便于长期维护。

### 可以提交 `main.js` / `styles.css` 吗？

不建议。它们是构建产物，发布由 CI 生成；`.gitignore` 应忽略它们，避免生成文件污染 diff。

## 13. 设计意图小结

| 选择 | 意图 | 代价 | 重新评估条件 |
|---|---|---|---|
| pnpm + lockfile | 可复现安装；规避本地 npm 权限问题 | 团队需统一包管理器 | 协作环境要求 npm 时 |
| esbuild | 快、配置少、单文件输出 | 无 HMR/代码分割 | 需要复杂前端时 |
| 双入口构建 | JS 与 CSS 都符合 Obsidian 约定 | 构建脚本稍复杂 | Obsidian 支持 CSS 导入时 |
| `.env` 同步脚本 | 构建后自动进入测试 Vault | 本地环境依赖 | 多人远程调试时 |
| 三处版本对齐 | 防止类型与最低版本错位 | 手工同步 | 引入自动版本脚本时 |
| CI 双 workflow | 合并门槛 + 可信发布 | 配置维护 | 发布频率变化时 |

## 14. 相关文档

- [架构设计](architecture.md)
- [新增特性](feature-development.md)
- [测试策略](testing.md)
- [数据与迁移](data-and-migrations.md)
