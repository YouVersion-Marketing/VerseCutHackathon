import { describe, expect, it } from 'vitest';
import { prioritizeVersions } from './versionOrder';
import type { ExportVersion } from './versionExport';

const v = (id: string, code: string): ExportVersion => ({ id, code });

describe('prioritizeVersions', () => {
  it('moves priority-code versions to the front in priority order, keeping the rest stable', () => {
    const input = [v('1', 'aau'), v('2', 'es'), v('3', 'en'), v('4', 'en'), v('5', 'zz')];
    const out = prioritizeVersions(input, ['en', 'es']);
    expect(out.map((x) => x.id)).toEqual(['3', '4', '2', '1', '5']);
  });

  it('returns versions unchanged when none match the priority list', () => {
    const input = [v('1', 'aau'), v('2', 'zz')];
    expect(prioritizeVersions(input, ['en']).map((x) => x.id)).toEqual(['1', '2']);
  });
});
