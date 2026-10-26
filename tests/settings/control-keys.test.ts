import { describe, expect, it } from 'vitest';
import {
  enabledControlKey,
  globalControlKey,
  optionControlKey,
  parseControlKey,
} from '../../src/settings/control-keys';

describe('control keys', () => {
  it('builds keys', () => {
    expect(globalControlKey('debug')).toBe('global.debug');
    expect(enabledControlKey('attachments')).toBe('attachments.$enabled');
    expect(optionControlKey('attachments', 'assetsRoot')).toBe(
      'attachments.assetsRoot',
    );
  });

  it('parses global, enabled, and option keys', () => {
    expect(parseControlKey('global.debug')).toEqual({
      kind: 'global',
      key: 'debug',
    });
    expect(parseControlKey('attachments.$enabled')).toEqual({
      kind: 'enabled',
      featureId: 'attachments',
    });
    expect(parseControlKey('attachments.assetsRoot')).toEqual({
      kind: 'option',
      featureId: 'attachments',
      key: 'assetsRoot',
    });
  });

  it('rejects malformed keys', () => {
    expect(() => parseControlKey('invalid')).toThrow();
    expect(() => parseControlKey('global.')).toThrow();
    expect(() => parseControlKey('.enabled')).toThrow();
  });
});
