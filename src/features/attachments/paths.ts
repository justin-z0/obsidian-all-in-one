import type { App, TFile } from 'obsidian';
import { t } from '../../i18n';
import { randomSuffix, stripMatchingExtension } from './filenames';

export function joinVaultPath(...parts: string[]): string {
  const segments = parts
    .flatMap((part) => part.split('/'))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  return segments.join('/');
}

export function normalizeAssetsRoot(input: string): string {
  const raw = input.trim().replace(/\\/g, '/');

  if (/^[a-zA-Z]:/.test(raw) || raw.startsWith('//')) {
    throw new Error(t('features.attachments.validation.assetsRootAbsolute'));
  }

  const normalized = raw.replace(/^\/+|\/+$/g, '');

  if (!normalized) {
    throw new Error(t('features.attachments.validation.assetsRootEmpty'));
  }

  const segments = normalized.split('/');
  if (
    segments.some(
      (segment) => !segment || segment === '.' || segment === '..',
    )
  ) {
    throw new Error(t('features.attachments.validation.assetsRootInvalid'));
  }

  return segments.join('/');
}

export function computeTargetDir(
  notePath: string,
  assetsRoot: string,
): string {
  const root = normalizeAssetsRoot(assetsRoot);
  const noteDir = notePath
    .split('/')
    .slice(0, -1)
    .filter((segment) => segment.length > 0)
    .join('/');

  return joinVaultPath(root, noteDir);
}

export async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const normalized = joinVaultPath(folderPath);
  if (!normalized) {
    return;
  }

  let current = '';
  for (const segment of normalized.split('/')) {
    current = joinVaultPath(current, segment);

    const existing = app.vault.getAbstractFileByPath(current);
    if (existing) {
      if (!app.vault.getFolderByPath(current)) {
        throw new Error(`Path exists but is not a folder: ${current}`);
      }
      continue;
    }

    try {
      await app.vault.createFolder(current);
    } catch (error) {
      if (!app.vault.getFolderByPath(current)) {
        throw error;
      }
    }
  }
}

export async function createUniqueBinary(
  app: App,
  folderPath: string,
  baseName: string,
  extension: string,
  data: ArrayBuffer,
): Promise<TFile> {
  const folder = joinVaultPath(folderPath);
  const extensionPart = extension ? `.${extension}` : '';
  const normalizedBase = stripMatchingExtension(baseName, extension);

  for (let index = 0; index < 50; index += 1) {
    const candidateBase = index === 0 ? normalizedBase : `${normalizedBase}-${index}`;
    const path = joinVaultPath(folder, `${candidateBase}${extensionPart}`);

    if (app.vault.getAbstractFileByPath(path)) {
      continue;
    }

    try {
      return await app.vault.createBinary(path, data);
    } catch (error) {
      if (app.vault.getAbstractFileByPath(path)) {
        continue;
      }
      throw error;
    }
  }

  const fallbackBase = `${normalizedBase}-${randomSuffix()}`;
  return app.vault.createBinary(
    joinVaultPath(folder, `${fallbackBase}${extensionPart}`),
    data,
  );
}
