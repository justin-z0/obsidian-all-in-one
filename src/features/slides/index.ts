import { Notice, TFile } from 'obsidian';
import type { Menu, TAbstractFile } from 'obsidian';
import type { FeatureDefinition } from '../../core/feature';
import type { FeatureContext } from '../../core/feature-context';
import { t } from '../../i18n';
import { DEFAULT_SLIDES_OPTIONS, slidesSettings } from './options';
import { SlidesModal } from './presenter';
import type { SlidesOptions } from './types';

export const slidesFeature: FeatureDefinition<SlidesOptions> = {
  id: 'slides',
  name: t('features.slides.name'),
  description: t('features.slides.description'),
  defaultEnabled: false,
  defaultOptions: DEFAULT_SLIDES_OPTIONS,
  settings: slidesSettings,
  setup,
};

function setup(ctx: FeatureContext<SlidesOptions>): void {
  let active: SlidesModal | null = null;
  let opening = false;

  const present = (file?: TFile | null): void => {
    if (opening) {
      return;
    }

    const target = file ?? ctx.app.workspace.getActiveFile();
    if (!target || target.extension !== 'md') {
      new Notice(t('features.slides.notice.noActiveNote'));
      return;
    }

    if (!ctx.isEnabled()) {
      return;
    }

    opening = true;
    let modal: SlidesModal | null = null;
    try {
      active?.close();
      modal = new SlidesModal(
        ctx.app,
        target,
        () =>
          ctx.app.vault.cachedRead(target).catch((error: unknown) => {
            ctx.logger.error('failed to read the note for slides', error);
            throw error;
          }),
        { ...ctx.options },
        () => {
          if (active === modal) {
            active = null;
          }
        },
      );
      active = modal;
      modal.open();
      modal.requestPresentationFullscreen();
    } catch (error) {
      modal?.close();
      if (active === modal) {
        active = null;
      }

      if (ctx.signal.aborted) {
        return;
      }

      ctx.logger.error('failed to open the slides presentation', error);
      new Notice(
        t('features.slides.notice.renderFailed', {
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return;
    } finally {
      opening = false;
    }
  };

  ctx.addCommand({
    id: 'present',
    name: t('features.slides.command.present'),
    callback: () => {
      void present();
    },
  });

  ctx.addRibbonIcon('presentation', t('features.slides.ribbon'), () => {
    void present();
  });

  ctx.registerEvent(
    ctx.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
      if (!(file instanceof TFile) || file.extension !== 'md') {
        return;
      }

      menu.addItem((item) => {
        item
          .setTitle(t('features.slides.menu.present'))
          .setIcon('presentation')
          .onClick(() => {
            void present(file);
          });
      });
    }),
  );

  ctx.register(() => {
    active?.close();
    active = null;
  });
}
