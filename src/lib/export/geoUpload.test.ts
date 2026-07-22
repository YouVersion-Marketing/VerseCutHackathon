import { describe, expect, it } from 'vitest';
import { geoUploadName } from '@/lib/export/geoUpload';
import { isValidExportKey } from '@/lib/server/uploadGuards';

describe('geoUploadName', () => {
  it('builds a guard-compatible per-language jpg key for AWS and AIR', () => {
    const aws = geoUploadName('aws', '2026-07-22', 'South Africa', 'af');
    expect(aws).toBe('versecut/2026-07-22/geo/south-africa_af.jpg');
    expect(isValidExportKey(aws)).toBe(true);

    const air = geoUploadName('air', '2026-07-22', 'France', 'fr');
    expect(air).toBe('versecut/2026-07-22/geo/france_fr.jpg');
    expect(isValidExportKey(air)).toBe(true);
  });

  it('omits the extension for Braze (it derives type from MIME)', () => {
    expect(geoUploadName('braze', '2026-07-22', 'Spain', 'es')).toBe(
      'versecut/2026-07-22/geo/spain_es',
    );
  });
});
