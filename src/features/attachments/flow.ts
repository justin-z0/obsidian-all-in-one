import { Notice } from 'obsidian';
import type { App, Editor, TFile } from 'obsidian';
import type { Logger } from '../../core/logger';
import { t } from '../../i18n';
import {
  baseNameOf,
  extensionForUpload,
  inferImageExtension,
  isImageFile,
  millisecondTimestamp,
  noteBaseName,
  renderFilename,
  sanitizeGeneratedName,
  timestampSuffix,
} from './filenames';
import { formatAttachmentLink } from './links';
import {
  computeTargetDir,
  createUniqueBinary,
  ensureFolder,
} from './paths';
import type {
  AttachmentOptions,
  ClipboardImage,
  InsertTarget,
  NamePromptRequest,
  PreparedAttachment,
  UploadedFile,
} from './types';

export interface BaseFlowDeps {
  app: App;
  logger: Logger;
  isEnabled: () => boolean;
  signal: AbortSignal;
  options: AttachmentOptions;
}

export interface PasteFlowDeps extends BaseFlowDeps {
  promptName: (request: NamePromptRequest) => Promise<string | null>;
}

export async function handlePastedImages(
  deps: PasteFlowDeps,
  editor: Editor,
  noteFile: TFile,
  images: readonly ClipboardImage[],
): Promise<void> {
  if (images.length === 0) {
    return;
  }

  // The rename modal steals focus; keep the target from before prompting.
  const target = safeCaptureTarget(deps, editor);
  const folder = resolveFolder(deps, noteFile);
  if (!folder) {
    return;
  }

  const note = noteBaseName(noteFile.path);
  const timestamp = timestampSuffix();
  const reserved = new Set<string>();
  const prepared: PreparedAttachment[] = [];

  for (const [index, image] of images.entries()) {
    if (deps.signal.aborted || !deps.isEnabled()) {
      return;
    }

    const extension = inferImageExtension(image.mime, image.fileName);
    const suffix = millisecondTimestamp();
    const defaultBaseName = sanitizeGeneratedName(
      renderFilename(deps.options.filenamePattern, {
        note,
        suffix,
        timestamp,
      }),
    );

    const baseName = await deps.promptName({
      folder,
      extension,
      defaultBaseName,
      reserved,
      index: index + 1,
      total: images.length,
    });

    if (baseName === null) {
      new Notice(t('features.attachments.notice.cancelled'));
      editor.focus();
      return;
    }

    if (deps.signal.aborted || !deps.isEnabled()) {
      return;
    }

    const normalizedBaseName = baseName.trim();
    if (!normalizedBaseName) {
      new Notice(t('features.attachments.rename.errorEmpty'));
      return;
    }

    reserved.add(normalizedBaseName);
    prepared.push({
      baseName: normalizedBaseName,
      extension,
      read: image.read,
      isImage: true,
    });
  }

  await saveAndInsert(deps, editor, noteFile, folder, prepared, target);
}

export async function handleUploadedFiles(
  deps: BaseFlowDeps,
  editor: Editor,
  noteFile: TFile,
  files: readonly UploadedFile[],
  target?: InsertTarget,
): Promise<void> {
  if (files.length === 0) {
    return;
  }

  const folder = resolveFolder(deps, noteFile);
  if (!folder) {
    return;
  }

  const note = noteBaseName(noteFile.path);
  const timestamp = timestampSuffix();
  const prepared: PreparedAttachment[] = files.map((file) => {
    const extension = extensionForUpload(file.name, file.mime);
    const suffix = sanitizeGeneratedName(baseNameOf(file.name) || 'file');
    const baseName = sanitizeGeneratedName(
      renderFilename(deps.options.uploadFilenamePattern, {
        note,
        suffix,
        timestamp,
      }),
    );

    return {
      baseName,
      extension,
      read: file.read,
      isImage: isImageFile(file.name, file.mime),
    };
  });

  await saveAndInsert(deps, editor, noteFile, folder, prepared, target);
}

async function saveAndInsert(
  deps: BaseFlowDeps,
  editor: Editor,
  noteFile: TFile,
  folder: string,
  prepared: readonly PreparedAttachment[],
  target: InsertTarget | undefined,
): Promise<void> {
  if (prepared.length === 0) {
    return;
  }

  try {
    await ensureFolder(deps.app, folder);
  } catch (error) {
    new Notice(
      t('features.attachments.notice.saveFailed', {
        message: errorMessage(error),
      }),
    );
    return;
  }

  const saved: Array<{ file: TFile; isImage: boolean }> = [];

  for (const item of prepared) {
    if (deps.signal.aborted || !deps.isEnabled()) {
      return;
    }

    try {
      const data = await item.read();
      const file = await createUniqueBinary(
        deps.app,
        folder,
        item.baseName,
        item.extension,
        data,
      );
      saved.push({ file, isImage: item.isImage });
    } catch (error) {
      deps.logger.error('failed to save attachment', error);
      new Notice(
        t('features.attachments.notice.saveFailed', {
          message: errorMessage(error),
        }),
      );
    }
  }

  if (saved.length === 0 || deps.signal.aborted || !deps.isEnabled()) {
    return;
  }

  const links = saved.map(({ file, isImage }) =>
    formatAttachmentLink(
      deps.app,
      file,
      noteFile.path,
      isImage,
      deps.options.embedImages,
      deps.logger,
    ),
  );

  const text = links.join('\n');

  try {
    insertAt(editor, target, text);
  } catch (error) {
    deps.logger.warn('failed to restore the insertion point; retrying at the current cursor', error);
    try {
      editor.replaceSelection(text);
      editor.focus();
    } catch (fallbackError) {
      deps.logger.error('failed to insert attachment links', fallbackError);
      new Notice(
        t('features.attachments.notice.linkFailed', {
          message: errorMessage(fallbackError),
        }),
      );
    }
  }
}

export function captureInsertTarget(editor: Editor): InsertTarget {
  return {
    from: editor.getCursor('from'),
    to: editor.getCursor('to'),
  };
}

function safeCaptureTarget(
  deps: BaseFlowDeps,
  editor: Editor,
): InsertTarget | undefined {
  try {
    return captureInsertTarget(editor);
  } catch (error) {
    deps.logger.warn('failed to capture the editor selection', error);
    return undefined;
  }
}

function insertAt(
  editor: Editor,
  target: InsertTarget | undefined,
  text: string,
): void {
  // Only restore the selection at a line start. For other positions keep the
  // proven replaceSelection path to avoid changing existing behavior.
  if (target && target.from.ch === 0) {
    editor.setSelection(target.from, target.to);
  }
  editor.replaceSelection(text);
  editor.focus();
}

function resolveFolder(
  deps: BaseFlowDeps,
  noteFile: TFile,
): string | null {
  try {
    return computeTargetDir(noteFile.path, deps.options.assetsRoot);
  } catch (error) {
    new Notice(
      t('features.attachments.notice.invalidSettings', {
        message: errorMessage(error),
      }),
    );
    return null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
