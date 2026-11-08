import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { chromium } from "playwright-core";

const port = await new Promise((resolve) => {
  const probe = createServer();
  probe.listen(0, "127.0.0.1", () => {
    const chosen = probe.address().port;
    probe.close(() => resolve(chosen));
  });
});
const origin = `http://127.0.0.1:${port}`;
const base = "/writing";
const widths = [320, 390, 768, 1280, 1440, 1920];
const outlined = new Set(["long-title", "specialist"]);
const plain = new Set(["code-image"]);
const articles = new Set([...outlined, ...plain]);
const specialist = "/post-training-when-a-specialist-beats-a-bigger-model";
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
  [specialist, "specialist"],
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

const shotDir = process.env.LAYOUT_SCREENSHOTS || "";
if (shotDir) mkdirSync(shotDir, { recursive: true });

const failures = [];
const samples = [];

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
        if (outlined.has(name) && width >= 1280) {
          await page.locator(".outline-rail a").first().waitFor({ timeout: 5000 });
        }
        if (outlined.has(name) && width < 1280) {
          await page.locator(".outline-mobile summary").waitFor({ timeout: 5000 });
        }
        const measure = await page.evaluate(() => {
          const h1 = document.querySelector("#content h1");
          const brand = document.querySelector(".brand");
          const frame = document.querySelector(".site-main .frame");
          const post = document.querySelector(".post-main");
          const cover = document.querySelector(".post-main .cover img");
          const paragraph = document.querySelector(".post-main p");
          const rail = document.querySelector(".outline-rail");
          const mobile = document.querySelector(".outline-mobile");
          const box = (element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, width: rect.width };
          };
          const railShown = rail && getComputedStyle(rail).display !== "none";
          const style = frame ? getComputedStyle(frame) : null;
          return {
            client: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
            h1: h1 ? box(h1) : null,
            brand: brand ? box(brand) : null,
            frame: frame ? box(frame) : null,
            post: post ? box(post) : null,
            cover: cover ? box(cover) : null,
            paragraph: paragraph ? box(paragraph) : null,
            rail: railShown ? box(rail) : null,
            mobile: Boolean(mobile),
            mobileDisplay: mobile ? getComputedStyle(mobile).display : "absent",
            mobileOpen: Boolean(mobile?.open),
            headings: document.querySelectorAll(".post-main h2[id], .post-main h3[id]")
              .length,
            padLeft: style ? parseFloat(style.paddingLeft) : 0,
            padRight: style ? parseFloat(style.paddingRight) : 0,
            outlineCount: document.querySelectorAll(".outline-rail").length,
          };
        });
        const label = `${theme} ${width} ${name}`;
        if (measure.scroll > measure.client + 1) {
          fail(`${label} overflows by ${measure.scroll - measure.client}px`);
        }
        if (articles.has(name)) {
          if (!measure.h1 || !measure.post) {
            fail(`${label} missing article column`);
            continue;
          }
          const center = (measure.post.left + measure.post.right) / 2;
          if (Math.abs(center - measure.client / 2) > 12) {
            fail(
              `${label} post center ${center.toFixed(1)} vs viewport ${measure.client / 2}`,
            );
          }
          if (Math.abs(measure.h1.left - measure.post.left) > 8) {
            fail(`${label} title is not in the post column`);
          }
          if (measure.cover && Math.abs(measure.cover.left - measure.post.left) > 8) {
            fail(`${label} cover is not in the post column`);
          }
          if (
            measure.paragraph &&
            Math.abs(measure.paragraph.left - measure.post.left) > 8
          ) {
            fail(`${label} body is not in the post column`);
          }
          if (measure.h1.left < 16) fail(`${label} title inset ${measure.h1.left}`);
          if (measure.rail) {
            if (measure.rail.left < measure.post.right + 16) {
              fail(`${label} outline overlaps the post`);
            }
            if (measure.rail.right > measure.client - 8) {
              fail(`${label} outline leaves the viewport`);
            }
          }
          if (width < 1280 && measure.rail) {
            fail(`${label} outline rail shows before it fits`);
          }
          if (plain.has(name)) {
            if (measure.headings) fail(`${label} unexpected section headings`);
            if (measure.rail || measure.mobile) {
              fail(`${label} shows an outline without headings`);
            }
          }
          if (outlined.has(name)) {
            if (!measure.headings) fail(`${label} section headings were not collected`);
            if (width >= 1280 && !measure.rail)
              fail(`${label} outline rail is missing`);
            if (width >= 1280 && measure.mobileDisplay !== "none") {
              fail(`${label} mobile outline stays visible beside the rail`);
            }
            if (width < 1280 && measure.mobileDisplay === "none") {
              fail(`${label} compact outline is hidden`);
            }
            if (width < 1280 && measure.mobileOpen) {
              fail(`${label} compact outline starts expanded`);
            }
          }
        } else {
          if (!measure.h1 || !measure.brand || !measure.frame) {
            fail(`${label} missing layout boxes`);
            continue;
          }
          const contentLeft = measure.frame.left + measure.padLeft;
          const contentRight = measure.frame.right - measure.padRight;
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
          if (measure.outlineCount) fail(`${label} shows an article outline`);
        }
        if (name === "specialist" && measure.post) {
          samples.push({
            theme,
            width,
            center: Number(((measure.post.left + measure.post.right) / 2).toFixed(1)),
            viewport: measure.client,
            postLeft: Number(measure.post.left.toFixed(1)),
            postRight: Number(measure.post.right.toFixed(1)),
            titleLeft: measure.h1 ? Number(measure.h1.left.toFixed(1)) : null,
            coverLeft: measure.cover ? Number(measure.cover.left.toFixed(1)) : null,
            railLeft: measure.rail ? Number(measure.rail.left.toFixed(1)) : null,
            railRight: measure.rail ? Number(measure.rail.right.toFixed(1)) : null,
          });
          if (shotDir && [390, 768, 1440, 1920].includes(width)) {
            await page.screenshot({ path: `${shotDir}/${theme}-${width}-post.png` });
            if (width < 1280) {
              await page.locator(".outline-mobile summary").click();
              await page.screenshot({
                path: `${shotDir}/${theme}-${width}-contents.png`,
              });
            }
          }
        }
      }
      async function expectSection(hash, label) {
        try {
          const landed = await page.waitForFunction(
            (expected) => {
              if (location.hash !== expected) return null;
              const id = decodeURIComponent(expected.replace(/^#/, ""));
              const target = document.getElementById(id);
              const header =
                document.querySelector(".site-header")?.getBoundingClientRect()
                  .bottom || 0;
              const current = [
                ...document.querySelectorAll('a[aria-current="location"]'),
              ].some((node) => node.getAttribute("href") === expected);
              if (!target || !current) return null;
              const top = target.getBoundingClientRect().top;
              if (top < header - 4) return null;
              const post = document
                .querySelector(".post-main")
                ?.getBoundingClientRect();
              if (!post) return null;
              return {
                center: (post.left + post.right) / 2,
                client: document.documentElement.clientWidth,
                scroll: document.documentElement.scrollWidth,
              };
            },
            hash,
            { timeout: 5000 },
          );
          const value = await landed.jsonValue();
          if (Math.abs(value.center - value.client / 2) > 12) {
            fail(`${label} post center moved to ${value.center.toFixed(1)}`);
          }
          if (value.scroll > value.client + 1) {
            fail(`${label} overflows after ${hash}`);
          }
        } catch {
          fail(`${label} did not settle on ${hash}`);
        }
      }
      if (width >= 1440) {
        await page.goto(`${origin}${base}${specialist}`, { waitUntil: "networkidle" });
        const start = page.url().split("#")[0];
        const links = page.locator(".outline-rail a");
        const clicked = await links.nth(1).getAttribute("href");
        const keyed = await links.nth(2).getAttribute("href");
        await links.nth(1).click();
        await expectSection(clicked, `${theme} ${width} click`);
        await links.nth(2).focus();
        await page.keyboard.press("Enter");
        await expectSection(keyed, `${theme} ${width} keyboard`);
        await page.goBack();
        await expectSection(clicked, `${theme} ${width} back`);
        await page.goForward();
        await expectSection(keyed, `${theme} ${width} forward`);
        await page.goto(`${start}${keyed}`, { waitUntil: "networkidle" });
        await expectSection(keyed, `${theme} ${width} direct hash`);
      }
      if (width === 390) {
        await page.goto(`${origin}${base}${specialist}`, { waitUntil: "networkidle" });
        const details = page.locator(".outline-mobile");
        if (await details.evaluate((element) => element.open)) {
          fail(`${theme} 390 compact outline starts open`);
        }
        await page.locator(".outline-mobile summary").click();
        const href = await page
          .locator(".outline-mobile a")
          .nth(1)
          .getAttribute("href");
        await page.locator(".outline-mobile a").nth(1).focus();
        await page.keyboard.press("Enter");
        await expectSection(href, `${theme} 390 compact`);
        await page.goBack();
        try {
          await page.waitForFunction(() => location.hash === "", null, {
            timeout: 5000,
          });
        } catch {
          fail(`${theme} 390 back did not clear the section hash`);
        }
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

if (samples.length) console.log(JSON.stringify(samples));
if (failures.length) {
  for (const failure of failures) console.error(`error ${failure}`);
  process.exit(1);
}
console.log(`layout checks passed for ${widths.length} widths and both themes`);
