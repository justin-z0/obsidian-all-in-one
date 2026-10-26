import { Plugin } from 'obsidian';
import { FeatureManager } from './core/feature-manager';
import { validateFeatures } from './core/registry';
import { SettingsStore } from './core/settings-store';
import { FEATURES } from './features';
import { AllInOneSettingTab } from './settings/tab';

export default class AllInOnePlugin extends Plugin {
  private store!: SettingsStore;
  private manager!: FeatureManager;

  override async onload(): Promise<void> {
    const { valid, errors } = validateFeatures(FEATURES);
    for (const error of errors) {
      console.error(`[all-in-one] ${error}`);
    }

    this.store = await SettingsStore.load(this, valid);
    this.manager = new FeatureManager(this, valid, this.store);

    const settingsTab = new AllInOneSettingTab(
      this.app,
      this,
      this.store,
      this.manager,
      valid,
    );
    this.addSettingTab(settingsTab);

    await this.manager.enableInitial();
    settingsTab.update();
  }

  override onunload(): void {
    this.manager?.unloadAll();
    void this.store?.flush();
  }
}
