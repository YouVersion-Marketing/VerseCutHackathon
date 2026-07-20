import { describe, expect, it } from 'vitest';
import { filterSelectOptions, type SelectOption } from './selectFilter';

const opts: SelectOption[] = [
  { value: 'en', label: 'English', group: 'Popular' },
  { value: 'te', label: 'Telugu' },
  { value: 'ta', label: 'Tamil' },
  { value: 'de', label: 'German' },
];

describe('filterSelectOptions', () => {
  it('returns all options for an empty or whitespace query', () => {
    expect(filterSelectOptions(opts, '')).toHaveLength(4);
    expect(filterSelectOptions(opts, '   ')).toHaveLength(4);
  });
  it('matches label case-insensitively as a substring', () => {
    expect(filterSelectOptions(opts, 'tel').map((o) => o.value)).toEqual(['te']);
    expect(filterSelectOptions(opts, 'TAM').map((o) => o.value)).toEqual(['ta']);
    expect(filterSelectOptions(opts, 'man').map((o) => o.value)).toEqual(['de']);
  });
  it('matches on group name too', () => {
    expect(filterSelectOptions(opts, 'popular').map((o) => o.value)).toEqual(['en']);
  });
  it('returns an empty array when nothing matches', () => {
    expect(filterSelectOptions(opts, 'zzz')).toEqual([]);
  });
  it('returns every option sharing a substring', () => {
    // "l" appears in English, Telugu, Tamil (not German; not the "Popular" group).
    expect(filterSelectOptions(opts, 'l').map((o) => o.value).sort()).toEqual([
      'en',
      'ta',
      'te',
    ]);
  });
});
