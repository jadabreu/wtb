import { chromium, devices } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const appUrl = process.env.UI_SMOKE_URL ?? "https://jtbd.globalsupply.link";
const outputDir = "playwright-artifacts";

const viewports = [
  {
    name: "desktop",
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  {
    name: "mobile",
    ...devices["iPhone 15"],
  },
];

async function main() {
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({
    args: ["--no-sandbox"],
  });

  const failures = [];

  for (const config of viewports) {
    const context = await browser.newContext(config);
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
    await page.waitForFunction(() => {
      const sidebarText = document.querySelector(".project-sidebar")?.textContent || "";
      return /\b[1-9]\d* saved\b/.test(sidebarText);
    }, null, { timeout: 10000 }).catch(() => undefined);

    await page.getByRole("heading", { name: "What to Build?" }).waitFor();
    await page.getByText("Find customer problems worth solving").waitFor();
    await page.getByRole("button", { name: /New research/i }).waitFor();
    await page.getByRole("heading", { name: /Customer Outcome Mapping/i }).waitFor();
    await page.getByRole("button", { name: /AI Actions/i }).first().waitFor();
    await page.getByRole("tab", { name: /Workflow/i }).waitFor();

    const screenshotPath = `${outputDir}/${config.name}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true, caret: "initial" });

    if (consoleErrors.length > 0) {
      failures.push(`${config.name} console errors:\n${consoleErrors.join("\n")}`);
    }

    if (pageErrors.length > 0) {
      failures.push(`${config.name} page errors:\n${pageErrors.join("\n")}`);
    }

    console.log(`ok ${config.name}: ${screenshotPath}`);
    await context.close();
  }

  await browser.close();

  if (failures.length > 0) {
    throw new Error(failures.join("\n\n"));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
