import { describe, expect, it, vi } from 'vitest';
import { Notice } from 'obsidian';
import type { App, Editor, TFile } from 'obsidian';
import type { Logger } from '../../../src/core/logger';
import {
  handlePastedImages,
  type PasteFlowDeps,
} from '../../../src/features/attachments/flow';
import { DEFAULT_ATTACHMENT_OPTIONS } from '../../../src/features/attachments/options';
import type {
  ClipboardImage,
  NamePromptRequest,
} from '../../../src/features/attachments/types';
import { createFakeApp } from '../../helpers/fake-app';

function noticeMessages(): string[] {
  return (Notice as unknown as { messages: string[] }).messages;
}

const logger = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

function noteFile(path = 'dir/dirb/note.md'): TFile {
  return { path } as TFile;
}

function editor(cursor = { line: 0, ch: 0 }): Editor {
  return {
    getCursor: () => cursor,
    posToOffset: () => 0,
    offsetToPos: () => cursor,
    replaceRange: vi.fn(),
    setSelection: vi.fn(),
    setCursor: vi.fn(),
    replaceSelection: vi.fn(),
    focus: vi.fn(),
  } as unknown as Editor;
}

function image(name = 'image.png'): ClipboardImage {
  return {
    mime: 'image/png',
    fileName: name,
    read: () => Promise.resolve(new ArrayBuffer(4)),
  };
}

function makeDeps(
  promptName: (request: NamePromptRequest) => Promise<string | null>,
  overrides: Partial<PasteFlowDeps> = {},
): PasteFlowDeps {
  return {
    app: createFakeApp().app,
    logger,
    isEnabled: () => true,
    signal: new AbortController().signal,
    options: { ...DEFAULT_ATTACHMENT_OPTIONS },
    promptName,
    ...overrides,
  };
}

describe('handlePastedImages', () => {
  it('saves an image under the note directory and inserts an embed', async () => {
    const { app, vault } = createFakeApp();
    const targetEditor = editor();
    const deps = makeDeps(async () => 'diagram', { app });

    await handlePastedImages(
      deps,
      targetEditor,
      noteFile(),
      [image()],
    );

    expect(vault.folders.has('assets/dir/dirb')).toBe(true);
    expect(vault.files.has('assets/dir/dirb/diagram.png')).toBe(true);
    expect(targetEditor.setSelection).toHaveBeenCalledWith(
      { line: 0, ch: 0 },
      { line: 0, ch: 0 },
    );
    expect(targetEditor.replaceSelection).toHaveBeenCalledWith(
      '![[assets/dir/dirb/diagram.png]]',
    );
  });

  it('uses a millisecond timestamp as the default paste suffix', async () => {
    const { app } = createFakeApp();
    let request: NamePromptRequest | undefined;
    const deps = makeDeps(
      async (value) => {
        request = value;
        return 'diagram';
      },
      { app },
    );

    await handlePastedImages(deps, editor(), noteFile(), [image()]);

    expect(request?.defaultBaseName).toMatch(/^note-\d{13}$/);
  });

  it('does not save anything when the user cancels', async () => {
    const { app, vault } = createFakeApp();
    const targetEditor = editor();
    const deps = makeDeps(async () => null, { app });
    noticeMessages().length = 0;

    await handlePastedImages(deps, targetEditor, noteFile(), [image()]);

    expect(vault.files.size).toBe(0);
    expect(vault.folders.size).toBe(0);
    expect(targetEditor.replaceSelection).not.toHaveBeenCalled();
    expect(noticeMessages()).toContain(
      'Attachment paste cancelled.',
    );
  });

  it('prompts for each image and inserts one link per line', async () => {
    const { app, vault } = createFakeApp();
    const targetEditor = editor();
    const names = ['one', 'two'];
    let index = 0;
    const deps = makeDeps(async () => names[index++] ?? null, { app });

    await handlePastedImages(
      deps,
      targetEditor,
      noteFile(),
      [image('one.png'), image('two.png')],
    );

    expect(vault.files.has('assets/dir/dirb/one.png')).toBe(true);
    expect(vault.files.has('assets/dir/dirb/two.png')).toBe(true);
    expect(targetEditor.setSelection).toHaveBeenCalledWith(
      { line: 0, ch: 0 },
      { line: 0, ch: 0 },
    );
    expect(targetEditor.replaceSelection).toHaveBeenCalledWith(
      '![[assets/dir/dirb/one.png]]\n![[assets/dir/dirb/two.png]]',
    );
  });

  it('does not save when the feature is disabled', async () => {
    const { app, vault } = createFakeApp();
    const targetEditor = editor();
    const deps = makeDeps(async () => 'diagram', {
      app,
      isEnabled: () => false,
    });

    await handlePastedImages(deps, targetEditor, noteFile(), [image()]);

    expect(vault.files.size).toBe(0);
    expect(targetEditor.replaceSelection).not.toHaveBeenCalled();
  });
});
