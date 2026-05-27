import { chromium, devices } from "@playwright/test";

const url = process.env.UI_SMOKE_URL ?? "https://jtbd.globalsupply.link";
const viewports = [
  { name: "desktop", viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { name: "tablet", viewport: { width: 900, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: true },
  { name: "mobile", ...devices["iPhone 15"] },
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const config of viewports) {
  const context = await browser.newContext(config);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
  await page.waitForFunction(() => {
    const sidebarText = document.querySelector(".project-sidebar")?.textContent || "";
    return /\b[1-9]\d* saved\b/.test(sidebarText);
  }, null, { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(250);

  const data = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const doc = document.documentElement;
    const body = document.body;
    const sel = (selector) => document.querySelector(selector);
    const all = (selector) => Array.from(document.querySelectorAll(selector));
    const visibleText = (element) => element?.innerText?.replace(/\s+/g, " ").trim().slice(0, 160) || "";
    const box = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        overflowY: styles.overflowY,
        display: styles.display,
        position: styles.position,
      };
    };

    const controls = all("button, textarea, input, [role='button']").map((element) => ({
      tag: element.tagName.toLowerCase(),
      text: visibleText(element),
      aria: element.getAttribute("aria-label") || element.getAttribute("title") || "",
      rect: box(element),
    }));

    return {
      viewport: { width: vw, height: vh },
      document: {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        scrollHeight: doc.scrollHeight,
        bodyScrollHeight: body.scrollHeight,
      },
      hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
      headings: all("h1,h2,h3").map((element) => ({ tag: element.tagName.toLowerCase(), text: visibleText(element), rect: box(element) })),
      regions: [".app-shell", ".topbar", ".workbench", ".project-sidebar", ".workspace", ".workflow-pane", ".workflow-stepper", ".workflow-content", ".messages", ".composer", ".project-rail"].map((selector) => ({ selector, text: visibleText(sel(selector)), rect: box(sel(selector)) })),
      textareas: all("textarea").map((element) => ({ aria: element.getAttribute("aria-label") || "", placeholder: element.getAttribute("placeholder") || "", rect: box(element), valueLength: element.value.length })),
      smallTargets: controls.filter((item) => item.rect && (item.rect.w < 40 || item.rect.h < 40)),
      offscreen: controls.filter((item) => item.rect && (item.rect.x < -1 || item.rect.y < -1 || item.rect.x + item.rect.w > vw + 1 || item.rect.y + item.rect.h > vh + 260)),
      unlabeledIconButtons: all("button").map((element) => ({ text: visibleText(element), aria: element.getAttribute("aria-label") || "", title: element.getAttribute("title") || "", rect: box(element) })).filter((item) => !item.text && !item.aria && !item.title),
    };
  });

  console.log("\n### " + config.name);
  console.log(JSON.stringify({ consoleErrors, ...data }, null, 2));
  await context.close();
}
await browser.close();
