import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultCta } from './cta';
import { SOCIAL_FORMAT_BY_ID } from './socialFormats';
import { ASPECT_DIMENSIONS, config, type AspectRatio, type OutputFormat } from '../config';
import { GRADIENTS, DEFAULT_GRADIENT_ID } from './gradients';
import { getBibleProvider, type BibleVersion, type Book, type Language } from './bible';
import { renderImage, renderVideo, type RenderedAsset } from './render';
import type { LogoStyle } from './iconCatalog';
import {
  importedVideoUrl,
  listVideosForDate,
  pickBackgroundUrl,
  resolvePlayback,
  type ImportedVideoEntry,
  type ManifestEntry,
} from './videoLibrary';

export interface SelectedLibraryVideo {
  entry: ManifestEntry | ImportedVideoEntry;
  url: string;
}

export interface Stage {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  progress?: number;
}

export type Phase = 'idle' | 'running' | 'done' | 'error';

export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export interface Job {
  id: string;
  label: string;
  aspect: AspectRatio;
  format: OutputFormat;
  kind: 'image' | 'video';
  status: JobStatus;
  stages: Stage[];
  asset: RenderedAsset | null;
  error: string | null;
  reference: string | null;
  versionAbbr: string | null;
  language: string;
  /** Build-time estimate (seconds) captured when the job was queued. */
  estimateSec: number;
  /** Epoch ms when the render actually started (null while queued). */
  startedAt: number | null;
}

interface JobSnapshot {
  versionId: string;
  bookId: string;
  chapter: number;
  fromVerse: number;
  toVerse: number;
  format: OutputFormat;
  durationSec: number;
  render: {
    aspect: AspectRatio;
    dimensions: { width: number; height: number };
    imageFile: File | null;
    videoFile: File | null;
    imageUrl: string | null;
    videoUrl: string | null;
    mimeType: 'image/png' | 'image/jpeg';
    languageId: string;
    logoStyle: LogoStyle;
    template: 'classic' | 'promo';
    cta: string;
    musicFile: File | null;
    gradientId: string;
  };
}

const MAX_VERSE = 176; // Psalm 119
const MAX_JOBS = 12; // retained render-history depth (older jobs' URLs are revoked)

export function useStudio() {
  const provider = useMemo(() => getBibleProvider(), []);

  // Reference data
  const [languages, setLanguages] = useState<Language[]>([]);
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [books, setBooks] = useState<Book[]>([]);

  // Form selections
  const [languageId, setLanguageId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [bookId, setBookId] = useState('');
  const [chapter, setChapter] = useState(3);
  const [fromVerse, setFromVerse] = useState(16);
  const [toVerse, setToVerse] = useState(17);

  const [imageFile, setImageFileState] = useState<File | null>(null);
  const [videoFile, setVideoFileState] = useState<File | null>(null);
  const [libraryVideo, setLibraryVideo] = useState<SelectedLibraryVideo | null>(null);
  const [sharedBg, setSharedBg] = useState<
    { url: string; label: string; kind: 'image' | 'video' } | null
  >(null);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [format, setFormat] = useState<OutputFormat>(config.output.defaultFormat);
  const [aspect, setAspect] = useState<AspectRatio>(config.output.defaultAspect);
  const [platform, setPlatform] = useState<string | null>(null);
  const selectPlatform = useCallback((id: string) => {
    setPlatform(id);
    const fmt = SOCIAL_FORMAT_BY_ID[id];
    if (fmt) setAspect(fmt.aspect);
  }, []);
  const [imageFormat, setImageFormat] = useState<'png' | 'jpg'>('png');
  const [durationSec, setDurationSec] = useState<number>(config.output.videoDurationSec);
  const [logoStyle, setLogoStyle] = useState<LogoStyle>(config.brand.defaultLogoStyle);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [gradientId, setGradientId] = useState<string>(DEFAULT_GRADIENT_ID);
  const [template, setTemplate] = useState<'classic' | 'promo'>('classic');
  const [cta, setCtaState] = useState<string>(defaultCta('en'));
  const ctaTouched = useRef(false);
  const setCta = useCallback((v: string) => {
    ctaTouched.current = true;
    setCtaState(v);
  }, []);

  // Generation — a queue of background jobs. Generating snapshots the form into
  // a job and renders it in the background, so the form stays editable and more
  // jobs can be queued. Renders run one at a time (real-time canvas capture
  // can't safely run two videos concurrently).
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const queueRef = useRef<{ id: string; snap: JobSnapshot }[]>([]);
  const runningRef = useRef(false);
  const jobSeq = useRef(0);

  // Revoke completed-render object URLs when their jobs are evicted or the
  // studio unmounts — otherwise each render leaks a blob URL for the session.
  const jobsRef = useRef<Job[]>([]);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);
  useEffect(
    () => () => {
      for (const j of jobsRef.current) {
        if (j.asset?.url) URL.revokeObjectURL(j.asset.url);
      }
    },
    [],
  );

  // Load languages once; default to English when available.
  useEffect(() => {
    provider.listLanguages().then((langs) => {
      setLanguages(langs);
      const def =
        langs.find((l) => l.id === 'i:en' || l.id === 'en' || l.id === 'eng') ??
        langs.find((l) => /^english$/i.test(l.name)) ??
        langs[0];
      if (def) setLanguageId(def.id);
    });
  }, [provider]);

  // Load versions + books when language changes.
  useEffect(() => {
    if (!languageId) return;
    let active = true;
    provider.listVersions(languageId).then((vs) => {
      if (!active) return;
      setVersions(vs);
      const def =
        vs.find((v) => v.id === config.bible.defaultVersionId) ??
        vs.find((v) => v.id.endsWith(`:${config.bible.defaultVersionId}`)) ??
        vs[0];
      setVersionId(def?.id ?? '');
    });
    return () => {
      active = false;
    };
  }, [provider, languageId]);

  useEffect(() => {
    if (!versionId) return;
    let active = true;
    provider.listBooks(versionId).then((bs) => {
      if (!active) return;
      setBooks(bs);
      setBookId((prev) => prev || bs.find((b) => b.id === 'JHN')?.id || bs[0]?.id || '');
    });
    return () => {
      active = false;
    };
  }, [provider, versionId]);

  // Bare language code (the picker ids are source-prefixed, e.g. "i:af" / "p:aai").
  const languageCode = languageId.includes(':')
    ? languageId.slice(languageId.indexOf(':') + 1)
    : languageId;

  // Seed the CTA with the language's localized default until the user edits it.
  useEffect(() => {
    if (!ctaTouched.current) setCtaState(defaultCta(languageCode));
  }, [languageCode]);

  const currentBook = books.find((b) => b.id === bookId);
  const maxChapter = currentBook?.chapters ?? 150;

  // Keep ranges coherent.
  useEffect(() => {
    if (chapter > maxChapter) setChapter(maxChapter);
  }, [maxChapter, chapter]);

  const setFrom = useCallback(
    (v: number) => {
      setFromVerse(v);
      if (v > toVerse) setToVerse(v);
    },
    [toVerse],
  );
  const setTo = useCallback(
    (v: number) => setToVerse(Math.max(v, fromVerse)),
    [fromVerse],
  );

  // A background source is exclusive: choosing one clears the others.
  const setImageFile = useCallback((f: File | null) => {
    setImageFileState(f);
    if (f) {
      setVideoFileState(null);
      setLibraryVideo(null);
      setSharedBg(null);
    }
  }, []);
  const setVideoFile = useCallback((f: File | null) => {
    setVideoFileState(f);
    if (f) {
      setImageFileState(null);
      setLibraryVideo(null);
      setSharedBg(null);
    }
  }, []);

  /** Pick a team-shared background (image or video) by URL. */
  const selectSharedAsset = useCallback(
    (asset: { fileUrl: string; name: string; kind: 'image' | 'video' }) => {
      setImageFileState(null);
      setVideoFileState(null);
      setLibraryVideo(null);
      setSharedBg({ url: asset.fileUrl, label: asset.name, kind: asset.kind });
    },
    [],
  );
  const clearSharedBg = useCallback(() => setSharedBg(null), []);

  /** Browse the library for a date + the selected language. */
  const browseVideos = useCallback(
    (date: string) => listVideosForDate(date, languageCode || 'en'),
    [languageCode],
  );

  /** Pick a library video: resolve its playback URL and set it as the background. */
  const selectLibraryVideo = useCallback(async (entry: ManifestEntry) => {
    setLibraryBusy(true);
    try {
      const playback = await resolvePlayback(entry.videoId, entry.language);
      const url = pickBackgroundUrl(playback);
      if (!url) throw new Error('No playable source for this video');
      setImageFileState(null);
      setVideoFileState(null);
      setSharedBg(null);
      setLibraryVideo({ entry, url });
    } finally {
      setLibraryBusy(false);
    }
  }, []);

  /** Pick a locally stored imported video (e.g. YouTube pull). */
  const selectImportedVideo = useCallback(async (entry: ImportedVideoEntry) => {
    setLibraryBusy(true);
    try {
      setImageFileState(null);
      setVideoFileState(null);
      setSharedBg(null);
      setLibraryVideo({ entry, url: importedVideoUrl(entry) });
    } finally {
      setLibraryBusy(false);
    }
  }, []);

  const clearLibraryVideo = useCallback(() => setLibraryVideo(null), []);

  const canGenerate =
    !!languageId && !!bookId && fromVerse >= 1 && toVerse >= fromVerse;

  const patchJob = useCallback(
    (id: string, patch: Partial<Job>) =>
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j))),
    [],
  );

  const patchJobStage = useCallback(
    (id: string, stageId: string, patch: Partial<Stage>) =>
      setJobs((prev) =>
        prev.map((j) =>
          j.id === id
            ? { ...j, stages: j.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)) }
            : j,
        ),
      ),
    [],
  );

  const runJob = useCallback(
    async (id: string, snap: JobSnapshot) => {
      patchJob(id, { status: 'running', startedAt: Date.now() });
      patchJobStage(id, 'fetch', { status: 'active' });
      try {
        const passage = await provider.fetchPassage({
          versionId: snap.versionId,
          bookId: snap.bookId,
          chapter: snap.chapter,
          fromVerse: snap.fromVerse,
          toVerse: snap.toVerse,
        });
        patchJobStage(id, 'fetch', { status: 'done' });
        patchJob(id, {
          label: passage.reference,
          reference: passage.reference,
          versionAbbr: passage.versionAbbreviation,
        });

        patchJobStage(id, 'compose', { status: 'active' });
        const input = {
          ...snap.render,
          passage,
          durationSec: snap.durationSec,
        };

        let result: RenderedAsset;
        if (snap.format === 'image') {
          result = await renderImage(input);
          patchJobStage(id, 'compose', { status: 'done' });
          patchJobStage(id, 'render', { status: 'done', progress: 1 });
        } else {
          result = await renderVideo(input, {
            onCapture: (f) => patchJobStage(id, 'compose', { progress: f }),
            onEncode: (f) => {
              patchJobStage(id, 'compose', { status: 'done' });
              patchJobStage(id, 'render', { status: 'active', progress: f });
            },
          });
          patchJobStage(id, 'compose', { status: 'done' });
          patchJobStage(id, 'render', { status: 'done', progress: 1 });
        }

        patchJob(id, { status: 'done', asset: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === id
              ? {
                  ...j,
                  status: 'error',
                  error: message,
                  stages: j.stages.map((s) =>
                    s.status === 'active' ? { ...s, status: 'error' } : s,
                  ),
                }
              : j,
          ),
        );
      }
    },
    [provider, patchJob, patchJobStage],
  );

  // Drain the queue one job at a time.
  const pump = useCallback(async () => {
    if (runningRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    runningRef.current = true;
    try {
      await runJob(next.id, next.snap);
    } finally {
      runningRef.current = false;
      void pump();
    }
  }, [runJob]);

  // Rough build-time estimate (seconds) shown before Generate. Video capture is
  // real-time, so duration dominates.
  const estimateSec = useMemo(() => {
    if (format === 'image') return 3;
    return Math.round(durationSec + 3); // real-time capture + encode
  }, [format, durationSec]);

  const generate = useCallback(() => {
    if (!canGenerate) return;
    const id = `job-${(jobSeq.current += 1)}`;
    const composeLabel =
      format === 'video' ? 'Compositing frames' : 'Compositing layers';
    const renderLabel = format === 'video' ? 'Encoding MP4' : 'Exporting image';
    const stages: Stage[] = [
      { id: 'fetch', label: 'Fetching verse', status: 'pending' },
      { id: 'compose', label: composeLabel, status: 'pending' },
      { id: 'render', label: renderLabel, status: 'pending' },
    ];

    const provisionalRef =
      `${currentBook?.name ?? bookId} ${chapter}:${fromVerse}` +
      (toVerse > fromVerse ? `-${toVerse}` : '');

    const snap: JobSnapshot = {
      versionId: versionId || config.bible.defaultVersionId,
      bookId,
      chapter,
      fromVerse,
      toVerse,
      format,
      durationSec,
      render: {
        aspect,
        dimensions: ASPECT_DIMENSIONS[aspect],
        imageFile,
        videoFile,
        imageUrl: sharedBg?.kind === 'image' ? sharedBg.url : null,
        videoUrl: libraryVideo?.url ?? (sharedBg?.kind === 'video' ? sharedBg.url : null),
        mimeType: imageFormat === 'jpg' ? 'image/jpeg' : 'image/png',
        languageId: languageCode,
        logoStyle,
        template,
        cta,
        musicFile,
        gradientId,
      },
    };

    const job: Job = {
      id,
      label: provisionalRef,
      aspect,
      format,
      kind: format === 'image' ? 'image' : 'video',
      status: 'queued',
      stages,
      asset: null,
      error: null,
      reference: null,
      versionAbbr: null,
      language: languageId,
      estimateSec,
      startedAt: null,
    };

    setJobs((prev) => {
      const next = [job, ...prev];
      // Keep a bounded history; revoke evicted jobs' asset URLs so blobs aren't
      // pinned for the whole session.
      if (next.length > MAX_JOBS) {
        for (const dropped of next.slice(MAX_JOBS)) {
          if (dropped.asset?.url) URL.revokeObjectURL(dropped.asset.url);
        }
        return next.slice(0, MAX_JOBS);
      }
      return next;
    });
    setSelectedJobId(id);
    queueRef.current.push({ id, snap });
    void pump();
  }, [
    canGenerate,
    format,
    versionId,
    languageId,
    languageCode,
    bookId,
    currentBook,
    chapter,
    fromVerse,
    toVerse,
    aspect,
    imageFile,
    videoFile,
    libraryVideo,
    sharedBg,
    imageFormat,
    logoStyle,
    template,
    cta,
    durationSec,
    musicFile,
    gradientId,
    estimateSec,
    pump,
  ]);

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId],
  );
  const isRendering = jobs.some((j) => j.status === 'running' || j.status === 'queued');

  return {
    // data
    languages,
    versions,
    books,
    maxChapter,
    maxVerse: MAX_VERSE,
    // form
    languageId,
    languageCode,
    setLanguageId,
    versionId,
    setVersionId,
    bookId,
    setBookId,
    chapter,
    setChapter,
    fromVerse,
    setFrom,
    toVerse,
    setTo,
    imageFile,
    setImageFile,
    videoFile,
    setVideoFile,
    // video library
    libraryVideo,
    libraryBusy,
    browseVideos,
    selectLibraryVideo,
    selectImportedVideo,
    clearLibraryVideo,
    // shared backgrounds
    sharedBg,
    selectSharedAsset,
    clearSharedBg,
    format,
    setFormat,
    aspect,
    setAspect,
    platform,
    selectPlatform,
    imageFormat,
    setImageFormat,
    durationSec,
    setDurationSec,
    logoStyle,
    setLogoStyle,
    template,
    setTemplate,
    cta,
    setCta,
    musicFile,
    setMusicFile,
    // background gradient
    gradients: GRADIENTS,
    gradientId,
    setGradientId,
    estimateSec,
    // generation (background job queue)
    jobs,
    selectedJob,
    selectJob: setSelectedJobId,
    isRendering,
    canGenerate,
    generate,
  };
}
