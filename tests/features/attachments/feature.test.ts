import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import type { FeatureDefinition } from '../../../src/core/feature';
import { validateFeatures } from '../../../src/core/registry';
import { SettingsStore } from '../../../src/core/settings-store';
import { attachmentsFeature } from '../../../src/features/attachments';
import { FakeHost } from '../../helpers/fake-host';

describe('attachments feature definition', () => {
  it('passes registry validation', () => {
    const result = validateFeatures([
      attachmentsFeature as unknown as FeatureDefinition,
    ]);

    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(1);
  });

  it('loads the upload pattern default from the store', async () => {
    const host = new FakeHost({} as App);
    const store = await SettingsStore.load(host, [
      attachmentsFeature as unknown as FeatureDefinition,
    ]);

    expect(store.getOptions('attachments')).toMatchObject({
      filenamePattern: '{note}-{suffix}',
      uploadFilenamePattern: '{suffix}',
    });
  });
});
