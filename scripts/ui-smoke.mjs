import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const appUrl = process.env.UI_SMOKE_URL ?? "https://jtbd.globalsupply.link";
const outputDir = "playwright-artifacts";

const viewports = [
  {
    name: "desktop",
    viewport: { width: 2048, height: 1100 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
];

async function main() {
  await mkdir(outputDir, { recursive: true });

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
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
      const projectButton = document.querySelector('button[aria-label="Select research project"]');
      return projectButton && !projectButton.hasAttribute("disabled");
    }, null, { timeout: 30000 });

    await page.getByRole("heading", { name: /Outcome Mapping/i, level: 1 }).waitFor();
    await page.getByLabel("Select research project").waitFor();
    await page.getByRole("link", { name: /Prompts/i }).first().waitFor();
    await page.locator('aside[aria-label="Chat"]').waitFor();
    await page.getByRole("complementary", { name: "Research artifacts" }).waitFor();
    await page.getByRole("navigation", { name: "Research artifacts" }).waitFor();
    await page.getByLabel("Collapse navigation").waitFor();
    await page.getByLabel("Collapse artifacts").waitFor();

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
