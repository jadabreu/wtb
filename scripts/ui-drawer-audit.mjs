import { chromium, devices } from "@playwright/test";

const url = process.env.UI_SMOKE_URL ?? "https://jtbd.globalsupply.link";
const viewports = [
  { name: "desktop", viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
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
  const libraryButton = page.getByRole("button", { name: /AI Actions/i }).first();
  await libraryButton.waitFor();
  await libraryButton.scrollIntoViewIfNeeded();
  await libraryButton.click({ force: true });
  await page.locator("[role=dialog][aria-label=\"AI Actions\"]").waitFor();
  await page.waitForTimeout(750);
  await page.screenshot({ path: `playwright-artifacts/ai-actions-${config.name}.png`, fullPage: true, caret: "initial" });

  const data = await page.evaluate(() => {
    const vw = window.innerWidth;
    const doc = document.documentElement;
    const all = (selector) => Array.from(document.querySelectorAll(selector));
    const text = (element) => element?.innerText?.replace(/\s+/g, " ").trim().slice(0, 140) || "";
    const box = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height), overflowX: styles.overflowX, overflowY: styles.overflowY, display: styles.display };
    };
    return {
      viewport: { width: vw, height: window.innerHeight },
      hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
      drawer: box(document.querySelector('[aria-label="AI Actions"]')),
      regions: [".prompt-drawer-header", ".prompt-library-layout", ".prompt-template-list", ".prompt-editor", ".prompt-editor-grid", ".prompt-tabs"].map((selector) => ({ selector, text: text(document.querySelector(selector)), rect: box(document.querySelector(selector)) })),
      offscreen: all("button, textarea, input, [role='tab']").map((element) => ({ tag: element.tagName.toLowerCase(), text: text(element), aria: element.getAttribute("aria-label") || element.getAttribute("title") || "", rect: box(element) })).filter((item) => item.rect && (item.rect.x < -1 || item.rect.x + item.rect.w > vw + 1)),
    };
  });

  console.log("\n### " + config.name);
  console.log(JSON.stringify({ consoleErrors, ...data }, null, 2));
  await context.close();
}
await browser.close();
