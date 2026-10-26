import { describe, expect, it, vi } from 'vitest';
import type {
  App,
  SettingDefinitionGroup,
  SettingDefinitionItem,
  SettingGroupItem,
} from 'obsidian';
import type { FeatureDefinition } from '../../src/core/feature';
import { FeatureManager } from '../../src/core/feature-manager';
import { SettingsStore } from '../../src/core/settings-store';
import { buildSettingDefinitions } from '../../src/settings/definitions';
import { FakeHost } from '../helpers/fake-host';

type TestOptions = {
  text: string;
  flag: boolean;
};

const feature: FeatureDefinition<TestOptions> = {
  id: 'test',
  name: 'Test',
  description: 'Test feature',
  defaultEnabled: false,
  defaultOptions: { text: 'value', flag: false },
  settings: [
    { name: 'Text', control: { type: 'text', key: 'text' } },
    { name: 'Flag', control: { type: 'toggle', key: 'flag' } },
  ],
  setup() {
    // no-op
  },
};

function visibleValue(
  value: boolean | (() => boolean) | undefined,
): boolean | undefined {
  return typeof value === 'function' ? value() : value;
}

function controlKey(item: SettingGroupItem): string | undefined {
  return 'control' in item ? item.control?.key : undefined;
}

function isGroup(
  item: SettingDefinitionItem,
  heading: string,
): item is SettingDefinitionGroup {
  return 'type' in item && item.type === 'group' && item.heading === heading;
}

describe('buildSettingDefinitions', () => {
  it('creates a general group and one group per feature', async () => {
    const host = new FakeHost({} as App);
    const registered = feature as unknown as FeatureDefinition;
    const store = await SettingsStore.load(host, [registered]);
    const manager = new FeatureManager(host, [registered], store);

    const items = buildSettingDefinitions({
      app: {} as App,
      features: [registered],
      manager,
      refresh: vi.fn(),
    });

    const general = items.find((item) => isGroup(item, 'General'));
    const group = items.find((item) => isGroup(item, 'Test'));

    expect(general).toBeDefined();
    expect(group).toBeDefined();
    expect(controlKey(group?.items?.[0] as SettingGroupItem)).toBe(
      'test.$enabled',
    );
  });

  it('hides feature settings while the feature is disabled and shows them after enabling', async () => {
    const host = new FakeHost({} as App);
    const registered = feature as unknown as FeatureDefinition;
    const store = await SettingsStore.load(host, [registered]);
    const manager = new FeatureManager(host, [registered], store);

    const build = () =>
      buildSettingDefinitions({
        app: {} as App,
        features: [registered],
        manager,
        refresh: vi.fn(),
      });

    const disabledGroup = build().find((item) => isGroup(item, 'Test'));
    const disabledText = disabledGroup?.items?.find(
      (item) => controlKey(item) === 'test.text',
    );
    expect(visibleValue(disabledText?.visible)).toBe(false);

    await manager.setEnabled('test', true);

    const enabledGroup = build().find((item) => isGroup(item, 'Test'));
    const enabledText = enabledGroup?.items?.find(
      (item) => controlKey(item) === 'test.text',
    );
    expect(visibleValue(enabledText?.visible)).toBe(true);
  });
});
