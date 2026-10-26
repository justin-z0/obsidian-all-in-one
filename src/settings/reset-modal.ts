import { ConfirmationModal } from 'obsidian';
import type { App } from 'obsidian';
import { t } from '../i18n';

export function showResetConfirmation(
  app: App,
  featureName: string,
  onConfirm: () => Promise<void>,
): void {
  const modal = new ConfirmationModal(app);
  modal.setTitle(t('settings.feature.resetTitle'));
  modal.contentEl.createEl('p', {
    text: t('settings.feature.resetConfirm', { name: featureName }),
  });
  modal.addCancelButton(t('common.cancel'));
  modal.addButton((button) =>
    button
      .setButtonText(t('common.reset'))
      .setCta()
      .onClick(() => {
        modal.close();
        void onConfirm().catch((error: unknown) => {
          console.error('[all-in-one:settings] failed to reset feature', error);
        });
      }),
  );
  modal.open();
}
