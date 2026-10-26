export class Logger {
  constructor(
    private readonly scope: string,
    private readonly isDebugEnabled: () => boolean,
  ) {}

  debug(...args: unknown[]): void {
    if (this.isDebugEnabled()) {
      console.debug(`[all-in-one:${this.scope}]`, ...args);
    }
  }

  warn(...args: unknown[]): void {
    console.warn(`[all-in-one:${this.scope}]`, ...args);
  }

  error(...args: unknown[]): void {
    console.error(`[all-in-one:${this.scope}]`, ...args);
  }
}
