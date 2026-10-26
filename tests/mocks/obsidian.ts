/* eslint-disable */
// Minimal Obsidian runtime mock for Vitest. This file is excluded from the
// TypeScript project and ignored by ESLint; tests use the real Obsidian types.

function fakeElement() {
  return {
    children: [],
    style: {},
    classList: { add() {}, remove() {} },
    createEl() {
      return fakeElement();
    },
    createDiv() {
      return fakeElement();
    },
    createSpan() {
      return fakeElement();
    },
    empty() {},
    setText() {},
    addClass() {},
    removeClass() {},
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    remove() {},
    focus() {},
    select() {},
    setAttribute() {},
  };
}

export class Component {
  cleanups = [];
  loaded = false;
  children = [];

  load() {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    this.onload();
  }

  unload() {
    if (!this.loaded) {
      return;
    }
    this.loaded = false;
    this.onunload();
    for (const cleanup of this.cleanups.splice(0)) {
      cleanup();
    }
  }

  onload() {}
  onunload() {}

  register(callback) {
    this.cleanups.push(callback);
  }

  registerEvent(eventRef) {
    this.register(() => eventRef?.off?.());
  }

  registerInterval(id) {
    this.register(() => clearInterval(id));
    return id;
  }

  registerDomEvent(element, type, callback) {
    element?.addEventListener?.(type, callback);
    this.register(() => element?.removeEventListener?.(type, callback));
  }

  addChild(child) {
    this.children.push(child);
    this.register(() => child.unload());
    return child;
  }
}

export class Notice {
  static messages = [];

  constructor(message) {
    this.message = message;
    Notice.messages.push(message);
  }

  hide() {}
}

export class Modal {
  constructor(app) {
    this.app = app;
    this.containerEl = fakeElement();
    this.modalEl = fakeElement();
    this.titleEl = fakeElement();
    this.contentEl = fakeElement();
    this.buttonContainerEl = fakeElement();
  }

  open() {
    this.onOpen();
  }

  close() {
    this.onClose();
  }

  onOpen() {}
  onClose() {}

  setTitle() {
    return this;
  }

  setContent() {
    return this;
  }

  setCloseCallback() {
    return this;
  }
}

export class ButtonComponent {
  constructor(containerEl) {
    this.containerEl = containerEl;
  }

  setButtonText() {
    return this;
  }

  setCta() {
    return this;
  }

  setDisabled() {
    return this;
  }

  onClick() {
    return this;
  }
}

export class ConfirmationModal extends Modal {
  addCancelButton() {
    return this;
  }

  addButton() {
    return this;
  }

  addCheckbox() {
    return this;
  }
}

export class MarkdownView {
  constructor() {
    this.file = null;
    this.editor = null;
  }

  getMode() {
    return 'source';
  }
}

export class Plugin {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
  }

  addCommand(command) {
    return command;
  }

  removeCommand() {}

  registerEditorExtension() {}

  addRibbonIcon() {
    return fakeElement();
  }

  addStatusBarItem() {
    return fakeElement();
  }

  async loadData() {
    return null;
  }

  async saveData() {}

  addSettingTab() {}
}

export class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = fakeElement();
    this.icon = 'settings';
  }

  update() {}
  refreshDomState() {}
  hide() {}
  getSettingDefinitions() {
    return [];
  }
  getControlValue() {}
  setControlValue() {}
}

export class TFile {
  constructor(path) {
    this.path = path;
  }
}

export class TFolder {
  constructor(path) {
    this.path = path;
  }
}

export function getLanguage() {
  return 'en';
}
