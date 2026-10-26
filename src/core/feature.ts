import type {
  Setting,
  SettingDefinitionControl,
  SettingDefinitionRender,
  SettingGroup,
} from 'obsidian';
import type { FeatureContext } from './feature-context';

export type FeatureOptions = Record<string, unknown>;

export type FeatureControlSetting<T extends FeatureOptions = FeatureOptions> =
  SettingDefinitionControl<Extract<keyof T, string>> & {
    /** live: the feature reads ctx.options; reload: rebuild the feature. */
    apply?: 'live' | 'reload';
  };

export type FeatureRenderSetting<T extends FeatureOptions = FeatureOptions> =
  Omit<SettingDefinitionRender, 'render'> & {
    render(
      setting: Setting,
      group: SettingGroup,
      ctx: FeatureContext<T>,
    ): void | (() => void);
  };

export type FeatureSetting<T extends FeatureOptions = FeatureOptions> =
  | FeatureControlSetting<T>
  | FeatureRenderSetting<T>;

export function isControlSetting<T extends FeatureOptions>(
  setting: FeatureSetting<T>,
): setting is FeatureControlSetting<T> {
  return 'control' in setting && setting.control !== undefined;
}

export interface FeatureDefinition<T extends FeatureOptions = FeatureOptions> {
  /** Persistent key, kebab-case, immutable after release. */
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultEnabled: boolean;
  readonly defaultOptions: T;
  readonly settings?: readonly FeatureSetting<T>[];

  setup(ctx: FeatureContext<T>): void | Promise<void>;
  teardown?(ctx: FeatureContext<T>): void | Promise<void>;
  onOptionsChange?(
    ctx: FeatureContext<T>,
    changed: readonly (keyof T & string)[],
  ): void;
}
