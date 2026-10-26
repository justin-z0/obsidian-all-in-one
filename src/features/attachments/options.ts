import type { FeatureSetting } from '../../core/feature';
import { t } from '../../i18n';
import { validateFilenamePattern } from './filenames';
import { normalizeAssetsRoot } from './paths';
import type { AttachmentOptions } from './types';

export const DEFAULT_ATTACHMENT_OPTIONS: AttachmentOptions = {
  assetsRoot: 'assets',
  filenamePattern: '{note}-{suffix}',
  uploadFilenamePattern: '{suffix}',
  embedImages: true,
};

export function validateAssetsRoot(value: string): string | void {
  try {
    normalizeAssetsRoot(value);
    return;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export const attachmentSettings: readonly FeatureSetting<AttachmentOptions>[] =
  [
    {
      name: t('features.attachments.assetsRoot'),
      desc: t('features.attachments.assetsRootDesc'),
      control: {
        type: 'folder',
        key: 'assetsRoot',
        includeRoot: false,
        placeholder: 'assets',
        defaultValue: DEFAULT_ATTACHMENT_OPTIONS.assetsRoot,
        validate: validateAssetsRoot,
      },
    },
    {
      name: t('features.attachments.filenamePattern'),
      desc: t('features.attachments.filenamePatternDesc'),
      control: {
        type: 'text',
        key: 'filenamePattern',
        placeholder: '{note}-{suffix}',
        defaultValue: DEFAULT_ATTACHMENT_OPTIONS.filenamePattern,
        validate: validateFilenamePattern,
      },
    },
    {
      name: t('features.attachments.uploadFilenamePattern'),
      desc: t('features.attachments.uploadFilenamePatternDesc'),
      control: {
        type: 'text',
        key: 'uploadFilenamePattern',
        placeholder: '{suffix}',
        defaultValue: DEFAULT_ATTACHMENT_OPTIONS.uploadFilenamePattern,
        validate: validateFilenamePattern,
      },
    },
    {
      name: t('features.attachments.embedImages'),
      desc: t('features.attachments.embedImagesDesc'),
      control: {
        type: 'toggle',
        key: 'embedImages',
        defaultValue: DEFAULT_ATTACHMENT_OPTIONS.embedImages,
      },
    },
  ];
