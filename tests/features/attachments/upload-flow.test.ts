import { describe, expect, it, vi } from 'vitest';
import type { App, Editor, TFile } from 'obsidian';
import type { Logger } from '../../../src/core/logger';
import {
  handleUploadedFiles,
  type BaseFlowDeps,
} from '../../../src/features/attachments/flow';
import { DEFAULT_ATTACHMENT_OPTIONS } from '../../../src/features/attachments/options';
import type { UploadedFile } from '../../../src/features/attachments/types';
import { createFakeApp } from '../../helpers/fake-app';

const logger = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

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

function noteFile(): TFile {
  return { path: 'dir/dirb/note.md' } as TFile;
}

function deps(app: App, overrides: Partial<BaseFlowDeps> = {}): BaseFlowDeps {
  return {
    app,
    logger,
    isEnabled: () => true,
    signal: new AbortController().signal,
    options: { ...DEFAULT_ATTACHMENT_OPTIONS },
    ...overrides,
  };
}

function uploadFile(name: string, mime: string): UploadedFile {
  return {
    name,
    mime,
    read: () => Promise.resolve(new ArrayBuffer(4)),
  };
}

describe('handleUploadedFiles', () => {
  it('preserves the original name in the suffix and links non-images', async () => {
    const { app, vault } = createFakeApp();
    const targetEditor = editor();

    await handleUploadedFiles(
      deps(app),
      targetEditor,
      noteFile(),
      [uploadFile('report.pdf', 'application/pdf')],
    );

    expect(vault.files.has('assets/dir/dirb/report.pdf')).toBe(true);
    expect(targetEditor.replaceSelection).toHaveBeenCalledWith(
      '[[assets/dir/dirb/report.pdf]]',
    );
  });

  it('embeds uploaded images and keeps the original name by default', async () => {
    const { app, vault } = createFakeApp();
    const targetEditor = editor();
    await handleUploadedFiles(
      deps(app),
      targetEditor,
      noteFile(),
      [uploadFile('photo.png', 'image/png')],
    );

    expect(vault.files.has('assets/dir/dirb/photo.png')).toBe(true);
    expect(targetEditor.replaceSelection).toHaveBeenCalledWith(
      '![[assets/dir/dirb/photo.png]]',
    );
  });

  it('adds a numeric suffix when the target name already exists', async () => {
    const { app, vault } = createFakeApp();
    vault.folders.add('assets');
    vault.folders.add('assets/dir');
    vault.folders.add('assets/dir/dirb');
    vault.files.set('assets/dir/dirb/photo.png', {
      path: 'assets/dir/dirb/photo.png',
    });

    await handleUploadedFiles(
      deps(app, {
        options: { ...DEFAULT_ATTACHMENT_OPTIONS },
      }),
      editor(),
      noteFile(),
      [uploadFile('photo.png', 'image/png')],
    );

    expect(vault.files.has('assets/dir/dirb/photo-1.png')).toBe(true);
  });

  it('inserts at the cursor position captured before the file picker', async () => {
    const { app, vault } = createFakeApp();
    const targetEditor = editor();
    const target = {
      from: { line: 4, ch: 0 },
      to: { line: 4, ch: 0 },
    };

    await handleUploadedFiles(
      deps(app),
      targetEditor,
      noteFile(),
      [uploadFile('report.pdf', 'application/pdf')],
      target,
    );

    expect(vault.files.has('assets/dir/dirb/report.pdf')).toBe(true);
    expect(targetEditor.setSelection).toHaveBeenCalledWith(
      target.from,
      target.to,
    );
    expect(targetEditor.replaceSelection).toHaveBeenCalledWith(
      '[[assets/dir/dirb/report.pdf]]',
    );
  });

  it('does not override the selection for non-line-start targets', async () => {
    const { app } = createFakeApp();
    const targetEditor = editor({ line: 2, ch: 5 });
    const target = {
      from: { line: 2, ch: 5 },
      to: { line: 2, ch: 5 },
    };

    await handleUploadedFiles(
      deps(app),
      targetEditor,
      noteFile(),
      [uploadFile('report.pdf', 'application/pdf')],
      target,
    );

    expect(targetEditor.setSelection).not.toHaveBeenCalled();
    expect(targetEditor.replaceSelection).toHaveBeenCalledWith(
      '[[assets/dir/dirb/report.pdf]]',
    );
  });
});
