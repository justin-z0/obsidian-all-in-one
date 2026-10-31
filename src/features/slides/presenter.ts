/** Presentation UI: full-screen modal, keyboard/pointer navigation, auto-fit, and cleanup. */
import { Component, Modal, Notice } from 'obsidian';
import type { App, KeymapEventHandler, TFile } from 'obsidian';
import { t } from '../../i18n';
import { DeckView } from './render';
import type { SlidesOptions } from './types';

export class SlidesModal extends Modal {
  private readonly renderComponent = new Component();
  private readonly keyHandlers: KeymapEventHandler[] = [];
  private deck: DeckView | null = null;
  private stageWrap: HTMLElement | null = null;
  private counterEl: HTMLElement | null = null;
  private progressBarEl: HTMLElement | null = null;
  private previousButton: HTMLButtonElement | null = null;
  private nextButton: HTMLButtonElement | null = null;
  private loadingEl: HTMLElement | null = null;
  private requestedFullscreen = false;
  private closed = false;

  constructor(
    app: App,
    private readonly file: TFile,
    private readonly loadSource: () => Promise<string>,
    private readonly options: SlidesOptions,
    private readonly onClosed: () => void,
  ) {
    super(app);
  }

  override async onOpen(): Promise<void> {
    this.closed = false;
    this.renderComponent.load();
    this.modalEl.addClass('aio-slides-modal');
    this.containerEl.addClass('aio-slides-container');
    this.contentEl.addClass('aio-slides-content');
    this.titleEl.remove();
    this.contentEl.empty();
    this.removeNativeChrome();

    try {
      this.buildChrome();
      this.bindKeys();
      this.bindFullscreenExit();

      const source = await this.loadSource();
      if (this.closed) {
        return;
      }

      const deck = new DeckView({
        app: this.app,
        file: this.file,
        source,
        options: this.options,
        component: this.renderComponent,
        onChange: (index, count) => this.updateHud(index, count),
      });
      this.deck = deck;

      const count = await deck.mount(this.stageWrap ?? this.contentEl);
      if (this.closed) {
        return;
      }

      if (count === 0) {
        new Notice(t('features.slides.notice.emptyNote'));
        this.close();
        return;
      }

      this.loadingEl?.remove();
      this.loadingEl = null;
      this.updateHud(0, count);
      this.focusPresentation();
    } catch (error) {
      if (this.closed) {
        return;
      }
      this.close();
      new Notice(
        t('features.slides.notice.renderFailed', {
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  override onClose(): void {
    this.closed = true;
    this.deck?.destroy();
    this.deck = null;

    for (const handler of this.keyHandlers.splice(0)) {
      try {
        this.scope.unregister(handler);
      } catch {
        // The modal scope may already be disposed.
      }
    }

    const wasFullscreen = this.isPresentationFullscreen();
    this.requestedFullscreen = false;
    if (wasFullscreen && typeof document.exitFullscreen === 'function') {
      void document.exitFullscreen().catch(() => {
        // The browser may already have left fullscreen.
      });
    }

    this.renderComponent.unload();
    this.contentEl.empty();
    try {
      this.onClosed();
    } finally {
      super.onClose();
    }
  }

  private removeNativeChrome(): void {
    for (const root of [this.modalEl, this.containerEl]) {
      for (const button of Array.from(
        root.querySelectorAll(
          '.modal-close-button, .modal-header-button, .modal-header',
        ),
      )) {
        button.remove();
      }
    }
  }

  private buildChrome(): void {
    const stageWrap = this.contentEl.createDiv({
      cls: 'aio-slides-stage-wrap',
    });
    stageWrap.tabIndex = -1;
    this.stageWrap = stageWrap;
    this.loadingEl = stageWrap.createDiv({
      cls: 'aio-slides-loading',
      text: t('features.slides.notice.loading'),
    });

    this.previousButton = this.createButton(
      'aio-slides-nav aio-slides-prev',
      '‹',
      t('features.slides.aria.previous'),
    );
    this.nextButton = this.createButton(
      'aio-slides-nav aio-slides-next',
      '›',
      t('features.slides.aria.next'),
    );
    const hud = this.contentEl.createDiv({ cls: 'aio-slides-hud' });
    this.counterEl = hud.createDiv({
      cls: 'aio-slides-counter aio-slides-sr-only',
    });
    this.counterEl.setAttribute('role', 'status');
    this.counterEl.setAttribute('aria-live', 'polite');

    if (this.options.showProgress) {
      const progress = this.contentEl.createDiv({
        cls: 'aio-slides-progress',
      });
      this.progressBarEl = progress.createDiv({
        cls: 'aio-slides-progress-bar',
      });
    }

    this.bindClick(this.previousButton, () => this.deck?.previous());
    this.bindClick(this.nextButton, () => this.deck?.next());

    this.renderComponent.registerDomEvent(stageWrap, 'click', (event) => {
      this.handleStageClick(event);
    });
  }

  private createButton(
    cls: string,
    text: string,
    label: string,
  ): HTMLButtonElement {
    return this.contentEl.createEl('button', {
      cls,
      text,
      type: 'button',
      title: label,
      attr: { 'aria-label': label },
    });
  }

  private bindClick(
    element: HTMLElement | null,
    action: () => void,
  ): void {
    if (!element) {
      return;
    }
    this.renderComponent.registerDomEvent(element, 'click', (event) => {
      event.stopPropagation();
      action();
      if (element.isConnected) {
        element.blur();
      }
    });
  }

  private bindKeys(): void {
    const bind = (
      modifiers: [] | ['Shift'],
      key: string,
      action: () => void,
    ): void => {
      this.keyHandlers.push(
        this.scope.register(modifiers, key, (event) => {
          if (isEditableTarget(event.target)) {
            return;
          }
          action();
          return false;
        }),
      );
    };

    bind([], 'ArrowRight', () => this.deck?.next());
    bind([], 'ArrowDown', () => this.deck?.next());
    bind([], ' ', () => this.deck?.next());
    bind([], 'PageDown', () => this.deck?.next());
    bind([], 'ArrowLeft', () => this.deck?.previous());
    bind([], 'ArrowUp', () => this.deck?.previous());
    bind([], 'PageUp', () => this.deck?.previous());
    bind(['Shift'], ' ', () => this.deck?.previous());
    bind([], 'Home', () => this.deck?.first());
    bind([], 'End', () => this.deck?.last());
  }

  private bindFullscreenExit(): void {
    this.renderComponent.registerDomEvent(document, 'fullscreenchange', () => {
      if (
        !this.closed &&
        this.requestedFullscreen &&
        !document.fullscreenElement
      ) {
        this.close();
      }
    });
  }

  private handleStageClick(event: MouseEvent): void {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }

    if (
      event.target.closest(
        'a, button, input, textarea, select, video, audio, iframe, summary, .callout.is-collapsible .callout-title',
      )
    ) {
      return;
    }

    const selection = window.getSelection();
    if (
      selection?.toString() &&
      selection.anchorNode &&
      this.contentEl.contains(selection.anchorNode)
    ) {
      return;
    }

    const stage = this.stageWrap;
    if (!stage) {
      return;
    }

    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const x = event.clientX - rect.left;
    if (x < rect.width / 3) {
      this.deck?.previous();
    } else if (x > (rect.width * 2) / 3) {
      this.deck?.next();
    }
  }

  private updateHud(index: number, count: number): void {
    if (count <= 0) {
      return;
    }

    if (this.counterEl) {
      this.counterEl.setText(`${index + 1} / ${count}`);
    }

    if (this.progressBarEl) {
      this.progressBarEl.style.width = `${((index + 1) / count) * 100}%`;
    }

    if (this.previousButton) {
      this.previousButton.disabled = index <= 0;
    }

    if (this.nextButton) {
      this.nextButton.disabled = index >= count - 1;
    }
  }

  private focusPresentation(): void {
    this.stageWrap?.focus({ preventScroll: true });
  }

  requestPresentationFullscreen(): void {
    if (document.fullscreenElement) {
      return;
    }

    const target = this.modalEl.isConnected
      ? this.modalEl
      : document.documentElement;

    if (typeof target.requestFullscreen !== 'function') {
      return;
    }

    this.requestedFullscreen = true;
    try {
      void target
        .requestFullscreen()
        .then(() => {
          if (this.closed && this.isPresentationFullscreen()) {
            this.requestedFullscreen = false;
            void document.exitFullscreen().catch(() => {
              // The window may already have left fullscreen.
            });
          }
        })
        .catch(() => {
          this.requestedFullscreen = false;
        });
    } catch {
      this.requestedFullscreen = false;
    }
  }

  private isPresentationFullscreen(): boolean {
    const element = document.fullscreenElement;
    return (
      element === this.modalEl ||
      (this.requestedFullscreen && element === document.documentElement)
    );
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}
