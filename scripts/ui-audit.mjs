import { chromium } from "@playwright/test";

const url = process.env.UI_SMOKE_URL ?? "https://jtbd.globalsupply.link";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({
  viewport: { width: 2048, height: 1100 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false
});
const page = await context.newPage();
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
await page.getByRole("heading", { name: "Outcome Mapping" }).waitFor();
await page.waitForTimeout(500);

const data = await page.evaluate(() => {
  const doc = document.documentElement;
  const body = document.body;
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
      overflowX: styles.overflowX,
      overflowY: styles.overflowY,
      display: styles.display,
      position: styles.position
    };
  };
  const all = (selector) => Array.from(document.querySelectorAll(selector));
  const controls = all("button, textarea, input, [role='button']").map((element) => ({
    tag: element.tagName.toLowerCase(),
    text: visibleText(element),
    aria: element.getAttribute("aria-label") || element.getAttribute("title") || "",
    rect: box(element)
  }));
  const visibleControls = controls.filter((item) => item.rect && item.rect.display !== "none" && item.rect.w > 0 && item.rect.h > 0);

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    document: {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      scrollHeight: doc.scrollHeight,
      bodyScrollHeight: body.scrollHeight
    },
    hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
    headings: all("h1,h2,h3").map((element) => ({ tag: element.tagName.toLowerCase(), text: visibleText(element), rect: box(element) })),
    regions: all("main, aside, section, [role='complementary']").map((element) => ({ text: visibleText(element), rect: box(element) })),
    textareas: all("textarea").map((element) => ({
      aria: element.getAttribute("aria-label") || "",
      placeholder: element.getAttribute("placeholder") || "",
      rect: box(element),
      valueLength: element.value.length
    })),
    smallTargets: visibleControls.filter((item) => item.rect && (item.rect.w < 32 || item.rect.h < 32)),
    offscreen: visibleControls.filter((item) => item.rect && (item.rect.x < -1 || item.rect.y < -1 || item.rect.x + item.rect.w > window.innerWidth + 1)),
    unlabeledIconButtons: all("button")
      .map((element) => ({
        text: visibleText(element),
        aria: element.getAttribute("aria-label") || "",
        title: element.getAttribute("title") || "",
        rect: box(element)
      }))
      .filter((item) => !item.text && !item.aria && !item.title)
  };
});

console.log(JSON.stringify({ consoleErrors, ...data }, null, 2));

await context.close();
await browser.close();
