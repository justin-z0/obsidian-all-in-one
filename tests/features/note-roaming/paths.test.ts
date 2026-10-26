import { describe, expect, it } from 'vitest';
import {
  filterRoamableNotes,
  isNoteInRoamScope,
  parseRoamScope,
  pickRandom,
} from '../../../src/features/note-roaming/paths';

function note(path: string): { path: string } {
  return { path };
}

describe('parseRoamScope', () => {
  it('treats an empty value as the whole vault', () => {
    expect(parseRoamScope('')).toEqual({
      unrestricted: true,
      paths: [],
      invalid: [],
    });
    expect(parseRoamScope('  \n\n  ')).toEqual({
      unrestricted: true,
      paths: [],
      invalid: [],
    });
  });

  it('normalizes folder and file entries, ignoring blanks and duplicates', () => {
    const scope = parseRoamScope(
      '  notes/  \nnotes\\daily\n/notes/daily/\nnotes\nreading/list.md\n',
    );

    expect(scope).toEqual({
      unrestricted: false,
      paths: ['notes', 'notes/daily', 'reading/list.md'],
      invalid: [],
    });
  });

  it('keeps invalid lines separate without widening the scope', () => {
    const scope = parseRoamScope(
      'C:\\vault\\notes\n../outside\n//server/share\n/\nnotes/../secret',
    );

    expect(scope.unrestricted).toBe(false);
    expect(scope.paths).toEqual([]);
    expect(scope.invalid).toEqual([
      'C:\\vault\\notes',
      '../outside',
      '//server/share',
      '/',
      'notes/../secret',
    ]);
  });

  it('accepts a single leading slash as a vault-relative path', () => {
    expect(parseRoamScope('/notes/daily/').paths).toEqual(['notes/daily']);
  });
});

describe('roaming scope matching', () => {
  const scope = parseRoamScope('notes\nreading/list.md');

  it('includes a configured file and every note under a configured folder', () => {
    expect(isNoteInRoamScope('notes/a.md', scope)).toBe(true);
    expect(isNoteInRoamScope('notes/sub/b.md', scope)).toBe(true);
    expect(isNoteInRoamScope('reading/list.md', scope)).toBe(true);
  });

  it('does not match sibling folders by prefix', () => {
    expect(isNoteInRoamScope('notes-private/c.md', scope)).toBe(false);
    expect(isNoteInRoamScope('reading/list.md.bak', scope)).toBe(false);
    expect(isNoteInRoamScope('other/d.md', scope)).toBe(false);
  });

  it('includes everything when the scope is unrestricted', () => {
    const all = parseRoamScope('');
    expect(isNoteInRoamScope('anywhere/note.md', all)).toBe(true);
  });

  it('includes nothing when the configuration only has invalid lines', () => {
    const invalid = parseRoamScope('../outside');
    expect(isNoteInRoamScope('notes/a.md', invalid)).toBe(false);
  });

  it('filters a note list by scope', () => {
    const notes = [
      note('notes/a.md'),
      note('notes/sub/b.md'),
      note('notes-private/c.md'),
      note('reading/list.md'),
      note('reading/other.md'),
    ];

    expect(filterRoamableNotes(notes, scope).map((item) => item.path)).toEqual([
      'notes/a.md',
      'notes/sub/b.md',
      'reading/list.md',
    ]);
  });
});

describe('pickRandom', () => {
  it('returns undefined for an empty list', () => {
    expect(pickRandom([], () => 0)).toBeUndefined();
  });

  it('uses the injected random source', () => {
    const items = ['a', 'b', 'c'];

    expect(pickRandom(items, () => 0)).toBe('a');
    expect(pickRandom(items, () => 0.34)).toBe('b');
    expect(pickRandom(items, () => 0.999)).toBe('c');
  });

  it('clamps out-of-range random values', () => {
    expect(pickRandom(['a', 'b'], () => 1)).toBe('b');
    expect(pickRandom(['a', 'b'], () => -1)).toBe('a');
    expect(pickRandom(['a', 'b'], () => Number.NaN)).toBe('a');
  });
});
