/** Shared types for settings, rendered blocks, and slide plans. */
export type SlidesColorScheme = 'vault' | 'light' | 'dark';
export type SlidesTransition = 'fade' | 'none';

export type SlidesOptions = {
  showBreadcrumb: boolean;
  breadcrumbSeparator: string;
  showPageNumber: boolean;
  showProgress: boolean;
  colorScheme: SlidesColorScheme;
  transition: SlidesTransition;
};

export interface HeadingBlock<T> {
  kind: 'heading';
  level: number;
  text: string;
  element: T;
}

export interface ContentBlock<T> {
  kind: 'content';
  element: T;
}

export interface BreakBlock<T> {
  kind: 'break';
  element: T;
}

export type Block<T> = HeadingBlock<T> | ContentBlock<T> | BreakBlock<T>;

export interface SectionSlidePlan<T> {
  kind: 'section';
  title: string;
  sectionNumber: number;
  blocks: [HeadingBlock<T>];
}

export interface ContentSlidePlan<T> {
  kind: 'content';
  title: string;
  breadcrumb: string[];
  blocks: Block<T>[];
}

export type SlidePlan<T> = SectionSlidePlan<T> | ContentSlidePlan<T>;
