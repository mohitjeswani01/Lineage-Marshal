# Lineage Marshal — Frontend Design System

> **Scope:** frontend only. This is the single source of truth for how the Lineage Marshal UI looks, moves and behaves. If a value isn't in here, it doesn't belong in a component.
>
> **Implementation:** [`frontend/src/index.css`](frontend/src/index.css) (colour + CSS-var tokens) and [`frontend/src/design/`](frontend/src/design/) (TypeScript tokens). Read this document, then use the tokens — never the raw values printed here.

---

## 1. Brand philosophy

Lineage Marshal is an incident tool. Someone opens it when a pipeline is broken, a dashboard is wrong, or an on-call page just fired. The interface has one job: **make the agent's findings legible fast, and never add noise to a stressful moment.**

Five principles, in priority order:

1. **Calm under load.** Muted surfaces, one accent colour, generous whitespace. Colour is reserved for meaning — a red badge means something is actually wrong. If everything is highlighted, nothing is.
2. **Data is the interface.** URNs, lineage nodes and blast-radius scores are the content. Chrome recedes; monospace is used wherever a value will be copied into a terminal.
3. **Motion explains, never decorates.** Every animation answers "where did this come from?" or "what just changed?" Nothing moves for delight alone, and nothing blocks input.
4. **Honest states.** The agent may be offline, slow, or partially implemented. The UI says exactly that, names the endpoint, and offers the next action. It never fabricates data to look complete.
5. **Keyboard and screen reader parity.** An incident responder who lives on the keyboard should never need the mouse.

Reference points: **Linear** (density + shared-layout nav), **Vercel** (restraint), **Raycast** (keyboard-first lists), **Stripe** (typographic hierarchy in dense data).

---

## 2. Colour system

Two themes, both driven from a four-colour palette. **Every colour in the app is a semantic token** — components never see a hex value. Raw hex appears in exactly one file: `frontend/src/index.css`.

### Dark theme — foundation palette

Source: <https://colorhunt.co/palette/1b262c0f4c753282b8bbe1fa>

| Swatch | Hex | Role in the system |
|---|---|---|
| Ink | `#1B262C` | Page ground |
| Deep | `#0F4C75` | Accent shadow-side, gradients |
| Accent | `#3282B8` | Primary interactive colour |
| Mist | `#BBE1FA` | Secondary text, hairlines |

### Light theme — foundation palette

Source: <https://colorhunt.co/palette/ffeddbedcdbbe3b7a0bf9270>

| Swatch | Hex | Role in the system |
|---|---|---|
| Sand | `#FFEDDB` | Page ground |
| Clay | `#EDCDBB` | Subtle ground, wells |
| Terracotta | `#E3B7A0` | Mid-tone, dividers |
| Cocoa | `#BF9270` | Primary interactive colour |

### Semantic tokens

| Token | Meaning | Dark | Light |
|---|---|---|---|
| `bg` | Page ground | `#1B262C` | `#FFEDDB` |
| `bg-subtle` | Recessed wells, code blocks | `#172026` | `#F7E2CE` |
| `surface` | Sidebar, sheets | `#1F2C33` | `#FFF7EE` |
| `surface-elevated` | Inputs, hovered rows, badges | `#24333C` | `#FFFDFA` |
| `card` | Card / panel body | `#1F2C33` | `#FFF7EE` |
| `accent` | Primary action, selection | `#3282B8` | `#BF9270` |
| `accent-hover` | Accent hover / active | `#4A97CC` | `#A87A58` |
| `accent-deep` | Gradient dark stop | `#0F4C75` | `#8C5C3D` |
| `accent-subtle` | Selected row wash, icon chips | `accent @ 14%` | `accent @ 16%` |
| `on-accent` | Text/icon on an accent fill | `#0B1418` | `#FFF7EE` |
| `border` | Default hairline | `mist @ 10%` | `cocoa @ 28%` |
| `border-strong` | Hover / emphasis hairline | `mist @ 20%` | `cocoa @ 48%` |
| `text` | Primary text | `#E8F2FA` | `#3A2B21` |
| `text-secondary` | Supporting text, labels | `#BBE1FA` | `#6B4F3C` |
| `muted` | Captions, metadata, placeholders | `#7F97A8` | `#9A7A63` |
| `success` | Completed, healthy | `#3FB98B` | `#2F8F63` |
| `warning` | Stale, no owner, degraded | `#E0A458` | `#B4731F` |
| `danger` | Failure, broken lineage | `#E2606B` | `#B34A4A` |
| `info` | Neutral in-progress | `#3282B8` | `#8C5C3D` |
| `focus` | Focus ring | `#4A97CC` | `#A87A58` |
| `overlay` | Modal / drawer scrim | `ink @ 72%` | `#3A2B21 @ 44%` |
| `glass` | Frosted surface fill | `#22303A @ 55%` | `#FFF7EE @ 62%` |
| `glass-border` | Frosted surface hairline | `mist @ 14%` | `cocoa @ 26%` |
| *(shadow)* | `--lm-shadow-color` + `--lm-shadow-alpha` | near-black @ 45% | cocoa @ 18% |

**Derived values.** Neither ColorHunt palette contains status hues or a text colour with sufficient contrast, so `success` / `warning` / `danger` / `text` are derived — tuned per theme to sit in the same family (cool-desaturated in dark, warm-earthy in light) while clearing WCAG AA against their own background.

**Shadow colour is theme-aware.** Black shadows on a sand background look like soot; the light theme casts a warm cocoa shadow instead.

### Rules

- ✅ `className="bg-surface text-muted border-border"`
- ✅ `style={{ background: colors.accentSubtle }}` when a value must reach JS
- ❌ `className="bg-[#3282B8]"` — no arbitrary colour values, ever
- ❌ `text-blue-400` — Tailwind's default palette is not part of this system
- Status colour must always be paired with a **word or icon**. Never colour alone.

---

## 3. Typography

System font stack (Inter first, falls back to the platform UI face) for prose; a monospace stack for anything copyable — URNs, JSON, IDs, durations.

| Token | Usage | Spec |
|---|---|---|
| `display` | Marketing-scale headline | 30/36px · 600 · −0.02em · 1.1 |
| `h1` | Page title | 24/30px · 600 · −0.02em · 1.15 |
| `h2` | Section title | 20px · 600 · −0.01em · 1.25 |
| `h3` | Card / panel title | 16px · 600 · −0.01em · 1.35 |
| `body` | Default text | 14px · 400 · 1.6 |
| `bodyLg` | Long-form brief text | 16px · 400 · 1.65 |
| `label` | Form labels | 12px · 500 · +0.02em |
| `caption` | Helper text, metadata | 12px · 400 · 1.5 · `muted` |
| `overline` | Section eyebrows | 10px · 600 · UPPERCASE · +0.12em · `muted` |
| `button` | Control labels | 14px · 500 · −0.005em |
| `mono` | URNs, JSON | 12px mono · 1.6 |
| `monoSm` | Dense chips, inline IDs | 11px mono · 1.5 |

**Rules.** Line height loosens as size drops (dense metadata needs air). Tracking tightens as size grows (large text at default tracking looks loose). Never more than three type sizes in one panel. Tokens are exported as ready-made class strings (`type.h3`) so a heading can't drift.

---

## 4. Spacing scale

Strict **4pt grid**. Tailwind's numeric scale is the same grid (`p-4` = 16px), so use it directly; the named aliases exist for JS and for review shorthand.

| Token | px | Typical use |
|---|---|---|
| `xs` | 4 | Icon-to-label, chip padding |
| `sm` | 8 | Tight stacks, gap between badges |
| `md` | 12 | Control padding, list row gap |
| `lg` | 16 | Card padding, default gap |
| `xl` | 24 | Card padding (roomy), section gap |
| `2xl` | 32 | Page gutters at ≥sm |
| `3xl` | 48 | Major section separation |
| `4xl` | 64 | Page top/bottom breathing room |

Structural constants (not decorative): sidebar `264px`, top bar `60px`, content max width `1440px`.

**No magic numbers.** If a value isn't on the grid, the layout is wrong, not the grid.

---

## 5. Radius scale

| Token | Value | Applied to |
|---|---|---|
| `sm` | 6px | Chips, tiny buttons, focus ring |
| `md` | 10px | Buttons, inputs, list rows |
| `lg` | 14px | Cards, toasts |
| `xl` | 18px | Panels |
| `2xl` | 24px | Dialogs, sheets |
| `full` | 9999px | Badges, status dots, avatars |

**Concentric rule:** a container at `lg` holds controls at `md`. Nested corners step down exactly one level so inner and outer curves stay parallel. `radiusFor` encodes the surface→token mapping so components don't each decide.

---

## 6. Shadow system

Four levels. A fifth means the layout needs fewer layers, not more depth.

| Token | Purpose |
|---|---|
| `soft` | Resting cards — barely there, just enough to lift off the ground |
| `medium` | Hovered / focused cards |
| `elevated` | Dropdowns, popovers |
| `floating` | Dialogs, toasts |

Each level is a **two-shadow stack**: a tight contact shadow plus a wide ambient one. Shadow colour and alpha come from theme vars, so the same token reads correctly in both themes.

Elevation roles (`elevation.card`, `elevation.dropdown`, …) map UI meaning to level, keeping z-order legible in code review.

---

## 7. Glassmorphism guidelines

Used sparingly — three places only: **sticky top bar**, **dropdown menus**, **toasts**. Every one of them sits *over* scrolling content, which is the only thing that justifies the effect.

| Property | Value |
|---|---|
| Blur | `blur(16px)` |
| Saturation | `saturate(160%)` — stops blurred content going grey |
| Fill | `glass` token (55% dark / 62% light) |
| Border | 1px `glass-border` |
| Inner highlight | `.rim-light` — `inset 0 1px 0` hairline, the "lit from above" cue |
| Layering | Glass never stacks on glass |

Reach for `.glass` + `.rim-light` utilities. Don't hand-roll `backdrop-filter`: an unblurred fallback must stay legible, and the token fills are already opaque enough to guarantee that.

---

## 8. Motion principles

All timing lives in [`design/motion.ts`](frontend/src/design/motion.ts). **No component declares a raw duration, curve or spring.**

### Durations

| Token | Seconds | Use |
|---|---|---|
| `instant` | 0.08 | Colour/opacity flips |
| `fast` | 0.14 | Hover, press, tooltips |
| `normal` | 0.22 | Panels, list items, view swaps |
| `slow` | 0.34 | Page-level entrances, error shake |
| `slower` | 0.5 | Large layout changes |

### Easing

| Token | Curve | Use |
|---|---|---|
| `standard` | `(0.2, 0, 0, 1)` | Default — starts and ends on screen |
| `entrance` | `(0.05, 0.7, 0.1, 1)` | Enters decisively, settles gently |
| `exit` | `(0.3, 0, 0.8, 0.15)` | Leaves fast — exits never make you wait |

### Springs

| Token | Physics | Use |
|---|---|---|
| `snappy` | 520 / 38 / 0.7 | Buttons, toggles, dropdowns — no visible overshoot |
| `gentle` | 280 / 30 / 0.9 | Cards, panels, nav pill |
| `bouncy` | 340 / 22 / 0.8 | Success mark — the one place overshoot is earned |

### Interaction physics

`hoverScale 1.015` · `hoverLift −2px` · `pressScale 0.985`. Small on purpose: at this density, a 1.05 hover looks like the page is breathing.

### Choreography

- **Stagger:** 45ms between siblings, 60ms before the first. Above ~10 items the last row would lag noticeably, so lists cap the perceived delay by staggering the container, not the scroll body.
- **Page/section entrance:** `fadeInUp` (8px rise) — direction implies "arriving from below the fold".
- **Shared layout:** the nav pill and the summary/raw toggle use `layoutId`, so the indicator *travels* instead of blinking. This is the single highest-value motion in the app.
- **Loading:** shimmer sweep on skeletons (CSS-only, main-thread free) plus a pulsing accent dot while the agent runs.
- **Success:** SVG path draw on a check mark, 0.35s, once.
- **Error:** a single low-amplitude shake (`x: 0 → −5 → 4 → −3 → 2 → 0`). Never repeats — twice reads as broken, not corrective.

### Reduced motion

`prefers-reduced-motion` is honoured twice: globally in CSS (all durations → 0.01ms) and per-component via `useReducedMotion` for transform-based effects. Meaning never lives in motion alone.

---

## 9. Component principles

| Component | Rules |
|---|---|
| **Button** | Four variants (`primary`, `secondary`, `ghost`, `danger`), three sizes. Exactly one `primary` per view. `loading` swaps the icon slot only — the button never resizes mid-request, so nothing jumps under the cursor. Always `<button type>`-explicit. |
| **Card** | `border` + `soft` shadow + `rim-light`. Hover lift **only** when the whole card is clickable. `CardHeader` (icon · title · description · action) is the single heading pattern. |
| **Dropdown / Select** | Full WAI-ARIA listbox: `aria-activedescendant`, ↑↓ Home End Enter Esc, focus returns to the trigger on close. Opens from its trigger edge with `transformOrigin: top`. Closes on outside *pointerdown*, not click. |
| **Input** | Label always visible — never placeholder-as-label. Hint and error occupy the same reserved line, so validation never reflows the form. `aria-invalid` + `aria-describedby` wired. |
| **Panel** | A Card with a bordered header band and a scrollable body. Header stays put; only the body scrolls. |
| **Dialog** | `2xl` radius, `floating` shadow, `overlay` scrim, focus trapped, Esc closes. *(Not yet needed — no dialog exists in this build.)* |
| **Toast** | Bottom-right stack, `glass` + `floating`. Polite live region, not assertive. **Errors never auto-dismiss**; success/info clear after 5s. Always dismissible. |
| **Table / list** | Rows are `md` radius, hover-tinted with `surface-elevated`, selected with `accent-subtle` + accent border. Metadata line is 11px `muted`. Truncate with `truncate`, never wrap a URN. |
| **Badge** | Always bordered so it reads on any surface. 11px, `full` radius, `whitespace-nowrap`. Six tones map to semantic status only. |
| **Status indicator** | Solid dot + `sr-only` label; the `animate-ping` halo is decorative and layered *behind* the dot, so state survives with animation off. |
| **Empty / error state** | One component, two tones. Every state has an icon, a title, a plain-English description and — where an action exists — a button. An error state without a next step is a dead end. |
| **Skeleton** | Shaped like the content it replaces (`SkeletonRow` mirrors an asset row) so nothing jumps on load. CSS-only shimmer. |

### Accessibility floor (non-negotiable)

- Visible focus on every interactive element — `:focus-visible` is styled once globally and never removed.
- Skip-to-content link as the first tab stop.
- Colour never carries meaning alone.
- Every icon-only control has an `aria-label`; every decorative icon has `aria-hidden`.
- Live regions: polite for toasts and progress, `role="alert"` for validation errors.
- All text clears WCAG AA against its own background in both themes.

---

## 10. Adding to this system

1. **Reuse first.** If a token or component already covers it, use that.
2. **Extend, don't fork.** New variant on an existing component beats a new component.
3. **Token before component.** A new colour/duration/radius goes into `design/` (and this doc) *before* any component references it.
4. **New token = new row here.** An undocumented token is a future inconsistency.
