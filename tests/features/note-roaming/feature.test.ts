import { describe, expect, it, vi } from 'vitest';
import { Notice } from 'obsidian';
import type { App, Command } from 'obsidian';
import type { FeatureDefinition } from '../../../src/core/feature';
import { FeatureManager } from '../../../src/core/feature-manager';
import { validateFeatures } from '../../../src/core/registry';
import { SettingsStore } from '../../../src/core/settings-store';
import { FEATURES } from '../../../src/features';
import { noteRoamingFeature } from '../../../src/features/note-roaming';
import { FakeHost } from '../../helpers/fake-host';

const registered = noteRoamingFeature as unknown as FeatureDefinition;

function noticeMessages(): string[] {
  return (Notice as unknown as { messages: string[] }).messages;
}

interface OpenedNote {
  path: string;
  mode: unknown;
}

interface FakeLeaf {
  id: number;
  openFile(
    file: { path: string },
    state?: { active?: boolean; state?: Record<string, unknown> },
  ): Promise<void>;
}

interface RoamingState {
  opened: OpenedNote[];
  openedLeafIds: number[];
  leafRequests: Array<string | boolean | undefined>;
  workspaceLeaves: FakeLeaf[];
}

interface RoamingHarness extends RoamingState {
  app: App;
}

function createApp(paths: readonly string[]): RoamingHarness {
  const opened: OpenedNote[] = [];
  const openedLeafIds: number[] = [];
  const leafRequests: Array<string | boolean | undefined> = [];
  const workspaceLeaves: FakeLeaf[] = [];
  let nextLeafId = 1;

  const app = {
    vault: {
      getMarkdownFiles: () => paths.map((path) => ({ path })),
    },
    workspace: {
      updateOptions(): void {
        // no-op
      },
      on(): { off(): void } {
        return { off(): void { /* no-op */ } };
      },
      getLeaf(pane?: string | boolean): FakeLeaf {
        leafRequests.push(pane);
        const leaf: FakeLeaf = {
          id: nextLeafId,
          openFile: async (
            file: { path: string },
            state?: { active?: boolean; state?: Record<string, unknown> },
          ): Promise<void> => {
            opened.push({ path: file.path, mode: state?.state?.mode });
            openedLeafIds.push(leaf.id);
          },
        };
        nextLeafId += 1;
        workspaceLeaves.push(leaf);
        return leaf;
      },
      iterateAllLeaves(callback: (leaf: FakeLeaf) => void): void {
        for (const leaf of [...workspaceLeaves]) {
          callback(leaf);
        }
      },
    },
  } as unknown as App;

  return { app, opened, openedLeafIds, leafRequests, workspaceLeaves };
}

async function enableNoteRoaming(
  paths: readonly string[],
  roamPaths: string,
): Promise<RoamingState & { host: FakeHost; manager: FeatureManager }> {
  const { app, opened, openedLeafIds, leafRequests, workspaceLeaves } =
    createApp(paths);
  const host = new FakeHost(app);
  const store = await SettingsStore.load(host, [registered]);
  const manager = new FeatureManager(host, [registered], store);

  await manager.setFeatureOption('note-roaming', 'roamPaths', roamPaths);
  await manager.setEnabled('note-roaming', true);

  return {
    host,
    manager,
    opened,
    openedLeafIds,
    leafRequests,
    workspaceLeaves,
  };
}

function getCommand(host: FakeHost): Command {
  const command = host.commands.get('note-roaming-roam');
  if (!command?.callback) {
    throw new Error('note-roaming command was not registered');
  }
  return command;
}

describe('note roaming feature definition', () => {
  it('passes registry validation', () => {
    const result = validateFeatures([registered]);

    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(1);
  });

  it('defaults to roaming the whole vault', async () => {
    const host = new FakeHost({} as App);
    const store = await SettingsStore.load(host, [registered]);

    expect(store.getOptions('note-roaming')).toEqual({ roamPaths: '' });
    expect(noteRoamingFeature.defaultEnabled).toBe(false);
  });

  it('is registered in the feature list', () => {
    expect(FEATURES.some((feature) => feature.id === 'note-roaming')).toBe(
      true,
    );
  });
});

describe('note roaming lifecycle', () => {
  it('shows the sidebar button while enabled and removes it when disabled', async () => {
    const { host, manager } = await enableNoteRoaming(['notes/a.md'], '');

    expect(host.commands.has('note-roaming-roam')).toBe(true);
    expect(host.ribbonIcons).toHaveLength(1);

    const icon = host.ribbonIcons[0];
    if (!icon) {
      throw new Error('ribbon icon was not registered');
    }
    expect(icon.icon).toBe('dices');
    expect(icon.removed).toBe(false);

    await manager.setEnabled('note-roaming', false);

    expect(host.commands.has('note-roaming-roam')).toBe(false);
    expect(icon.removed).toBe(true);
  });

  it('does not register resources when the feature is disabled', async () => {
    const { app } = createApp(['notes/a.md']);
    const host = new FakeHost(app);
    const store = await SettingsStore.load(host, [registered]);
    new FeatureManager(host, [registered], store);

    expect(host.commands.size).toBe(0);
    expect(host.ribbonIcons).toHaveLength(0);
  });
});

describe('note roaming behavior', () => {
  it('opens a random note from the configured paths in a dedicated tab', async () => {
    const { host, opened, leafRequests } = await enableNoteRoaming(
      ['notes/a.md', 'notes/sub/b.md', 'notes-private/c.md', 'other/d.md'],
      'notes',
    );

    await getCommand(host).callback?.();

    expect(opened).toHaveLength(1);
    expect(opened[0]?.path).toMatch(/^notes\//);
    expect(opened[0]?.mode).toBe('preview');
    expect(leafRequests).toEqual(['tab']);
  });

  it('reuses the dedicated tab for repeated roams', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const {
      host,
      opened,
      openedLeafIds,
      leafRequests,
      workspaceLeaves,
    } = await enableNoteRoaming(['notes/a.md', 'notes/b.md'], 'notes');

    await getCommand(host).callback?.();
    await getCommand(host).callback?.();
    random.mockRestore();

    expect(opened).toHaveLength(2);
    expect(leafRequests).toEqual(['tab']);
    expect(workspaceLeaves).toHaveLength(1);
    expect(new Set(openedLeafIds).size).toBe(1);
  });

  it('creates a new dedicated tab after the previous one is closed', async () => {
    const { host, opened, leafRequests, workspaceLeaves } =
      await enableNoteRoaming(['notes/a.md'], 'notes');

    await getCommand(host).callback?.();
    expect(workspaceLeaves).toHaveLength(1);

    workspaceLeaves.length = 0;

    await getCommand(host).callback?.();

    expect(leafRequests).toEqual(['tab', 'tab']);
    expect(workspaceLeaves).toHaveLength(1);
    expect(opened).toHaveLength(2);
  });

  it('roams the whole vault when the paths setting is empty', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const { host, opened } = await enableNoteRoaming(
      ['notes/a.md', 'other/b.md'],
      '',
    );

    await getCommand(host).callback?.();
    random.mockRestore();

    expect(opened).toEqual([{ path: 'notes/a.md', mode: 'preview' }]);
  });

  it('matches exact file paths as well as folders', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const { host, opened } = await enableNoteRoaming(
      ['notes/a.md', 'reading/list.md', 'reading/other.md'],
      'reading/list.md',
    );

    await getCommand(host).callback?.();
    random.mockRestore();

    expect(opened).toEqual([{ path: 'reading/list.md', mode: 'preview' }]);
  });

  it('opens from the sidebar button', async () => {
    const { host, opened } = await enableNoteRoaming(['notes/a.md'], 'notes');

    const icon = host.ribbonIcons[0];
    if (!icon) {
      throw new Error('ribbon icon was not registered');
    }

    await icon.callback({} as MouseEvent);

    expect(opened).toEqual([{ path: 'notes/a.md', mode: 'preview' }]);
  });

  it('shows a notice instead of opening a note when no note matches', async () => {
    const { host, opened, leafRequests, workspaceLeaves } =
      await enableNoteRoaming(['other/note.md'], 'notes');
    noticeMessages().length = 0;

    await getCommand(host).callback?.();

    expect(opened).toHaveLength(0);
    expect(leafRequests).toEqual([]);
    expect(workspaceLeaves).toHaveLength(0);
    expect(noticeMessages()).toContain(
      'No Markdown notes to roam. Check the roaming paths.',
    );
  });

  it('never falls back to the whole vault when every configured path is invalid', async () => {
    const { host, opened, leafRequests, workspaceLeaves } =
      await enableNoteRoaming(['notes/a.md'], '../outside');
    noticeMessages().length = 0;

    await getCommand(host).callback?.();

    expect(opened).toHaveLength(0);
    expect(leafRequests).toEqual([]);
    expect(workspaceLeaves).toHaveLength(0);
    expect(noticeMessages()).toContain(
      'No Markdown notes to roam. Check the roaming paths.',
    );
  });
});
