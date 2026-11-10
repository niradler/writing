import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { resolveSiteTarget } from "../lib/site.mjs";
import { chromium } from "playwright-core";

// Lab only. Applied Chrome network throttling, not Lighthouse simulated
// scoring and not field INP. Slow 4G here is 150ms latency, 1.6 Mbit/s down
// (200_000 bytes/s), 750 kbit/s up (93_750 bytes/s), cache disabled, CPU
// unthrottled. web.dev good thresholds: LCP <= 2.5s, CLS <= 0.1.
const DOWNLOAD = 200_000;
const UPLOAD = 93_750;
const LATENCY = 150;

const port = await new Promise((resolve) => {
  const probe = createServer();
  probe.listen(0, "127.0.0.1", () => {
    const chosen = probe.address().port;
    probe.close(() => resolve(chosen));
  });
});
const origin = `http://127.0.0.1:${port}`;
const base = resolveSiteTarget("preview").base.replace(/\/$/, "");
const pages = [
  ["/", "home"],
  ["/post-training-when-a-specialist-beats-a-bigger-model", "article"],
  ["/coding-agents-are-reshaping-the-sdlc", "diagrams"],
];
const profiles = [
  {
    name: "mobile-slow-4g",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    throttle: true,
  },
  {
    name: "desktop-dpr2",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    throttle: false,
  },
];

const chrome = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/chromium"]
  .filter(Boolean)
  .find((item) => existsSync(item));

const server = spawn(
  process.execPath,
  [
    "node_modules/vitepress/bin/vitepress.js",
    "preview",
    "site",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { env: { ...process.env, SITE_TARGET: "preview" }, stdio: "ignore", detached: true },
);

function stop() {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${origin}${base}/`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("preview server did not start");
}

const runs = Number(process.env.RUNS || 1);
const results = [];
try {
  await waitForServer();
  const browser = await chromium.launch({
    headless: true,
    ...(chrome ? { executablePath: chrome } : {}),
  });
  for (let run = 1; run <= runs; run++) {
    for (const profile of profiles) {
      if (process.env.MOBILE_ONLY && profile.name !== "mobile-slow-4g") continue;
      for (const [path, name] of pages) {
        const context = await browser.newContext({
          viewport: profile.viewport,
          deviceScaleFactor: profile.deviceScaleFactor,
        });
        const page = await context.newPage();
        const failed = [];
        page.on("requestfailed", (request) => {
          failed.push({
            url: request.url(),
            error: request.failure()?.errorText || "",
          });
        });
        const client = await context.newCDPSession(page);
        await client.send("Network.enable");
        await client.send("Network.setCacheDisabled", { cacheDisabled: true });
        if (profile.throttle) {
          await client.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: LATENCY,
            downloadThroughput: DOWNLOAD,
            uploadThroughput: UPLOAD,
          });
        }
        await page.addInitScript(() => {
          window.__shifts = [];
          window.__lcp = null;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) window.__lcp = entry;
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) window.__shifts.push(entry.value);
            }
          }).observe({ type: "layout-shift", buffered: true });
        });
        const started = Date.now();
        await page.goto(`${origin}${base}${path}`, {
          waitUntil: "load",
          timeout: 180000,
        });
        await page.evaluate(() =>
          Promise.race([
            document.fonts.ready.then(
              () => new Promise((resolve) => setTimeout(resolve, 1500)),
            ),
            new Promise((resolve) => setTimeout(resolve, 12000)),
          ]),
        );
        const measured = await page.evaluate(() => {
          const resources = performance.getEntriesByType("resource").map((entry) => ({
            name: entry.name,
            type: entry.initiatorType,
            transfer: entry.transferSize,
            encoded: entry.encodedBodySize,
            duration: Math.round(entry.duration),
          }));
          const images = [...document.images].map((image) => ({
            currentSrc: image.currentSrc,
            src: image.getAttribute("src"),
            loading: image.getAttribute("loading"),
            fetchPriority: image.getAttribute("fetchpriority"),
            width: image.naturalWidth,
            client: Math.round(image.getBoundingClientRect().width),
          }));
          const lcp = window.__lcp;
          return {
            lcpMs: lcp ? Math.round(lcp.startTime) : null,
            lcpUrl: lcp && "url" in lcp ? lcp.url || "" : "",
            cls: Number(
              (window.__shifts || []).reduce((sum, value) => sum + value, 0).toFixed(4),
            ),
            resources,
            images,
          };
        });
        const imageResources = measured.resources.filter((entry) =>
          /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(entry.name),
        );
        const sum = (entries, key) =>
          entries.reduce((total, entry) => total + entry[key], 0);
        results.push({
          run,
          profile: profile.name,
          page: name,
          elapsedMs: Date.now() - started,
          lcpMs: measured.lcpMs,
          lcpUrl: measured.lcpUrl,
          cls: measured.cls,
          requests: measured.resources.length + 1,
          transferBytes: sum(measured.resources, "transfer"),
          imageRequests: imageResources.length,
          imageBytes: sum(imageResources, "transfer"),
          failed,
          images: measured.images
            .filter((image) => image.client > 0)
            .map((image) => ({
              currentSrc: image.currentSrc.split("/").pop(),
              client: image.client,
            })),
          fonts: measured.resources
            .filter((entry) => entry.name.includes(".woff"))
            .map((entry) => ({
              name: entry.name.split("/").pop(),
              duration: entry.duration,
              transfer: entry.transfer,
            })),
        });
        await context.close();
      }
    }
  }
  await browser.close();
} finally {
  stop();
}

console.log(
  JSON.stringify(
    {
      conditions: {
        latencyMs: LATENCY,
        downloadBytesPerSec: DOWNLOAD,
        uploadBytesPerSec: UPLOAD,
        cache: "disabled",
        cpu: "unthrottled",
      },
      results,
    },
    null,
    2,
  ),
);
