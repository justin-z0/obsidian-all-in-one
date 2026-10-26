import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { t } from '../src/i18n';
import { zh } from '../src/i18n/zh';

describe('i18n', () => {
  it('keeps English and Chinese key sets in sync', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('interpolates variables', () => {
    expect(t('settings.feature.resetConfirm', { name: 'Test' })).toContain(
      'Test',
    );
  });
});
