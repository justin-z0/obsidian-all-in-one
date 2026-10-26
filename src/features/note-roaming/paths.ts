/**
 * Parsed roaming scope.
 *
 * - `unrestricted` is true when the user left the setting empty; every
 *   Markdown note in the vault is eligible.
 * - `paths` contains normalized vault-relative folders and files. An entry
 *   matches the exact path or, when it is a folder, everything below it.
 * - `invalid` keeps the original lines that could not be normalized. The
 *   caller decides whether to warn; invalid entries never widen the scope.
 */
export interface RoamScope {
  unrestricted: boolean;
  paths: readonly string[];
  invalid: readonly string[];
}

const WINDOWS_DRIVE = /^[a-zA-Z]:/;

function normalizeRoamPath(line: string): string | null {
  const raw = line.trim().replace(/\\/g, '/');
  if (!raw) {
    return null;
  }

  if (WINDOWS_DRIVE.test(raw) || raw.startsWith('//')) {
    return null;
  }

  const trimmed = raw.replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    return null;
  }

  const segments = trimmed.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }

  return segments.join('/');
}

export function parseRoamScope(input: string): RoamScope {
  const lines = input.split(/\r?\n/);
  const paths: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let hasInput = false;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    hasInput = true;
    const normalized = normalizeRoamPath(line);
    if (!normalized) {
      invalid.push(line.trim());
      continue;
    }

    if (!seen.has(normalized)) {
      seen.add(normalized);
      paths.push(normalized);
    }
  }

  return {
    unrestricted: !hasInput,
    paths,
    invalid,
  };
}

/**
 * A configured entry matches itself and, when it is a folder, any note below
 * it. Prefix matching adds a separator so `notes-private/` is not considered
 * part of `notes/`.
 */
export function isNoteInRoamScope(
  notePath: string,
  scope: RoamScope,
): boolean {
  if (scope.unrestricted) {
    return true;
  }

  if (scope.paths.length === 0) {
    return false;
  }

  const normalized = notePath.replace(/\\/g, '/').replace(/^\/+/, '');

  return scope.paths.some(
    (entry) => normalized === entry || normalized.startsWith(`${entry}/`),
  );
}

export function filterRoamableNotes<T extends { path: string }>(
  notes: readonly T[],
  scope: RoamScope,
): T[] {
  return notes.filter((note) => isNoteInRoamScope(note.path, scope));
}

export function pickRandom<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T | undefined {
  if (items.length === 0) {
    return undefined;
  }

  const value = random();
  const safe = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1 - Number.EPSILON)
    : 0;

  return items[Math.floor(safe * items.length)];
}
