import { describe, expect, it } from 'vitest';
import { extractClipboardImages } from '../../../src/features/attachments/clipboard';

function imageFile(name = 'image.png', type = 'image/png'): {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
} {
  return {
    name,
    type,
    size: 4,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
  };
}

describe('extractClipboardImages', () => {
  it('extracts image files from clipboard items', async () => {
    const file = imageFile();
    const data = {
      items: [
        {
          kind: 'file',
          type: 'image/png',
          getAsFile: () => file,
        },
        {
          kind: 'string',
          type: 'text/plain',
          getAsFile: () => null,
        },
      ],
    } as unknown as DataTransfer;

    const images = extractClipboardImages(data);
    const image = images[0];

    expect(images).toHaveLength(1);
    expect(image?.mime).toBe('image/png');
    expect(await image?.read()).toBeInstanceOf(ArrayBuffer);
  });

  it('returns an empty list for missing or non-image data', () => {
    expect(extractClipboardImages(null)).toEqual([]);

    const data = {
      items: [
        {
          kind: 'file',
          type: 'application/pdf',
          getAsFile: () => imageFile('file.pdf', 'application/pdf'),
        },
      ],
    } as unknown as DataTransfer;

    expect(extractClipboardImages(data)).toEqual([]);
  });
});
