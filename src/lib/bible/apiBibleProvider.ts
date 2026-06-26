import { config } from '../../config';
import type {
  BibleProvider,
  BibleVersion,
  Book,
  Language,
  Passage,
  PassageQuery,
} from './types';

/**
 * Adapter for API.Bible (https://scripture.api.bible).
 * Docs: GET /bibles, /bibles/{id}/books, /bibles/{id}/passages/{passageId}.
 * passageId format: BOOK.CH.V or a range BOOK.CH.V1-BOOK.CH.V2 (e.g. JHN.3.16-JHN.3.17).
 */
export class ApiBibleProvider implements BibleProvider {
  private get headers() {
    return { 'api-key': config.bible.apiKey };
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${config.bible.apiBaseUrl}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`API.Bible request failed (${res.status}): ${path}`);
    }
    const json = await res.json();
    return json.data as T;
  }

  async listLanguages(): Promise<Language[]> {
    const bibles = await this.get<Array<{ language: { id: string; name: string } }>>(
      '/bibles',
    );
    const seen = new Map<string, Language>();
    for (const b of bibles) {
      if (!seen.has(b.language.id)) {
        seen.set(b.language.id, { id: b.language.id, name: b.language.name });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listVersions(languageId: string): Promise<BibleVersion[]> {
    const bibles = await this.get<
      Array<{ id: string; abbreviationLocal: string; name: string }>
    >('/bibles', { language: languageId });
    return bibles.map((b) => ({
      id: b.id,
      abbreviation: b.abbreviationLocal,
      name: b.name,
      languageId,
    }));
  }

  async listBooks(versionId: string): Promise<Book[]> {
    const books = await this.get<Array<{ id: string; name: string; chapters?: unknown[] }>>(
      `/bibles/${versionId}/books`,
      { 'include-chapters': 'true' },
    );
    return books.map((b) => ({
      id: b.id,
      name: b.name,
      // chapters array includes an "intro" entry; subtract it when present.
      chapters: Math.max(1, (b.chapters?.length ?? 1) - 1),
    }));
  }

  async fetchPassage(query: PassageQuery): Promise<Passage> {
    const passageId =
      query.fromVerse === query.toVerse
        ? `${query.bookId}.${query.chapter}.${query.fromVerse}`
        : `${query.bookId}.${query.chapter}.${query.fromVerse}-${query.bookId}.${query.chapter}.${query.toVerse}`;

    const data = await this.get<{
      content: string;
      reference: string;
    }>(`/bibles/${query.versionId}/passages/${passageId}`, {
      'content-type': 'text',
      'include-verse-numbers': 'false',
      'include-notes': 'false',
      'include-titles': 'false',
    });

    const versions = await this.listVersions('');
    const abbr = versions.find((v) => v.id === query.versionId)?.abbreviation ?? '';

    return {
      reference: data.reference,
      text: data.content.replace(/\s+/g, ' ').trim(),
      versionAbbreviation: abbr,
    };
  }
}
