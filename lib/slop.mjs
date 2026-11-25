import matter from "gray-matter";

const AI_URL_PARAM_RE =
  /([?&])(?:utm_source=(?:chatgpt\.com|openai|claude\.ai|perplexity\.ai|copilot\.com)|referrer=grok\.com)(?:&|$)/gi;

const CHATBOT_LEAK_RE =
  /\b(?:citeturn\d+[a-z]*\d*|oai_citation|grok_card)\b|contentReference\[[^\]]+\](?:\{[^}]+\})?|\[attached_file:\d+\]/gi;

const PLACEHOLDER_RE =
  /\[(?:confirm|todo|tbd|insert|your|add|enter|describe|specify|choose)\b[^\]]*\]|\b\d{4}-XX-XX\b|\bTBD\b/gi;

const CUTOFF_RE =
  /\b(?:as of my last update|as of my knowledge cutoff|i don't have access to real-time|while specific details are limited based on available information)\b/gi;

const CHATBOT_ARTIFACT_RE =
  /\b(?:i hope this helps|great question!?|feel free to reach out|let me know if you need anything else|happy coding!?|let's dive in|in this article,\s*we will explore|in this post,\s*we will explore)\b/gi;

const NEGATIVE_PARALLELISM_RE =
  /\b(?:it(?:'s| is) not(?: just)? [^.!?\n]{2,60}(?:,|—|--| - ) it(?:'s| is)|this isn't(?: just)? about [^.!?\n]{2,60}, it(?:'s| is) about|not just [^.!?\n]{2,50}, (?:it(?:'s| is)|but) |the real (?:story|question|issue) is\b)/gi;

const INFOMERCIAL_HOOK_RE =
  /(?:^|[.!?]\s+)(?:the catch\?|the kicker\?|the best part\?|plot twist:|the result\?|here's the thing[.:]|but here's the kicker:)/gim;

const FILLER_OPENER_RE =
  /\b(?:in today's (?:fast-paced |rapidly evolving |digital |modern )?[a-z]+|in an era (?:where|of)|in the rapidly evolving|imagine a world where|picture a future in which|let's (?:explore|take a look|break this down|examine|unpack))\b/gi;

const HEDGE_STACK_RE =
  /\b(?:could potentially|may eventually|might ultimately|would potentially|might potentially|could eventually)\b/gi;

const HOLLOW_INTENSIFIER_RE =
  /\b(?:genuinely|truly|quite frankly|to be honest|let's be clear|it(?:'s| is) worth noting(?: that)?|it is important to note(?: that)?|needless to say|the reality is that)\b/gi;

const VAGUE_ATTRIBUTION_RE =
  /\b(?:experts believe|studies show|research suggests|industry leaders agree|many developers say|it is widely considered|independent testing confirms|analysts agree)\b/gi;

const GENERIC_CLOSER_RE =
  /\b(?:the future looks bright|only time will tell|one thing is certain|as we move forward|worth your time|a must-read|don't sleep on|thank me later)\b/gi;

const TRANSITION_CRUTCH_RE =
  /(?:^|[.!?]\s+)(?:moreover|furthermore|additionally|notably|interestingly|surprisingly|importantly|significantly|when it comes to|at the end of the day|in conclusion|in summary|to summarize)\b/gim;

const MINIMIZER_RE = /\b(?:it(?:'s| is) that simple|simply put|simply|easily)\b/gi;

const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const TIER1_WORDS = [
  ["delve", /\bdelv(?:e|es|ed|ing)\b/gi, "use 'explore', 'inspect', or 'look at'"],
  ["tapestry", /\btapestr(?:y|ies)\b/gi, "describe the actual structure"],
  ["realm", /\brealms?\b/gi, "use 'area', 'field', or 'domain'"],
  ["beacon", /\bbeacons?\b/gi, "cut or state the concrete role"],
  ["testament to", /\btestament to\b/gi, "use 'shows' or 'proves'"],
  ["cutting-edge", /\bcutting-edge\b/gi, "name the version or technique"],
  ["pivotal", /\bpivotal\b/gi, "use 'key' or state what changed"],
  ["underscores", /\bunderscor(?:e|es|ed|ing)\b/gi, "use 'shows' or 'highlights'"],
  ["meticulous", /\bmeticulous(?:ly)?\b/gi, "use 'careful' or 'detailed'"],
  [
    "seamless",
    /\bseamless(?:ly)?\b/gi,
    "describe what actually happens without friction",
  ],
  [
    "game-changer",
    /\bgame-chang(?:er|ing)\b/gi,
    "state the specific measurable change",
  ],
  ["utilize", /\butiliz(?:e|es|ed|ing)\b/gi, "use 'use'"],
  ["watershed moment", /\bwatershed moment\b/gi, "state what changed"],
  ["nestled", /\bnestled\b/gi, "use 'sits' or 'lives in'"],
  ["vibrant", /\bvibrant\b/gi, "describe what makes it active or cut"],
  ["thriving", /\bthriving\b/gi, "cite a number or cut"],
  ["showcasing", /\bshowcas(?:e|es|ed|ing)\b/gi, "use 'showing' or cut"],
  ["deep dive", /\bdeep dives?\b/gi, "name what the section actually inspects"],
  ["unpack", /\bunpack(?:s|ed|ing)?\b/gi, "use 'explain' or 'walk through'"],
  ["bustling", /\bbustling\b/gi, "cite a number or cut"],
  ["intricate", /\bintricat(?:e|ely)|intricacies\b/gi, "name the specific complexity"],
  ["ever-evolving", /\bever-evolving\b/gi, "say what changed and when"],
  ["daunting", /\bdaunting\b/gi, "use 'hard' or name the difficulty"],
  ["holistic", /\bholistic(?:ally)?\b/gi, "list what is included"],
  ["actionable", /\bactionable\b/gi, "use 'concrete' or 'usable'"],
  ["impactful", /\bimpactful\b/gi, "describe the actual effect"],
  ["learnings", /\blearnings\b/gi, "use 'lessons' or 'findings'"],
  ["thought leader", /\bthought leader(?:ship)?\b/gi, "name their actual work"],
  ["at its core", /\bat its core\b/gi, "cut and state the point directly"],
  ["synergy", /\bsynerg(?:y|ies)\b/gi, "describe the combined effect"],
  ["interplay", /\binterplay\b/gi, "use 'interaction' or 'relationship'"],
  ["in order to", /\bin order to\b/gi, "replace with 'to'"],
  ["due to the fact that", /\bdue to the fact that\b/gi, "replace with 'because'"],
  ["serves as", /\bserves as\b/gi, "use 'is'"],
  ["boasts", /\bboasts?\b/gi, "use 'has'"],
  ["commence", /\bcommenc(?:e|es|ed|ing)\b/gi, "use 'start'"],
  ["ascertain", /\bascertain(?:s|ed|ing)?\b/gi, "use 'find out' or 'check'"],
  ["endeavor", /\bendeavors?\b/gi, "use 'effort' or 'try'"],
  ["supercharge", /\bsupercharg(?:e|es|ed|ing)\b/gi, "state the actual gain"],
  ["unlock", /\bunlock(?:s|ed|ing)?\b/gi, "state what becomes possible"],
];

const TIER2_WORDS = [
  "navigate",
  "navigating",
  "foster",
  "fostering",
  "elevate",
  "elevating",
  "unleash",
  "unleashing",
  "empower",
  "empowering",
  "bolster",
  "bolstering",
  "spearhead",
  "spearheading",
  "resonate",
  "resonates",
  "revolutionize",
  "revolutionizing",
  "facilitate",
  "facilitates",
  "underpin",
  "underpins",
  "nuanced",
  "crucial",
  "multifaceted",
  "myriad",
  "plethora",
  "encompass",
  "encompasses",
  "catalyze",
  "reimagine",
  "galvanize",
  "augment",
  "cultivate",
  "illuminate",
  "elucidate",
  "juxtapose",
  "transformative",
  "cornerstone",
  "paramount",
  "poised",
  "burgeoning",
  "nascent",
  "quintessential",
  "overarching",
  "quietly",
  "robust",
  "comprehensive",
  "streamline",
  "leverage",
  "leveraging",
  "ecosystem",
  "paradigm",
];

const TIER2_RE = new RegExp(`\\b(?:${TIER2_WORDS.join("|")})\\b`, "gi");

const TITLE_CASE_SMALL = new Set([
  "a",
  "an",
  "the",
  "and",
  "but",
  "or",
  "for",
  "nor",
  "in",
  "on",
  "at",
  "to",
  "of",
  "by",
  "as",
  "with",
  "from",
  "into",
  "vs",
  "per",
]);

const FINITE_CLAUSE_VERB_RE =
  /\b(?:is|are|was|were|has|have|had|does|do|did|can|cannot|can't|will|won't|isn't|aren't|doesn't|don't|needs|moves|changes|matters|makes)\b/i;

const SEVERITY_ORDER = { P0: 0, P1: 1, P2: 2 };

export const SLOP_RULES = [
  "chatbot-leak",
  "ai-url-param",
  "placeholder-leak",
  "cutoff-disclaimer",
  "chatbot-artifact",
  "em-dash",
  "semicolon",
  "table-semicolon",
  "en-dash-clause",
  "curly-quotes",
  "emoji-in-heading",
  "exclamation-overuse",
  "bold-list-period",
  "bold-list-streak",
  "negative-parallelism",
  "infomercial-hook",
  "filler-opener",
  "hedge-stack",
  "hollow-intensifier",
  "vague-attribution",
  "generic-closer",
  "word-tier1",
  "tier2-cluster",
  "transition-crutch",
  "minimizer",
  "title-case-heading",
  "long-paragraph",
  "uniform-paragraphs",
  "uniform-sentences",
  "low-ttr",
];

function splitFrontmatter(markdown) {
  const match = String(markdown).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return {
      frontmatterRaw: "",
      frontmatterLines: 0,
      body: String(markdown),
      data: {},
    };
  }
  const frontmatterRaw = match[0];
  const frontmatterLines = frontmatterRaw.split(/\r?\n/).length - 1;
  let data = {};
  try {
    data = matter(markdown).data || {};
  } catch {
    data = {};
  }
  return {
    frontmatterRaw,
    frontmatterLines,
    body: String(markdown).slice(frontmatterRaw.length),
    data,
  };
}

function maskSpan(text) {
  return text.replace(/[^\r\n]/g, " ");
}

function maskBodyForProse(body) {
  const lines = body.split("\n");
  let inFence = false;
  let fenceChar = "";
  let fenceLen = 0;

  const processed = lines.map((line) => {
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0];
        fenceLen = marker.length;
        return maskSpan(line);
      }
      if (
        marker[0] === fenceChar &&
        marker.length >= fenceLen &&
        trimmed.replace(new RegExp(`^${fenceChar}+`), "").trim() === ""
      ) {
        inFence = false;
        return maskSpan(line);
      }
    }
    if (inFence) return maskSpan(line);
    if (/^\s*>/.test(line)) return maskSpan(line);

    let out = line;
    out = out.replace(/<!--[\s\S]*?-->/g, maskSpan);
    out = out.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, maskSpan);
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      return `[${label}](${maskSpan(url)})`;
    });
    out = out.replace(/`+[^`]*`+/g, maskSpan);
    out = out.replace(/https?:\/\/[^\s)>"']+/gi, maskSpan);
    out = out.replace(/<[^>]+>/g, maskSpan);
    return out;
  });

  return processed.join("\n");
}

function lineNumberAt(text, offset, baseLine) {
  let line = baseLine;
  for (let i = 0; i < offset; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function snippetFor(text, index, length) {
  const start = Math.max(0, text.lastIndexOf("\n", index - 1) + 1);
  const endIdx = text.indexOf("\n", index + length);
  const end = endIdx === -1 ? text.length : endIdx;
  const line = text.slice(start, end).trim();
  if (line.length <= 120) return line;
  const rel = Math.max(0, index - start);
  const winStart = Math.max(0, rel - 40);
  const winEnd = Math.min(line.length, rel + length + 50);
  return `${winStart > 0 ? "..." : ""}${line.slice(winStart, winEnd).trim()}${winEnd < line.length ? "..." : ""}`;
}

function collectMatches(text, regex, baseLine, makeIssue) {
  const issues = [];
  const re = new RegExp(regex.source, regex.flags);
  for (const match of text.matchAll(re)) {
    const idx = match.index ?? 0;
    const issue = makeIssue(match, lineNumberAt(text, idx, baseLine));
    if (issue) issues.push(issue);
  }
  return issues;
}

function isTableRow(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function isTableSeparator(line) {
  return /^\s*\|[\s:|-]+\|\s*$/.test(line);
}

function checkFrontmatter(frontmatterRaw, data) {
  const issues = [];
  if (!frontmatterRaw) return issues;
  const lines = frontmatterRaw.split("\n");
  for (const field of ["title", "description"]) {
    const value = typeof data[field] === "string" ? data[field] : "";
    if (!value) continue;
    const lineIdx = lines.findIndex((l) => l.startsWith(`${field}:`));
    const lineNum = lineIdx === -1 ? 1 : lineIdx + 1;
    if (value.includes("—") || /\s--\s/.test(value)) {
      issues.push({
        rule: "em-dash",
        severity: "P1",
        line: lineNum,
        match: "—",
        snippet: `${field}: ${value}`,
        suggestion: `Replace em dash in frontmatter ${field} with a colon, comma, or period`,
      });
    }
    if (value.includes(";")) {
      issues.push({
        rule: "semicolon",
        severity: "P1",
        line: lineNum,
        match: ";",
        snippet: `${field}: ${value}`,
        suggestion: `Replace semicolon in frontmatter ${field} with a period, comma, or colon`,
      });
    }
    if (/[“”‘’]/.test(value)) {
      issues.push({
        rule: "curly-quotes",
        severity: "P2",
        line: lineNum,
        match: value.match(/[“”‘’]/)[0],
        snippet: `${field}: ${value}`,
        suggestion: "Normalize curly quotes to straight quotes",
      });
    }
    for (const match of value.matchAll(PLACEHOLDER_RE)) {
      issues.push({
        rule: "placeholder-leak",
        severity: "P0",
        line: lineNum,
        match: match[0],
        snippet: `${field}: ${value}`,
        suggestion: "Replace unresolved placeholder before publishing",
      });
    }
  }
  return issues;
}

function checkRawBodyLeaks(body, baseLine) {
  const issues = [];
  const lines = body.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const lineNum = baseLine + i;
    for (const match of line.matchAll(AI_URL_PARAM_RE)) {
      issues.push({
        rule: "ai-url-param",
        severity: "P0",
        line: lineNum,
        match: match[0].replace(/^[?&]|&$/g, ""),
        snippet: line.trim(),
        suggestion: "Strip AI tracking parameter from URL",
      });
    }
    for (const match of line.matchAll(CHATBOT_LEAK_RE)) {
      issues.push({
        rule: "chatbot-leak",
        severity: "P0",
        line: lineNum,
        match: match[0],
        snippet: line.trim(),
        suggestion: "Remove leaked chat citation token",
      });
    }
  }
  return issues;
}

function checkPunctuationAndLines(maskedBody, rawBody, baseLine) {
  const issues = [];
  const maskedLines = maskedBody.split("\n");
  const rawLines = rawBody.split("\n");
  let boldBulletStreak = 0;
  let streakStartLine = baseLine;
  let exclamationCount = 0;
  let firstExclamationLine = baseLine;

  for (let i = 0; i < maskedLines.length; i += 1) {
    const line = maskedLines[i];
    const rawLine = rawLines[i] || "";
    const lineNum = baseLine + i;
    const trimmed = line.trim();

    const boldPeriodMatch = rawLine.match(/^\s*[-*]\s+\*\*([^*]+)\.\*\*\s+\S/);
    if (boldPeriodMatch && trimmed) {
      const labelWords = boldPeriodMatch[1].trim().split(/\s+/).filter(Boolean);
      if (labelWords.length <= 7) {
        issues.push({
          rule: "bold-list-period",
          severity: "P1",
          line: lineNum,
          match: `**${boldPeriodMatch[1]}.**`,
          snippet: rawLine.trim(),
          suggestion:
            "Drop bold lead-in or use a plain colon label (e.g. '- Label: ...')",
        });
      }
    }

    if (/^\s*[-*]\s+\*\*[^*]+\*\*/.test(rawLine) && trimmed) {
      if (boldBulletStreak === 0) streakStartLine = lineNum;
      boldBulletStreak += 1;
    } else if (trimmed !== "") {
      if (boldBulletStreak >= 3) {
        issues.push({
          rule: "bold-list-streak",
          severity: "P1",
          line: streakStartLine,
          match: `${boldBulletStreak} bold-led bullets`,
          snippet: rawLines[streakStartLine - baseLine]?.trim() || "",
          suggestion:
            "Convert bold-led bullet block to prose or plain unbolded bullets",
        });
      }
      boldBulletStreak = 0;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      if (EMOJI_RE.test(headingText)) {
        issues.push({
          rule: "emoji-in-heading",
          severity: "P1",
          line: lineNum,
          match: headingText.match(EMOJI_RE)[0],
          snippet: rawLine.trim(),
          suggestion: "Remove emoji from headings",
        });
      }
      if (headingText.includes("!")) {
        issues.push({
          rule: "exclamation-overuse",
          severity: "P2",
          line: lineNum,
          match: "!",
          snippet: rawLine.trim(),
          suggestion: "Avoid exclamation marks in headings",
        });
      }
      if (level >= 2) {
        const cleanedHeading = headingText.replace(/:\s+[A-Z]/g, " ");
        const tokens = cleanedHeading
          .replace(/[^A-Za-z0-9'\s-]/g, " ")
          .split(/\s+/)
          .filter(Boolean);
        if (tokens.length >= 4) {
          const rest = tokens.slice(1);
          const cappedSmall = rest.some(
            (w) => TITLE_CASE_SMALL.has(w.toLowerCase()) && /^[A-Z][a-z]+$/.test(w),
          );
          const candidates = rest.filter(
            (w) =>
              !TITLE_CASE_SMALL.has(w.toLowerCase()) &&
              !/^[A-Z0-9]{2,}$/.test(w) &&
              !/\d/.test(w),
          );
          const capCount = candidates.filter((w) => /^[A-Z][a-z]+$/.test(w)).length;
          if (
            cappedSmall ||
            (candidates.length >= 4 && capCount / candidates.length >= 0.85)
          ) {
            issues.push({
              rule: "title-case-heading",
              severity: "P2",
              line: lineNum,
              match: headingText,
              snippet: rawLine.trim(),
              suggestion: "Use sentence case for subheadings",
            });
          }
        }
      }
    }

    const tableRow = isTableRow(rawLine);
    if (tableRow && isTableSeparator(rawLine)) continue;

    let emCheckLine = line;
    if (tableRow) {
      emCheckLine = emCheckLine.replace(/\|\s*—\s*(?=\|)/g, "|   ");
    }
    for (const match of emCheckLine.matchAll(/—|\s--\s/g)) {
      issues.push({
        rule: "em-dash",
        severity: "P1",
        line: lineNum,
        match: match[0].trim(),
        snippet: rawLine.trim(),
        suggestion: "Replace em dash with a comma, period, colon, or parentheses",
      });
    }

    for (const match of line.matchAll(/\s–\s/g)) {
      issues.push({
        rule: "en-dash-clause",
        severity: "P2",
        line: lineNum,
        match: "–",
        snippet: rawLine.trim(),
        suggestion: "Replace spaced en dash with a comma, period, or colon",
      });
    }

    const noEntities = line
      .replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, maskSpan)
      .replace(/\bTL;DR\b/gi, maskSpan);
    for (const match of noEntities.matchAll(/;/g)) {
      issues.push({
        rule: tableRow ? "table-semicolon" : "semicolon",
        severity: tableRow ? "P2" : "P1",
        line: lineNum,
        match: ";",
        snippet: rawLine.trim(),
        suggestion: tableRow
          ? "Prefer periods, commas, or separate lines over semicolons inside table cells"
          : "Split into two sentences or replace semicolon with a comma or colon",
      });
    }

    if (/[“”‘’]/.test(line)) {
      issues.push({
        rule: "curly-quotes",
        severity: "P2",
        line: lineNum,
        match: line.match(/[“”‘’]/)[0],
        snippet: rawLine.trim(),
        suggestion: "Normalize curly quotes to straight ASCII quotes",
      });
    }

    if (!headingMatch) {
      const bangs = line.match(/!/g);
      if (bangs) {
        if (exclamationCount === 0) firstExclamationLine = lineNum;
        exclamationCount += bangs.length;
      }
    }
  }

  if (boldBulletStreak >= 3) {
    issues.push({
      rule: "bold-list-streak",
      severity: "P1",
      line: streakStartLine,
      match: `${boldBulletStreak} bold-led bullets`,
      snippet: rawLines[streakStartLine - baseLine]?.trim() || "",
      suggestion: "Convert bold-led bullet block to prose or plain unbolded bullets",
    });
  }

  if (exclamationCount > 2) {
    issues.push({
      rule: "exclamation-overuse",
      severity: "P2",
      line: firstExclamationLine,
      match: `${exclamationCount} exclamation marks`,
      snippet: rawLines[firstExclamationLine - baseLine]?.trim() || "",
      suggestion: "Cut exclamation marks in technical prose",
    });
  }

  return issues;
}

function extractProseSegments(maskedBody, rawBody, baseLine) {
  const maskedLines = maskedBody.split("\n");
  const rawLines = rawBody.split("\n");
  const segments = [];
  const listAndTableItems = [];
  let current = [];
  let rawCurrent = [];
  let startLine = baseLine;

  const flush = () => {
    if (!current.length) return;
    const text = current.join(" ").replace(/\s+/g, " ").trim();
    const raw = rawCurrent.join(" ").replace(/\s+/g, " ").trim();
    if (text) segments.push({ type: "paragraph", text, raw, line: startLine });
    current = [];
    rawCurrent = [];
  };

  for (let i = 0; i < maskedLines.length; i += 1) {
    const line = maskedLines[i];
    const rawLine = rawLines[i] || "";
    const trimmed = line.trim();
    const rawTrimmed = rawLine.trim();

    if (!trimmed) {
      flush();
      if (/^!\[/.test(rawTrimmed) || /^<figure\b/i.test(rawTrimmed)) {
        segments.push({ type: "break" });
      }
      continue;
    }

    const isHeading = /^#{1,6}\s/.test(trimmed);
    const isList = /^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed);
    const isTable = /^\|/.test(rawTrimmed);
    const isRule = /^---+$/.test(trimmed);

    if (isHeading || isList || isTable || isRule) {
      flush();
      segments.push({ type: "break" });
      if ((isList || (isTable && !isTableSeparator(rawLine))) && trimmed) {
        listAndTableItems.push({ text: trimmed, raw: rawTrimmed, line: baseLine + i });
      }
      continue;
    }

    if (!current.length) startLine = baseLine + i;
    current.push(trimmed);
    rawCurrent.push(rawTrimmed);
  }
  flush();
  return { segments, listAndTableItems };
}

function checkStylometry(maskedBody, rawBody, baseLine) {
  const issues = [];
  const { segments, listAndTableItems } = extractProseSegments(
    maskedBody,
    rawBody,
    baseLine,
  );
  const allWords = [];
  const proseParagraphRuns = [[]];
  const sentenceRuns = [[]];

  const collectWords = (text) => {
    const clean = text.replace(/[*_~[\]()|]/g, " ");
    const words = clean.match(/[A-Za-z0-9'-]+/g) || [];
    for (const w of words) {
      const lower = w.toLowerCase();
      if (/^[a-z]{2,}$/.test(lower)) allWords.push(lower);
    }
    return { clean, words };
  };

  for (const item of listAndTableItems) {
    const { clean } = collectWords(item.text);
    const tier2Matches = [
      ...new Set((clean.match(TIER2_RE) || []).map((w) => w.toLowerCase())),
    ];
    if (tier2Matches.length >= 2) {
      issues.push({
        rule: "tier2-cluster",
        severity: "P1",
        line: item.line,
        match: tier2Matches.join(", "),
        snippet: item.raw.slice(0, 120),
        suggestion:
          "Multiple AI-favored buzzwords in one item; replace with plain concrete verbs",
      });
    }
  }

  let paragraphCount = 0;

  for (const seg of segments) {
    if (seg.type === "break") {
      if (proseParagraphRuns.at(-1).length) proseParagraphRuns.push([]);
      if (sentenceRuns.at(-1).length) sentenceRuns.push([]);
      continue;
    }

    paragraphCount += 1;
    const { clean, words } = collectWords(seg.text);

    const tier2Matches = [
      ...new Set((clean.match(TIER2_RE) || []).map((w) => w.toLowerCase())),
    ];
    if (tier2Matches.length >= 2) {
      issues.push({
        rule: "tier2-cluster",
        severity: "P1",
        line: seg.line,
        match: tier2Matches.join(", "),
        snippet: seg.raw.slice(0, 120),
        suggestion:
          "Multiple AI-favored buzzwords in one paragraph; replace with plain concrete verbs",
      });
    }

    const sentences = clean
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => (s.match(/[A-Za-z]+/g) || []).length >= 3);

    for (const sentence of sentences) {
      sentenceRuns.at(-1).push({
        words: (sentence.match(/[A-Za-z0-9'-]+/g) || []).length,
        line: seg.line,
        text: sentence,
      });
    }

    proseParagraphRuns.at(-1).push({
      line: seg.line,
      words: words.length,
      raw: seg.raw,
    });

    if (words.length > 130) {
      issues.push({
        rule: "long-paragraph",
        severity: "P2",
        line: seg.line,
        match: `${words.length} words / ${sentences.length} sentences`,
        snippet: seg.raw.slice(0, 120),
        suggestion: "Split long paragraph to keep one idea per paragraph",
      });
    }
  }

  for (const run of proseParagraphRuns) {
    for (let i = 0; i <= run.length - 4; i += 1) {
      const window = run.slice(i, i + 4);
      const min = Math.min(...window.map((w) => w.words));
      const max = Math.max(...window.map((w) => w.words));
      if (min >= 25 && max - min <= 12) {
        issues.push({
          rule: "uniform-paragraphs",
          severity: "P2",
          line: window[0].line,
          match: window.map((w) => `${w.words}w`).join(", "),
          snippet: window[0].raw.slice(0, 120),
          suggestion:
            "Vary paragraph lengths; mix short 1-2 sentence paragraphs with longer ones",
        });
        i += 3;
      }
    }
  }

  for (const run of sentenceRuns) {
    let runStart = -1;
    let runLen = 0;
    for (let i = 0; i < run.length; i += 1) {
      const count = run[i].words;
      if (count >= 14 && count <= 24) {
        if (runLen === 0) runStart = i;
        runLen += 1;
      } else {
        if (runLen >= 5) {
          issues.push({
            rule: "uniform-sentences",
            severity: "P2",
            line: run[runStart].line,
            match: `${runLen} consecutive 14-24 word sentences`,
            snippet: run[runStart].text.slice(0, 120),
            suggestion: "Mix short punchy sentences (<10 words) with longer ones",
          });
        }
        runLen = 0;
      }
    }
    if (runLen >= 5) {
      issues.push({
        rule: "uniform-sentences",
        severity: "P2",
        line: run[runStart].line,
        match: `${runLen} consecutive 14-24 word sentences`,
        snippet: run[runStart].text.slice(0, 120),
        suggestion: "Mix short punchy sentences (<10 words) with longer ones",
      });
    }
  }

  const wordCount = allWords.length;
  const uniqueWords = new Set(allWords).size;
  const ttr = wordCount > 0 ? uniqueWords / wordCount : 1;
  if (wordCount >= 250 && ttr < 0.36) {
    issues.push({
      rule: "low-ttr",
      severity: "P2",
      line: baseLine,
      match: `TTR ${ttr.toFixed(2)} (${uniqueWords}/${wordCount})`,
      snippet: "Document vocabulary diversity is unusually flat",
      suggestion:
        "Replace repeated abstractions with concrete names, cases, or numbers",
    });
  }

  return {
    issues,
    stats: {
      wordCount,
      uniqueWords,
      ttr: Number(ttr.toFixed(3)),
      paragraphs: paragraphCount,
    },
  };
}

export function analyzeMarkdown(markdown, options = {}) {
  const { minSeverity = "P2" } = options;
  const { frontmatterRaw, frontmatterLines, body, data } = splitFrontmatter(markdown);
  const baseLine = frontmatterLines + 1;
  const maskedBody = maskBodyForProse(body);

  const issues = [
    ...checkFrontmatter(frontmatterRaw, data),
    ...checkRawBodyLeaks(body, baseLine),
    ...checkPunctuationAndLines(maskedBody, body, baseLine),
  ];

  const regexSpecs = [
    [
      "placeholder-leak",
      "P0",
      PLACEHOLDER_RE,
      "Fill in or delete unresolved placeholder",
    ],
    [
      "cutoff-disclaimer",
      "P0",
      CUTOFF_RE,
      "Verify the fact or cut the model-limitation disclaimer",
    ],
    [
      "chatbot-artifact",
      "P0",
      CHATBOT_ARTIFACT_RE,
      "Cut conversational chat scaffolding",
    ],
    [
      "negative-parallelism",
      "P1",
      NEGATIVE_PARALLELISM_RE,
      "State the claim directly without 'not X, it is Y'",
    ],
    [
      "infomercial-hook",
      "P1",
      INFOMERCIAL_HOOK_RE,
      "Delete the teaser hook and state the fact",
    ],
    [
      "filler-opener",
      "P1",
      FILLER_OPENER_RE,
      "Cut throat-clearing opener and lead with the point",
    ],
    ["hedge-stack", "P1", HEDGE_STACK_RE, "Pick one hedge or state the claim directly"],
    [
      "hollow-intensifier",
      "P1",
      HOLLOW_INTENSIFIER_RE,
      "Cut empty intensifier and state the fact",
    ],
    [
      "vague-attribution",
      "P1",
      VAGUE_ATTRIBUTION_RE,
      "Cite a named source or drop the attribution",
    ],
    [
      "generic-closer",
      "P1",
      GENERIC_CLOSER_RE,
      "Replace generic closer with a concrete takeaway or question",
    ],
    [
      "transition-crutch",
      "P2",
      TRANSITION_CRUTCH_RE,
      "Cut formal transition crutch or connect ideas directly",
    ],
    ["minimizer", "P2", MINIMIZER_RE, "Cut minimizer ('simply', 'easily')"],
  ];

  for (const [rule, severity, regex, suggestion] of regexSpecs) {
    issues.push(
      ...collectMatches(maskedBody, regex, baseLine, (match, line) => ({
        rule,
        severity,
        line,
        match: match[0].trim(),
        snippet: snippetFor(body, match.index ?? 0, match[0].length),
        suggestion,
      })),
    );
  }

  for (const [, regex, suggestion] of TIER1_WORDS) {
    issues.push(
      ...collectMatches(maskedBody, regex, baseLine, (match, line) => ({
        rule: "word-tier1",
        severity: "P1",
        line,
        match: match[0],
        snippet: snippetFor(body, match.index ?? 0, match[0].length),
        suggestion,
      })),
    );
  }

  const stylometry = checkStylometry(maskedBody, body, baseLine);
  issues.push(...stylometry.issues);

  const threshold = SEVERITY_ORDER[minSeverity.toUpperCase()] ?? 2;
  const filtered = issues
    .filter((item) => (SEVERITY_ORDER[item.severity] ?? 2) <= threshold)
    .sort(
      (a, b) =>
        a.line - b.line || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );

  const counts = { P0: 0, P1: 0, P2: 0 };
  for (const item of filtered) counts[item.severity] = (counts[item.severity] || 0) + 1;

  return {
    issues: filtered,
    counts,
    stats: stylometry.stats,
  };
}

function matchCase(source, replacement) {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (/^[A-Z]/.test(source)) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function cleanProseSegment(segment, { fixPunctuation, isTable = false }) {
  let out = segment;
  out = out.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  out = out.replace(CHATBOT_LEAK_RE, "");
  out = out.replace(/\bin order to\b/gi, (m) => matchCase(m, "to"));
  out = out.replace(/\bdue to the fact that\b/gi, (m) => matchCase(m, "because"));
  out = out.replace(/\butiliz(e|es|ed|ing)\b/gi, (m, suffix) => {
    const map = { e: "use", es: "uses", ed: "used", ing: "using" };
    return matchCase(m, map[suffix.toLowerCase()]);
  });

  if (fixPunctuation) {
    out = out.replace(/\s+(?:—|--)\s+/g, ", ");
    out = out.replace(/([A-Za-z0-9)\]])—([A-Za-z0-9(\[])/g, "$1, $2");
    if (!isTable) {
      out = out.replace(
        /(?!&(?:#\d+|#x[\da-f]+|[a-z]+););(\s+)([a-z])/g,
        (_, space, nextChar) => `.${space}${nextChar.toUpperCase()}`,
      );
      out = out.replace(/(?!&(?:#\d+|#x[\da-f]+|[a-z]+););(\s+)/g, ".$1");
    }
  }
  return out;
}

function stripAiParamsFromUrl(url) {
  try {
    const parsed = new URL(url);
    const utm = parsed.searchParams.get("utm_source");
    if (
      utm &&
      /^(?:chatgpt\.com|openai|claude\.ai|perplexity\.ai|copilot\.com)$/i.test(utm)
    ) {
      parsed.searchParams.delete("utm_source");
    }
    const ref = parsed.searchParams.get("referrer");
    if (ref && /^grok\.com$/i.test(ref)) {
      parsed.searchParams.delete("referrer");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function restoreHeld(text, held) {
  let next = text;
  let guard = 0;
  while (next.includes("\u0000HOLD") && guard < 10) {
    next = next.replace(/\u0000HOLD(\d+)\u0000/g, (_, idx) => held[Number(idx)]);
    guard += 1;
  }
  return next;
}

function cleanLine(line, options) {
  const { fixPunctuation } = options;
  if (/^\s*>/.test(line)) return line;
  const tableRow = isTableRow(line);
  if (tableRow && isTableSeparator(line)) return line;

  const held = [];
  const hold = (value) => {
    held.push(value);
    return `\u0000HOLD${held.length - 1}\u0000`;
  };

  let next = line;
  next = next.replace(/<!--[\s\S]*?-->/g, hold);
  next = next.replace(/`+[^`]*`+/g, hold);
  next = next.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_, alt, url) =>
    hold(`![${alt}](${stripAiParamsFromUrl(url)})`),
  );
  next = next.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const cleanedLabel = cleanProseSegment(label, {
      fixPunctuation,
      isTable: tableRow,
    });
    return hold(`[${cleanedLabel}](${stripAiParamsFromUrl(url)})`);
  });
  next = next.replace(/https?:\/\/[^\s)>"']+/gi, (url) =>
    hold(stripAiParamsFromUrl(url)),
  );
  next = next.replace(/<[^>]+>/g, hold);

  if (tableRow) {
    next = next.replace(/(\|\s*)—(\s*)(?=\|)/g, (_, a, b) => hold(`${a}—${b}`));
  }
  next = next.replace(/\bTL;DR\b/gi, hold);

  next = next.replace(
    /^(\s*[-*]\s+\*\*)([^*]+)\.\*\*(\s+)/,
    (whole, prefix, label, space) => {
      const words = label.trim().split(/\s+/).filter(Boolean);
      if (words.length <= 7 && !FINITE_CLAUSE_VERB_RE.test(label)) {
        return `${prefix}${label}:**${space}`;
      }
      return whole;
    },
  );

  next = cleanProseSegment(next, { fixPunctuation, isTable: tableRow });
  return restoreHeld(next, held);
}

export function cleanMarkdown(markdown, options = {}) {
  const { fixPunctuation = false } = options;
  const { frontmatterRaw, frontmatterLines, body } = splitFrontmatter(markdown);

  let cleanedFrontmatter = frontmatterRaw;
  const changes = [];

  if (frontmatterRaw) {
    const fmLines = frontmatterRaw.split("\n");
    const nextFmLines = fmLines.map((line, index) => {
      const fmMatch = line.match(/^((?:title|description):\s*)(.*)$/);
      if (!fmMatch) return line;
      const [, prefix, rawVal] = fmMatch;
      const singleQuoted = rawVal.startsWith("'") && rawVal.endsWith("'");
      const doubleQuoted = rawVal.startsWith('"') && rawVal.endsWith('"');
      let inner = singleQuoted || doubleQuoted ? rawVal.slice(1, -1) : rawVal;
      inner = inner.replace(/[“”]/g, doubleQuoted ? '\\"' : '"');
      inner = inner.replace(/[‘’]/g, singleQuoted ? "''" : "'");
      if (fixPunctuation) {
        inner = inner.replace(/\s+(?:—|--)\s+/g, ": ").replace(/;/g, ".");
      }
      const next = singleQuoted
        ? `${prefix}'${inner}'`
        : doubleQuoted
          ? `${prefix}"${inner}"`
          : `${prefix}${inner}`;
      if (next !== line) {
        changes.push({ line: index + 1, before: line, after: next });
      }
      return next;
    });
    cleanedFrontmatter = nextFmLines.join("\n");
  }

  const lines = body.split("\n");
  let inFence = false;
  let fenceChar = "";
  let fenceLen = 0;
  const baseLine = frontmatterLines + 1;

  const nextLines = lines.map((line, idx) => {
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0];
        fenceLen = marker.length;
        return line;
      }
      if (
        marker[0] === fenceChar &&
        marker.length >= fenceLen &&
        trimmed.replace(new RegExp(`^${fenceChar}+`), "").trim() === ""
      ) {
        inFence = false;
        return line;
      }
    }
    if (inFence) return line;
    const cleaned = cleanLine(line, { fixPunctuation });
    if (cleaned !== line) {
      changes.push({ line: baseLine + idx, before: line, after: cleaned });
    }
    return cleaned;
  });

  return {
    content: cleanedFrontmatter + nextLines.join("\n"),
    changes,
  };
}

export function formatReport(fileReports) {
  const lines = [];
  let totalP0 = 0;
  let totalP1 = 0;
  let totalP2 = 0;

  for (const report of fileReports) {
    totalP0 += report.counts.P0;
    totalP1 += report.counts.P1;
    totalP2 += report.counts.P2;
    const summary = `P0:${report.counts.P0} P1:${report.counts.P1} P2:${report.counts.P2}`;
    lines.push(
      `${report.file} (${summary}, ${report.stats.wordCount} words, TTR ${report.stats.ttr})`,
    );
    if (!report.issues.length) {
      lines.push("  clean");
      continue;
    }
    for (const issue of report.issues) {
      lines.push(
        `  ${issue.severity} L${issue.line} [${issue.rule}] "${issue.match}" -> ${issue.suggestion}`,
      );
      if (issue.snippet) lines.push(`     ${issue.snippet}`);
    }
  }

  lines.push(
    `total: ${fileReports.length} file(s), P0:${totalP0} P1:${totalP1} P2:${totalP2}`,
  );
  return lines.join("\n");
}
