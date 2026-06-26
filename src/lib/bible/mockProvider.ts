import type {
  BibleProvider,
  BibleVersion,
  Book,
  Language,
  Passage,
  PassageQuery,
} from './types';

// Minimal offline data set so the app is fully usable without an API key.
const LANGUAGES: Language[] = [
  { id: 'eng', name: 'English' },
  { id: 'spa', name: 'Spanish' },
  { id: 'por', name: 'Portuguese' },
  { id: 'fra', name: 'French' },
];

const VERSIONS: BibleVersion[] = [
  { id: 'niv', abbreviation: 'NIV', name: 'New International Version', languageId: 'eng' },
  { id: 'esv', abbreviation: 'ESV', name: 'English Standard Version', languageId: 'eng' },
  { id: 'kjv', abbreviation: 'KJV', name: 'King James Version', languageId: 'eng' },
  { id: 'nlt', abbreviation: 'NLT', name: 'New Living Translation', languageId: 'eng' },
  { id: 'msg', abbreviation: 'MSG', name: 'The Message', languageId: 'eng' },
  { id: 'csb', abbreviation: 'CSB', name: 'Christian Standard Bible', languageId: 'eng' },
  { id: 'nasb', abbreviation: 'NASB', name: 'New American Standard Bible', languageId: 'eng' },
  { id: 'rvr60', abbreviation: 'RVR60', name: 'Reina-Valera 1960', languageId: 'spa' },
  { id: 'nvi-es', abbreviation: 'NVI', name: 'Nueva Versión Internacional', languageId: 'spa' },
  { id: 'arc', abbreviation: 'ARC', name: 'Almeida Revista e Corrigida', languageId: 'por' },
  { id: 'lsg', abbreviation: 'LSG', name: 'Louis Segond', languageId: 'fra' },
];

const BOOKS: Book[] = [
  { id: 'GEN', name: 'Genesis', chapters: 50 },
  { id: 'PSA', name: 'Psalms', chapters: 150 },
  { id: 'PRO', name: 'Proverbs', chapters: 31 },
  { id: 'ISA', name: 'Isaiah', chapters: 66 },
  { id: 'MAT', name: 'Matthew', chapters: 28 },
  { id: 'JHN', name: 'John', chapters: 21 },
  { id: 'ROM', name: 'Romans', chapters: 16 },
  { id: 'PHP', name: 'Philippians', chapters: 4 },
];

// A few real passages keyed by "VERSION:BOOK.CH.V". Anything else falls back to
// a generated placeholder so the rendering pipeline always has text.
const SAMPLE_TEXT: Record<string, string> = {
  'niv:JHN.3.16':
    'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
  'niv:JHN.3.17':
    'For God did not send his Son into the world to condemn the world, but to save the world through him.',
  'niv:PHP.4.13': 'I can do all this through him who gives me strength.',
  'niv:ROM.8.28':
    'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.',
  'esv:JHN.3.16':
    'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.',
  'kjv:JHN.3.16':
    'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockBibleProvider implements BibleProvider {
  async listLanguages(): Promise<Language[]> {
    await delay(150);
    return LANGUAGES;
  }

  async listVersions(languageId: string): Promise<BibleVersion[]> {
    await delay(150);
    return VERSIONS.filter((v) => v.languageId === languageId);
  }

  async listBooks(_versionId: string): Promise<Book[]> {
    await delay(150);
    return BOOKS;
  }

  async fetchPassage(query: PassageQuery): Promise<Passage> {
    await delay(400);
    const version = VERSIONS.find((v) => v.id === query.versionId);
    const book = BOOKS.find((b) => b.id === query.bookId);
    const bookName = book?.name ?? query.bookId;

    const parts: string[] = [];
    for (let v = query.fromVerse; v <= query.toVerse; v++) {
      const key = `${query.versionId}:${query.bookId}.${query.chapter}.${v}`;
      parts.push(
        SAMPLE_TEXT[key] ??
          `[${bookName} ${query.chapter}:${v}] Sample verse text for preview — connect API.Bible to load the real translation.`,
      );
    }

    const range =
      query.fromVerse === query.toVerse
        ? `${query.fromVerse}`
        : `${query.fromVerse}-${query.toVerse}`;

    return {
      reference: `${bookName} ${query.chapter}:${range}`,
      text: parts.join(' '),
      versionAbbreviation: version?.abbreviation ?? '',
    };
  }
}
