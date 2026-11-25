const SEVERITY_ORDER = { P0: 0, P1: 1, P2: 2 };

function lineNumberAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function parseAttr(tag, name) {
  const match = tag.match(
    new RegExp(`(?<![\\w-])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match ? (match[1] ?? match[2] ?? "") : null;
}

export function analyzeSvg(source) {
  const text = String(source);
  const issues = [];

  const rootMatch = text.match(/<svg\b[^>]*>/i);
  if (!rootMatch) {
    issues.push({
      rule: "missing-svg-root",
      severity: "P0",
      line: 1,
      match: "<svg>",
      suggestion: "File does not contain a root <svg> element",
    });
    return { issues, counts: { P0: 1, P1: 0, P2: 0 } };
  }

  const rootTag = rootMatch[0];
  if (!parseAttr(rootTag, "viewBox")) {
    issues.push({
      rule: "missing-viewbox",
      severity: "P1",
      line: lineNumberAt(text, rootMatch.index ?? 0),
      match: "<svg>",
      suggestion: "Add an explicit viewBox attribute for responsive scaling",
    });
  }
  if (!parseAttr(rootTag, "role")) {
    issues.push({
      rule: "missing-role",
      severity: "P1",
      line: lineNumberAt(text, rootMatch.index ?? 0),
      match: "<svg>",
      suggestion: 'Add role="img" on the root <svg>',
    });
  }
  if (!/<title\b[^>]*>[\s\S]*?\S[\s\S]*?<\/title>/i.test(text)) {
    issues.push({
      rule: "missing-title",
      severity: "P1",
      line: 1,
      match: "<title>",
      suggestion: "Add a descriptive <title> element as the first child of <svg>",
    });
  }

  for (const match of text.matchAll(/<script\b/gi)) {
    issues.push({
      rule: "svg-script",
      severity: "P0",
      line: lineNumberAt(text, match.index ?? 0),
      match: "<script>",
      suggestion: "Remove <script>; SVGs embedded via <img> block scripts",
    });
  }

  const definedIds = new Set();
  for (const match of text.matchAll(/(?<![\w-])id\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)) {
    definedIds.add(match[1] ?? match[2]);
  }
  for (const match of text.matchAll(/url\(\s*#([^)\s"']+)\s*\)/gi)) {
    const id = match[1];
    if (!definedIds.has(id)) {
      issues.push({
        rule: "dangling-url-ref",
        severity: "P0",
        line: lineNumberAt(text, match.index ?? 0),
        match: `url(#${id})`,
        suggestion: `Define id="${id}" inside <defs> or reference an existing id`,
      });
    }
  }

  for (const match of text.matchAll(
    /<(animate|animateMotion|animateTransform)\b[^>]*>/gi,
  )) {
    const tag = match[0];
    const line = lineNumberAt(text, match.index ?? 0);
    const keyTimesRaw = parseAttr(tag, "keyTimes");
    if (keyTimesRaw !== null) {
      const times = keyTimesRaw
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean)
        .map(Number);

      if (!times.length || times.some((n) => Number.isNaN(n))) {
        issues.push({
          rule: "invalid-keytimes",
          severity: "P0",
          line,
          match: `keyTimes="${keyTimesRaw}"`,
          suggestion: "Use valid numeric semicolon-separated keyTimes in [0, 1]",
        });
      } else {
        if (times.some((n) => n < 0 || n > 1)) {
          issues.push({
            rule: "keytimes-out-of-range",
            severity: "P0",
            line,
            match: `keyTimes="${keyTimesRaw}"`,
            suggestion: "Clamp all SMIL keyTimes values to the [0, 1] range",
          });
        }
        for (let i = 1; i < times.length; i += 1) {
          if (times[i] < times[i - 1]) {
            issues.push({
              rule: "keytimes-non-monotonic",
              severity: "P0",
              line,
              match: `keyTimes="${keyTimesRaw}"`,
              suggestion: "Keep SMIL keyTimes non-decreasing",
            });
            break;
          }
        }
        const valuesRaw = parseAttr(tag, "values");
        if (valuesRaw !== null) {
          const vals = valuesRaw.split(";").map((item) => item.trim());
          if (vals.length !== times.length) {
            issues.push({
              rule: "keytimes-length-mismatch",
              severity: "P0",
              line,
              match: `keyTimes(${times.length}) vs values(${vals.length})`,
              suggestion: "Ensure keyTimes and values have the same number of entries",
            });
          }
        }
        const keyPointsRaw = parseAttr(tag, "keyPoints");
        if (keyPointsRaw !== null) {
          const pts = keyPointsRaw
            .split(";")
            .map((item) => item.trim())
            .filter(Boolean);
          if (pts.length !== times.length) {
            issues.push({
              rule: "keytimes-length-mismatch",
              severity: "P0",
              line,
              match: `keyTimes(${times.length}) vs keyPoints(${pts.length})`,
              suggestion:
                "Ensure keyTimes and keyPoints have the same number of entries",
            });
          }
        }
      }
    }
  }

  for (const match of text.matchAll(
    /<(?:circle|rect|ellipse|polygon|path)\b[^>]*>/gi,
  )) {
    const tag = match[0];
    const opacityRaw = parseAttr(tag, "opacity");
    const strokeRaw = parseAttr(tag, "stroke");
    const fillRaw = parseAttr(tag, "fill");
    if (
      opacityRaw !== null &&
      strokeRaw &&
      strokeRaw !== "none" &&
      fillRaw &&
      fillRaw !== "none" &&
      Number(opacityRaw) > 0 &&
      Number(opacityRaw) <= 0.35
    ) {
      issues.push({
        rule: "low-shape-opacity-with-stroke",
        severity: "P2",
        line: lineNumberAt(text, match.index ?? 0),
        match: `opacity="${opacityRaw}" stroke="${strokeRaw}"`,
        suggestion: "Use fill-opacity instead of opacity so the stroke stays legible",
      });
    }
  }

  const hasCssAnimation = /@keyframes\b|animation\s*:/i.test(text);
  const hasReducedMotion = /prefers-reduced-motion/i.test(text);
  if (hasCssAnimation && !hasReducedMotion) {
    issues.push({
      rule: "missing-reduced-motion",
      severity: "P1",
      line: 1,
      match: "@keyframes",
      suggestion: "Add @media (prefers-reduced-motion: reduce) to stop CSS animation",
    });
  }

  issues.sort(
    (a, b) =>
      a.line - b.line || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  const counts = { P0: 0, P1: 0, P2: 0 };
  for (const item of issues) counts[item.severity] = (counts[item.severity] || 0) + 1;
  return { issues, counts };
}

export function formatSvgReport(reports) {
  const lines = [];
  let p0 = 0;
  let p1 = 0;
  let p2 = 0;
  for (const report of reports) {
    p0 += report.counts.P0;
    p1 += report.counts.P1;
    p2 += report.counts.P2;
    lines.push(
      `${report.file} (P0:${report.counts.P0} P1:${report.counts.P1} P2:${report.counts.P2})`,
    );
    if (!report.issues.length) {
      lines.push("  clean");
      continue;
    }
    for (const issue of report.issues) {
      lines.push(
        `  ${issue.severity} L${issue.line} [${issue.rule}] "${issue.match}" -> ${issue.suggestion}`,
      );
    }
  }
  lines.push(`total: ${reports.length} svg file(s), P0:${p0} P1:${p1} P2:${p2}`);
  return lines.join("\n");
}
