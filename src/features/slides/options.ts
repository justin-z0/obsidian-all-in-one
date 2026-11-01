/** Feature settings: defaults, separator validation, and declarative setting rows. */
import type { FeatureSetting } from '../../core/feature';
import { t } from '../../i18n';
import type { SlidesOptions } from './types';

export const DEFAULT_SLIDES_OPTIONS: SlidesOptions = {
  showBreadcrumb: false,
  breadcrumbSeparator: '-',
  showPageNumber: true,
  showProgress: true,
  colorScheme: 'vault',
  transition: 'fade',
};

export function validateBreadcrumbSeparator(value: string): string | void {
  if (value.trim().length === 0) {
    return t('features.slides.validation.separatorEmpty');
  }

  if (value.length > 3) {
    return t('features.slides.validation.separatorTooLong');
  }
}

export const slidesSettings: readonly FeatureSetting<SlidesOptions>[] = [
  {
    name: t('features.slides.showBreadcrumb'),
    desc: t('features.slides.showBreadcrumbDesc'),
    control: {
      type: 'toggle',
      key: 'showBreadcrumb',
      defaultValue: DEFAULT_SLIDES_OPTIONS.showBreadcrumb,
    },
  },
  {
    name: t('features.slides.breadcrumbSeparator'),
    desc: t('features.slides.breadcrumbSeparatorDesc'),
    control: {
      type: 'text',
      key: 'breadcrumbSeparator',
      placeholder: '-',
      defaultValue: DEFAULT_SLIDES_OPTIONS.breadcrumbSeparator,
      validate: validateBreadcrumbSeparator,
    },
  },
  {
    name: t('features.slides.showPageNumber'),
    control: {
      type: 'toggle',
      key: 'showPageNumber',
      defaultValue: DEFAULT_SLIDES_OPTIONS.showPageNumber,
    },
  },
  {
    name: t('features.slides.showProgress'),
    control: {
      type: 'toggle',
      key: 'showProgress',
      defaultValue: DEFAULT_SLIDES_OPTIONS.showProgress,
    },
  },
  {
    name: t('features.slides.colorScheme'),
    desc: t('features.slides.colorSchemeDesc'),
    control: {
      type: 'dropdown',
      key: 'colorScheme',
      defaultValue: DEFAULT_SLIDES_OPTIONS.colorScheme,
      options: {
        vault: t('features.slides.colorVault'),
        light: t('features.slides.colorLight'),
        dark: t('features.slides.colorDark'),
      },
    },
  },
  {
    name: t('features.slides.transition'),
    control: {
      type: 'dropdown',
      key: 'transition',
      defaultValue: DEFAULT_SLIDES_OPTIONS.transition,
      options: {
        fade: t('features.slides.transitionFade'),
        none: t('features.slides.transitionNone'),
      },
    },
  },
];
