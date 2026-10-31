/** Pagination rules: maps rendered top-level blocks to H1 section pages and H2 content pages. */
import type {
  Block,
  ContentSlidePlan,
  HeadingBlock,
  SectionSlidePlan,
  SlidePlan,
} from './types';

const SECTION_LEVEL = 1;
const CONTENT_LEVEL = 2;

/**
 * Turn rendered top-level blocks into presentation pages.
 *
 * H1 always starts a title-only section page. H2 starts a content page whose
 * breadcrumb is the H1/H2 chain. Deeper headings stay inside the content page.
 */
export function planSlides<T>(
  blocks: readonly Block<T>[],
  noteTitle: string,
): SlidePlan<T>[] {
  const slides: SlidePlan<T>[] = [];
  const trail: HeadingBlock<T>[] = [];
  let current: ContentSlidePlan<T> | null = null;
  let sectionNumber = 0;

  const breadcrumb = (): string[] => {
    const visible = trail
      .filter((heading) => heading.level <= CONTENT_LEVEL)
      .map((heading) => heading.text)
      .filter((text) => text.length > 0);

    if (visible.length > 0) {
      return visible;
    }

    const fallback = trail
      .map((heading) => heading.text)
      .filter((text) => text.length > 0);

    return fallback.length > 0 ? fallback : [noteTitle];
  };

  const startContent = (): ContentSlidePlan<T> => {
    const plan: ContentSlidePlan<T> = {
      kind: 'content',
      title: trail.at(-1)?.text ?? noteTitle,
      breadcrumb: breadcrumb(),
      blocks: [],
    };
    slides.push(plan);
    current = plan;
    return plan;
  };

  for (const block of blocks) {
    if (block.kind === 'break') {
      current = null;
      continue;
    }

    if (block.kind === 'heading') {
      while (trail.length > 0) {
        const last = trail[trail.length - 1];
        if (last && last.level >= block.level) {
          trail.pop();
        } else {
          break;
        }
      }
      trail.push(block);

      if (block.level <= SECTION_LEVEL) {
        sectionNumber += 1;
        const section: SectionSlidePlan<T> = {
          kind: 'section',
          title: block.text.length > 0 ? block.text : noteTitle,
          sectionNumber,
          blocks: [block],
        };
        slides.push(section);
        current = null;
        continue;
      }

      if (block.level <= CONTENT_LEVEL) {
        const plan: ContentSlidePlan<T> = {
          kind: 'content',
          title: block.text.length > 0 ? block.text : noteTitle,
          breadcrumb: breadcrumb(),
          blocks: [block],
        };
        slides.push(plan);
        current = plan;
        continue;
      }

      (current ?? startContent()).blocks.push(block);
      continue;
    }

    (current ?? startContent()).blocks.push(block);
  }

  return slides;
}

export function formatBreadcrumb(
  parts: readonly string[],
  separator: string,
): string {
  const effective =
    separator.trim().length > 0 && separator.length <= 3 ? separator : '-';
  return parts.join(effective);
}

/**
 * Remove YAML frontmatter before rendering. The metadata cache offset is more
 * reliable than a regex, so callers should pass it when available.
 */
export function stripFrontmatter(
  source: string,
  frontmatterEndOffset?: number,
): string {
  if (
    typeof frontmatterEndOffset === 'number' &&
    frontmatterEndOffset > 0 &&
    frontmatterEndOffset <= source.length
  ) {
    return source
      .slice(frontmatterEndOffset)
      .replace(/^(?:[ \t]*\r?\n)+/, '');
  }

  const match =
    /^---\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(source);
  return match ? source.slice(match[0].length) : source;
}
