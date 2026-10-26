import { beforeEach, describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import type { FeatureDefinition } from '../../src/core/feature';
import { SettingsStore } from '../../src/core/settings-store';
import { FakeHost } from '../helpers/fake-host';

type TestOptions = {
  text: string;
  mode: 'a' | 'b';
  flag: boolean;
};

const feature: FeatureDefinition<TestOptions> = {
  id: 'test',
  name: 'Test',
  description: 'Test feature',
  defaultEnabled: false,
  defaultOptions: {
    text: 'hello',
    mode: 'a',
    flag: false,
  },
  settings: [
    {
      name: 'Text',
      control: { type: 'text', key: 'text' },
    },
    {
      name: 'Mode',
      control: {
        type: 'dropdown',
        key: 'mode',
        options: { a: 'A', b: 'B' },
      },
    },
    {
      name: 'Flag',
      control: { type: 'toggle', key: 'flag' },
    },
  ],
  setup() {
    // no-op
  },
};

const registeredFeature = feature as unknown as FeatureDefinition;

function createHost(data: unknown = null): FakeHost {
  const host = new FakeHost({} as App);
  host.loadedData = data;
  return host;
}

describe('SettingsStore', () => {
  beforeEach(() => {
    // Each test creates a fresh host/store.
  });

  it('loads defaults when no data exists', async () => {
    const store = await SettingsStore.load(createHost(), [registeredFeature]);

    expect(store.global.debug).toBe(false);
    expect(store.isFeatureEnabled('test')).toBe(false);
    expect(store.getOptions<TestOptions>('test')).toEqual({
      text: 'hello',
      mode: 'a',
      flag: false,
    });
  });

  it('merges persisted values, keeps unknown keys, and preserves unknown feature blocks', async () => {
    const host = createHost({
      schemaVersion: 1,
      global: { debug: true, extra: 'kept' },
      features: {
        test: {
          enabled: true,
          options: {
            text: 'changed',
            mode: 'b',
            unknownOption: 'kept',
          },
        },
        unknownFeature: {
          enabled: true,
          options: { anything: 1 },
        },
      },
    });

    const store = await SettingsStore.load(host, [registeredFeature]);
    const options = store.getOptions<Record<string, unknown>>('test');

    expect(store.isFeatureEnabled('test')).toBe(true);
    expect(options.text).toBe('changed');
    expect(options.mode).toBe('b');
    expect(options.flag).toBe(false);
    expect(options.unknownOption).toBe('kept');

    const snapshot = store.toJSON();
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.global).toMatchObject({ debug: true, extra: 'kept' });
    expect(snapshot.features).toHaveProperty('unknownFeature');
  });

  it('falls back to defaults for invalid persisted values', async () => {
    const host = createHost({
      features: {
        test: {
          enabled: true,
          options: { text: 42, mode: 'z', flag: 'yes' },
        },
      },
    });

    const store = await SettingsStore.load(host, [registeredFeature]);

    expect(store.getOptions<TestOptions>('test')).toEqual({
      text: 'hello',
      mode: 'a',
      flag: false,
    });
  });

  it('writes valid changes and rejects unknown or invalid options', async () => {
    const host = createHost();
    const store = await SettingsStore.load(host, [registeredFeature]);

    await store.setFeatureOption('test', 'text', 'new value');
    await store.flush();

    const saved = host.saved.at(-1) as {
      features: { test: { options: TestOptions } };
    };
    expect(saved.features.test.options.text).toBe('new value');

    await expect(
      store.setFeatureOption('test', 'unknown', 'x'),
    ).rejects.toThrow();
    await expect(
      store.setFeatureOption('test', 'mode', 'invalid'),
    ).rejects.toThrow();
  });

  it('persists enabled state and resets options', async () => {
    const host = createHost();
    const store = await SettingsStore.load(host, [registeredFeature]);

    await store.setFeatureEnabled('test', true);
    await store.setFeatureOption('test', 'text', 'changed');
    await store.resetFeatureOptions('test');
    await store.flush();

    expect(store.isFeatureEnabled('test')).toBe(true);
    expect(store.getOptions<TestOptions>('test').text).toBe('hello');

    const saved = host.saved.at(-1) as {
      features: { test: { enabled: boolean; options: TestOptions } };
    };
    expect(saved.features.test.enabled).toBe(true);
    expect(saved.features.test.options.text).toBe('hello');
  });

  it('persists global settings', async () => {
    const host = createHost();
    const store = await SettingsStore.load(host, [registeredFeature]);

    await store.setGlobal('debug', true);
    await store.flush();

    expect(store.global.debug).toBe(true);
    await expect(store.setGlobal('unknown', true)).rejects.toThrow();
  });
});
