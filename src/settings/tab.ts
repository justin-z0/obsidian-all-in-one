import { Notice, PluginSettingTab } from 'obsidian';
import type {
  App,
  Plugin,
  SettingDefinitionItem,
} from 'obsidian';
import type { FeatureDefinition, FeatureOptions } from '../core/feature';
import type { FeatureManager } from '../core/feature-manager';
import type { SettingsStore } from '../core/settings-store';
import { t } from '../i18n';
import { parseControlKey } from './control-keys';
import { buildSettingDefinitions } from './definitions';

export class AllInOneSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly store: SettingsStore,
    private readonly manager: FeatureManager,
    private readonly features: readonly FeatureDefinition[],
  ) {
    super(app, plugin);
    this.icon = 'settings';
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    return buildSettingDefinitions({
      app: this.app,
      features: this.features,
      manager: this.manager,
      refresh: () => this.update(),
    });
  }

  override getControlValue(key: string): unknown {
    try {
      const parsed = parseControlKey(key);

      switch (parsed.kind) {
        case 'global':
          return (this.store.global as unknown as Record<string, unknown>)[
            parsed.key
          ];
        case 'enabled':
          return this.store.isFeatureEnabled(parsed.featureId);
        case 'option':
          return this.store.getOptions<FeatureOptions>(parsed.featureId)[
            parsed.key
          ];
      }
    } catch (error) {
      console.error('[all-in-one:settings] failed to read control value', error);
      return undefined;
    }
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    let parsed: ReturnType<typeof parseControlKey>;

    try {
      parsed = parseControlKey(key);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
      return;
    }

    if (parsed.kind === 'enabled') {
      try {
        await this.manager.setEnabled(parsed.featureId, Boolean(value));
      } catch (error) {
        console.error('[all-in-one:settings] failed to toggle feature', error);
        new Notice(
          t('notice.featureEnableFailed', {
            name: this.featureName(parsed.featureId),
          }),
        );
      }
      this.update();
      return;
    }

    if (parsed.kind === 'option') {
      const wasEnabled = this.manager.isEnabled(parsed.featureId);

      try {
        await this.manager.setFeatureOption(
          parsed.featureId,
          parsed.key,
          value,
        );
      } catch (error) {
        new Notice(error instanceof Error ? error.message : String(error));
        this.update();
        return;
      }

      if (this.manager.isEnabled(parsed.featureId) !== wasEnabled) {
        this.update();
      } else {
        this.refreshDomState();
      }
      return;
    }

    try {
      await this.store.setGlobal(parsed.key, value);
      this.refreshDomState();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
      this.update();
    }
  }

  override hide(): void {
    void this.store.flush();
  }

  private featureName(id: string): string {
    return this.features.find((feature) => feature.id === id)?.name ?? id;
  }
}
