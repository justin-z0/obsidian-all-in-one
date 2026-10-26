import type { App, Command } from 'obsidian';
import type { EditorExtension, PluginHost } from '../../src/core/plugin-host';

function fakeElement(onRemove?: () => void): HTMLElement {
  return {
    remove(): void {
      onRemove?.();
    },
  } as unknown as HTMLElement;
}

export interface FakeRibbonIcon {
  readonly icon: string;
  readonly title: string;
  readonly callback: (evt: MouseEvent) => unknown;
  removed: boolean;
}

export class FakeHost implements PluginHost {
  readonly commands = new Map<string, Command>();
  readonly removedCommands: string[] = [];
  readonly saved: unknown[] = [];
  readonly editorExtensions: EditorExtension[] = [];
  readonly ribbonIcons: FakeRibbonIcon[] = [];
  loadedData: unknown = null;

  constructor(readonly app: App) {}

  loadData(): Promise<unknown> {
    return Promise.resolve(this.loadedData);
  }

  saveData(data: unknown): Promise<void> {
    this.saved.push(data);
    return Promise.resolve();
  }

  addCommand(command: Command): Command {
    this.commands.set(command.id, command);
    return command;
  }

  removeCommand(commandId: string): void {
    this.commands.delete(commandId);
    this.removedCommands.push(commandId);
  }

  registerEditorExtension(extension: EditorExtension): void {
    this.editorExtensions.push(extension);
  }

  addRibbonIcon(
    icon: string,
    title: string,
    callback: (evt: MouseEvent) => unknown,
  ): HTMLElement {
    const entry: FakeRibbonIcon = {
      icon,
      title,
      callback,
      removed: false,
    };
    this.ribbonIcons.push(entry);
    return fakeElement(() => {
      entry.removed = true;
    });
  }

  addStatusBarItem(): HTMLElement {
    return fakeElement();
  }
}
