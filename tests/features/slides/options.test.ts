import { describe, expect, it } from 'vitest';
import { isControlSetting } from '../../../src/core/feature';
import {
  DEFAULT_SLIDES_OPTIONS,
  slidesSettings,
  validateBreadcrumbSeparator,
} from '../../../src/features/slides/options';

describe('slides options', () => {
  it('provides a default for every setting key', () => {
    const keys = slidesSettings
      .filter(isControlSetting)
      .map((setting) => setting.control.key)
      .sort();

    expect(Object.keys(DEFAULT_SLIDES_OPTIONS).sort()).toEqual(keys);
  });

  it('uses the defaults expected by the presentation', () => {
    expect(DEFAULT_SLIDES_OPTIONS).toEqual({
      showBreadcrumb: false,
      breadcrumbSeparator: '-',
      showPageNumber: true,
      showProgress: true,
      autoFit: true,
      colorScheme: 'vault',
      transition: 'fade',
    });
  });

  it('accepts short separators', () => {
    expect(validateBreadcrumbSeparator('-')).toBeUndefined();
    expect(validateBreadcrumbSeparator(' - ')).toBeUndefined();
    expect(validateBreadcrumbSeparator('›')).toBeUndefined();
  });

  it('rejects empty or overly long separators', () => {
    expect(validateBreadcrumbSeparator('')).toBe(
      'The header separator cannot be empty.',
    );
    expect(validateBreadcrumbSeparator('   ')).toBe(
      'The header separator cannot be empty.',
    );
    expect(validateBreadcrumbSeparator('----')).toBe(
      'The header separator can be at most 3 characters.',
    );
  });
});
