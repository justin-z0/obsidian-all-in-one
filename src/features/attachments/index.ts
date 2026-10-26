import { MarkdownView, Notice } from 'obsidian';
import type { Editor, MarkdownFileInfo } from 'obsidian';
import type { FeatureDefinition } from '../../core/feature';
import type { FeatureContext } from '../../core/feature-context';
import { t } from '../../i18n';
import { extractClipboardImages } from './clipboard';
import {
  handlePastedImages,
  type BaseFlowDeps,
  type PasteFlowDeps,
} from './flow';
import {
  DEFAULT_ATTACHMENT_OPTIONS,
  attachmentSettings,
} from './options';
import { promptRename } from './rename-modal';
import type { AttachmentOptions, NamePromptRequest } from './types';
import { uploadFiles } from './upload';

export const attachmentsFeature: FeatureDefinition<AttachmentOptions> = {
  id: 'attachments',
  name: t('features.attachments.name'),
  description: t('features.attachments.description'),
  defaultEnabled: true,
  defaultOptions: DEFAULT_ATTACHMENT_OPTIONS,
  settings: attachmentSettings,
  setup,
};

function setup(ctx: FeatureContext<AttachmentOptions>): void {
  let busy = false;

  const makeDeps = (): BaseFlowDeps => ({
    app: ctx.app,
    logger: ctx.logger,
    isEnabled: () => ctx.isEnabled(),
    signal: ctx.signal,
    options: { ...ctx.options },
  });

  const handlePaste = (
    evt: ClipboardEvent,
    editor: Editor,
    info: MarkdownFileInfo,
  ): void => {
    if (evt.defaultPrevented) {
      return;
    }

    const images = extractClipboardImages(evt.clipboardData);
    if (images.length === 0) {
      return;
    }

    const noteFile = info.file;
    if (!noteFile) {
      new Notice(t('features.attachments.notice.noActiveNote'));
      return;
    }

    if (busy) {
      evt.preventDefault();
      new Notice(t('features.attachments.notice.busy'));
      return;
    }

    evt.preventDefault();
    busy = true;

    const deps: PasteFlowDeps = {
      ...makeDeps(),
      promptName: (request: NamePromptRequest) =>
        promptRename(ctx.app, request, ctx.signal),
    };

    void handlePastedImages(deps, editor, noteFile, images)
      .catch((error: unknown) => {
        ctx.logger.error('paste flow failed', error);
      })
      .finally(() => {
        busy = false;
      });
  };

  ctx.registerEvent(ctx.app.workspace.on('editor-paste', handlePaste));

  ctx.addCommand({
    id: 'upload',
    name: t('features.attachments.command.upload'),
    checkCallback: (checking: boolean) => {
      const view = ctx.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.file || !view.editor || view.getMode() !== 'source') {
        return false;
      }

      if (checking) {
        return true;
      }

      if (busy) {
        new Notice(t('features.attachments.notice.busy'));
        return true;
      }

      busy = true;
      void uploadFiles(makeDeps(), view)
        .catch((error: unknown) => {
          ctx.logger.error('upload flow failed', error);
          new Notice(
            t('features.attachments.notice.uploadFailed', {
              message: error instanceof Error ? error.message : String(error),
            }),
          );
        })
        .finally(() => {
          busy = false;
        });

      return true;
    },
  });
}
