import { t } from '../../i18n';

export interface BaseNameValidationOptions {
  reserved: ReadonlySet<string>;
  exists: (baseName: string) => boolean;
}

const INVALID_CHARS = /[\\/:*?"<>|]/;
const RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    if ((char.codePointAt(0) ?? 0) < 32) {
      return true;
    }
  }
  return false;
}

export function validateAttachmentBaseName(
  name: string,
  options: BaseNameValidationOptions,
): string | null {
  const trimmed = name.trim();

  if (!trimmed) {
    return t('features.attachments.rename.errorEmpty');
  }

  if (trimmed === '.' || trimmed === '..') {
    return t('features.attachments.rename.errorInvalid');
  }

  if (/[\\/]/.test(trimmed)) {
    return t('features.attachments.rename.errorSeparator');
  }

  if (INVALID_CHARS.test(trimmed) || hasControlCharacters(trimmed)) {
    return t('features.attachments.rename.errorInvalid');
  }

  if (/^[. ]|[. ]$/.test(trimmed)) {
    return t('features.attachments.rename.errorInvalid');
  }

  if (trimmed.length > 100) {
    return t('features.attachments.rename.errorTooLong');
  }

  if (RESERVED_NAMES.has(trimmed.toUpperCase())) {
    return t('features.attachments.rename.errorReserved');
  }

  if (options.reserved.has(trimmed)) {
    return t('features.attachments.rename.errorDuplicate');
  }

  if (options.exists(trimmed)) {
    return t('features.attachments.rename.errorExists');
  }

  return null;
}
