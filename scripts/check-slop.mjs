import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeMarkdown, cleanMarkdown, formatReport } from "../lib/slop.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = {
    all: false,
    fix: false,
    fixPunctuation: false,
    dryRun: false,
    json: false,
    warnOnly: false,
    severity: "P2",
    files: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") options.all = true;
    else if (arg === "--fix") options.fix = true;
    else if (arg === "--fix-punctuation") {
      options.fix = true;
      options.fixPunctuation = true;
    } else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--warn-only") options.warnOnly = true;
    else if (arg === "--severity") {
      options.severity = (argv[i + 1] || "P2").toUpperCase();
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      options.files.push(arg);
    } else {
      console.error(`unknown option: ${arg}`);
      printUsage();
      process.exit(2);
    }
  }
  return options;
}

function printUsage() {
  console.log(
    [
      "Usage: node scripts/check-slop.mjs [options] <file...>",
      "",
      "Options:",
      "  --all               Scan all posts in site/posts/",
      "  --fix               Apply safe mechanical cleanups in place",
      "  --fix-punctuation   Also rewrite prose em dashes and semicolons",
      "  --dry-run           Preview --fix changes without writing files",
      "  --severity p0|p1|p2 Minimum severity to report (default: p2)",
      "  --json              Output JSON report",
      "  --warn-only         Always exit 0 even when P0/P1 issues are found",
    ].join("\n"),
  );
}

async function resolveTargets(options) {
  if (options.all) {
    const dir = path.join(root, "site/posts");
    const entries = await readdir(dir);
    return entries
      .filter((name) => name.endsWith(".md"))
      .sort()
      .map((name) => path.join(dir, name));
  }
  return options.files.map((file) => path.resolve(process.cwd(), file));
}

const options = parseArgs(process.argv.slice(2));
const targets = await resolveTargets(options);

if (!targets.length) {
  printUsage();
  process.exit(2);
}

const reports = [];
let failingIssues = 0;

for (const file of targets) {
  let content = await readFile(file, "utf8");
  const rel = path.relative(root, file) || file;
  let changes = [];

  if (options.fix) {
    const cleaned = cleanMarkdown(content, {
      fixPunctuation: options.fixPunctuation,
    });
    changes = cleaned.changes;
    if (changes.length && !options.dryRun) {
      await writeFile(file, cleaned.content, "utf8");
    }
    content = cleaned.content;
    if (!options.json && changes.length) {
      const mode = options.dryRun ? "would fix" : "fixed";
      console.log(`${mode} ${changes.length} line(s) in ${rel}:`);
      for (const change of changes) {
        console.log(`  L${change.line}:`);
        console.log(`    - ${change.before}`);
        console.log(`    + ${change.after}`);
      }
    }
  }

  const result = analyzeMarkdown(content, { minSeverity: options.severity });
  failingIssues += result.counts.P0 + result.counts.P1;
  reports.push({ file: rel, changes, ...result });
}

if (options.json) {
  console.log(JSON.stringify(reports, null, 2));
} else {
  console.log(formatReport(reports));
}

if (failingIssues > 0 && !options.warnOnly) {
  process.exit(1);
}
