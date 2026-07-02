# Design

## Theme

Light and dark, user-toggleable (system default on first load). Register: **product** — Restrained color strategy (tinted neutrals + one brand accent, semantic colors for state).

## Color (OKLCH)

Brand seed: `oklch(0.842 0.165 91.3)` — warm amber/honey-gold. Primary and warning share this hue family (gold → orange → red maps naturally to stock health: healthy → low → critical).

### Light

```css
--bg: oklch(1 0 0);                    /* pure white — warmth lives in primary, not bg */
--surface: oklch(0.975 0.006 91);      /* cards, table rows */
--surface-2: oklch(0.955 0.008 91);    /* sidebar / toolbar — second neutral layer */
--surface-hover: oklch(0.94 0.01 91);
--border: oklch(0.89 0.01 91);
--ink: oklch(0.20 0.014 91);           /* body text, ~13:1 on bg */
--muted: oklch(0.48 0.012 91);         /* secondary text, ~5.2:1 on bg */

--primary: oklch(0.60 0.15 91);        /* amber-gold — primary actions */
--primary-hover: oklch(0.54 0.15 91);
--primary-ink: oklch(1 0 0);

--accent: oklch(0.40 0.07 224);        /* deep slate-teal — links, info, secondary emphasis */
--accent-ink: oklch(1 0 0);

--success: oklch(0.56 0.13 152);
--success-ink: oklch(1 0 0);
--warning: oklch(0.66 0.16 55);
--warning-ink: oklch(1 0 0);
--danger: oklch(0.54 0.21 25);
--danger-ink: oklch(1 0 0);
```

### Dark

```css
--bg: oklch(0.09 0 0);                 /* pure near-black, chroma 0 */
--surface: oklch(0.155 0.006 91);
--surface-2: oklch(0.13 0.006 91);
--surface-hover: oklch(0.20 0.008 91);
--border: oklch(0.28 0.012 91);
--ink: oklch(0.95 0.006 91);
--muted: oklch(0.66 0.012 91);

--primary: oklch(0.74 0.14 91);
--primary-hover: oklch(0.80 0.13 91);
--primary-ink: oklch(0.16 0.02 91);    /* dark text — this gold is too light for white text */

--accent: oklch(0.68 0.09 224);
--accent-ink: oklch(0.12 0.02 224);

--success: oklch(0.68 0.14 152);
--success-ink: oklch(0.12 0.03 152);
--warning: oklch(0.72 0.15 55);
--warning-ink: oklch(0.14 0.03 55);
--danger: oklch(0.62 0.20 25);
--danger-ink: oklch(1 0 0);
```

Rules: accent/status colors are for state only (current selection, badges, alerts) — never decoration. Sidebar/toolbar use `surface-2`, content cards use `surface`.

## Typography

Single family: **Geist Sans** (already in the Next.js scaffold via `next/font`) carries headings, labels, body, buttons. **Geist Mono** reserved for codes only — SKU/barcode values, timestamps in logs, IDs.

Fixed rem scale, ratio ~1.15 (product register — no fluid clamp):

| Token | Size | Weight | Use |
|---|---|---|---|
| `text-xs` | 0.75rem | 500 | badges, meta, table captions |
| `text-sm` | 0.8125rem | 400/500 | table cells, form labels, secondary UI |
| `text-base` | 0.9375rem | 400 | body, inputs |
| `text-lg` | 1.0625rem | 600 | card titles, section headers |
| `text-xl` | 1.25rem | 600 | page titles |
| `text-2xl` | 1.5rem | 700 | dashboard hero numbers |
| `text-3xl` | 1.875rem | 700 | rare — large stat callouts only |

No display font. No all-caps body. Uppercase only for short badges/status pills (≤2 words).

## Layout & Spacing

- Spacing scale: 4px base (Tailwind default) — 1,2,3,4,6,8,12,16 used deliberately, not everything on 4/8.
- Sidebar (fixed, `surface-2`) + top bar (breadcrumb/user menu) + content area (`bg`) — standard product shell, per-panel (user/admin/developer each get their own shell instance, not one shell with conditional rendering).
- Tables run dense when the data calls for it (product lists, movement history, audit logs) — no artificial line-height inflation to "look airy."
- Cards used only where they earn it (stat tiles, product detail panel) — never nested cards.

## Radius & Elevation

- `radius-sm`: 6px (inputs, buttons, badges)
- `radius-md`: 10px (cards, panels, modals)
- `radius-lg`: 14px (rare — large containers)
- Shadows minimal: one soft `shadow-sm` for popovers/dropdowns/modals only. Flat elsewhere — border does the separation work, not shadow.

## Components (conventions, not decoration)

- Every interactive control ships default/hover/focus/active/disabled/loading states. Focus ring: 2px `accent` outline, offset 2px — never removed.
- Buttons: solid (`primary`) for the one primary action per view, outline/ghost for secondary, `danger` solid reserved for destructive confirs only.
- Tables: sticky header, row hover = `surface-hover`, critical-stock rows get a left icon + `warning`/`danger` text badge (never a colored left-border stripe).
- Empty states teach ("Henüz ürün eklenmedi — İlk ürünü ekle" + CTA), not blank silence.
- Loading: skeletons for tables/cards, not centered spinners over content.
- Modals: last resort — used only for destructive confirmation (delete user, delete product) and quick-create forms. Everything else inline or a side panel.

## Motion

150–250ms, ease-out-quart, transform/opacity only. State changes and feedback (toast in, row removal, panel expand) — never orchestrated page-load sequences. Full `prefers-reduced-motion` fallback (crossfade/instant) everywhere.

## Iconography

One icon set throughout (lucide-react) — 18–20px in UI chrome, 16px inline with text. Status always paired with an icon, not color alone (accessibility: color-blind users must read state from shape too).
