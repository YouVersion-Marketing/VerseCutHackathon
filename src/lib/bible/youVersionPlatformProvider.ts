import { config } from '../../config';
import type {
  BibleProvider,
  BibleVersion,
  Book,
  Language,
  Passage,
  PassageQuery,
} from './types';
import { describeBook, USFM_ORDER } from './usfmBooks';

/**
 * YouVersion Platform API (https://api.youversion.com/v1).
 *
 * Auth is the `x-yvp-app-key` header. In the browser the key is injected by a
 * same-origin proxy (Vite dev proxy / a serverless function in prod), so the
 * client calls a relative base (default `/yvp`) and never holds the key.
 * See vite.config.ts and the README.
 *
 * Reference: alfred/yv_platform_api/client.py.
 */
export class YouVersionPlatformProvider implements BibleProvider {
  private base = config.bible.youversion.baseUrl.replace(/\/$/, '');

  private async get<T>(path: string, params?: [string, string][]): Promise<T> {
    const qs = params && params.length ? `?${new URLSearchParams(params)}` : '';
    const headers: Record<string, string> = { Accept: 'application/json' };
    // When calling the API directly (no proxy), include the key client-side.
    if (config.bible.youversion.sendKeyFromClient && config.bible.apiKey) {
      headers['x-yvp-app-key'] = config.bible.apiKey;
    }
    const res = await fetch(`${this.base}${path}${qs}`, { headers });
    if (!res.ok) {
      throw new Error(`YouVersion Platform request failed (${res.status}): ${path}`);
    }
    return (await res.json()) as T;
  }

  async listLanguages(): Promise<Language[]> {
    // page_size=* with ≤3 fields returns the whole set in one request.
    const data = await this.get<{
      data: { id: string; language?: string; display_names?: Record<string, string> }[];
    }>('/v1/languages', [
      ['bibles_available', 'true'],
      ['page_size', '*'],
      ['fields[]', 'id'],
      ['fields[]', 'display_names'],
    ]);
    return data.data
      .map((l) => ({
        id: l.id,
        name: l.display_names?.en || l.display_names?.[l.id] || l.language || l.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listVersions(languageId: string): Promise<BibleVersion[]> {
    const out: BibleVersion[] = [];
    let pageToken: string | undefined;
    do {
      const params: [string, string][] = [
        ['language_ranges[]', languageId],
        ['page_size', '99'],
      ];
      if (pageToken) params.push(['page_token', pageToken]);
      const body = await this.get<{
        data: {
          id: number;
          abbreviation?: string;
          localized_abbreviation?: string;
          title?: string;
          localized_title?: string;
        }[];
        next_page_token?: string | null;
      }>('/v1/bibles', params);
      for (const b of body.data) {
        out.push({
          id: String(b.id),
          abbreviation: b.localized_abbreviation || b.abbreviation || String(b.id),
          name: b.localized_title || b.title || b.abbreviation || String(b.id),
          languageId,
        });
      }
      pageToken = body.next_page_token ?? undefined;
    } while (pageToken);
    return out;
  }

  async listBooks(versionId: string): Promise<Book[]> {
    // /v1/bibles/{id} returns just the USFM codes the version contains; join
    // against the canonical table for names + chapter counts.
    const detail = await this.get<{ books?: string[] }>(`/v1/bibles/${versionId}`);
    const codes = detail.books ?? [];
    const present = new Set(codes);
    return USFM_ORDER.filter((c) => present.has(c)).map((c) => {
      const meta = describeBook(c);
      return { id: c, name: meta.name, chapters: meta.chapters };
    });
  }

  async fetchPassage(query: PassageQuery): Promise<Passage> {
    const passageId =
      query.fromVerse === query.toVerse
        ? `${query.bookId}.${query.chapter}.${query.fromVerse}`
        : `${query.bookId}.${query.chapter}.${query.fromVerse}-${query.toVerse}`;

    const data = await this.get<{ id: string; content: string; reference: string }>(
      `/v1/bibles/${query.versionId}/passages/${passageId}`,
      [['format', 'text']],
    );

    // Look up the abbreviation from the bible detail (cheap, cached by browser).
    let abbr = '';
    try {
      const detail = await this.get<{ abbreviation?: string; localized_abbreviation?: string }>(
        `/v1/bibles/${query.versionId}`,
      );
      abbr = detail.localized_abbreviation || detail.abbreviation || '';
    } catch {
      /* abbreviation is optional */
    }

    return {
      reference: data.reference,
      text: data.content.replace(/\s+/g, ' ').trim(),
      versionAbbreviation: abbr,
    };
  }
}
