import type { App, TFile } from 'obsidian';
import type { Logger } from '../../core/logger';

export function formatAttachmentLink(
  app: App,
  file: TFile,
  notePath: string,
  isImage: boolean,
  embedImages: boolean,
  logger: Logger,
): string {
  try {
    const link = app.fileManager.generateMarkdownLink(file, notePath);
    return isImage && embedImages ? `!${link}` : link;
  } catch (error) {
    logger.error('failed to generate a Markdown link', error);
    return isImage && embedImages ? `![[${file.path}]]` : `[[${file.path}]]`;
  }
}
