import { describe, expect, it } from 'vitest';
import type { FeatureDefinition } from '../../src/core/feature';
import { validateFeatures } from '../../src/core/registry';

function feature(
  overrides: Partial<FeatureDefinition> = {},
): FeatureDefinition {
  return {
    id: 'test',
    name: 'Test',
    description: 'Test feature',
    defaultEnabled: false,
    defaultOptions: { text: 'value' },
    settings: [
      {
        name: 'Text',
        control: { type: 'text', key: 'text' },
      },
    ],
    setup() {
      // no-op
    },
    ...overrides,
  };
}

describe('validateFeatures', () => {
  it('accepts a valid feature', () => {
    const result = validateFeatures([feature()]);
    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(1);
  });

  it('rejects duplicate ids', () => {
    const result = validateFeatures([feature(), feature({ name: 'Second' })]);
    expect(result.valid).toHaveLength(1);
    expect(result.errors.join('\n')).toContain('Duplicate feature id');
  });

  it('rejects invalid ids and reserved ids', () => {
    expect(validateFeatures([feature({ id: 'Bad ID' })]).valid).toHaveLength(0);
    expect(validateFeatures([feature({ id: 'global' })]).valid).toHaveLength(0);
  });

  it('rejects a control key without a default value', () => {
    const invalid = feature({
      settings: [
        {
          name: 'Missing',
          control: { type: 'text', key: 'missing' },
        },
      ],
    });
    const result = validateFeatures([invalid]);
    expect(result.valid).toHaveLength(0);
    expect(result.errors.join('\n')).toContain('missing a default');
  });

  it('rejects reserved option keys', () => {
    const invalid = feature({
      defaultOptions: { $enabled: true },
      settings: [
        {
          name: 'Invalid',
          control: { type: 'toggle', key: '$enabled' },
        },
      ],
    });
    const result = validateFeatures([invalid]);
    expect(result.valid).toHaveLength(0);
  });
});
