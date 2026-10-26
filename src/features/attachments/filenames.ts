import { t } from '../../i18n';

const TOKEN_PATTERN = /\{(note|suffix|timestamp)\}/g;
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;
const MAX_BASE_NAME_LENGTH = 100;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/tiff': 'tiff',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'avif',
  'tiff',
  'tif',
  'heic',
  'heif',
]);

export interface FilenameValues {
  note: string;
  suffix: string;
  timestamp: string;
}

export function baseNameOf(pathOrName: string): string {
  const basename = pathOrName.split('/').pop() ?? pathOrName;
  const dot = basename.lastIndexOf('.');
  return dot > 0 ? basename.slice(0, dot) : basename;
}

export function extensionOf(pathOrName: string): string {
  const basename = pathOrName.split('/').pop() ?? pathOrName;
  const dot = basename.lastIndexOf('.');
  if (dot <= 0 || dot === basename.length - 1) {
    return '';
  }
  return sanitizeExtension(basename.slice(dot + 1));
}

export function sanitizeExtension(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);
}

function stripControlCharacters(value: string): string {
  let result = '';
  for (const char of value) {
    result += (char.codePointAt(0) ?? 0) < 32 ? '-' : char;
  }
  return result;
}

export function sanitizeGeneratedName(value: string): string {
  const sanitized = stripControlCharacters(value)
    .normalize('NFC')
    .replace(INVALID_FILENAME_CHARS, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, MAX_BASE_NAME_LENGTH);

  return sanitized.length > 0 ? sanitized : 'attachment';
}

export function noteBaseName(notePath: string): string {
  return sanitizeGeneratedName(baseNameOf(notePath));
}

export function renderFilename(
  pattern: string,
  values: FilenameValues,
): string {
  return pattern.replace(TOKEN_PATTERN, (_match, token: string) => {
    switch (token) {
      case 'note':
        return values.note;
      case 'suffix':
        return values.suffix;
      case 'timestamp':
        return values.timestamp;
      default:
        return `{${token}}`;
    }
  });
}

export function millisecondTimestamp(): string {
  return Date.now().toString();
}

export function randomSuffix(length = 6): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  let result = '';
  for (const byte of bytes) {
    result += alphabet.charAt(byte % alphabet.length);
  }
  return result;
}

export function timestampSuffix(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

export function extensionFromMime(mime: string): string {
  const normalized = mime.toLowerCase();
  const mapped = MIME_EXTENSION_MAP[normalized];
  if (mapped) {
    return mapped;
  }

  if (normalized.startsWith('image/')) {
    const subtype = normalized.slice('image/'.length).split('+')[0] ?? '';
    return sanitizeExtension(subtype) || 'png';
  }

  return '';
}

export function inferImageExtension(mime: string, fileName = ''): string {
  return extensionFromMime(mime) || extensionOf(fileName) || 'png';
}

export function extensionForUpload(fileName: string, mime: string): string {
  return extensionOf(fileName) || extensionFromMime(mime);
}

export function isImageFile(fileName: string, mime: string): boolean {
  return mime.toLowerCase().startsWith('image/') ||
    IMAGE_EXTENSIONS.has(extensionOf(fileName));
}

export function stripMatchingExtension(baseName: string, extension: string): string {
  if (!extension) {
    return baseName;
  }

  const suffix = `.${extension.toLowerCase()}`;
  return baseName.toLowerCase().endsWith(suffix)
    ? baseName.slice(0, -suffix.length)
    : baseName;
}

export function finalFileName(baseName: string, extension: string): string {
  const base = stripMatchingExtension(baseName, extension);
  return extension ? `${base}.${extension}` : base;
}

export function validateFilenamePattern(value: string): string | void {
  const pattern = value.trim();

  if (!pattern) {
    return t('features.attachments.validation.patternEmpty');
  }

  if (/[\\/]/.test(pattern)) {
    return t('features.attachments.validation.patternSeparator');
  }

  const stripped = pattern.replace(TOKEN_PATTERN, '');
  if (stripped.includes('{') || stripped.includes('}')) {
    return t('features.attachments.validation.patternToken');
  }

  const rendered = renderFilename(pattern, {
    note: 'note',
    suffix: 'abc123',
    timestamp: '20260101-000000',
  }).trim();

  if (rendered.replace(/[.\s-]/g, '') === '') {
    return t('features.attachments.validation.patternInvalid');
  }

  return;
}

export { IMAGE_EXTENSIONS };
