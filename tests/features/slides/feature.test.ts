import { describe, expect, it } from 'vitest';
import { Notice, TFile } from 'obsidian';
import type { App, Menu } from 'obsidian';
import type { FeatureDefinition } from '../../../src/core/feature';
import { FeatureManager } from '../../../src/core/feature-manager';
import { validateFeatures } from '../../../src/core/registry';
import { SettingsStore } from '../../../src/core/settings-store';
import { FEATURES } from '../../../src/features';
import { slidesFeature } from '../../../src/features/slides';
import { FakeHost } from '../../helpers/fake-host';

const registered = slidesFeature as unknown as FeatureDefinition;

interface MenuItemStub {
  title: string;
  icon: string;
  click: (() => void) | null;
  setTitle(title: string): MenuItemStub;
  setIcon(icon: string): MenuItemStub;
  onClick(callback: () => void): MenuItemStub;
}

interface MenuStub {
  addItem(callback: (item: MenuItemStub) => void): void;
}

interface AppHarness {
  app: App;
  fileMenu: () => ((menu: MenuStub, file: TFile, source: string) => void) | null;
  offCount: () => number;
}

function createApp(
  activeFile: TFile | null,
  markdown = '# 主题 A',
): AppHarness {
  let fileMenu:
    | ((menu: MenuStub, file: TFile, source: string) => void)
    | null = null;
  let offs = 0;

  const app = {
    vault: {
      cachedRead: async (): Promise<string> => markdown,
    },
    workspace: {
      getActiveFile: (): TFile | null => activeFile,
      on: (name: string, callback: unknown): { off: () => void } => {
        if (name === 'file-menu') {
          fileMenu = callback as (
            menu: MenuStub,
            file: TFile,
            source: string,
          ) => void;
        }
        return {
          off: (): void => {
            offs += 1;
          },
        };
      },
    },
    metadataCache: {
      getFileCache: (): null => null,
    },
  } as unknown as App;

  return {
    app,
    fileMenu: () => fileMenu,
    offCount: () => offs,
  };
}

function createMenu(): { menu: MenuStub; items: MenuItemStub[] } {
  const items: MenuItemStub[] = [];
  const menu: MenuStub = {
    addItem(callback: (item: MenuItemStub) => void): void {
      const item: MenuItemStub = {
        title: '',
        icon: '',
        click: null,
        setTitle(title: string): MenuItemStub {
          this.title = title;
          return this;
        },
        setIcon(icon: string): MenuItemStub {
          this.icon = icon;
          return this;
        },
        onClick(callback: () => void): MenuItemStub {
          this.click = callback;
          return this;
        },
      };
      items.push(item);
      callback(item);
    },
  };
  return { menu, items };
}

function noticeMessages(): string[] {
  return (Notice as unknown as { messages: string[] }).messages;
}

async function enableSlides(
  app: App,
): Promise<{ host: FakeHost; manager: FeatureManager }> {
  const host = new FakeHost(app);
  const store = await SettingsStore.load(host, [registered]);
  const manager = new FeatureManager(host, [registered], store);
  await manager.setEnabled('slides', true);
  return { host, manager };
}

describe('slides feature definition', () => {
  it('passes registry validation', () => {
    const result = validateFeatures([registered]);

    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(1);
  });

  it('is disabled by default and has the full default option set', async () => {
    const host = new FakeHost({} as App);
    const store = await SettingsStore.load(host, [registered]);

    expect(store.isFeatureEnabled('slides')).toBe(false);
    expect(store.getOptions('slides')).toEqual(slidesFeature.defaultOptions);
  });

  it('is registered in the feature list', () => {
    expect(FEATURES.some((feature) => feature.id === 'slides')).toBe(true);
  });
});

describe('slides lifecycle', () => {
  it('registers its command, ribbon icon, and file menu while enabled', async () => {
    const { app, fileMenu } = createApp(null);
    const { host, manager } = await enableSlides(app);

    expect(host.commands.has('slides-present')).toBe(true);
    expect(host.ribbonIcons).toHaveLength(1);

    const menu = fileMenu();
    expect(menu).not.toBeNull();

    const file = new TFile();
    file.path = 'notes/a.md';
    file.extension = 'md';
    const { menu: stub, items } = createMenu();
    menu?.(stub, file, 'file-explorer');

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Present this note');
    expect(items[0]?.icon).toBe('presentation');

    await manager.setEnabled('slides', false);

    expect(host.commands.has('slides-present')).toBe(false);
    expect(host.ribbonIcons[0]?.removed).toBe(true);
  });

  it('does not register resources while disabled', async () => {
    const { app } = createApp(null);
    const host = new FakeHost(app);
    const store = await SettingsStore.load(host, [registered]);
    new FeatureManager(host, [registered], store);

    expect(host.commands.size).toBe(0);
    expect(host.ribbonIcons).toHaveLength(0);
  });

  it('removes the file menu listener when disabled', async () => {
    const { app, offCount } = createApp(null);
    const { manager } = await enableSlides(app);

    expect(offCount()).toBe(0);

    await manager.setEnabled('slides', false);

    expect(offCount()).toBeGreaterThan(0);
  });
});

describe('slides behavior', () => {
  it('shows a notice instead of opening a presentation without an active note', async () => {
    const { app } = createApp(null);
    const { host } = await enableSlides(app);
    noticeMessages().length = 0;

    const command = host.commands.get('slides-present');
    await command?.callback?.();

    expect(noticeMessages()).toContain(
      'Open a Markdown note before starting a presentation.',
    );
  });

  it('ignores non-Markdown files from the file menu', async () => {
    const { app, fileMenu } = createApp(null);
    await enableSlides(app);
    const menu = fileMenu();
    const { menu: stub, items } = createMenu();
    const file = new TFile();
    file.path = 'assets/image.png';
    file.extension = 'png';

    menu?.(stub, file, 'file-explorer');

    expect(items).toHaveLength(0);
  });
});
