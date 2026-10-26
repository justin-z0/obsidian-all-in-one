import type { EditorPosition } from 'obsidian';

export type AttachmentOptions = {
  assetsRoot: string;
  filenamePattern: string;
  uploadFilenamePattern: string;
  embedImages: boolean;
};

export interface ClipboardImage {
  mime: string;
  fileName: string;
  read: () => Promise<ArrayBuffer>;
}

export interface UploadedFile {
  name: string;
  mime: string;
  read: () => Promise<ArrayBuffer>;
}

export interface InsertTarget {
  from: EditorPosition;
  to: EditorPosition;
}

export interface PreparedAttachment {
  baseName: string;
  extension: string;
  read: () => Promise<ArrayBuffer>;
  isImage: boolean;
}

export interface NamePromptRequest {
  folder: string;
  extension: string;
  defaultBaseName: string;
  reserved: ReadonlySet<string>;
  index: number;
  total: number;
}
