/** Orientation filter accepted by Unsplash search / list endpoints. */
export type UnsplashOrientation = 'landscape' | 'portrait' | 'squarish';

/** Slim photo shape returned by our API and used in the studio UI. */
export interface UnsplashPhoto {
  id: string;
  description: string | null;
  urls: {
    thumb: string;
    small: string;
    regular: string;
  };
  user: {
    name: string;
    profileUrl: string;
  };
  links: {
    html: string;
    downloadLocation: string;
  };
}

export interface UnsplashSearchResult {
  photos: UnsplashPhoto[];
  total: number;
  totalPages: number;
}

export interface UnsplashSearchParams {
  query?: string;
  page?: number;
  perPage?: number;
  orientation?: UnsplashOrientation | 'all';
}
