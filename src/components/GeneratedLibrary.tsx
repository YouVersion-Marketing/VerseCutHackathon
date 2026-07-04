import { useEffect, useMemo, useState } from 'react';
import { deleteMyAd, listMyAds, type SavedAd } from '../lib/library';
import { Download, Spinner, Trash } from './icons';
import { Select } from './ui';
import { LazyVideo } from './LazyVideo';

type KindFilter = 'all' | 'image' | 'video';
type SortKey = 'newest' | 'oldest' | 'title';

// Right-panel browser for the user's own previously-generated ads (saved to the
// library), with kind/aspect/language/tag filters and sorting. Assets are
// viewable + playable (videos render with controls).
export function GeneratedLibrary() {
  const [ads, setAds] = useState<SavedAd[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilter>('all');
  const [aspect, setAspect] = useState<string>('all');
  const [language, setLanguage] = useState<string>('all');
  const [tag, setTag] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('newest');

  useEffect(() => {
    let active = true;
    setAds(null);
    setError(null);
    listMyAds()
      .then((a) => active && setAds(a))
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Failed to load'));
    return () => {
      active = false;
    };
  }, []);

  const aspects = useMemo(
    () => Array.from(new Set((ads ?? []).map((a) => a.aspect).filter(Boolean))).sort(),
    [ads],
  );
  const languages = useMemo(
    () => Array.from(new Set((ads ?? []).map((a) => a.language).filter((l): l is string => !!l))).sort(),
    [ads],
  );
  const tags = useMemo(
    () => Array.from(new Set((ads ?? []).flatMap((a) => a.tags ?? []))).sort(),
    [ads],
  );

  const view = useMemo(() => {
    let list = [...(ads ?? [])];
    if (kind !== 'all') list = list.filter((a) => a.format === kind);
    if (aspect !== 'all') list = list.filter((a) => a.aspect === aspect);
    if (language !== 'all') list = list.filter((a) => a.language === language);
    if (tag !== 'all') list = list.filter((a) => (a.tags ?? []).includes(tag));
    list.sort((a, b) => {
      if (sort === 'title') return (a.title ?? '').localeCompare(b.title ?? '');
      const cmp = a.createdAt.localeCompare(b.createdAt);
      return sort === 'oldest' ? cmp : -cmp;
    });
    return list;
  }, [ads, kind, aspect, language, tag, sort]);

  async function onRemove(ad: SavedAd) {
    if (!window.confirm(`Delete “${ad.title || ad.reference || 'this ad'}” from your library?`)) return;
    setRemovingId(ad.id);
    try {
      await deleteMyAd(ad.id);
      setAds((prev) => (prev ? prev.filter((a) => a.id !== ad.id) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="scroll-slim h-full overflow-y-auto px-8 py-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[18px] font-bold text-ink">Previously generated</h2>
        <span className="text-[12px] font-medium text-faint">Your saved ads</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[150px] flex-1">
          <Select
            value={kind}
            onChange={(v) => setKind(v as KindFilter)}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'image', label: 'Images' },
              { value: 'video', label: 'Videos' },
            ]}
          />
        </div>
        <div className="min-w-[130px] flex-1">
          <Select
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'title', label: 'Title (A–Z)' },
            ]}
          />
        </div>
        {aspects.length > 1 && (
          <div className="min-w-[120px] flex-1">
            <Select
              value={aspect}
              onChange={setAspect}
              options={[
                { value: 'all', label: 'All ratios' },
                ...aspects.map((a) => ({ value: a, label: a })),
              ]}
            />
          </div>
        )}
        {languages.length > 1 && (
          <div className="min-w-[130px] flex-1">
            <Select
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'all', label: 'All languages' },
                ...languages.map((l) => ({ value: l, label: l })),
              ]}
            />
          </div>
        )}
        {tags.length > 0 && (
          <div className="min-w-[130px] flex-1">
            <Select
              value={tag}
              onChange={setTag}
              options={[
                { value: 'all', label: 'All tags' },
                ...tags.map((t) => ({ value: t, label: `#${t}` })),
              ]}
            />
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-[13px] text-brand">{error}</p>}
      {!ads && !error && (
        <div className="flex items-center gap-2 text-[14px] text-muted">
          <Spinner className="text-muted" /> Loading…
        </div>
      )}
      {ads && ads.length === 0 && (
        <p className="text-[14px] text-faint">
          Nothing here yet — generate an ad and tap “Save to library”.
        </p>
      )}
      {ads && ads.length > 0 && view.length === 0 && (
        <p className="text-[14px] text-faint">No ads match these filters.</p>
      )}

      {view.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {view.map((ad) => (
            <div key={ad.id} className="group overflow-hidden rounded-xl border border-line">
              <div className="aspect-square bg-black">
                {ad.format === 'video' ? (
                  <LazyVideo src={ad.fileUrl} controls className="h-full w-full object-contain" />
                ) : (
                  <img
                    src={ad.fileUrl}
                    alt={ad.title ?? ad.reference ?? ''}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <div className="flex items-start justify-between gap-2 p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-ink">
                    {ad.title || ad.reference || 'Verse ad'}
                  </div>
                  <div className="truncate text-[11px] text-faint">
                    {ad.versionAbbr ? `${ad.versionAbbr} · ` : ''}
                    {ad.format} · {ad.aspect}
                  </div>
                  {ad.tags && ad.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ad.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-line-soft px-1.5 py-0.5 text-[10px] font-medium text-muted"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center">
                  <a
                    href={ad.fileUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Download"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-line-soft hover:text-ink"
                  >
                    <Download />
                  </a>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => onRemove(ad)}
                    disabled={removingId === ad.id}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-line-soft hover:text-brand disabled:opacity-60"
                  >
                    {removingId === ad.id ? <Spinner className="text-muted" /> : <Trash />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
