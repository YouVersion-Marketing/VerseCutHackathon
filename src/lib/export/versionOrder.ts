import type { ExportVersion } from './versionExport';

/**
 * Reorder versions so those whose language `code` is in `priorityCodes` come
 * first (in the given priority order), then everything else in its original
 * order. Used so a small test limit renders well-known languages (which
 * actually contain the verse and upload cleanly) instead of the alphabetical
 * long tail, which is mostly partial/single-book translations.
 */
export function prioritizeVersions(
  versions: ExportVersion[],
  priorityCodes: string[],
): ExportVersion[] {
  const rank = new Map(priorityCodes.map((code, i) => [code, i]));
  const priority: ExportVersion[] = [];
  const rest: ExportVersion[] = [];
  for (const v of versions) {
    if (rank.has(v.code)) priority.push(v);
    else rest.push(v);
  }
  priority.sort((a, b) => (rank.get(a.code) ?? 0) - (rank.get(b.code) ?? 0));
  return [...priority, ...rest];
}

/** Default priority: major, well-covered languages first. */
export const DEFAULT_PRIORITY_CODES = [
  'en',
  'es',
  'es-LA',
  'pt-BR',
  'pt',
  'fr',
  'de',
  'it',
  'ru',
  'zh-CN',
  'ko',
  'ja',
  'id',
  'hi',
  'ar',
];
