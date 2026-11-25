import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSvg, formatSvgReport } from "../lib/svg.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = { all: false, json: false, warnOnly: false, files: [] };
  for (const arg of argv) {
    if (arg === "--all") options.all = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--warn-only") options.warnOnly = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/check-svg.mjs [--all] [--json] [--warn-only] <file...>",
      );
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      options.files.push(arg);
    } else {
      console.error(`unknown option: ${arg}`);
      process.exit(2);
    }
  }
  return options;
}

async function walkSvgs(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkSvgs(full, out);
    else if (entry.name.endsWith(".svg")) out.push(full);
  }
  return out.sort();
}

const options = parseArgs(process.argv.slice(2));
const targets = options.all
  ? await walkSvgs(path.join(root, "site/public/media"))
  : options.files.map((file) => path.resolve(process.cwd(), file));

if (!targets.length) {
  console.log("no svg files matched");
  process.exit(0);
}

const reports = [];
let failing = 0;
for (const file of targets) {
  const raw = await readFile(file, "utf8");
  const result = analyzeSvg(raw);
  failing += result.counts.P0 + result.counts.P1;
  reports.push({ file: path.relative(root, file) || file, ...result });
}

if (options.json) {
  console.log(JSON.stringify(reports, null, 2));
} else {
  console.log(formatSvgReport(reports));
}

if (failing > 0 && !options.warnOnly) process.exit(1);
