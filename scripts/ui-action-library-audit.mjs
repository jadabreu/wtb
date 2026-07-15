import { chromium } from "@playwright/test";

const baseUrl = process.env.UI_SMOKE_URL ?? "https://jtbd.globalsupply.link";
const url = new URL("/actions", baseUrl).toString();

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
await page.getByRole("heading", { name: "Prompts" }).waitFor();
await page.getByText("Catalog").first().waitFor();
await page.waitForTimeout(750);
await page.screenshot({ path: "playwright-artifacts/prompts-desktop.png", fullPage: true, caret: "initial" });

const data = await page.evaluate(() => {
  const doc = document.documentElement;
  const text = (element) => element?.innerText?.replace(/\s+/g, " ").trim().slice(0, 140) || "";
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
      display: styles.display
    };
  };
  const all = (selector) => Array.from(document.querySelectorAll(selector));

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
    headings: all("h1, h2, h3").map((element) => ({ text: text(element), rect: box(element) })),
    panels: all("[data-slot='card'], aside").map((element) => ({ text: text(element), rect: box(element) })),
    offscreen: all("button, textarea, input, [role='tab']").map((element) => ({
      tag: element.tagName.toLowerCase(),
      text: text(element),
      aria: element.getAttribute("aria-label") || element.getAttribute("title") || "",
      rect: box(element)
    })).filter((item) => item.rect && (item.rect.x < -1 || item.rect.x + item.rect.w > window.innerWidth + 1))
  };
});

console.log(JSON.stringify({ consoleErrors, ...data }, null, 2));

await context.close();
await browser.close();
