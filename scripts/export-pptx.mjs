import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import JSZip from "jszip";

const require = createRequire(import.meta.url);
const pptxgen = require("pptxgenjs");

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const defaultOutput = path.join(repoRoot, "exports", "webslides.pptx");
const slideWidth = 13.333;
const slideHeight = 7.5;

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

async function updateZipText(zip, filePath, transform) {
  const file = zip.file(filePath);
  if (!file) {
    return;
  }

  zip.file(filePath, transform(await file.async("text")));
}

async function cleanPptxPackage(filePath) {
  const zip = await JSZip.loadAsync(await readFile(filePath));

  await updateZipText(zip, "ppt/presentation.xml", (xml) =>
    xml.replace(/(?s:\s*<p:notesMasterIdLst>.*?<\/p:notesMasterIdLst>)/g, ""),
  );
  await updateZipText(zip, "ppt/_rels/presentation.xml.rels", (xml) =>
    xml.replace(
      /(?s:\s*<Relationship[^>]+Type="[^"]+\/notesMaster"[^>]*\/>)/g,
      "",
    ),
  );
  await updateZipText(zip, "[Content_Types].xml", (xml) =>
    xml
      .replace(
        /(?s:\s*<Override[^>]+PartName="\/ppt\/notesSlides\/[^"]+"[^>]*\/>)/g,
        "",
      )
      .replace(
        /(?s:\s*<Override[^>]+PartName="\/ppt\/notesMasters\/[^"]+"[^>]*\/>)/g,
        "",
      ),
  );

  for (const fileName of Object.keys(zip.files)) {
    if (
      fileName.startsWith("ppt/notesMasters/") ||
      fileName.startsWith("ppt/notesSlides/")
    ) {
      zip.remove(fileName);
    }
  }

  for (const fileName of Object.keys(zip.files)) {
    if (/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(fileName)) {
      await updateZipText(zip, fileName, (xml) =>
        xml.replace(
          /(?s:\s*<Relationship[^>]+Type="[^"]+\/notesSlide"[^>]*\/>)/g,
          "",
        ),
      );
    }
  }

  const cleaned = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  await writeFile(filePath, cleaned);
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
          "Could not launch a browser for PPTX export.",
          "Install Chromium with `npx playwright install chromium`, or set PLAYWRIGHT_BROWSER_CHANNEL to an installed browser channel.",
          `Edge launch error: ${edgeError instanceof Error ? edgeError.message : String(edgeError)}`,
          `Chromium launch error: ${
            chromiumError instanceof Error
              ? chromiumError.message
              : String(chromiumError)
          }`,
        ].join("\n"),
      );
    }
  }
}

async function waitForDeck(page) {
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
}

async function captureSlideImages(page) {
  const slides = page.locator(".pdf-export-page");
  const count = await slides.count();
  if (count === 0) {
    throw new Error(
      "No export slides were found. Make sure the deck supports ?export=pdf.",
    );
  }

  const images = [];
  for (let index = 0; index < count; index += 1) {
    const slide = slides.nth(index);
    await slide.scrollIntoViewIfNeeded();
    const screenshot = await slide.screenshot({
      animations: "disabled",
      type: "png",
    });
    images.push(`image/png;base64,${screenshot.toString("base64")}`);
  }

  return images;
}

function createPresentation(images) {
  const pptx = new pptxgen();
  pptx.defineLayout({
    name: "WEB_WIDE",
    width: slideWidth,
    height: slideHeight,
  });
  pptx.layout = "WEB_WIDE";
  pptx.author = "GitHub Copilot";
  pptx.company = "Microsoft";
  pptx.subject = "GPT Realtime Whisper and Translate on Azure";
  pptx.title = "GPT Realtime Whisper + Translate on Azure";
  pptx.lang = "en-US";
  pptx.theme = {
    headFontFace: "Segoe UI",
    bodyFontFace: "Segoe UI",
    lang: "en-US",
  };
  pptx.margin = 0;

  for (const image of images) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addImage({
      data: image,
      x: 0,
      y: 0,
      w: slideWidth,
      h: slideHeight,
    });
  }

  return pptx;
}

const baseUrl = readOption("--url", "http://localhost:5173/");
const outputPath = resolveOutput(readOption("--output", defaultOutput));
const exportUrl = buildExportUrl(baseUrl);

await mkdir(path.dirname(outputPath), { recursive: true });

const browser = await launchBrowser();
try {
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { width: 1920, height: 1080 },
  });

  await page.goto(exportUrl, { waitUntil: "domcontentloaded" });
  await waitForDeck(page);

  const images = await captureSlideImages(page);
  const pptx = createPresentation(images);
  await pptx.writeFile({ fileName: outputPath });
  await cleanPptxPackage(outputPath);

  console.log(`PPTX exported ${images.length} slides to ${outputPath}`);
} finally {
  await browser.close();
}
