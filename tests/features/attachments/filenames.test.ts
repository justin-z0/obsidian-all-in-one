import { describe, expect, it } from 'vitest';
import {
  extensionForUpload,
  extensionFromMime,
  finalFileName,
  inferImageExtension,
  millisecondTimestamp,
  noteBaseName,
  randomSuffix,
  renderFilename,
  sanitizeGeneratedName,
  validateFilenamePattern,
} from '../../../src/features/attachments/filenames';

describe('attachment filenames', () => {
  it('renders pattern tokens', () => {
    expect(
      renderFilename('{note}-{suffix}-{timestamp}', {
        note: 'note',
        suffix: 'abc123',
        timestamp: '20260101-120000',
      }),
    ).toBe('note-abc123-20260101-120000');
  });

  it('sanitizes generated names and note names', () => {
    expect(sanitizeGeneratedName('my note:test')).toBe('my-note-test');
    expect(sanitizeGeneratedName('  ..hello..  ')).toBe('hello');
    expect(sanitizeGeneratedName('')).toBe('attachment');
    expect(noteBaseName('dir/dirb/My Note.md')).toBe('My-Note');
  });

  it('infers extensions from MIME types and names', () => {
    expect(extensionFromMime('image/jpeg')).toBe('jpg');
    expect(extensionFromMime('image/svg+xml')).toBe('svg');
    expect(inferImageExtension('', 'photo.webp')).toBe('webp');
    expect(inferImageExtension('image/unknown')).toBe('unknown');
    expect(extensionForUpload('report.pdf', 'application/pdf')).toBe('pdf');
    expect(extensionForUpload('no-extension', 'image/png')).toBe('png');
  });

  it('appends extensions without duplicating them', () => {
    expect(finalFileName('diagram', 'png')).toBe('diagram.png');
    expect(finalFileName('diagram.png', 'png')).toBe('diagram.png');
    expect(finalFileName('diagram', '')).toBe('diagram');
  });

  it('generates a millisecond timestamp', () => {
    expect(millisecondTimestamp()).toMatch(/^\d{13}$/);
  });

  it('generates short random suffixes for collision fallbacks', () => {
    const suffix = randomSuffix();
    expect(suffix).toHaveLength(6);
    expect(suffix).toMatch(/^[a-z0-9]+$/);
  });

  it('validates filename patterns', () => {
    expect(validateFilenamePattern('{note}-{suffix}')).toBeUndefined();
    expect(validateFilenamePattern('{suffix}')).toBeUndefined();
    expect(typeof validateFilenamePattern('{unknown}')).toBe('string');
    expect(typeof validateFilenamePattern('a/b')).toBe('string');
    expect(typeof validateFilenamePattern('')).toBe('string');
    expect(typeof validateFilenamePattern('---')).toBe('string');
  });
});
