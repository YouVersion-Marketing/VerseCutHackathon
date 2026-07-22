import { describe, expect, it } from 'vitest';
import {
  csvCell,
  toCsv,
  buildVersionsCsv,
  buildGeoByCountryCsv,
  buildGeoByLanguageCsv,
} from './csv';
import type { GeoLanguageRender, GeoResult, VersionExportRow } from './types';

describe('csvCell', () => {
  it('passes plain values through', () => {
    expect(csvCell('John 3:16')).toBe('John 3:16');
  });
  it('quotes and escapes commas, quotes, and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });
  it('neutralizes spreadsheet formula injection with a leading apostrophe', () => {
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    // Leading '=' plus a comma → apostrophe-prefixed AND RFC-4180 quoted.
    expect(csvCell('=HYPERLINK("x","y")')).toBe('"\'=HYPERLINK(""x"",""y"")"');
  });
});

describe('toCsv', () => {
  it('joins headers and rows with CRLF and a trailing newline', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe('a,b\r\n1,2\r\n');
  });
});

describe('buildVersionsCsv', () => {
  it('emits the four columns and escapes verse text', () => {
    const rows: VersionExportRow[] = [
      { version_id: '111', reference: 'John 3:16', verse_text: 'For God, so "loved"', air_cdn_link: 'https://cdn/x.jpg' },
    ];
    expect(buildVersionsCsv(rows)).toBe(
      'version_id,reference,verse_text,air_cdn_link\r\n111,John 3:16,"For God, so ""loved""",https://cdn/x.jpg\r\n',
    );
  });
});

const GEO: GeoResult[] = [
  {
    country: 'France',
    capital: 'Paris',
    images: [
      { url: 'https://img/a.jpg', credit: 'Ann / Unsplash' },
      { url: 'https://img/b.jpg', credit: 'Bo / Unsplash' },
    ],
    languages: [
      { code: 'fr', name: 'French' },
      { code: 'br', name: 'Breton' },
    ],
  },
];

describe('buildGeoByCountryCsv', () => {
  it('lists the raw candidate photos per country in per-image columns', () => {
    expect(buildGeoByCountryCsv(GEO)).toBe(
      'country,capital,image_url_1,credit_1,image_url_2,credit_2\r\n' +
        'France,Paris,https://img/a.jpg,Ann / Unsplash,https://img/b.jpg,Bo / Unsplash\r\n',
    );
  });

  it('pads rows with fewer images so every row has the same columns', () => {
    const mixed: GeoResult[] = [
      GEO[0],
      {
        country: 'Spain',
        capital: 'Madrid',
        images: [{ url: 'https://img/s.jpg', credit: 'Si / Unsplash' }],
        languages: [{ code: 'es', name: 'Spanish' }],
      },
    ];
    expect(buildGeoByCountryCsv(mixed)).toBe(
      'country,capital,image_url_1,credit_1,image_url_2,credit_2\r\n' +
        'France,Paris,https://img/a.jpg,Ann / Unsplash,https://img/b.jpg,Bo / Unsplash\r\n' +
        'Spain,Madrid,https://img/s.jpg,Si / Unsplash,,\r\n',
    );
  });
});

describe('buildGeoByLanguageCsv', () => {
  it('emits one localized rendered image row per language with its cdn link', () => {
    const rows: GeoLanguageRender[] = [
      {
        language: 'fr',
        language_name: 'French',
        country: 'France',
        reference: 'Jean 3:16',
        verse_text: 'Car Dieu a tant aimé le monde',
        background_url: 'https://img/a.jpg',
        credit: 'Ann / Unsplash',
        cdn_url: 'https://cdn/fr.jpg',
      },
      {
        language: 'br',
        language_name: 'Breton',
        country: 'France',
        reference: 'Yann 3:16',
        verse_text: 'Rak Doue en deus karet',
        background_url: 'https://img/a.jpg',
        credit: 'Ann / Unsplash',
        cdn_url: '', // upload failed → blank
      },
    ];
    expect(buildGeoByLanguageCsv(rows)).toBe(
      'language,language_name,country,reference,verse_text,background_url,cdn_url,credit\r\n' +
        'fr,French,France,Jean 3:16,Car Dieu a tant aimé le monde,https://img/a.jpg,https://cdn/fr.jpg,Ann / Unsplash\r\n' +
        'br,Breton,France,Yann 3:16,Rak Doue en deus karet,https://img/a.jpg,,Ann / Unsplash\r\n',
    );
  });
});
