import { config } from '../config';
import type { Stage, useStudio } from '../lib/useStudio';
import { Check, Download, ImageIcon, Spinner } from './icons';

type Studio = ReturnType<typeof useStudio>;

function StageRow({ stage }: { stage: Stage }) {
  const pct = stage.progress != null ? Math.round(stage.progress * 100) : null;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        {stage.status === 'done' && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white">
            <Check />
          </span>
        )}
        {stage.status === 'active' && <Spinner className="text-brand" />}
        {stage.status === 'pending' && (
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        )}
        {stage.status === 'error' && (
          <span className="h-2.5 w-2.5 rounded-full bg-brand" />
        )}
      </span>
      <span
        className={`text-[14px] font-medium ${
          stage.status === 'pending' ? 'text-faint' : 'text-ink'
        }`}
      >
        {stage.label}
      </span>
      {stage.status === 'active' && pct != null && (
        <span className="ml-auto text-[13px] font-semibold tabular-nums text-muted">
          {pct}%
        </span>
      )}
    </div>
  );
}

function PreviewFrame({
  aspect,
  children,
}: {
  aspect: string;
  children: React.ReactNode;
}) {
  const portrait = aspect === '9:16';
  return (
    <div
      className="overflow-hidden rounded-2xl bg-black shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5"
      style={{
        aspectRatio: aspect.replace(':', ' / '),
        height: portrait ? 'min(74vh, 720px)' : undefined,
        width: portrait ? undefined : 'min(80%, 880px)',
        maxWidth: '100%',
      }}
    >
      {children}
    </div>
  );
}

export function OutputPanel({ studio }: { studio: Studio }) {
  const { phase, stages, asset, aspect, format, error } = studio;
  const kindLabel = format === 'video' ? 'VIDEO' : 'IMAGE';

  function download() {
    if (!asset) return;
    const a = document.createElement('a');
    a.href = asset.url;
    a.download = `verse-ad.${asset.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-10 pt-7">
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-faint">
          Preview · {kindLabel} · {aspect}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center px-10 py-8">
        {phase === 'idle' && (
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-faint shadow-sm ring-1 ring-line">
              <ImageIcon width={26} height={26} />
            </div>
            <h2 className="mb-2 text-[20px] font-bold text-ink">
              Your ad preview appears here
            </h2>
            <p className="text-[14px] leading-relaxed text-muted">
              Pick a language and verse range on the left, then generate to see your{' '}
              {format === 'video' ? 'video' : 'image'} ad render in {aspect}.
            </p>
          </div>
        )}

        {phase === 'running' && (
          <div className="flex w-full max-w-md flex-col items-center">
            <PreviewFrame aspect={aspect}>
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-black">
                <div className="h-full w-full animate-pulse-soft bg-[radial-gradient(circle_at_50%_30%,rgba(254,55,69,0.25),transparent_60%)]" />
              </div>
            </PreviewFrame>
            <div className="mt-7 w-full max-w-xs rounded-2xl border border-line bg-surface p-4">
              {stages.map((s) => (
                <StageRow key={s.id} stage={s} />
              ))}
            </div>
          </div>
        )}

        {phase === 'done' && asset && (
          <div className="flex animate-fade-up flex-col items-center">
            <PreviewFrame aspect={aspect}>
              {asset.kind === 'image' ? (
                <img src={asset.url} alt="Generated verse ad" className="h-full w-full object-contain" />
              ) : (
                <video
                  src={asset.url}
                  className="h-full w-full object-contain"
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              )}
            </PreviewFrame>

            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={download}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-7 text-[15px] font-semibold text-white transition hover:bg-black active:scale-[0.99]"
              >
                <Download /> Download {asset.ext.toUpperCase()}
              </button>
              {asset.note && (
                <p className="max-w-xs text-center text-[12px] leading-relaxed text-muted">
                  {asset.note}
                </p>
              )}
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="max-w-sm text-center">
            <h2 className="mb-2 text-[18px] font-bold text-ink">Generation failed</h2>
            <p className="mb-5 text-[14px] leading-relaxed text-muted">{error}</p>
            <button
              type="button"
              onClick={studio.generate}
              className="rounded-xl border border-line bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink transition hover:bg-line-soft"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {(phase === 'running' || phase === 'done') && (
        <div className="px-10 pb-6 text-center">
          <p className="text-[12px] text-faint">
            {config.brand.name} · rendered in your browser
          </p>
        </div>
      )}
    </div>
  );
}
