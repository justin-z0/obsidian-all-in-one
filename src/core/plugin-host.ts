import type { App, Command, Plugin } from 'obsidian';

/**
 * The CodeMirror extension type accepted by Obsidian's
 * Plugin.registerEditorExtension. Obsidian does not re-export the type, so we
 * derive it from the method signature.
 */
export type EditorExtension = Parameters<Plugin['registerEditorExtension']>[0];

/**
 * The narrow host contract used by the plugin core. Obsidian's Plugin class
 * satisfies this structurally; tests use a fake implementation.
 */
export interface PluginHost {
  readonly app: App;
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
  addCommand(command: Command): Command;
  removeCommand(commandId: string): void;
  registerEditorExtension(extension: EditorExtension): void;
  addRibbonIcon(
    icon: string,
    title: string,
    callback: (evt: MouseEvent) => unknown,
  ): HTMLElement;
  addStatusBarItem(): HTMLElement;
}
