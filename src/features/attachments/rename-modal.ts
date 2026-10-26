import { ButtonComponent, Modal } from 'obsidian';
import type { App } from 'obsidian';
import { t } from '../../i18n';
import { finalFileName, stripMatchingExtension } from './filenames';
import { joinVaultPath } from './paths';
import { validateAttachmentBaseName } from './rename-validation';
import type { NamePromptRequest } from './types';

/**
 * Prompt for a base file name. Resolves null when the user cancels or the
 * feature is disabled while the modal is open.
 */
export function promptRename(
  app: App,
  request: NamePromptRequest,
  signal: AbortSignal,
): Promise<string | null> {
  if (signal.aborted) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    let modal: RenameAttachmentModal | null = null;

    const finish = (value: string | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      signal.removeEventListener('abort', onAbort);
      resolve(value);
    };

    const onAbort = (): void => {
      modal?.close();
    };

    modal = new RenameAttachmentModal(app, request, finish);
    signal.addEventListener('abort', onAbort, { once: true });
    modal.open();

    if (signal.aborted) {
      modal.close();
    }
  });
}

class RenameAttachmentModal extends Modal {
  private result: string | null = null;
  private inputEl!: HTMLInputElement;
  private errorEl!: HTMLElement;

  constructor(
    app: App,
    private readonly request: NamePromptRequest,
    private readonly done: (value: string | null) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText(t('features.attachments.rename.title'));

    if (this.request.total > 1) {
      this.contentEl.createDiv({
        cls: 'aio-attachment-position',
        text: t('features.attachments.rename.position', {
          index: this.request.index,
          total: this.request.total,
        }),
      });
    }

    this.contentEl.createEl('p', {
      text: t('features.attachments.rename.folder', {
        folder: `${this.request.folder}/`,
      }),
    });

    const row = this.contentEl.createDiv({
      cls: 'aio-attachment-name-row',
    });

    const input = row.createEl('input', {
      type: 'text',
      cls: 'aio-attachment-name-input',
    });
    input.value = this.request.defaultBaseName;
    input.setAttribute(
      'aria-label',
      t('features.attachments.rename.label'),
    );

    if (this.request.extension) {
      row.createSpan({
        cls: 'aio-attachment-name-ext',
        text: `.${this.request.extension}`,
      });
    }

    this.inputEl = input;
    this.errorEl = this.contentEl.createDiv({
      cls: 'aio-attachment-error mod-warning',
    });

    const buttons = this.contentEl.createDiv({
      cls: 'modal-button-container aio-attachment-buttons',
    });

    new ButtonComponent(buttons)
      .setButtonText(t('common.cancel'))
      .onClick(() => this.close());

    new ButtonComponent(buttons)
      .setButtonText(t('features.attachments.rename.save'))
      .setCta()
      .onClick(() => this.submit());

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.submit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });

    input.focus();
    input.select();
  }

  override onClose(): void {
    this.contentEl.empty();
    this.done(this.result);
    super.onClose();
  }

  private submit(): void {
    this.errorEl.removeClass('is-visible');
    let baseName = this.inputEl.value.trim();
    baseName = stripMatchingExtension(baseName, this.request.extension);

    const error = validateAttachmentBaseName(baseName, {
      reserved: this.request.reserved,
      exists: (candidate) =>
        this.app.vault.getAbstractFileByPath(
          joinVaultPath(
            this.request.folder,
            finalFileName(candidate, this.request.extension),
          ),
        ) !== null,
    });

    if (error) {
      this.showError(error);
      return;
    }

    this.result = baseName;
    this.close();
  }

  private showError(message: string): void {
    this.errorEl.setText(message);
    this.errorEl.addClass('is-visible');
  }
}
