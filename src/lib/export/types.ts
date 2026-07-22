export interface VersionExportRow {
  version_id: string;
  reference: string;
  verse_text: string;
  air_cdn_link: string;
}

export interface GeoImage {
  url: string;
  credit: string;
}

export interface GeoResult {
  country: string;
  capital: string;
  images: GeoImage[];
  languages: { code: string; name: string }[];
}

/**
 * One localized geo asset: the selected verse rendered in a language over its
 * country's top landmark photo, uploaded to the chosen destination.
 */
export interface GeoLanguageRender {
  language: string;
  language_name: string;
  country: string;
  reference: string;
  verse_text: string;
  /** Unsplash background photo the verse was rendered over. */
  background_url: string;
  credit: string;
  /** CDN URL of the rendered+uploaded localized image (blank if it failed). */
  cdn_url: string;
}
