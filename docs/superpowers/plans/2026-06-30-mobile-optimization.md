# Mobile Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give VerseCut a real phone experience below `md` — a bottom tab bar (Edit/Preview/Library), a hamburger header, and correct mobile viewport behavior — without changing the `md`–`lg` stacked or `≥lg` two-panel desktop layouts.

**Architecture:** A single breakpoint boundary at `md` (768px). Mobile chrome renders with `md:hidden`; desktop/tablet chrome with `hidden md:…`; both live in one tree and CSS decides which is visible (SSR-safe, no JS width branching). New `MobileTabBar` and `MobileMenu` components plus a `mobileView` state in `App.tsx`. No changes to `useStudio`, rendering, or APIs.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Vitest.

## Global Constraints

- No `any` — use `unknown` + narrowing. (CLAUDE.md)
- No business logic in components — pure logic in `src/lib/`; new pure fn → `*.test.ts` beside it. (CLAUDE.md)
- Relative imports inside `src/` (match the file you edit).
- `npm run check` (typecheck + lint + tests) must pass before pushing.
- Breakpoint boundary is **`md` (768px)**: `<md` = new mobile shell; `md`–`lg` and `≥lg` unchanged.
- Mobile bottom tabs: **Edit · Preview · Library** (Library hosts Videos/Backgrounds via a `Segmented` sub-toggle).
- Header saved-ads button is labeled **"Saved ads"** (was "Library").
- Mobile form inputs ≥16px to prevent iOS focus-zoom (`text-base md:text-[15px]`).
- Root height `h-dvh`; `viewportFit: 'cover'`; bottom bar respects `env(safe-area-inset-bottom)`.
- Out of scope: `ProductBuilder` (`/product`) — a separate local-dev tool, not the studio.

---

### Task 1: Pure mobile-nav module + tests

**Files:**
- Create: `src/lib/mobileNav.ts`
- Test: `src/lib/mobileNav.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type MobileView = 'edit' | 'preview' | 'library'`; `MOBILE_TABS: { id: MobileView; label: string }[]`; `isMobileView(x: unknown): x is MobileView`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/mobileNav.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MOBILE_TABS, isMobileView } from './mobileNav';

describe('MOBILE_TABS', () => {
  it('is Edit, Preview, Library in order', () => {
    expect(MOBILE_TABS.map((t) => t.id)).toEqual(['edit', 'preview', 'library']);
    expect(MOBILE_TABS.map((t) => t.label)).toEqual(['Edit', 'Preview', 'Library']);
  });
});

describe('isMobileView', () => {
  it('accepts the three valid views', () => {
    expect(isMobileView('edit')).toBe(true);
    expect(isMobileView('preview')).toBe(true);
    expect(isMobileView('library')).toBe(true);
  });
  it('rejects anything else', () => {
    expect(isMobileView('output')).toBe(false);
    expect(isMobileView(null)).toBe(false);
    expect(isMobileView(2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- mobileNav`
Expected: FAIL — cannot resolve `./mobileNav`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/mobileNav.ts`:

```ts
export type MobileView = 'edit' | 'preview' | 'library';

export const MOBILE_TABS: { id: MobileView; label: string }[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'preview', label: 'Preview' },
  { id: 'library', label: 'Library' },
];

export function isMobileView(x: unknown): x is MobileView {
  return x === 'edit' || x === 'preview' || x === 'library';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- mobileNav`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mobileNav.ts src/lib/mobileNav.test.ts
git commit -m "Add pure mobile-nav descriptors + guard with tests"
```

---

### Task 2: Add `Menu` and `Pencil` icons

**Files:**
- Modify: `src/components/icons.tsx` (append two exports)

**Interfaces:**
- Consumes: the existing icon prop pattern (icons accept `width`/`height`/`className` via SVG props — see `VideoIcon` usage `<VideoIcon width={16} height={16} />`).
- Produces: `Menu`, `Pencil` icon components.

- [ ] **Step 1: Inspect an existing icon's signature**

Run: `grep -n "export function VideoIcon" -A6 src/components/icons.tsx`
Expected: shows a component taking `props: React.SVGProps<SVGSVGElement>` (or similar) spread onto `<svg>`. Match that exact signature for the new icons.

- [ ] **Step 2: Append the two icons**

Append to `src/components/icons.tsx`, matching the existing component signature (shown here as `React.SVGProps<SVGSVGElement>`; if the file uses a local alias, use that instead):

```tsx
export function Menu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function Pencil(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/icons.tsx
git commit -m "Add Menu and Pencil icons for mobile chrome"
```

---

### Task 3: `MobileTabBar` component

**Files:**
- Create: `src/components/MobileTabBar.tsx`

**Interfaces:**
- Consumes: `MOBILE_TABS`, `type MobileView` from `../lib/mobileNav`; `Pencil`, `Play`, `ImageIcon` from `./icons`.
- Produces: `MobileTabBar({ value, onChange }: { value: MobileView; onChange: (v: MobileView) => void })`.

- [ ] **Step 1: Create the component**

Create `src/components/MobileTabBar.tsx`:

```tsx
'use client';

import { MOBILE_TABS, type MobileView } from '../lib/mobileNav';
import { ImageIcon, Pencil, Play } from './icons';

const ICONS: Record<MobileView, (p: React.SVGProps<SVGSVGElement>) => React.ReactElement> = {
  edit: Pencil,
  preview: Play,
  library: ImageIcon,
};

export function MobileTabBar({
  value,
  onChange,
}: {
  value: MobileView;
  onChange: (v: MobileView) => void;
}) {
  return (
    <nav className="flex shrink-0 items-stretch border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {MOBILE_TABS.map(({ id, label }) => {
        const Icon = ICONS[id];
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
              active ? 'text-brand' : 'text-muted'
            }`}
          >
            <Icon width={20} height={20} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (If the `ICONS` return-type annotation conflicts with the icon signatures, simplify to `Record<MobileView, typeof Pencil>`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/MobileTabBar.tsx
git commit -m "Add MobileTabBar bottom navigation"
```

---

### Task 4: `MobileMenu` component (hamburger slide-out)

**Files:**
- Create: `src/components/MobileMenu.tsx`

**Interfaces:**
- Consumes: `XMark` from `./icons`.
- Produces: `MobileMenu({ open, onClose, status, userEmail, onOpenSavedAds }: { open: boolean; onClose: () => void; status: { label: string; dot: string }; userEmail?: string | null; onOpenSavedAds: () => void })`.

- [ ] **Step 1: Create the component**

Create `src/components/MobileMenu.tsx` (mirrors the `LibraryDrawer` overlay pattern: fixed inset, scrim, right sheet):

```tsx
'use client';

import { XMark } from './icons';

export function MobileMenu({
  open,
  onClose,
  status,
  userEmail,
  onOpenSavedAds,
}: {
  open: boolean;
  onClose: () => void;
  status: { label: string; dot: string };
  userEmail?: string | null;
  onOpenSavedAds: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end md:hidden">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative flex h-full w-72 max-w-[80%] flex-col border-l border-line bg-surface px-5 pt-5 pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[16px] font-extrabold text-ink">Menu</span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-line-soft hover:text-ink"
          >
            <XMark />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-full bg-panel px-3.5 py-2">
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          <span className="text-[13px] font-semibold text-muted">{status.label}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSavedAds();
          }}
          className="rounded-lg px-3 py-2.5 text-left text-[15px] font-semibold text-ink transition hover:bg-line-soft"
        >
          Saved ads
        </button>

        <div className="mt-auto border-t border-line pt-4">
          {userEmail && <div className="mb-2 text-[13px] font-medium text-muted">{userEmail}</div>}
          <a
            href="/auth/signout"
            className="block rounded-lg px-3 py-2.5 text-[15px] font-semibold text-muted transition hover:bg-line-soft hover:text-ink"
          >
            Sign out
          </a>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/MobileMenu.tsx
git commit -m "Add MobileMenu hamburger slide-out"
```

---

### Task 5: Mobile viewport + input-zoom ergonomics

**Files:**
- Modify: `src/app/layout.tsx` (the `viewport` export)
- Modify: `src/components/ui.tsx:138` (`Select` input font)
- Modify: `src/components/InputPanel.tsx:253` (CTA `<input>` font)

**Interfaces:**
- Consumes/Produces: none (CSS/meta only).

- [ ] **Step 1: Add `viewportFit: 'cover'`**

In `src/app/layout.tsx`, update the exported viewport:

```tsx
export const viewport: Viewport = {
  themeColor: '#fe3745',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
```

- [ ] **Step 2: Bump form input font on mobile (prevent iOS zoom)**

In `src/components/ui.tsx`, the `Select` `<select>` className (line ~138) change `text-[15px]` → `text-base md:text-[15px]`:

```tsx
        className="h-[52px] w-full appearance-none rounded-xl border border-line bg-surface px-4 pr-11 text-base font-medium text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-50 md:text-[15px]"
```

In `src/components/InputPanel.tsx`, the CTA `<input>` className (line ~253) change `text-[15px]` → `text-base md:text-[15px]`:

```tsx
              className="h-[52px] w-full rounded-xl border border-line bg-surface px-4 text-base font-medium text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10 md:text-[15px]"
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/ui.tsx src/components/InputPanel.tsx
git commit -m "Mobile viewport-fit + 16px inputs to prevent iOS focus zoom"
```

---

### Task 6: Wire the mobile shell into `App.tsx`

**Files:**
- Modify: `src/App.tsx` (imports; state; root height; header; body; tab bar + menu)

**Interfaces:**
- Consumes: `MobileTabBar` (Task 3), `MobileMenu` (Task 4), `type MobileView` (Task 1), `Menu` (Task 2), plus existing `OutputPanel`/`VideoLibrary`/`ImageLibrary`/`Segmented`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Add imports**

In `src/App.tsx`, add after the existing component imports (after the `PanelResizer` import line):

```tsx
import { OutputPanel } from './components/OutputPanel';
import { VideoLibrary } from './components/VideoLibrary';
import { ImageLibrary } from './components/ImageLibrary';
import { MobileTabBar } from './components/MobileTabBar';
import { MobileMenu } from './components/MobileMenu';
import { Segmented } from './components/ui';
import { Menu } from './components/icons';
import { type MobileView } from './lib/mobileNav';
```

- [ ] **Step 2: Add mobile state**

After the existing `const [rightView, setRightView] = useState<RightView>('output');` line, add:

```tsx
  const [mobileView, setMobileView] = useState<MobileView>('edit');
  const [mobileLib, setMobileLib] = useState<'videos' | 'images'>('images');
  const [menuOpen, setMenuOpen] = useState(false);
```

- [ ] **Step 3: Switch root height to `h-dvh`**

Change the root container (line ~49):

```tsx
    <div className="flex h-dvh flex-col bg-surface">
```

- [ ] **Step 4: Make the current header desktop-only and add a mobile header**

Replace the opening `<header …>` tag and its first child group. The current header (lines ~51–88) becomes two siblings inside a wrapper. Replace:

```tsx
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-line px-7 py-3.5">
        <div className="flex items-center gap-3">
          <img src={headerLogo} alt="" className="h-9 w-9 rounded-[11px]" />
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold tracking-tight text-ink">
              {config.brand.name}
            </div>
            <div className="text-[12px] font-medium text-muted">{config.brand.tagline}</div>
          </div>
        </div>
        <SpaceSwitcher />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-muted transition hover:bg-line-soft hover:text-ink"
          >
            Library
          </button>
```

with:

```tsx
      {/* Header */}
      <header className="shrink-0 border-b border-line">
        {/* Mobile header (<md) */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 md:hidden">
          <img src={headerLogo} alt="" className="h-8 w-8 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1 overflow-x-auto">
            <SpaceSwitcher />
          </div>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-line-soft hover:text-ink"
          >
            <Menu />
          </button>
        </div>
        {/* Desktop header (≥md) */}
        <div className="hidden items-center justify-between px-7 py-3.5 md:flex">
          <div className="flex items-center gap-3">
            <img src={headerLogo} alt="" className="h-9 w-9 rounded-[11px]" />
            <div className="leading-tight">
              <div className="text-[15px] font-extrabold tracking-tight text-ink">
                {config.brand.name}
              </div>
              <div className="text-[12px] font-medium text-muted">{config.brand.tagline}</div>
            </div>
          </div>
          <SpaceSwitcher />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-muted transition hover:bg-line-soft hover:text-ink"
            >
              Saved ads
            </button>
```

(Note: the rest of the desktop header group — the status pill and the `{userEmail && …}` block at lines ~70–86 — now sits inside this `md:flex` div; only its indentation context changed, leave that markup as-is, and keep the closing `</div></header>` that currently ends the header.)

- [ ] **Step 5: Verify the header still closes correctly**

After Step 4, the original status-pill + email block (`<div className="flex items-center gap-2 rounded-full bg-panel …">` … through the `{userEmail && (…)}` block) must be immediately followed by the closing `</div>` (closes the desktop right-group), then `</div>` (closes the `md:flex` desktop header), then `</header>`. Read `src/App.tsx` around the header end and confirm there are exactly those three closes. Fix nesting if off.

- [ ] **Step 6: Add the mobile body and gate the desktop grid**

Replace the body block. Change the existing two-panel `<div className="grid …">` opening to `hidden md:grid`, and add the mobile body as a sibling immediately before it. Replace:

```tsx
      {/* Two-panel body */}
      <div
        className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[var(--left-col)_1fr]"
        style={{ '--left-col': `${leftWidth}px` } as React.CSSProperties}
      >
```

with:

```tsx
      {/* Mobile body (<md): one view at a time */}
      <div className="min-h-0 flex-1 overflow-hidden md:hidden">
        {mobileView === 'edit' && (
          <InputPanel
            studio={studio}
            space={space}
            onBrowse={(v) => {
              if (v !== 'output') setMobileLib(v);
              setMobileView('library');
            }}
          />
        )}
        {mobileView === 'preview' && <OutputPanel studio={studio} space={space} />}
        {mobileView === 'library' && (
          <div className="flex h-full flex-col">
            <div className="shrink-0 px-4 pt-3">
              <Segmented
                value={mobileLib}
                onChange={(v) => setMobileLib(v as 'videos' | 'images')}
                options={[
                  { value: 'videos', label: 'Videos' },
                  { value: 'images', label: 'Backgrounds' },
                ]}
              />
            </div>
            <div className="min-h-0 flex-1">
              {mobileLib === 'videos' ? (
                <VideoLibrary studio={studio} onPicked={() => setMobileView('preview')} />
              ) : (
                <ImageLibrary studio={studio} onPicked={() => setMobileView('preview')} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Two-panel body (≥md) */}
      <div
        className="hidden min-h-0 flex-1 grid-cols-1 md:grid lg:grid-cols-[var(--left-col)_1fr]"
        style={{ '--left-col': `${leftWidth}px` } as React.CSSProperties}
      >
```

- [ ] **Step 7: Add the tab bar + menu before the closing root `</div>`**

Just before the existing `<LibraryDrawer … />` line, add:

```tsx
      <MobileTabBar value={mobileView} onChange={setMobileView} />
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        status={status}
        userEmail={userEmail}
        onOpenSavedAds={() => setLibraryOpen(true)}
      />
```

- [ ] **Step 8: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (0 errors). The pre-existing `react-hooks/set-state-in-effect` warnings remain; no new errors.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "Wire mobile shell: bottom tabs, hamburger menu, single-view body"
```

---

### Task 7: Gate + manual smoke + push/PR

**Files:** none (verification + delivery)

- [ ] **Step 1: Full gate**

Run: `npm run check`
Expected: typecheck + lint (0 errors) + all tests (incl. `mobileNav`) PASS.

- [ ] **Step 2: Manual smoke at a phone viewport**

Run `npm run dev`; in a browser at 390×844 (iPhone 12/13/14): confirm the bottom tab bar shows Edit/Preview/Library, switching views works, the header shows logo + space switcher + hamburger, the hamburger opens the menu with Saved ads / Sign out, and Generate is reachable in Edit. Resize ≥768px → desktop header + two-panel layout returns unchanged.

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin HEAD
gh pr create --title "Mobile optimization: bottom-tab navigation + responsive header" --body "$(cat <<'EOF'
## Summary
- Phones (<md) get a bottom tab bar (Edit/Preview/Library), a hamburger header menu, and single-view navigation.
- md–lg stacked and ≥lg resizable two-panel layouts are unchanged.
- Mobile correctness: h-dvh, viewport-fit cover, safe-area insets, ≥16px inputs (no iOS focus-zoom).
- Header saved-ads button renamed "Saved ads" to disambiguate from the Library tab.

## Test plan
- [ ] <md: tab bar switches Edit/Preview/Library; hamburger menu works; Generate reachable
- [ ] Library tab: Videos/Backgrounds sub-toggle; picking returns to Preview
- [ ] ≥md: desktop header + two-panel unchanged; ≥lg resizer works
- [ ] Adversarial QA workflow (separate) green
EOF
)"
```

- [ ] **Step 4: Address review**

Read Greptile/CodeRabbit comments; fix real findings; push.

---

## Self-Review

**Spec coverage:**
- Breakpoint boundary at `md` → Task 6 (`md:hidden` / `hidden md:grid`). ✓
- Bottom tab bar Edit/Preview/Library → Tasks 1, 3, 6. ✓
- Hamburger header + overflow (status/email/Saved ads/Sign out) → Tasks 2, 4, 6. ✓
- Single-view body + Library sub-toggle (Videos/Backgrounds) → Task 6. ✓
- `h-dvh` + `viewportFit: cover` + safe-area insets → Tasks 5, 3, 4, 6. ✓
- ≥16px inputs → Task 5. ✓
- "Saved ads" rename → Task 6 (desktop) + Task 4 (menu). ✓
- Pure logic + test (`mobileNav`) → Task 1. ✓
- Adversarial QA → run after Task 7 as a multi-agent workflow (separate, per spec). ✓
- `md`–`lg`/`≥lg` unchanged → Task 6 keeps the grid's internal classes, only gates visibility. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✓

**Type consistency:** `MobileView` defined in Task 1 and consumed in Tasks 3, 6. `MobileTabBar` props (`value`/`onChange`) match between Task 3 and Task 6. `MobileMenu` props (`open`/`onClose`/`status`/`userEmail`/`onOpenSavedAds`) match between Task 4 and Task 6. `mobileLib` is `'videos'|'images'` throughout Task 6; `onBrowse` coerces away `'output'`. ✓

## Adversarial QA (after Task 7, before final merge)

Per the user's explicit request, run a **multi-agent QA workflow** against the running dev server. Parallel agents each drive Playwright at a mobile viewport and probe one dimension, returning structured findings (real bug? severity? repro). Dimensions: 390×844 portrait reachability; landscape; keyboard-open on the CTA input (no zoom, Generate reachable); long verse range / long language label (no overflow); RTL (Arabic) direction; safe-area padding on the tab bar; rapid tab switching (state persists); Library with 197 items scrolling under chrome. Triage → fix real findings → re-run failed dimensions → then merge.
