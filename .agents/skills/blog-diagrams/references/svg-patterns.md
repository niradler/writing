# SVG Starter Patterns and Pitfalls

Reusable scaffolding matching Piece by Piece's dark-card diagram style.

## Base Card Skeleton

Every SVG starts from this wrapper:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 400" width="1360" height="800" role="img" font-family="IBM Plex Sans, Inter, Helvetica, Arial, sans-serif">
  <title>One-sentence summary of what the diagram demonstrates.</title>
  <style>
    .t{fill:#DCE7E2;font-size:14px;font-weight:500}
    .s{fill:#8FA39B;font-size:12px}
    .c{text-anchor:middle;dominant-baseline:central}
    @media (prefers-reduced-motion: reduce){*{animation:none!important}}
  </style>
  <rect width="680" height="400" rx="16" fill="#0E1412"/>
  <text x="40" y="44" class="t">Clear takeaway title</text>
  <text x="40" y="64" class="s">One-line subtitle with scope or sample size</text>
  <!-- diagram content -->
</svg>
```

## Pattern 1: Closed Feedback Loop with Gate

Best for: agent loops, CI/CD gates, retry/escalation pipelines.

- Draw the background track twice: a thick neutral rail (`stroke="#26332E" stroke-width="10" stroke-linejoin="round"`) and a thin dashed flow overlay (`stroke="#14B88A" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 10"` animated with `stroke-dashoffset`).
- Place 4-8 uniform rounded node cards (`rx="10"`, `fill="#0F3D31"`, `stroke="#14B88A"`). Highlight the final promotion/alert node with `stroke="#FF6B3D"`.
- Show a concrete outcome by animating 2-3 dots along `<animateMotion path="...">`: rejected dots turn `#56645F` at the gate and drop into a dashed `reverted` box; the winning dot turns `#FF6B3D` and completes the loop.
- Pair each outcome with a short pill badge (`rx="13"`) that flashes via `<animate attributeName="opacity" calcMode="discrete" ...>`.

## Pattern 2: Side-by-Side Architecture Comparison

Best for: "Without X vs With X", before/after, single-agent vs hub topologies.

- Use a `viewBox="0 0 1000 520"` split down the middle (`<line x1="500" y1="50" x2="500" y2="500" stroke="#26332E"/>`).
- Put section headers at `(30, 32)` and `(530, 32)`.
- Define one arrowhead `<marker>` per semantic color inside `<defs>` and verify every `marker-end="url(#...)"` references a defined ID.
- Put concrete failure/limitation notes along the bottom left in `#FF6B6B` and exact source file references along the bottom right in `#8FA39B`.

## Pattern 3: Quantitative Threshold / Noise-Band Chart

Best for: showing why averages mislead, noise bands, or per-round decisions.

- Plot a horizontal baseline (`stroke="#8FA39B" stroke-dasharray="4 4"`) inside a translucent noise band (`fill="#56645F" fill-opacity=".22"`).
- Label the vertical axis direction clearly ("faster ↑", "lower cost ↓") with a small arrow marker.
- Drop points sequentially across the cycle (`<animateTransform type="translate">` + `<animate attributeName="opacity">`) using `#56645F` for inside-noise/reverted points and `#FF6B3D` for kept/winning points.

## Pattern 4: 2x2 Quadrant / Positioning Map

Best for: comparing 4-6 engineering patterns along two concrete axes (e.g., runtime vs decision latency).

- Draw crisp axes (`#8FA39B`) with concrete tick labels (units like `seconds`, `minutes`, `hours`, `days` rather than vague `low`/`high`).
- Plot circular translucent nodes (`r="44"`, `fill-opacity="0.12"`, colored stroke) with bold title + one-line concrete tool example inside.
- Add a one-line footer takeaway in the bottom-right corner.

## Common SVG Pitfalls to Avoid

1. **Dangling marker IDs**: referencing `marker-end="url(#a555)"` when `#a555` is not in `<defs>` silently drops the arrowhead in browsers.
2. **Invalid SMIL `keyTimes`**: any value `> 1` (e.g. `1.0071`) or mismatched array length between `keyTimes` and `values`/`keyPoints` breaks the animation in Chromium/WebKit.
3. **Inline `<script>` tags**: browsers ignore JavaScript inside SVGs loaded via `<img>` tags. Use pure SVG/SMIL/CSS.
4. **Transparent backgrounds**: transparent dark-text SVGs become unreadable in dark mode (`#000000`), and transparent light-text SVGs disappear in light mode (`#fafafa`). Always draw the `#0E1412` background card.
5. **Unreadable mobile text**: cramming 15 boxes into `viewBox="0 0 1400 700"` makes `11px` labels microscopic on a `390px` phone screen. Split dense architectures into two focused diagrams instead.
