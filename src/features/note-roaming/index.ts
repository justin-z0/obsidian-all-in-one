import { Notice } from 'obsidian';
import type { Workspace, WorkspaceLeaf } from 'obsidian';
import type { FeatureDefinition } from '../../core/feature';
import type { FeatureContext } from '../../core/feature-context';
import { t } from '../../i18n';
import {
  DEFAULT_NOTE_ROAMING_OPTIONS,
  noteRoamingSettings,
} from './options';
import { filterRoamableNotes, parseRoamScope, pickRandom } from './paths';
import type { NoteRoamingOptions } from './types';

export const noteRoamingFeature: FeatureDefinition<NoteRoamingOptions> = {
  id: 'note-roaming',
  name: t('features.note-roaming.name'),
  description: t('features.note-roaming.description'),
  defaultEnabled: false,
  defaultOptions: DEFAULT_NOTE_ROAMING_OPTIONS,
  settings: noteRoamingSettings,
  setup,
};

function isLeafAttached(workspace: Workspace, leaf: WorkspaceLeaf): boolean {
  let attached = false;

  workspace.iterateAllLeaves((candidate) => {
    if (candidate === leaf) {
      attached = true;
    }
  });

  return attached;
}

function setup(ctx: FeatureContext<NoteRoamingOptions>): void {
  let roaming = false;
  let roamLeaf: WorkspaceLeaf | null = null;

  const acquireRoamLeaf = (): WorkspaceLeaf => {
    if (roamLeaf && isLeafAttached(ctx.app.workspace, roamLeaf)) {
      return roamLeaf;
    }

    roamLeaf = ctx.app.workspace.getLeaf('tab');
    return roamLeaf;
  };

  const roam = async (): Promise<void> => {
    if (roaming) {
      return;
    }

    roaming = true;
    try {
      const scope = parseRoamScope(ctx.options.roamPaths);
      if (scope.invalid.length > 0) {
        ctx.logger.warn(
          `ignoring ${scope.invalid.length} invalid roaming path(s)`,
        );
      }

      const notes = filterRoamableNotes(
        ctx.app.vault.getMarkdownFiles(),
        scope,
      );
      const note = pickRandom(notes);
      if (!note) {
        new Notice(t('features.note-roaming.notice.noNotes'));
        return;
      }

      if (!ctx.isEnabled()) {
        return;
      }

      const leaf = acquireRoamLeaf();
      await leaf.openFile(note, {
        active: true,
        state: { mode: 'preview' },
      });
    } catch (error) {
      if (ctx.signal.aborted) {
        return;
      }

      ctx.logger.error('failed to open a random note', error);
      new Notice(
        t('features.note-roaming.notice.openFailed', {
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      roaming = false;
    }
  };

  ctx.addCommand({
    id: 'roam',
    name: t('features.note-roaming.command.roam'),
    callback: () => roam(),
  });

  ctx.addRibbonIcon('dices', t('features.note-roaming.ribbon'), () => roam());
}
