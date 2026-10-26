import { isRecord } from './utils';

export type RawData = Record<string, unknown>;
export type Migration = (data: RawData) => RawData;

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Version 1 is the initial schema. The identity migration also converts
 * pre-versioned data (schemaVersion missing) into version 1.
 */
export const migrations: Record<number, Migration> = {
  1: (data) => data,
};

export function readVersion(data: RawData): number {
  const value = data.schemaVersion;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

export function runMigrations(
  raw: unknown,
  migrationMap: Record<number, Migration>,
  targetVersion: number,
): RawData {
  let data = isRecord(raw) ? raw : {};
  let version = readVersion(data);

  if (version > targetVersion) {
    return data;
  }

  while (version < targetVersion) {
    const next = version + 1;
    const migration = migrationMap[next];

    if (!migration) {
      throw new Error(`Missing migration for schema version ${next}`);
    }

    data = migration(data);
    version = next;
  }

  return { ...data, schemaVersion: version };
}

export function migrate(raw: unknown): RawData {
  return runMigrations(raw, migrations, CURRENT_SCHEMA_VERSION);
}
