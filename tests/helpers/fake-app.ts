import type { App } from 'obsidian';

export interface FakeBinaryFile {
  path: string;
  data?: ArrayBuffer;
}

export class FakeVault {
  readonly folders = new Set<string>();
  readonly files = new Map<string, FakeBinaryFile>();

  getAbstractFileByPath(path: string): unknown {
    return this.files.get(path) ?? (this.folders.has(path) ? { path } : null);
  }

  getFolderByPath(path: string): unknown {
    return this.folders.has(path) ? { path } : null;
  }

  async createFolder(path: string): Promise<unknown> {
    if (this.folders.has(path)) {
      throw new Error(`Folder exists: ${path}`);
    }
    this.folders.add(path);
    return { path };
  }

  async createBinary(path: string, data: ArrayBuffer): Promise<unknown> {
    if (this.files.has(path)) {
      throw new Error(`File exists: ${path}`);
    }
    const file: FakeBinaryFile = { path, data };
    this.files.set(path, file);
    return file;
  }
}

export interface FakeApp {
  app: App;
  vault: FakeVault;
}

export function createFakeApp(): FakeApp {
  const vault = new FakeVault();
  const app = {
    vault,
    fileManager: {
      generateMarkdownLink(file: { path: string }): string {
        return `[[${file.path}]]`;
      },
    },
    workspace: {
      updateOptions(): void {
        // no-op
      },
      on(): { off(): void } {
        return { off(): void { /* no-op */ } };
      },
      getActiveViewOfType(): null {
        return null;
      },
    },
  } as unknown as App;

  return { app, vault };
}
