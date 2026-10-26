const GLOBAL_PREFIX = 'global.';
const ENABLED_SUFFIX = '$enabled';

export type ParsedControlKey =
  | { kind: 'global'; key: string }
  | { kind: 'enabled'; featureId: string }
  | { kind: 'option'; featureId: string; key: string };

export function globalControlKey(key: string): string {
  return `${GLOBAL_PREFIX}${key}`;
}

export function enabledControlKey(featureId: string): string {
  return `${featureId}.${ENABLED_SUFFIX}`;
}

export function optionControlKey(featureId: string, key: string): string {
  return `${featureId}.${key}`;
}

export function parseControlKey(raw: string): ParsedControlKey {
  if (raw.startsWith(GLOBAL_PREFIX)) {
    const key = raw.slice(GLOBAL_PREFIX.length);
    if (!key) {
      throw new Error(`Invalid control key: ${raw}`);
    }
    return { kind: 'global', key };
  }

  const separator = raw.indexOf('.');
  if (separator <= 0 || separator === raw.length - 1) {
    throw new Error(`Invalid control key: ${raw}`);
  }

  const featureId = raw.slice(0, separator);
  const key = raw.slice(separator + 1);

  if (key === ENABLED_SUFFIX) {
    return { kind: 'enabled', featureId };
  }

  return { kind: 'option', featureId, key };
}
