import { Component } from 'obsidian';
import type { App, Command } from 'obsidian';
import type { FeatureDefinition, FeatureOptions } from './feature';
import type { FeatureManager } from './feature-manager';
import type { Logger } from './logger';
import type { EditorExtension, PluginHost } from './plugin-host';
import type { SettingsStore } from './settings-store';

export class FeatureContext<T extends FeatureOptions = FeatureOptions>
  extends Component
{
  readonly featureId: string;
  readonly app: App;
  readonly signal: AbortSignal;

  private readonly controller = new AbortController();
  private readonly commandIds = new Set<string>();
  private active = false;
  private editorExtensionCleanupRegistered = false;

  constructor(
    private readonly definition: FeatureDefinition<T>,
    private readonly manager: FeatureManager,
    private readonly store: SettingsStore,
    private readonly host: PluginHost,
    private readonly loggerInstance: Logger,
  ) {
    super();
    this.featureId = definition.id;
    this.app = host.app;
    this.signal = this.controller.signal;
  }

  get options(): Readonly<T> {
    return this.store.getOptions<T>(this.featureId);
  }

  get logger(): Logger {
    return this.loggerInstance;
  }

  isEnabled(): boolean {
    return this.manager.isEnabled(this.featureId);
  }

  async setOption<K extends keyof T & string>(
    key: K,
    value: T[K],
  ): Promise<void> {
    this.assertActive('setOption');
    await this.manager.setFeatureOption(this.featureId, key, value);
  }

  async reload(): Promise<void> {
    this.assertActive('reload');
    await this.manager.reload(this.featureId);
  }

  addCommand(command: Command): void {
    this.assertActive('addCommand');
    const id = `${this.featureId}-${command.id}`;

    if (this.commandIds.has(id)) {
      throw new Error(`[${this.featureId}] duplicate command id: ${id}`);
    }

    this.commandIds.add(id);
    this.host.addCommand({ ...command, id });
    this.registerCleanup(() => {
      this.host.removeCommand(id);
      this.commandIds.delete(id);
    });
  }

  addRibbonIcon(
    icon: string,
    title: string,
    callback: (evt: MouseEvent) => unknown,
  ): HTMLElement {
    this.assertActive('addRibbonIcon');
    const element = this.host.addRibbonIcon(icon, title, callback);
    this.registerCleanup(() => element.remove());
    return element;
  }

  addStatusBarItem(): HTMLElement {
    this.assertActive('addStatusBarItem');
    const element = this.host.addStatusBarItem();
    this.registerCleanup(() => element.remove());
    return element;
  }

  addEditorExtension(extension: EditorExtension): void {
    this.assertActive('addEditorExtension');
    this.manager.addEditorExtension(this.featureId, extension);

    if (!this.editorExtensionCleanupRegistered) {
      this.editorExtensionCleanupRegistered = true;
      this.registerCleanup(() => {
        this.manager.removeEditorExtensions(this.featureId);
      });
    }
  }

  setTimeout(callback: () => void, delay: number): number {
    this.assertActive('setTimeout');
    const id = window.setTimeout(callback, delay);
    this.registerCleanup(() => window.clearTimeout(id));
    return id;
  }

  override onload(): void {
    this.active = true;
  }

  override onunload(): void {
    this.active = false;
    this.controller.abort();
    super.onunload();
  }

  private assertActive(method: string): void {
    if (!this.active) {
      throw new Error(
        `[${this.featureId}] ${method} called while the feature is inactive`,
      );
    }
  }

  private registerCleanup(cleanup: () => void): void {
    this.register(() => {
      try {
        cleanup();
      } catch (error) {
        this.logger.error('cleanup failed', error);
      }
    });
  }
}
