// Kokoro voice selection. Kokoro v1.0 covers a subset of languages; for others
// in-browser voiceover isn't offered (defaultVoice returns null).
export interface Voice {
  id: string;
  label: string;
  lang: string;
}

export const VOICES: Voice[] = [
  { id: 'af_heart', label: 'Heart — US English (F)', lang: 'en' },
  { id: 'am_michael', label: 'Michael — US English (M)', lang: 'en' },
  { id: 'bf_emma', label: 'Emma — British English (F)', lang: 'en' },
  { id: 'ef_dora', label: 'Dora — Spanish (F)', lang: 'es' },
  { id: 'ff_siwis', label: 'Siwis — French (F)', lang: 'fr' },
  { id: 'if_sara', label: 'Sara — Italian (F)', lang: 'it' },
  { id: 'pf_dora', label: 'Dora — Portuguese (F)', lang: 'pt' },
  { id: 'hf_alpha', label: 'Alpha — Hindi (F)', lang: 'hi' },
  { id: 'jf_alpha', label: 'Alpha — Japanese (F)', lang: 'ja' },
  { id: 'zf_xiaobei', label: 'Xiaobei — Mandarin (F)', lang: 'zh' },
];

// Keys use underscores to match the YouVersion app language codes (e.g. "en_GB"
// in appLanguages.ts); lookups normalize hyphens to underscores so both forms hit.
const DEFAULT_BY_LANG: Record<string, string> = {
  en: 'af_heart',
  en_GB: 'bf_emma',
  es: 'ef_dora',
  es_LA: 'ef_dora',
  fr: 'ff_siwis',
  it: 'if_sara',
  pt: 'pf_dora',
  pt_BR: 'pf_dora',
  hi: 'hf_alpha',
  ja: 'jf_alpha',
  zh: 'zf_xiaobei',
  zh_CN: 'zf_xiaobei',
  zh_TW: 'zf_xiaobei',
};

/** Default voice id for a language code, or null if Kokoro doesn't cover it. */
export function defaultVoice(languageCode: string): string | null {
  const norm = languageCode.replace(/-/g, '_');
  return DEFAULT_BY_LANG[norm] ?? DEFAULT_BY_LANG[norm.split('_')[0]] ?? null;
}

export function voiceSupported(languageCode: string): boolean {
  return defaultVoice(languageCode) !== null;
}
