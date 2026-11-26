---
name: blog-diagrams
description: Design and verify custom dark-card SVGs (static and animated) and data charts for Piece by Piece (blog.niradler.com) matching the site's typography, palette, dual light/dark readability, accessibility, and reduced-motion rules. Use when adding diagrams, architecture visuals, protocol animations, or charts to a blog post in site/public/media/<slug>/.
---

# Blog Diagrams and Visuals

Build visuals that carry real technical information and look native to Piece by Piece in both light (`#fafafa`) and dark (`#000000`) themes. Never add decorative stock images or generic AI art when a crisp diagram or data chart explains the point better.

## Choose the Right Visual

| When the post explains...                                         | Use                                        | Example                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| Every published post's hero / social card (mandatory)             | **16:9 Raster Cover** (`cover.jpg`/`.png`) | Dark isometric editorial illustration (zero text, matching recent covers) or hero chart |
| A feedback loop, state machine, gating rule, or message protocol  | **Animated SVG** (SMIL / CSS)              | Candidate revisions entering a noise-band gate and dropping into reverted vs promoted   |
| Multi-component architecture, before/after comparison, or 2x2 map | **Static SVG**                             | Side-by-side "Without a hub" vs "With a hub" topology                                   |
| Quantitative runs, latency/cost trade-offs, or distributions      | **Data chart** (PNG or SVG from real data) | Scatter of wall-clock time vs cost per run with labeled clusters                        |
| Short linear command flow or small text hierarchy                 | **Code block or table**                    | Don't draw an SVG when a 6-line table is faster to scan                                 |

## Piece by Piece SVG Design System

All diagrams render inside the `42rem` (~672px) article column, wrapped with `1px solid var(--border)` and `border-radius: 8px`. Use a self-contained dark card so every SVG has high contrast on both the light (`#fafafa`) and dark (`#000000`) page canvases.

### Palette Tokens

| Role                           | Hex                                                                           | Usage                                                  |
| ------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| Card background                | `#0E1412`                                                                     | Outer `<rect rx="16">` canvas                          |
| Node fill (neutral)            | `#16201C` / `#121A17`                                                         | Boxes, containers, channel panels                      |
| Node fill (active/core)        | `#0F3D31`                                                                     | Primary loop nodes or central hub                      |
| Track / divider                | `#26332E` / `#3A4A44`                                                         | Background tracks, subtle borders, dashed paths        |
| Primary text                   | `#DCE7E2`                                                                     | Titles, node labels, key annotations                   |
| Secondary / muted text         | `#8FA39B`                                                                     | Subtitles, axis ticks, secondary captions              |
| Primary accent (pass / active) | `#14B88A`                                                                     | Active nodes, passing flows, primary strokes           |
| Alert / highlight / gate pass  | `#FF6B3D` / `#FF8A65`                                                         | Promoted items, raised human flags, pause states       |
| Muted / reverted / inactive    | `#56645F`                                                                     | Rejected items, noise band fill (`fill-opacity=".22"`) |
| Multi-role accents (optional)  | `#5AA9E6` (blue), `#B39DDB` (purple), `#4DD0E1` (cyan), `#FF6B6B` (error red) | Distinct roles in multi-agent or comparative diagrams  |

### Typography and Sizing

- **Font stack**: `font-family="IBM Plex Sans, Inter, Helvetica, Arial, sans-serif"` on the root `<svg>`. Use `font-family="IBM Plex Mono, Menlo, monospace"` for filenames, commands, and status literals.
- **ViewBox**: keep aspect ratio readable inside `42rem` and on `390px` mobile screens. Prefer `viewBox="0 0 680 400"` to `viewBox="0 0 960 520"` (do not make viewBox wider than `1000` or text shrinks below legibility on phones).
- **Text sizes**:
  - Diagram title: `14–16px`, weight `500–600`, `#DCE7E2`.
  - Subtitle / legend / axis labels: `12px`, `#8FA39B`.
  - Node title: `13–14px`, weight `500–600`, `#DCE7E2`; node subtitle: `11–12px`, `#8FA39B`.
  - Never use text smaller than `10.5px` in a `900+` viewBox.
- **Margins**: keep at least `30–40px` padding inside the card edges so text and rounded corners never crowd the border.

### Motion Rules (Animated SVGs)

Animate only when movement explains state over time (a loop cycle, a pause flag stopping spend, rounds dropping against a noise band).

1. **Reduced motion**: CSS `@media (prefers-reduced-motion: reduce){*{animation:none!important}}` stops CSS `@keyframes` only; it does **not** stop SMIL `<animate>` or `<animateMotion>`. For SMIL-animated SVGs, wrap animated layers in `<g class="anim">` and provide a readable static `<g class="static-fallback">` toggled via `@media (prefers-reduced-motion: reduce){.anim{display:none}.static-fallback{display:inline}}` (with `.static-fallback{display:none}` by default), or use CSS animations instead of SMIL.
2. Keep cycle durations calm and readable (`12s–18s` for multi-step stories, `5s–7s` for simple background loops).
3. Ensure SMIL `keyTimes` values are strictly non-decreasing, start at `0`, and **never exceed `1`** (`0 <= t <= 1`).
4. Ensure the first frame (`t = 0`) and reduced-motion static state still communicate the core flow visually (never hide all labels at `opacity="0"` without a static state).
5. Do not use `<script>` inside SVGs; `<img src="/media/...">` sandboxes scripts and executes only declarative CSS/SMIL animations.

### Accessibility and File Placement

- Add `role="img"` on `<svg>` and a `<title>` element inside `<svg>` summarizing the exact takeaway.
- Save under `site/public/media/<slug>/<name>.svg` (lowercase, hyphenated).
- Reference in Markdown with root-relative path and rich alt text describing what the reader should take away:
  ```markdown
  ![Animated loop: production runs, grade, datasets, coach, candidate, replay, shadow, promote. Two candidates fall inside the noise band and are reverted; the third beats the noise and is promoted](/media/<slug>/loop.svg)
  ```
- Note: `scripts/optimize-images.mjs` only converts raster formats (`.png`, `.jpg`, `.gif`, `.webp`); SVGs are served directly and stay crisp at any DPI.

## Reference Patterns

See [references/svg-patterns.md](references/svg-patterns.md) for reusable starter templates (closed feedback loop, noise-band scatter/drop chart, side-by-side comparison) and common SVG pitfalls.

## Verification Checklist

Run the automated SVG checker first:

```bash
npm run check:svg -- site/public/media/<slug>/*.svg
```

Then confirm manually before committing any SVG or chart:

- [ ] `npm run check:svg` reports zero `P0` and `P1` issues (valid `url(#id)` refs, valid monotonic `keyTimes` in `[0, 1]`, `role="img"`, `<title>`, no `<script>`).
- [ ] Animated SVGs have a readable static state for `prefers-reduced-motion: reduce`.
- [ ] No connector line cuts through unrelated boxes or text, and no text clips past card edges or overlaps borders.
- [ ] Stroked translucent shapes use `fill-opacity`, not whole-element `opacity`.
- [ ] Rendered cleanly in `npm run dev` (or built preview) in both light and dark modes, at desktop (`1280px`) and mobile (`390px`).
- [ ] `npm run check` passes (confirms local file exists and alt text is present).
