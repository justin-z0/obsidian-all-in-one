/** Rendering pipeline: render the whole note, partition its top-level DOM, and build full-screen slides. */
import { Component, MarkdownRenderer } from 'obsidian';
import type { App, TFile } from 'obsidian';
import { formatBreadcrumb, planSlides, stripFrontmatter } from './deck';
import type { Block, SlidesOptions, SlidePlan } from './types';

export interface DeckViewOptions {
  app: App;
  file: TFile;
  source: string;
  options: SlidesOptions;
  component: Component;
  onChange?: (index: number, count: number) => void;
}

/**
 * Renders the note once with Obsidian's Markdown renderer, then distributes the
 * resulting top-level blocks into fixed-size slide wrappers.
 */
export class DeckView {
  private readonly app: App;
  private readonly file: TFile;
  private readonly source: string;
  private readonly options: SlidesOptions;
  private readonly component: Component;
  private readonly onChange?: (index: number, count: number) => void;
  private readonly noteTitle: string;

  private stage: HTMLElement | null = null;
  private slides: HTMLElement[] = [];
  private readonly slideBodies = new Map<number, HTMLElement>();
  private active = 0;
  private destroyed = false;

  constructor(options: DeckViewOptions) {
    this.app = options.app;
    this.file = options.file;
    this.source = options.source;
    this.options = options.options;
    this.component = options.component;
    this.onChange = options.onChange;
    this.noteTitle = resolveNoteTitle(this.app, this.file);
  }

  async mount(container: HTMLElement): Promise<number> {
    const stage = container.createDiv({ cls: 'aio-slides-stage' });
    stage.addClass(`aio-slides-scheme-${this.options.colorScheme}`);
    stage.addClass(`aio-slides-transition-${this.options.transition}`);
    this.stage = stage;

    await nextFrame();
    await nextFrame();
    if (this.destroyed) {
      return 0;
    }

    this.updateStageUnit();

    const track = stage.createDiv({ cls: 'aio-slides-track' });
    const host = track.createDiv({
      cls: 'aio-slides-render-host markdown-rendered markdown-preview-view',
    });

    const markdown = stripFrontmatter(
      this.source,
      this.frontmatterEndOffset(),
    );
    await MarkdownRenderer.render(
      this.app,
      markdown,
      host,
      this.file.path,
      this.component,
    );

    if (this.destroyed) {
      return 0;
    }

    const blocks = collectBlocks(host);
    const plans = planSlides(blocks, this.noteTitle);
    host.remove();

    if (plans.length === 0) {
      return 0;
    }

    plans.forEach((plan, index) => {
      const slide = this.buildSlide(plan, index, plans.length);
      track.appendChild(slide);
      this.slides.push(slide);
    });

    this.bindResize();
    this.go(0);

    return plans.length;
  }

  go(index: number): void {
    if (this.slides.length === 0) {
      return;
    }

    this.active = clamp(index, 0, this.slides.length - 1);

    this.slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === this.active;
      slide.classList.toggle('is-active', isActive);
      slide.classList.toggle('is-before', slideIndex < this.active);
      slide.classList.toggle('is-after', slideIndex > this.active);
      slide.setAttribute('aria-hidden', String(!isActive));
    });

    const body = this.slideBodies.get(this.active);
    if (body) {
      body.scrollTop = 0;
    }

    this.onChange?.(this.active, this.slides.length);
  }

  next(): boolean {
    if (this.active >= this.slides.length - 1) {
      return false;
    }
    this.go(this.active + 1);
    return true;
  }

  previous(): boolean {
    if (this.active <= 0) {
      return false;
    }
    this.go(this.active - 1);
    return true;
  }

  first(): boolean {
    if (this.active === 0) {
      return false;
    }
    this.go(0);
    return true;
  }

  last(): boolean {
    if (this.active === this.slides.length - 1) {
      return false;
    }
    this.go(this.slides.length - 1);
    return true;
  }

  /**
   * Scroll the active page before changing slides. Returns false when the page
   * cannot scroll further in that direction, letting the caller navigate.
   */
  scrollActive(direction: -1 | 1, fraction = 0.85): boolean {
    const body = this.slideBodies.get(this.active);
    if (!body) {
      return false;
    }

    const max = body.scrollHeight - body.clientHeight;
    if (max <= 1) {
      return false;
    }

    const before = body.scrollTop;
    const step = Math.max(1, Math.round(body.clientHeight * fraction));
    body.scrollTop = clamp(before + direction * step, 0, max);
    return Math.abs(body.scrollTop - before) > 1;
  }

  destroy(): void {
    this.destroyed = true;
    this.slides = [];
    this.slideBodies.clear();
    this.stage?.remove();
    this.stage = null;
  }

  private buildSlide(
    plan: SlidePlan<HTMLElement>,
    index: number,
    total: number,
  ): HTMLElement {
    const slide = createDiv({ cls: 'aio-slides-slide' });
    slide.setAttribute('data-kind', plan.kind);
    slide.setAttribute('data-index', String(index));
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-hidden', 'true');
    slide.setAttribute('aria-label', plan.title || this.noteTitle);

    const inner = slide.createDiv({ cls: 'aio-slides-slide-inner' });

    if (plan.kind === 'section') {
      inner.addClass('aio-slides-section');
      inner.createDiv({
        cls: 'aio-slides-section-number',
        text: String(plan.sectionNumber).padStart(2, '0'),
      });
      const title = inner.createDiv({ cls: 'aio-slides-section-title' });
      title.appendChild(plan.blocks[0].element);
      inner.createDiv({ cls: 'aio-slides-section-rule' });
    } else {
      if (this.options.showBreadcrumb) {
        const header = inner.createDiv({ cls: 'aio-slides-header' });
        header.createDiv({
          cls: 'aio-slides-breadcrumb',
          text: formatBreadcrumb(
            plan.breadcrumb,
            this.options.breadcrumbSeparator,
          ),
        });
      }

      const body = inner.createDiv({
        cls: 'aio-slides-body markdown-rendered markdown-preview-view',
      });
      for (const block of plan.blocks) {
        body.appendChild(block.element);
      }
      this.slideBodies.set(index, body);
    }

    this.appendFooter(inner, index, total);
    return slide;
  }

  private appendFooter(
    inner: HTMLElement,
    index: number,
    total: number,
  ): void {
    if (!this.options.showPageNumber) {
      return;
    }

    const footer = inner.createDiv({ cls: 'aio-slides-footer' });
    footer.createDiv({
      cls: 'aio-slides-footer-page',
      text: `${index + 1} / ${total}`,
    });
  }

  private bindResize(): void {
    this.component.registerDomEvent(window, 'resize', () => {
      this.updateStageUnit();
    });
  }

  private updateStageUnit(): void {
    if (!this.stage) {
      return;
    }
    const width = this.stage.clientWidth;
    const unit = Math.max(1, width / 100);
    this.stage.setCssProps({ '--aio-slides-unit': `${unit}px` });
  }

  private frontmatterEndOffset(): number | undefined {
    return this.app.metadataCache.getFileCache(this.file)?.frontmatterPosition
      ?.end.offset;
  }
}

function resolveNoteTitle(app: App, file: TFile): string {
  const rawTitle: unknown =
    app.metadataCache.getFileCache(file)?.frontmatter?.title;
  if (typeof rawTitle === 'string' && rawTitle.trim().length > 0) {
    return rawTitle.trim();
  }
  return file.basename || file.path;
}

function collectBlocks(host: HTMLElement): Block<HTMLElement>[] {
  const blocks: Block<HTMLElement>[] = [];

  for (const child of Array.from(host.children)) {
    if (!child.instanceOf(HTMLElement)) {
      continue;
    }

    const level = headingLevel(child);
    if (level !== null) {
      blocks.push({
        kind: 'heading',
        level,
        text: headingText(child),
        element: child,
      });
      continue;
    }

    if (child.tagName === 'HR') {
      blocks.push({ kind: 'break', element: child });
      continue;
    }

    blocks.push({ kind: 'content', element: child });
  }

  return blocks;
}

function headingLevel(element: HTMLElement): number | null {
  const match = /^H([1-6])$/.exec(element.tagName);
  if (!match) {
    return null;
  }
  const level = Number(match[1]);
  return Number.isFinite(level) ? level : null;
}

function headingText(element: HTMLElement): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
