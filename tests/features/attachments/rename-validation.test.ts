import { describe, expect, it } from 'vitest';
import { validateAttachmentBaseName } from '../../../src/features/attachments/rename-validation';

const options = {
  reserved: new Set<string>(),
  exists: () => false,
};

describe('validateAttachmentBaseName', () => {
  it('accepts a normal name', () => {
    expect(validateAttachmentBaseName('diagram', options)).toBeNull();
    expect(validateAttachmentBaseName('My Diagram v2', options)).toBeNull();
  });

  it('rejects empty names, separators, and invalid characters', () => {
    expect(typeof validateAttachmentBaseName('', options)).toBe('string');
    expect(typeof validateAttachmentBaseName('a/b', options)).toBe('string');
    expect(typeof validateAttachmentBaseName('a\\b', options)).toBe('string');
    expect(typeof validateAttachmentBaseName('a:b', options)).toBe('string');
    expect(typeof validateAttachmentBaseName('a\u0001b', options)).toBe(
      'string',
    );
    expect(typeof validateAttachmentBaseName('.hidden', options)).toBe(
      'string',
    );
  });

  it('rejects reserved names', () => {
    expect(typeof validateAttachmentBaseName('CON', options)).toBe('string');
    expect(typeof validateAttachmentBaseName('com1', options)).toBe('string');
  });

  it('rejects duplicate and existing names', () => {
    expect(
      typeof validateAttachmentBaseName('diagram', {
        reserved: new Set(['diagram']),
        exists: () => false,
      }),
    ).toBe('string');

    expect(
      typeof validateAttachmentBaseName('diagram', {
        reserved: new Set(),
        exists: () => true,
      }),
    ).toBe('string');
  });
});
