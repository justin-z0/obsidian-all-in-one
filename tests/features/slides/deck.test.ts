/** Pure pagination and frontmatter tests for the slides feature. */
import { describe, expect, it } from 'vitest';
import {
  formatBreadcrumb,
  planSlides,
  stripFrontmatter,
} from '../../../src/features/slides/deck';
import type {
  Block,
  ContentSlidePlan,
  SectionSlidePlan,
  SlidePlan,
} from '../../../src/features/slides/types';

function heading(level: number, text: string): Block<string> {
  return { kind: 'heading', level, text, element: `h${level}:${text}` };
}

function content(element: string): Block<string> {
  return { kind: 'content', element };
}

function pageBreak(): Block<string> {
  return { kind: 'break', element: 'hr' };
}

function sectionAt(
  slides: readonly SlidePlan<string>[],
  index: number,
): SectionSlidePlan<string> {
  const slide = slides[index];
  if (!slide || slide.kind !== 'section') {
    throw new Error(`expected a section slide at ${index}`);
  }
  return slide;
}

function contentAt(
  slides: readonly SlidePlan<string>[],
  index: number,
): ContentSlidePlan<string> {
  const slide = slides[index];
  if (!slide || slide.kind !== 'content') {
    throw new Error(`expected a content slide at ${index}`);
  }
  return slide;
}

describe('planSlides', () => {
  it('maps H1 to a title page and H2 to content pages', () => {
    const slides = planSlides(
      [
        heading(1, '主题 A'),
        heading(2, '子主题 A1'),
        content('正文 A1'),
        heading(2, '子主题 A2'),
        content('正文 A2'),
      ],
      '笔记',
    );

    expect(slides).toHaveLength(3);
    expect(sectionAt(slides, 0)).toMatchObject({
      title: '主题 A',
      sectionNumber: 1,
      blocks: [heading(1, '主题 A')],
    });
    expect(contentAt(slides, 1).breadcrumb).toEqual(['主题 A', '子主题 A1']);
    expect(contentAt(slides, 1).blocks).toEqual([
      heading(2, '子主题 A1'),
      content('正文 A1'),
    ]);
    expect(contentAt(slides, 2).breadcrumb).toEqual(['主题 A', '子主题 A2']);
  });

  it('keeps content directly under H1 on its own page', () => {
    const slides = planSlides(
      [heading(1, '主题 A'), content('概述'), heading(2, '子主题 A1')],
      '笔记',
    );

    expect(slides).toHaveLength(3);
    expect(contentAt(slides, 1).breadcrumb).toEqual(['主题 A']);
    expect(contentAt(slides, 1).blocks).toEqual([content('概述')]);
  });

  it('creates one section page per H1', () => {
    const slides = planSlides(
      [
        heading(1, '主题 A'),
        heading(2, 'A1'),
        heading(1, '主题 B'),
        heading(2, 'B1'),
      ],
      '笔记',
    );

    expect(slides.map((slide) => slide.kind)).toEqual([
      'section',
      'content',
      'section',
      'content',
    ]);
    expect(sectionAt(slides, 0).sectionNumber).toBe(1);
    expect(sectionAt(slides, 2).sectionNumber).toBe(2);
    expect(contentAt(slides, 3).breadcrumb).toEqual(['主题 B', 'B1']);
  });

  it('starts at H2 when the note has no H1', () => {
    const slides = planSlides(
      [heading(2, '子主题 A1'), content('正文')],
      '笔记',
    );

    expect(slides).toHaveLength(1);
    expect(contentAt(slides, 0).breadcrumb).toEqual(['子主题 A1']);
  });

  it('uses the note title for content before the first heading', () => {
    const slides = planSlides([content('前言'), heading(1, '主题 A')], '笔记');

    expect(slides).toHaveLength(2);
    expect(contentAt(slides, 0).breadcrumb).toEqual(['笔记']);
    expect(sectionAt(slides, 1).title).toBe('主题 A');
  });

  it('starts a new content page for each H3', () => {
    const slides = planSlides(
      [
        heading(1, '主题 A'),
        heading(2, 'A1'),
        content('A1 概述'),
        heading(3, '细节 1'),
        content('内容 1'),
        heading(3, '细节 2'),
        content('内容 2'),
      ],
      '笔记',
    );

    expect(slides).toHaveLength(4);
    expect(contentAt(slides, 1).blocks).toEqual([
      heading(2, 'A1'),
      content('A1 概述'),
    ]);
    expect(contentAt(slides, 2)).toMatchObject({
      title: '细节 1',
      breadcrumb: ['主题 A', 'A1'],
      blocks: [heading(3, '细节 1'), content('内容 1')],
    });
    expect(contentAt(slides, 3)).toMatchObject({
      title: '细节 2',
      breadcrumb: ['主题 A', 'A1'],
      blocks: [heading(3, '细节 2'), content('内容 2')],
    });
  });

  it('keeps H4-H6 inside the current H3 page', () => {
    const slides = planSlides(
      [
        heading(1, '主题 A'),
        heading(2, 'A1'),
        heading(3, '细节'),
        heading(4, '补充'),
        content('说明'),
        heading(5, '更细'),
        content('更多'),
      ],
      '笔记',
    );

    expect(slides).toHaveLength(2);
    expect(contentAt(slides, 1).blocks).toEqual([
      heading(3, '细节'),
      heading(4, '补充'),
      content('说明'),
      heading(5, '更细'),
      content('更多'),
    ]);
  });

  it('does not leave a title-only H2 page when H3 follows immediately', () => {
    const slides = planSlides(
      [
        heading(1, '主题 A'),
        heading(2, 'A1'),
        heading(3, '细节'),
        content('内容'),
      ],
      '笔记',
    );

    expect(slides).toHaveLength(2);
    expect(contentAt(slides, 1)).toMatchObject({
      title: '细节',
      breadcrumb: ['主题 A', 'A1'],
      blocks: [heading(3, '细节'), content('内容')],
    });
  });

  it('keeps all H2 content on one page when the H2 has no H3', () => {
    const slides = planSlides(
      [
        heading(1, '主题 A'),
        heading(2, 'A1'),
        content('第一段'),
        content('第二段'),
      ],
      '笔记',
    );

    expect(slides).toHaveLength(2);
    expect(contentAt(slides, 1).blocks).toEqual([
      heading(2, 'A1'),
      content('第一段'),
      content('第二段'),
    ]);
  });

  it('uses the H1 breadcrumb for H3 pages directly under H1', () => {
    const slides = planSlides(
      [heading(1, '主题 A'), heading(3, '细节'), content('内容')],
      '笔记',
    );

    expect(slides).toHaveLength(2);
    expect(contentAt(slides, 1).breadcrumb).toEqual(['主题 A']);
    expect(contentAt(slides, 1).title).toBe('细节');
  });

  it('turns a horizontal rule into a page break without empty pages', () => {
    const slides = planSlides(
      [
        heading(1, '主题 A'),
        heading(2, 'A1'),
        content('第一段'),
        pageBreak(),
        pageBreak(),
        content('第二段'),
      ],
      '笔记',
    );

    expect(slides).toHaveLength(3);
    expect(contentAt(slides, 1).breadcrumb).toEqual(['主题 A', 'A1']);
    expect(contentAt(slides, 2).breadcrumb).toEqual(['主题 A', 'A1']);
    expect(contentAt(slides, 2).blocks).toEqual([content('第二段')]);
  });

  it('returns no slides for an empty note', () => {
    expect(planSlides([], '笔记')).toEqual([]);
  });

  it('falls back to the note title when a heading has no text', () => {
    const slides = planSlides([heading(1, '')], '笔记');

    expect(sectionAt(slides, 0).title).toBe('笔记');
  });
});

describe('formatBreadcrumb', () => {
  it('joins headings with the configured separator', () => {
    expect(formatBreadcrumb(['主题 A', '子主题 A1'], '-')).toBe(
      '主题 A-子主题 A1',
    );
    expect(formatBreadcrumb(['主题 A', '子主题 A1'], ' - ')).toBe(
      '主题 A - 子主题 A1',
    );
  });

  it('falls back to a hyphen for blank or oversized separators', () => {
    expect(formatBreadcrumb(['A', 'B'], '   ')).toBe('A-B');
    expect(formatBreadcrumb(['A', 'B'], '----')).toBe('A-B');
  });
});

describe('stripFrontmatter', () => {
  const source = '---\ntitle: 演示\ntags: [a]\n---\n# 主题 A\n';

  it('uses the metadata cache offset when provided', () => {
    const offset = source.indexOf('# 主题 A');

    expect(stripFrontmatter(source, offset)).toBe('# 主题 A\n');
  });

  it('falls back to a regex when no offset is available', () => {
    expect(stripFrontmatter(source)).toBe('# 主题 A\n');
  });

  it('handles empty frontmatter', () => {
    expect(stripFrontmatter('---\n---\n正文')).toBe('正文');
  });

  it('keeps a horizontal rule that is not frontmatter', () => {
    const body = '正文\n\n---\n\n更多正文';

    expect(stripFrontmatter(body)).toBe(body);
  });

  it('leaves notes without frontmatter untouched', () => {
    expect(stripFrontmatter('# 主题 A\n正文')).toBe('# 主题 A\n正文');
  });
});
