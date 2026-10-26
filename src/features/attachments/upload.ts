import { Notice } from 'obsidian';
import type { Editor, MarkdownView } from 'obsidian';
import { t } from '../../i18n';
import {
  captureInsertTarget,
  handleUploadedFiles,
  type BaseFlowDeps,
} from './flow';
import type { UploadedFile } from './types';

export async function uploadFiles(
  deps: BaseFlowDeps,
  view: MarkdownView,
): Promise<void> {
  const initialEditor = view.editor;
  const initialFile = view.file;
  // The file picker steals focus and may reset the editor selection, so
  // remember the insertion point before opening it when possible. Never let
  // this optional capture prevent the picker itself from opening.
  const target = initialEditor
    ? safeCapture(initialEditor, deps)
    : undefined;

  deps.logger.debug('opening the attachment file picker');
  const files = await pickFiles(deps.signal);

  if (files.length === 0) {
    if (!deps.signal.aborted && deps.isEnabled()) {
      new Notice(t('features.attachments.notice.noFiles'));
    }
    return;
  }

  deps.logger.debug(`selected ${files.length} attachment file(s)`);

  if (deps.signal.aborted || !deps.isEnabled()) {
    return;
  }

  const editor = view.editor ?? initialEditor;
  const noteFile = view.file ?? initialFile;

  if (!editor || !noteFile) {
    new Notice(t('features.attachments.notice.noActiveEditor'));
    return;
  }

  const uploaded: UploadedFile[] = files.map((file) => ({
    name: file.name,
    mime: file.type,
    read: () => file.arrayBuffer(),
  }));

  await handleUploadedFiles(
    deps,
    editor,
    noteFile,
    uploaded,
    editor === initialEditor ? target : undefined,
  );
}

function safeCapture(
  editor: Editor,
  deps: BaseFlowDeps,
): ReturnType<typeof captureInsertTarget> | undefined {
  try {
    return captureInsertTarget(editor);
  } catch (error) {
    deps.logger.warn('failed to capture the editor selection', error);
    return undefined;
  }
}

function pickFiles(signal: AbortSignal): Promise<File[]> {
  if (signal.aborted) {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const input = activeDocument.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.addClass('aio-hidden-input');

    let settled = false;
    let timeoutId: number | null = null;
    let pollId: number | null = null;

    let onAbort: () => void = () => undefined;
    let onChange: () => void = () => undefined;
    let onCancel: () => void = () => undefined;

    const finish = (files: File[]): void => {
      if (settled) {
        return;
      }
      settled = true;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (pollId !== null) {
        window.clearInterval(pollId);
        pollId = null;
      }

      signal.removeEventListener('abort', onAbort);

      input.remove();
      resolve(files);
    };

    onChange = () => {
      const selected = input.files;
      if (selected && selected.length > 0) {
        finish(Array.from(selected));
      }
    };
    onCancel = () => finish([]);
    onAbort = () => finish([]);
    input.addEventListener('change', onChange, { once: true });
    input.addEventListener(
      'cancel' as keyof HTMLElementEventMap,
      onCancel,
      { once: true },
    );
    signal.addEventListener('abort', onAbort, { once: true });

    timeoutId = window.setTimeout(() => finish([]), 60_000);

    activeDocument.body.appendChild(input);

    try {
      input.click();
    } catch {
      finish([]);
      return;
    }

    // Electron may populate input.files without firing change (and the window
    // may never emit focus/blur around the native dialog). Poll the input as a
    // fallback; empty values are not treated as cancellation.
    pollId = window.setInterval(() => {
      const selected = input.files;
      if (selected && selected.length > 0) {
        finish(Array.from(selected));
      }
    }, 100);
  });
}
