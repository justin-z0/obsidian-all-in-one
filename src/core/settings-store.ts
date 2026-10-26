import { Notice } from 'obsidian';
import type { SettingControl } from 'obsidian';
import { isControlSetting } from './feature';
import type {
  FeatureControlSetting,
  FeatureDefinition,
  FeatureOptions,
  FeatureSetting,
} from './feature';
import type { PluginHost } from './plugin-host';
import { t } from '../i18n';
import { CURRENT_SCHEMA_VERSION, migrate, type RawData } from './migrations';
import { clone, isRecord } from './utils';

export interface GlobalSettings {
  debug: boolean;
}

export interface FeatureState {
  enabled: boolean;
  options: Record<string, unknown>;
}

export interface PluginData {
  schemaVersion: number;
  global: GlobalSettings;
  features: Record<string, FeatureState>;
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  debug: false,
};

const SAVE_DEBOUNCE_MS = 300;

type SanitizeResult =
  | { ok: true; value: unknown }
  | { ok: false };

function sanitizeControlValue(
  control: SettingControl,
  value: unknown,
): SanitizeResult {
  switch (control.type) {
    case 'toggle':
      return typeof value === 'boolean' ? { ok: true, value } : { ok: false };

    case 'text':
    case 'textarea':
    case 'file':
    case 'folder':
    case 'color':
      return typeof value === 'string' ? { ok: true, value } : { ok: false };

    case 'number':
    case 'slider':
      return typeof value === 'number' && Number.isFinite(value)
        ? { ok: true, value }
        : { ok: false };

    case 'dropdown':
      return typeof value === 'string' &&
        Object.prototype.hasOwnProperty.call(control.options, value)
        ? { ok: true, value }
        : { ok: false };

    default:
      return { ok: true, value };
  }
}

function findControlSetting(
  definition: FeatureDefinition,
  key: string,
): FeatureControlSetting | undefined {
  for (const setting of definition.settings ?? []) {
    if (isControlSetting(setting) && setting.control.key === key) {
      return setting;
    }
  }
  return undefined;
}

export class SettingsStore {
  private readonly data: PluginData;
  private readonly definitionMap: Map<string, FeatureDefinition>;
  private readonly extraFeatures: Record<string, unknown> = {};
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveChain: Promise<void> = Promise.resolve();

  private constructor(
    private readonly host: PluginHost,
    private readonly definitions: readonly FeatureDefinition[],
    definitionMap: Map<string, FeatureDefinition>,
  ) {
    this.definitionMap = definitionMap;
    this.data = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      global: { ...DEFAULT_GLOBAL_SETTINGS },
      features: {},
    };

    for (const definition of definitions) {
      this.data.features[definition.id] = {
        enabled: definition.defaultEnabled,
        options: clone(definition.defaultOptions),
      };
    }
  }

  static async load(
    host: PluginHost,
    definitions: readonly FeatureDefinition[],
  ): Promise<SettingsStore> {
    let raw: unknown = null;

    try {
      raw = await host.loadData();
    } catch (error) {
      console.error('[all-in-one:settings] failed to load data', error);
    }

    let migrated: RawData = {};
    try {
      migrated = migrate(raw);
    } catch (error) {
      console.error('[all-in-one:settings] failed to migrate data', error);
    }

    const definitionMap = new Map(
      definitions.map((definition) => [definition.id, definition]),
    );
    const store = new SettingsStore(host, definitions, definitionMap);
    store.normalize(migrated);
    return store;
  }

  get global(): Readonly<GlobalSettings> {
    return this.data.global;
  }

  isFeatureEnabled(id: string): boolean {
    return this.data.features[id]?.enabled ?? false;
  }

  getOptions<T extends FeatureOptions>(id: string): Readonly<T> {
    const state = this.data.features[id];
    return (state?.options ?? {}) as T;
  }

  async setFeatureEnabled(id: string, enabled: boolean): Promise<void> {
    const state = this.data.features[id];
    if (!state) {
      throw new Error(`Unknown feature: ${id}`);
    }
    state.enabled = enabled;
    await this.flush();
  }

  async setFeatureOption(
    id: string,
    key: string,
    value: unknown,
  ): Promise<void> {
    const definition = this.definitionMap.get(id);
    if (!definition) {
      throw new Error(`Unknown feature: ${id}`);
    }

    const setting = findControlSetting(definition, key);
    if (!setting) {
      throw new Error(`Unknown option for feature ${id}: ${key}`);
    }

    const sanitized = sanitizeControlValue(setting.control, value);
    if (!sanitized.ok) {
      throw new Error(`Invalid value for ${id}.${key}`);
    }

    const state = this.data.features[id];
    if (!state) {
      throw new Error(`Unknown feature state: ${id}`);
    }

    state.options[key] = sanitized.value;
    this.scheduleSave();
  }

  async resetFeatureOptions(id: string): Promise<void> {
    const definition = this.definitionMap.get(id);
    const state = this.data.features[id];
    if (!definition || !state) {
      throw new Error(`Unknown feature: ${id}`);
    }
    state.options = clone(definition.defaultOptions);
    this.scheduleSave();
  }

  async setGlobal(key: string, value: unknown): Promise<void> {
    if (key !== 'debug') {
      throw new Error(`Unknown global setting: ${key}`);
    }
    if (typeof value !== 'boolean') {
      throw new Error('debug must be a boolean');
    }
    this.data.global.debug = value;
    this.scheduleSave();
  }

  async flush(): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    const snapshot = this.toJSON();
    this.saveChain = this.saveChain
      .then(
        () => this.host.saveData(snapshot),
        () => this.host.saveData(snapshot),
      )
      .catch((error: unknown) => {
        console.error('[all-in-one:settings] failed to save data', error);
        new Notice(t('notice.settingsSaveFailed'));
      });

    await this.saveChain;
  }

  toJSON(): Record<string, unknown> {
    return {
      schemaVersion: this.data.schemaVersion,
      global: clone(this.data.global),
      features: {
        ...clone(this.extraFeatures),
        ...clone(this.data.features),
      },
    };
  }

  private normalize(data: RawData): void {
    const rawGlobal = isRecord(data.global) ? data.global : {};
    const global: GlobalSettings = {
      debug:
        typeof rawGlobal.debug === 'boolean'
          ? rawGlobal.debug
          : DEFAULT_GLOBAL_SETTINGS.debug,
    };
    for (const [key, value] of Object.entries(rawGlobal)) {
      if (key !== 'debug') {
        (global as unknown as Record<string, unknown>)[key] = clone(value);
      }
    }
    this.data.global = global;

    const rawFeatures = isRecord(data.features) ? data.features : {};
    const knownIds = new Set(this.definitions.map((definition) => definition.id));

    for (const [id, value] of Object.entries(rawFeatures)) {
      if (!knownIds.has(id)) {
        this.extraFeatures[id] = clone(value);
      }
    }

    for (const definition of this.definitions) {
      const rawStateValue = rawFeatures[definition.id];
      const rawState = isRecord(rawStateValue) ? rawStateValue : {};
      const enabled =
        typeof rawState.enabled === 'boolean'
          ? rawState.enabled
          : definition.defaultEnabled;
      const rawOptions = isRecord(rawState.options) ? rawState.options : {};
      const options: Record<string, unknown> = {
        ...clone(definition.defaultOptions),
        ...rawOptions,
      };

      for (const setting of definition.settings ?? []) {
        if (!isControlSetting(setting)) {
          continue;
        }

        const key = setting.control.key;
        const rawValue = rawOptions[key];
        if (rawValue === undefined) {
          continue;
        }

        const sanitized = sanitizeControlValue(setting.control, rawValue);
        if (sanitized.ok) {
          options[key] = sanitized.value;
        } else if (key in definition.defaultOptions) {
          options[key] = clone(definition.defaultOptions[key]);
        } else {
          delete options[key];
        }
      }

      this.data.features[definition.id] = { enabled, options };
    }

    if (
      typeof data.schemaVersion === 'number' &&
      Number.isInteger(data.schemaVersion) &&
      data.schemaVersion >= CURRENT_SCHEMA_VERSION
    ) {
      this.data.schemaVersion = data.schemaVersion;
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, SAVE_DEBOUNCE_MS);
  }
}

export type { FeatureSetting };
