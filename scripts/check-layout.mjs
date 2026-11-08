import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const port = 4179;
const origin = `http://127.0.0.1:${port}`;
const base = "/writing";
const widths = [320, 390, 768, 1440];
const pages = [
  ["/", "home"],
  ["/archive", "archive"],
  ["/tags", "tags"],
  ["/series", "series"],
  ["/page/about", "about"],
  ["/search", "search"],
  [
    "/ai-on-microcontrollers-a-deep-dive-into-tinyml-esp-skainet-and-the-embedded-intelligence-revolution",
    "long-title",
  ],
  ["/statikly-no-hassle-full-stack-framework", "code-image"],
];

const chrome = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/chromium"]
  .filter(Boolean)
  .find((path) => existsSync(path));

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
  {
    env: { ...process.env, SITE_TARGET: "preview" },
    stdio: "ignore",
    detached: true,
  },
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
      const response = await fetch(`${origin}${base}/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("preview server did not start");
}

const failures = [];

function fail(message) {
  failures.push(message);
}

try {
  await waitForServer();
  const cssStatus = await fetch(`${origin}${base}/`).then(async (response) => {
    const html = await response.text();
    const href = html.match(/href="([^"]*\/assets\/style[^"]+\.css)"/)?.[1];
    if (!href) return 0;
    return (await fetch(`${origin}${href}`)).status;
  });
  if (cssStatus !== 200) throw new Error(`preview stylesheet returned ${cssStatus}`);
  const browser = await chromium.launch({
    headless: true,
    ...(chrome ? { executablePath: chrome } : {}),
  });
  for (const theme of ["light", "dark"]) {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await page.addInitScript((value) => {
        localStorage.setItem("piece-theme", value);
      }, theme);
      for (const [path, name] of pages) {
        await page.goto(`${origin}${base}${path}`, { waitUntil: "networkidle" });
        const measure = await page.evaluate(() => {
          const h1 = document.querySelector("#content h1");
          const brand = document.querySelector(".brand");
          const frame = document.querySelector(".site-main .frame");
          const box = (element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, width: rect.width };
          };
          const style = frame ? getComputedStyle(frame) : null;
          return {
            client: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
            h1: h1 ? box(h1) : null,
            brand: brand ? box(brand) : null,
            frame: frame ? box(frame) : null,
            padLeft: style ? parseFloat(style.paddingLeft) : 0,
            padRight: style ? parseFloat(style.paddingRight) : 0,
          };
        });
        const label = `${theme} ${width} ${name}`;
        if (!measure.h1 || !measure.brand || !measure.frame) {
          fail(`${label} missing layout boxes`);
          continue;
        }
        const contentLeft = measure.frame.left + measure.padLeft;
        const contentRight = measure.frame.right - measure.padRight;
        if (measure.scroll > measure.client + 1) {
          fail(`${label} overflows by ${measure.scroll - measure.client}px`);
        }
        if (measure.padLeft < 20 || measure.padRight < 20) {
          fail(`${label} frame padding ${measure.padLeft}/${measure.padRight}`);
        }
        if (contentLeft < 20 || measure.client - contentRight < 20) {
          fail(`${label} content edge ${contentLeft}..${contentRight}`);
        }
        if (Math.abs(measure.h1.left - contentLeft) > 2) {
          fail(
            `${label} heading is not aligned to the frame (${measure.h1.left} vs ${contentLeft})`,
          );
        }
        if (Math.abs(measure.brand.left - contentLeft) > 2) {
          fail(
            `${label} brand is not aligned to the content (${measure.brand.left} vs ${contentLeft})`,
          );
        }
        if (measure.h1.width > 820)
          fail(`${label} heading is ${measure.h1.width}px wide`);
      }
      await page.goto(`${origin}${base}/`, { waitUntil: "networkidle" });
      await page.locator(".skip").focus();
      const focus = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement);
        return { outline: style.outlineStyle, width: style.outlineWidth };
      });
      if (focus.outline === "none" || parseFloat(focus.width) < 2) {
        fail(`${theme} ${width} skip link focus is ${focus.outline} ${focus.width}`);
      }
      if (width >= 960) {
        const writing = page.locator('.nav-desktop a[aria-current="page"]');
        if ((await writing.count()) !== 1)
          fail(`${theme} ${width} home is not the current nav item`);
        const border = await page.locator(".search-link").evaluate((element) => {
          return parseFloat(getComputedStyle(element).borderTopWidth);
        });
        if (border < 1) fail(`${theme} ${width} search control has no border`);
      } else {
        await page.locator(".menu-button").click();
        const item = page.locator("#site-menu a", { hasText: "Archive" });
        const height = await item.evaluate(
          (element) => element.getBoundingClientRect().height,
        );
        if (height < 44) fail(`${theme} ${width} menu item is ${height}px`);
        await page.keyboard.press("Escape");
        if (await page.locator("#site-menu").count()) {
          fail(`${theme} ${width} escape did not close the menu`);
        }
      }
      await context.close();
    }
  }
  await browser.close();
} catch (error) {
  fail(error.stack || error.message);
} finally {
  stop();
}

if (failures.length) {
  for (const failure of failures) console.error(`error ${failure}`);
  process.exit(1);
}
console.log(`layout checks passed for ${widths.length} widths and both themes`);
