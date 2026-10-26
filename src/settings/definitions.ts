import type {
  App,
  SettingDefinitionAction,
  SettingDefinitionControl,
  SettingDefinitionGroup,
  SettingDefinitionItem,
  SettingGroupItem,
} from 'obsidian';
import { isControlSetting } from '../core/feature';
import type { FeatureDefinition, FeatureSetting } from '../core/feature';
import type { FeatureManager } from '../core/feature-manager';
import { evaluateBoolean } from '../core/utils';
import { t } from '../i18n';
import {
  enabledControlKey,
  globalControlKey,
  optionControlKey,
} from './control-keys';
import { showResetConfirmation } from './reset-modal';

export interface BuildDefinitionsOptions {
  app: App;
  features: readonly FeatureDefinition[];
  manager: FeatureManager;
  refresh: () => void;
}

export function buildSettingDefinitions(
  options: BuildDefinitionsOptions,
): SettingDefinitionItem[] {
  const general = buildGeneralGroup();
  const features = options.features.map((feature) =>
    buildFeatureGroup(feature, options),
  );
  return [general, ...features];
}

function buildGeneralGroup(): SettingDefinitionGroup {
  const debug: SettingDefinitionControl = {
    name: t('settings.debug'),
    desc: t('settings.debugDesc'),
    control: {
      type: 'toggle',
      key: globalControlKey('debug'),
      defaultValue: false,
    },
  };

  return {
    type: 'group',
    heading: t('settings.general'),
    items: [debug],
  };
}

function buildFeatureGroup(
  definition: FeatureDefinition,
  options: BuildDefinitionsOptions,
): SettingDefinitionGroup {
  const enabled = () => options.manager.isEnabled(definition.id);
  const items: SettingGroupItem[] = [];

  const toggle: SettingDefinitionControl = {
    name: t('settings.feature.enabled'),
    desc: definition.description,
    control: {
      type: 'toggle',
      key: enabledControlKey(definition.id),
      defaultValue: definition.defaultEnabled,
    },
  };
  items.push(toggle);

  for (const setting of definition.settings ?? []) {
    items.push(mapSetting(definition, setting, options.manager));
  }

  if ((definition.settings?.length ?? 0) > 0) {
    const reset: SettingDefinitionAction = {
      name: t('settings.feature.reset'),
      desc: t('settings.feature.resetDesc'),
      action: () => {
        showResetConfirmation(options.app, definition.name, async () => {
          await options.manager.resetFeature(definition.id);
          options.refresh();
        });
      },
      visible: enabled,
    };
    items.push(reset);
  }

  return {
    type: 'group',
    heading: definition.name,
    cls: `aio-feature-group aio-feature-${definition.id}`,
    items,
  };
}

function mapSetting(
  definition: FeatureDefinition,
  setting: FeatureSetting,
  manager: FeatureManager,
): SettingGroupItem {
  const enabled = () => manager.isEnabled(definition.id);

  if (isControlSetting(setting)) {
    const { apply: _apply, ...rest } = setting;
    const key = setting.control.key;

    return {
      ...rest,
      control: {
        ...setting.control,
        key: optionControlKey(definition.id, key),
      },
      visible: combineVisible(enabled, setting.visible),
    };
  }

  return {
    ...setting,
    visible: combineVisible(enabled, setting.visible),
    render: (settingEl, group) => {
      const ctx = manager.getContext(definition.id);
      if (!ctx) {
        return undefined;
      }
      return setting.render(settingEl, group, ctx);
    },
  };
}

function combineVisible(
  base: () => boolean,
  extra: boolean | (() => boolean) | undefined,
): () => boolean {
  return () => base() && evaluateBoolean(extra);
}
