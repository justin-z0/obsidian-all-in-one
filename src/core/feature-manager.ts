import { isControlSetting } from './feature';
import type {
  FeatureControlSetting,
  FeatureDefinition,
  FeatureOptions,
} from './feature';
import { FeatureContext } from './feature-context';
import { Logger } from './logger';
import type { EditorExtension, PluginHost } from './plugin-host';
import type { SettingsStore } from './settings-store';

export type FeatureStatus =
  | 'disabled'
  | 'enabling'
  | 'enabled'
  | 'disabling';

function findControlSetting(
  definition: FeatureDefinition,
  key: string,
): FeatureControlSetting | undefined {
  for (const setting of definition.settings ?? []) {
    if (isControlSetting(setting) && setting.control.key === key) {
      return setting;
    }
  }
  return undefined;
}

export class FeatureManager {
  private readonly features: Map<string, FeatureDefinition>;
  private readonly featureList: readonly FeatureDefinition[];
  private readonly contexts = new Map<string, FeatureContext>();
  private readonly statuses = new Map<string, FeatureStatus>();
  private readonly queues = new Map<string, Promise<void>>();
  private readonly loggers = new Map<string, Logger>();
  private readonly extensionMap = new Map<string, EditorExtension[]>();
  private readonly extensions: EditorExtension[] = [];

  constructor(
    private readonly host: PluginHost,
    features: readonly FeatureDefinition[],
    private readonly store: SettingsStore,
  ) {
    this.featureList = features;
    this.features = new Map(features.map((feature) => [feature.id, feature]));

    for (const feature of features) {
      this.statuses.set(feature.id, 'disabled');
    }

    // Register one mutable array; features add/remove their own extensions.
    this.host.registerEditorExtension(this.extensions);
  }

  getContext<T extends FeatureOptions = FeatureOptions>(
    id: string,
  ): FeatureContext<T> | undefined {
    return this.contexts.get(id) as FeatureContext<T> | undefined;
  }

  isEnabled(id: string): boolean {
    return this.statuses.get(id) === 'enabled';
  }

  getStatus(id: string): FeatureStatus | undefined {
    return this.statuses.get(id);
  }

  setEnabled(id: string, enabled: boolean): Promise<void> {
    return this.enqueue(id, () => this.setEnabledInternal(id, enabled));
  }

  async setFeatureOption(
    id: string,
    key: string,
    value: unknown,
  ): Promise<void> {
    const definition = this.requireDefinition(id);
    await this.store.setFeatureOption(id, key, value);

    if (!this.isEnabled(id)) {
      return;
    }

    const setting = findControlSetting(definition, key);
    if (setting && setting.apply === 'reload') {
      await this.enqueue(id, () => this.reloadInternal(id));
      return;
    }

    if (definition.onOptionsChange) {
      const ctx = this.contexts.get(id);
      if (!ctx) {
        return;
      }
      try {
        definition.onOptionsChange(ctx, [key]);
      } catch (error) {
        this.loggerFor(definition).error('onOptionsChange failed', error);
      }
    }
  }

  async resetFeature(id: string): Promise<void> {
    this.requireDefinition(id);
    await this.store.resetFeatureOptions(id);

    if (this.isEnabled(id)) {
      await this.enqueue(id, () => this.reloadInternal(id));
    }
  }

  reload(id: string): Promise<void> {
    return this.enqueue(id, () => this.reloadInternal(id));
  }

  async enableInitial(): Promise<void> {
    const ids = this.featureList
      .filter((feature) => this.store.isFeatureEnabled(feature.id))
      .map((feature) => feature.id);

    await Promise.allSettled(ids.map((id) => this.setEnabled(id, true)));
  }

  unloadAll(): void {
    const entries = [...this.contexts.entries()].reverse();

    for (const [id, ctx] of entries) {
      const definition = this.features.get(id);
      this.statuses.set(id, 'disabling');

      if (definition?.teardown) {
        try {
          void Promise.resolve(definition.teardown(ctx)).catch((error) => {
            this.loggerFor(definition).error('teardown failed', error);
          });
        } catch (error) {
          this.loggerFor(definition).error('teardown failed', error);
        }
      }

      ctx.unload();
      this.contexts.delete(id);
      this.statuses.set(id, 'disabled');
      void this.store.setFeatureEnabled(id, false);
    }

    this.extensionMap.clear();
    this.rebuildExtensions();
  }

  addEditorExtension(featureId: string, extension: EditorExtension): void {
    const list = this.extensionMap.get(featureId) ?? [];
    list.push(extension);
    this.extensionMap.set(featureId, list);
    this.rebuildExtensions();
  }

  removeEditorExtensions(featureId: string): void {
    if (!this.extensionMap.delete(featureId)) {
      return;
    }
    this.rebuildExtensions();
  }

  private async setEnabledInternal(
    id: string,
    enabled: boolean,
  ): Promise<void> {
    const definition = this.requireDefinition(id);

    if (enabled) {
      if (this.statuses.get(id) === 'enabled') {
        return;
      }

      await this.store.setFeatureEnabled(id, true);
      this.statuses.set(id, 'enabling');

      let ctx: FeatureContext | undefined;
      try {
        ctx = new FeatureContext(
          definition,
          this,
          this.store,
          this.host,
          this.loggerFor(definition),
        );
        ctx.load();
        await definition.setup(ctx);
        this.contexts.set(id, ctx);
        this.statuses.set(id, 'enabled');
      } catch (error) {
        ctx?.unload();
        this.contexts.delete(id);
        this.statuses.set(id, 'disabled');
        await this.store.setFeatureEnabled(id, false);
        this.loggerFor(definition).error('setup failed', error);
        throw error;
      }

      return;
    }

    if (this.statuses.get(id) === 'disabled') {
      if (this.store.isFeatureEnabled(id)) {
        await this.store.setFeatureEnabled(id, false);
      }
      return;
    }

    await this.store.setFeatureEnabled(id, false);
    this.statuses.set(id, 'disabling');

    const ctx = this.contexts.get(id);
    if (ctx) {
      if (definition.teardown) {
        try {
          await definition.teardown(ctx);
        } catch (error) {
          this.loggerFor(definition).error('teardown failed', error);
        }
      }

      ctx.unload();
      this.contexts.delete(id);
    }

    this.statuses.set(id, 'disabled');
  }

  private async reloadInternal(id: string): Promise<void> {
    if (this.statuses.get(id) !== 'enabled') {
      return;
    }

    await this.setEnabledInternal(id, false);
    await this.setEnabledInternal(id, true);
  }

  private enqueue<T>(id: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(id) ?? Promise.resolve();
    const run = previous.then(task, task);
    this.queues.set(
      id,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  private requireDefinition(id: string): FeatureDefinition {
    const definition = this.features.get(id);
    if (!definition) {
      throw new Error(`Unknown feature: ${id}`);
    }
    return definition;
  }

  private loggerFor(definition: FeatureDefinition): Logger {
    const existing = this.loggers.get(definition.id);
    if (existing) {
      return existing;
    }

    const logger = new Logger(definition.id, () => this.store.global.debug);
    this.loggers.set(definition.id, logger);
    return logger;
  }

  private rebuildExtensions(): void {
    this.extensions.length = 0;
    for (const list of this.extensionMap.values()) {
      this.extensions.push(...list);
    }
    this.host.app.workspace?.updateOptions?.();
  }
}
