export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

export function asIso(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

export function formatUtcDate(value) {
  const iso = asIso(value);
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function datesDiffer(published, updated) {
  const a = asIso(published);
  const b = asIso(updated);
  if (!a || !b) return false;
  return Math.abs(Date.parse(a) - Date.parse(b)) > 60_000;
}

export function collapseSpace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

export function plainText(markdown) {
  return String(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function outsideFences(markdown, visit) {
  const parts = String(markdown).split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => (index % 2 === 1 ? part : visit(part))).join("");
}
