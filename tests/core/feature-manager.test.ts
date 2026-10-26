import { describe, expect, it, vi } from 'vitest';
import type { App, EventRef } from 'obsidian';
import type { FeatureDefinition } from '../../src/core/feature';
import { FeatureManager } from '../../src/core/feature-manager';
import { SettingsStore } from '../../src/core/settings-store';
import { FakeHost } from '../helpers/fake-host';

type TestOptions = { text: string };

function createFeature(overrides: Partial<FeatureDefinition<TestOptions>> = {}) {
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
  } satisfies FeatureDefinition<TestOptions>;
}

describe('FeatureManager', () => {
  it('registers resources on enable and cleans them up on disable', async () => {
    const off = vi.fn();
    const teardown = vi.fn();

    const feature = createFeature({
      setup(ctx) {
        ctx.addCommand({ id: 'run', name: 'Run' });
        ctx.registerEvent({ off } as unknown as EventRef);
      },
      teardown() {
        teardown();
      },
    });

    const host = new FakeHost({} as App);
    const definition = feature as unknown as FeatureDefinition;
    const store = await SettingsStore.load(host, [definition]);
    const manager = new FeatureManager(host, [definition], store);

    await manager.setEnabled('test', true);

    expect(manager.isEnabled('test')).toBe(true);
    expect(store.isFeatureEnabled('test')).toBe(true);
    expect(host.commands.has('test-run')).toBe(true);
    expect(off).not.toHaveBeenCalled();
    expect(teardown).not.toHaveBeenCalled();

    await manager.setEnabled('test', false);

    expect(manager.isEnabled('test')).toBe(false);
    expect(store.isFeatureEnabled('test')).toBe(false);
    expect(host.commands.has('test-run')).toBe(false);
    expect(off).toHaveBeenCalledOnce();
    expect(teardown).toHaveBeenCalledOnce();
  });

  it('rolls back when setup throws after registering a command', async () => {
    const feature = createFeature({
      id: 'bad',
      setup(ctx) {
        ctx.addCommand({ id: 'partial', name: 'Partial' });
        throw new Error('boom');
      },
    });

    const host = new FakeHost({} as App);
    const definition = feature as unknown as FeatureDefinition;
    const store = await SettingsStore.load(host, [definition]);
    const manager = new FeatureManager(host, [definition], store);

    await expect(manager.setEnabled('bad', true)).rejects.toThrow('boom');

    expect(manager.isEnabled('bad')).toBe(false);
    expect(store.isFeatureEnabled('bad')).toBe(false);
    expect(host.commands.has('bad-partial')).toBe(false);
  });

  it('serializes rapid toggles and ends in the last requested state', async () => {
    const feature = createFeature({
      setup(ctx) {
        ctx.addCommand({ id: 'run', name: 'Run' });
      },
    });

    const host = new FakeHost({} as App);
    const definition = feature as unknown as FeatureDefinition;
    const store = await SettingsStore.load(host, [definition]);
    const manager = new FeatureManager(host, [definition], store);

    await Promise.all([
      manager.setEnabled('test', true),
      manager.setEnabled('test', false),
      manager.setEnabled('test', true),
    ]);

    expect(manager.isEnabled('test')).toBe(true);
    expect(host.commands.size).toBe(1);
  });

  it('does not enable features that are disabled in settings', async () => {
    const feature = createFeature();
    const host = new FakeHost({} as App);
    host.loadedData = {
      features: { test: { enabled: false, options: {} } },
    };
    const definition = feature as unknown as FeatureDefinition;
    const store = await SettingsStore.load(host, [definition]);
    const manager = new FeatureManager(host, [definition], store);

    await manager.enableInitial();

    expect(manager.isEnabled('test')).toBe(false);
  });

  it('cleans up all features on unload', async () => {
    const feature = createFeature({
      setup(ctx) {
        ctx.addCommand({ id: 'run', name: 'Run' });
      },
    });
    const host = new FakeHost({} as App);
    const definition = feature as unknown as FeatureDefinition;
    const store = await SettingsStore.load(host, [definition]);
    const manager = new FeatureManager(host, [definition], store);

    await manager.setEnabled('test', true);
    expect(host.commands.size).toBe(1);

    manager.unloadAll();

    expect(host.commands.size).toBe(0);
    expect(manager.isEnabled('test')).toBe(false);
  });
});
