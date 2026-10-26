import type { FeatureSetting } from '../../core/feature';
import { t } from '../../i18n';
import { parseRoamScope } from './paths';
import type { NoteRoamingOptions } from './types';

export const DEFAULT_NOTE_ROAMING_OPTIONS: NoteRoamingOptions = {
  roamPaths: '',
};

export function validateRoamPaths(value: string): string | void {
  const scope = parseRoamScope(value);
  if (scope.invalid.length === 0) {
    return;
  }

  return t('features.note-roaming.validation.pathInvalid', {
    path: scope.invalid[0] ?? '',
  });
}

export const noteRoamingSettings: readonly FeatureSetting<NoteRoamingOptions>[] =
  [
    {
      name: t('features.note-roaming.roamPaths'),
      desc: t('features.note-roaming.roamPathsDesc'),
      control: {
        type: 'textarea',
        key: 'roamPaths',
        rows: 4,
        placeholder: t('features.note-roaming.roamPathsPlaceholder'),
        defaultValue: DEFAULT_NOTE_ROAMING_OPTIONS.roamPaths,
        validate: validateRoamPaths,
      },
    },
  ];
