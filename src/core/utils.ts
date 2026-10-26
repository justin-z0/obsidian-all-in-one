export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function evaluateBoolean(
  value: boolean | (() => boolean) | undefined,
): boolean {
  return typeof value === 'function' ? value() : (value ?? true);
}
