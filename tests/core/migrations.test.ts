import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  migrate,
  runMigrations,
} from '../../src/core/migrations';

describe('migrations', () => {
  it('runs migrations in order', () => {
    const result = runMigrations(
      { schemaVersion: 0, value: 1 },
      {
        1: (data) => ({ ...data, one: true }),
        2: (data) => ({ ...data, two: true }),
      },
      2,
    );

    expect(result).toMatchObject({
      schemaVersion: 2,
      one: true,
      two: true,
      value: 1,
    });
  });

  it('throws when a migration is missing', () => {
    expect(() =>
      runMigrations({ schemaVersion: 0 }, {}, 1),
    ).toThrow('Missing migration');
  });

  it('does not downgrade data with a newer schema version', () => {
    const result = runMigrations(
      { schemaVersion: CURRENT_SCHEMA_VERSION + 5, value: 'kept' },
      {},
      CURRENT_SCHEMA_VERSION,
    );

    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION + 5);
    expect(result.value).toBe('kept');
  });

  it('treats missing data as version 0 and converts it to the current version', () => {
    expect(migrate(null)).toEqual({ schemaVersion: CURRENT_SCHEMA_VERSION });
    expect(migrate({ schemaVersion: undefined })).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });
  });
});
