# Mobile Optimization — Design

**Date:** 2026-06-30
**Status:** Approved (pending spec review)

## Problem

VerseCut is built for desktop: a resizable two-panel layout (input left, preview
right). Below the `lg` breakpoint the grid collapses to `grid-cols-1`, which
stacks the full input panel (with its own sticky Generate footer) on top of the
preview — an awkward, long-scroll experience. The header packs logo + name +
space switcher + Library + status pill + email + sign-out into a single row that
overflows on phones. Only ~12 responsive utilities exist across the app.

## Goals

- A real phone navigation model: one view at a time via a fixed bottom tab bar.
- A header that fits a phone screen (overflow into a hamburger menu).
- Correct mobile viewport behavior (dvh, safe-area insets, no focus-zoom).
- No regressions to the existing `md`–`lg` stacked or `≥lg` two-panel layouts.

## Non-goals

- No change to `useStudio`, rendering, compositor, or API logic — layout/nav only.
- No redesign of the `md`–`lg` (tablet) layout — it keeps today's stacked behavior.
- No change to the `≥lg` desktop two-panel + resizer.
- No PWA/offline/install work.

## Breakpoint strategy

A single new boundary at **`md` (768px)**:

| Width | Layout |
|---|---|
| `< md` | **NEW** mobile shell: compact header + hamburger, single-view body, bottom tab bar |
| `md … < lg` | Unchanged — current `grid-cols-1` stacked |
| `≥ lg` | Unchanged — resizable two-panel + `PanelResizer` |

Mobile-only chrome uses `md:hidden`; desktop/tablet chrome uses `hidden md:…`.
Both render in the same tree; CSS decides which is visible (no JS width branching
for the structural split, to stay SSR-safe).

## Components

### New: `MobileTabBar.tsx`
- Fixed bottom nav (`fixed bottom-0 inset-x-0 md:hidden`), three destinations:
  **Edit · Preview · Library** (icon + label).
- Props: `value: MobileView`, `onChange(v: MobileView)`.
- Active item uses brand color; inactive muted.
- Bottom padding `pb-[env(safe-area-inset-bottom)]` for the notch.

### New: `MobileMenu.tsx`
- Hamburger slide-out, reusing the `LibraryDrawer` overlay pattern (fixed inset,
  scrim, right/left sheet). Triggered by a hamburger button in the mobile header.
- Contents: render status (the existing status dot+label), user email,
  **Saved ads** button (opens the existing `LibraryDrawer`), **Sign out** link.
- Props: `open`, `onClose`, `status`, `userEmail`, `onOpenSavedAds`.

### Changed: `App.tsx`
- New state: `const [mobileView, setMobileView] = useState<MobileView>('edit')`.
- `MobileView = 'edit' | 'preview' | 'library'` (type lives in a small module —
  see Pure logic).
- **Header**: split into desktop (`hidden md:flex`, current markup) and mobile
  (`flex md:hidden`): logo icon + compact `SpaceSwitcher` + hamburger button.
- **Body** (`<md`, `md:hidden` container):
  - `edit` → `<InputPanel>` (full width; its sticky Generate footer sits above the
    tab bar — add `pb` equal to tab-bar height + safe-area).
  - `preview` → `<OutputPanel>`.
  - `library` → a `Videos | Backgrounds` segmented control over
    `<VideoLibrary>` / `<ImageLibrary>` (driven by the existing `RightView`).
  - A spacer/padding-bottom equal to the tab bar height so content isn't hidden
    behind the fixed bar.
- **Body** (`≥md`): the existing grid block becomes a sibling with `hidden md:grid`
  (internal classes otherwise unchanged); the mobile block above is `md:hidden`.
  Exactly one is visible at any width.
- Root container: `h-screen` → `h-dvh`.

### Renames
- The header **"Library"** button (opens saved generated ads via `LibraryDrawer`)
  is relabeled **"Saved ads"** on both desktop and the mobile menu, to disambiguate
  from the bottom **"Library"** tab (reusable backgrounds/videos browser).

### Changed: `src/app/layout.tsx`
- Add `viewportFit: 'cover'` to the exported `viewport`.

### Changed: form inputs (`src/components/ui.tsx`, InputPanel CTA input)
- `Select`, the CTA `<input>`, and any `text-[15px]` form fields bump to ≥16px on
  mobile to prevent iOS focus-zoom: `text-base md:text-[15px]` (16px on phones,
  15px from `md` up). Steppers/selects keep their 52px height (already touch-ok).

## Data flow

```
App.tsx
 ├─ mobileView state ─ drives the <md body switch + MobileTabBar active state
 ├─ rightView state (existing) ─ reused for the mobile Library sub-toggle + desktop
 ├─ <header>: desktop markup (hidden md:flex) | mobile markup (flex md:hidden)
 ├─ <md body (md:hidden)>: InputPanel | OutputPanel | (VideoLibrary|ImageLibrary)
 ├─ ≥md body (hidden md:grid): existing grid + PanelResizer (≥lg)
 ├─ <MobileTabBar md:hidden value=mobileView onChange=setMobileView />
 ├─ <MobileMenu open=… /> (hamburger)
 └─ <LibraryDrawer> (saved ads — unchanged)
```

## Pure logic + testing

Layout is mostly declarative CSS, but the mobile navigation has one piece of pure
logic worth isolating and unit-testing per CLAUDE.md:

- `src/lib/mobileNav.ts` — `MobileView` type + `MOBILE_TABS` descriptor array
  (id, label, icon-key) + a tiny helper `isMobileView(x): x is MobileView`.
- `mobileNav.test.ts` — asserts the tab descriptors and the guard.

Everything else is verified at runtime (see QA).

## Adversarial QA (multi-agent)

After implementation, run a **multi-agent QA workflow** (the user explicitly opted
into adversarial agents). The dev server runs; parallel agents each drive the app
via Playwright at a mobile viewport and probe one adversarial dimension, returning
structured findings:

1. **375×667 portrait** — every view reachable; nothing clipped; Generate above tab bar.
2. **Landscape (667×375)** — tab bar + header don't eat the whole screen; content scrolls.
3. **Keyboard open** — focusing the CTA input doesn't hide Generate / break layout; no zoom.
4. **Long verse range / long language name** — no horizontal overflow in Edit.
5. **RTL language (Arabic)** — header, tabs, and form don't break direction.
6. **Safe-area / notch** — bottom tab bar padding renders (simulate via CSS env).
7. **Rapid tab switching** — no state loss; selected background/preview persists.
8. **Library with 197 items** — grid scrolls under the tab bar; filter usable; videos load.

Findings are triaged; real ones fixed before the PR merges. A final pass re-runs
the failed dimensions.

## Decisions (confirmed)

- Bottom tab bar with **3 tabs** (Edit / Preview / Library); Library hosts
  Videos/Backgrounds via a segmented sub-toggle.
- Header overflow → **hamburger** menu; keep logo + space switcher in the bar.
- **Phones-first**: new layout `< md` only; `md`–`lg` and `≥lg` unchanged.
- Header saved-ads button renamed **"Saved ads"**.
- `h-screen`→`h-dvh`, `viewportFit: 'cover'`, ≥16px inputs on mobile.
