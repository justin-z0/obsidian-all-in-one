import { describe, expect, it } from 'vitest';
import {
  computeTargetDir,
  createUniqueBinary,
  ensureFolder,
  normalizeAssetsRoot,
} from '../../../src/features/attachments/paths';
import { createFakeApp } from '../../helpers/fake-app';

describe('attachment paths', () => {
  it('normalizes the assets root', () => {
    expect(normalizeAssetsRoot('assets')).toBe('assets');
    expect(normalizeAssetsRoot('/assets/')).toBe('assets');
    expect(normalizeAssetsRoot('assets\\images')).toBe('assets/images');
    expect(() => normalizeAssetsRoot('')).toThrow();
    expect(() => normalizeAssetsRoot('../assets')).toThrow();
    expect(() => normalizeAssetsRoot('C:/assets')).toThrow();
    expect(() => normalizeAssetsRoot('//server/assets')).toThrow();
  });

  it('preserves the note directory under the assets root', () => {
    expect(computeTargetDir('dir/dirb/note.md', 'assets')).toBe(
      'assets/dir/dirb',
    );
    expect(computeTargetDir('note.md', 'assets')).toBe('assets');
    expect(computeTargetDir('dir/note.md', '/assets/')).toBe('assets/dir');
  });

  it('creates every missing folder', async () => {
    const { app, vault } = createFakeApp();

    await ensureFolder(app, 'assets/dir/dirb');

    expect(vault.folders.has('assets')).toBe(true);
    expect(vault.folders.has('assets/dir')).toBe(true);
    expect(vault.folders.has('assets/dir/dirb')).toBe(true);
  });

  it('rejects a file where a folder is required', async () => {
    const { app, vault } = createFakeApp();
    vault.files.set('assets', { path: 'assets' });

    await expect(ensureFolder(app, 'assets/dir')).rejects.toThrow();
  });

  it('creates a unique binary path', async () => {
    const { app, vault } = createFakeApp();

    await ensureFolder(app, 'assets');
    await createUniqueBinary(app, 'assets', 'note', 'png', new ArrayBuffer(1));
    await createUniqueBinary(app, 'assets', 'note', 'png', new ArrayBuffer(1));

    expect(vault.files.has('assets/note.png')).toBe(true);
    expect(vault.files.has('assets/note-1.png')).toBe(true);
  });

  it('does not duplicate an extension already present in the base name', async () => {
    const { app, vault } = createFakeApp();

    await ensureFolder(app, 'assets');
    await createUniqueBinary(app, 'assets', 'note.png', 'png', new ArrayBuffer(1));

    expect(vault.files.has('assets/note.png')).toBe(true);
    expect(vault.files.has('assets/note.png.png')).toBe(false);
  });
});
