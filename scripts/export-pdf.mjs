import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = path.join(repoRoot, "exports", "webslides.pdf");

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

function resolveOutput(output) {
  return path.isAbsolute(output) ? output : path.join(repoRoot, output);
}

function buildExportUrl(input) {
  const url = new URL(input);
  url.searchParams.set("export", "pdf");
  url.searchParams.delete("slide");
  return url.toString();
}

async function launchBrowser() {
  const configuredChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
  if (configuredChannel) {
    return chromium.launch({ channel: configuredChannel });
  }

  try {
    return await chromium.launch({ channel: "msedge" });
  } catch (edgeError) {
    try {
      return await chromium.launch();
    } catch (chromiumError) {
      throw new Error(
        [
          "Could not launch a browser for PDF export.",
          "Install Chromium with `npx playwright install chromium`, or set PLAYWRIGHT_BROWSER_CHANNEL to an installed browser channel.",
          `Edge launch error: ${edgeError instanceof Error ? edgeError.message : String(edgeError)}`,
          `Chromium launch error: ${chromiumError instanceof Error ? chromiumError.message : String(chromiumError)}`,
        ].join("\n"),
      );
    }
  }
}

const baseUrl = readOption("--url", "http://localhost:5173/");
const outputPath = resolveOutput(readOption("--output", defaultOutput));
const exportUrl = buildExportUrl(baseUrl);

await mkdir(path.dirname(outputPath), { recursive: true });

const browser = await launchBrowser();
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  await page.goto(exportUrl, { waitUntil: "domcontentloaded" });
  await page.emulateMedia({ media: "print" });
  await page.waitForFunction(
    () =>
      window.__webslidesExportReady === true ||
      document.documentElement.dataset.webslidesExportReady === "true",
    null,
    { timeout: 30000 },
  );
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }

    await Promise.all(
      Array.from(document.images).map((image) => {
        if (image.complete) {
          return undefined;
        }

        return new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }),
    );
  });
  await page.pdf({
    path: outputPath,
    width: "13.333in",
    height: "7.5in",
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  });
} finally {
  await browser.close();
}

console.log(`PDF exported to ${outputPath}`);
