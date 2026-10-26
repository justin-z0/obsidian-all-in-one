import type { ClipboardImage } from './types';

export function extractClipboardImages(
  data: DataTransfer | null,
): ClipboardImage[] {
  if (!data) {
    return [];
  }

  const images: ClipboardImage[] = [];

  for (const item of Array.from(data.items)) {
    if (item.kind !== 'file') {
      continue;
    }

    const file = item.getAsFile();
    if (!file || file.size === 0) {
      continue;
    }

    const mime = item.type || file.type;
    if (!mime.toLowerCase().startsWith('image/')) {
      continue;
    }

    images.push({
      mime,
      fileName: file.name,
      read: () => file.arrayBuffer(),
    });
  }

  return images;
}
