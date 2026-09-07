# Apex-Work Design System

Source of truth for the visual language. Tokens follow the **three-layer**
model (primitive → semantic → component) and draw on the open-source
**UI/UX Pro Max** skill ([uupm.cc](https://uupm.cc)) design intelligence,
specifically its **Freelancer Platform**, **Marketplace (P2P)** and
**Chat & Messaging** palettes — the exact product type of Apex-Work.

## 1. Primitive (raw values)

Found in `apps/web/src/app/globals.css` as CSS custom properties, expressed in
HSL hue/saturation/lightness.

| Primitive      | Light           | Dark          | Note                           |
| -------------- | --------------- | ------------- | ------------------------------ |
| `--primary`    | `262 83% 58%`   | `262 90% 74%` | Violet — trust / brand         |
| `--accent`     | `142 66% 37%`   | `142 66% 52%` | Hire green — CTA / positive    |
| `--background` | `262 40% 98.5%` | `258 22% 6%`  | Cool near-white → violet-black |
| `--foreground` | `258 24% 10%`   | `258 20% 96%` | Near-black w/ violet cast      |
| `--border`     | `258 34% 90%`   | `258 16% 16%` | Violet-tinted hairline         |

Brand gradient (component-level):
`linear-gradient(135deg, #7c3aed 0%, #6366f1 45%, #16a34a 100%)`
(used by `.grad-hero`, `.grad-text`, and the `brand` button variant).

## 2. Semantic (purpose aliases)

Mapped to Tailwind utilities automatically (shadcn-style):
`bg-primary`, `text-muted-foreground`, `border-border`, `bg-card`,
`ring-ring`, `bg-destructive`, `bg-accent`, etc. Because every component
consumes these, redefining the primitives restyles the whole app with no
per-file churn.

## 3. Component (component-specific)

| Component        | Values                                                          |
| ---------------- | --------------------------------------------------------------- |
| Button (default) | `bg-primary text-primary-foreground`, violet shadow, hover lift |
| Button (brand)   | `.grad-hero` gradient + `shadow-primary/40`                     |
| Avatar           | `ring-2 ring-cyan-400` verified ring, badge on outer wrapper    |
| Card             | `bg-card border-border`, 12px radius                            |
| Radius           | `--radius: 0.75rem`                                             |

## Typography

- **Latin / UI:** Plus Jakarta Sans (`--font-pjs`) — Friendly/Enterprise SaaS
  pairing, "modern, approachable, legible, admin dashboards".
- **Amharic / Ethiopic:** Noto Sans Ethiopic (`--font-ethiopic`) — loaded as a
  fallback in the same font stack so the full Amharic UI renders with the same
  weight and cadence instead of a system fallback.
- Font stack: `var(--font-pjs), var(--font-ethiopic), system-ui, sans-serif`.

## Dark mode

Violet-black surfaces (`--background: 258 22% 6%`) with a lighter violet primary
(`262 90% 74%`) for contrast; controlled by `.dark` on `<html>`.

## Motion & accessibility

- Animations are reserved for loading/feedback (per uupm UX guidance), using
  short, ease-out curves; screenshot of the app respects
  `html[data-data-saver='true']` which disables gradient/blur animation.
- Focus is always visible via `focus-visible:ring-2 ring-ring ring-offset-2`.
- Text color uses the `--foreground`/`--muted-foreground` pairs for WCAG contrast;
  the hire-green accent is darkened in light mode (`142 66% 37%`) so `bg-accent`
  stays readable with white text.
