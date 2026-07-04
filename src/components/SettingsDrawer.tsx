'use client';

import { useEffect } from 'react';
import { XMark } from './icons';
import { SETTING_META, type AppSettings, type SettingKey, type VerseDefault } from '../lib/appSettings';

function verseLabel(v: VerseDefault): string {
  const range = v.fromVerse === v.toVerse ? `${v.fromVerse}` : `${v.fromVerse}-${v.toVerse}`;
  return `${v.bookName} ${v.chapter}:${range}`;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-brand' : 'bg-line'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export function SettingsDrawer({
  open,
  onClose,
  settings,
  onToggle,
  currentVerse,
  onSaveVerseDefault,
  onClearVerseDefault,
}: {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onToggle: (key: SettingKey) => void;
  currentVerse: VerseDefault;
  onSaveVerseDefault: () => void;
  onClearVerseDefault: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" role="presentation" aria-hidden="true" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-[16px] font-extrabold text-ink">Settings</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-line-soft hover:text-ink"
          >
            <XMark />
          </button>
        </div>

        <div className="scroll-slim flex-1 overflow-y-auto p-6">
          <p className="mb-4 text-[13px] text-muted">
            Turn optional features on or off. Disabled features are hidden from the studio panel.
          </p>
          <div className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {SETTING_META.map(({ key, label, hint }) => (
              <div key={key} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-ink">{label}</div>
                  <div className="text-[12px] text-faint">{hint}</div>
                </div>
                <Toggle on={settings[key]} onChange={() => onToggle(key)} label={label} />
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="mb-1 text-[15px] font-semibold text-ink">Default verse range</div>
            <p className="mb-3 text-[12px] text-faint">
              New sessions start here. Currently:{' '}
              <span className="font-semibold text-ink">
                {settings.verseDefault ? verseLabel(settings.verseDefault) : 'John 3:16-17 (built-in)'}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSaveVerseDefault}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink transition hover:bg-line-soft"
              >
                Use current selection ({verseLabel(currentVerse)})
              </button>
              {settings.verseDefault && (
                <button
                  type="button"
                  onClick={onClearVerseDefault}
                  className="rounded-lg px-3 py-2 text-[13px] font-semibold text-faint transition hover:text-ink"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
