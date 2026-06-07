import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import JSZip from "jszip";

const require = createRequire(import.meta.url);
const pptxgen = require("pptxgenjs");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = path.join(repoRoot, "exports", "webslides.pptx");

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

const pptx = new pptxgen();
pptx.defineLayout({ name: "WEB_WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WEB_WIDE";
pptx.author = "GitHub Copilot";
pptx.company = "Microsoft";
pptx.subject = "Webslides export";
pptx.title = "Webslides";
pptx.lang = "en-US";
pptx.theme = {
  headFontFace: "Segoe UI",
  bodyFontFace: "Segoe UI",
  lang: "en-US",
};
pptx.margin = 0;

const S = pptx.ShapeType;

const C = {
  bg: "FFFFFF",
  fg: "0D0D0D",
  muted: "F5F5F5",
  mutedText: "5C5C5C",
  border: "DEDEDE",
  green: "2DBE6C",
  red: "F1511B",
  msGreen: "80CC28",
  msBlue: "00ADEF",
  msYellow: "FBBC09",
};

const font = {
  sans: "Segoe UI",
  mono: "Consolas",
};

function addMicrosoftLogo(slide, x, y, size = 0.14) {
  const gap = size * 0.1;
  const cell = (size - gap) / 2;
  const squares = [
    [0, 0, C.red],
    [cell + gap, 0, C.msGreen],
    [0, cell + gap, C.msBlue],
    [cell + gap, cell + gap, C.msYellow],
  ];

  for (const [dx, dy, color] of squares) {
    slide.addShape(S.rect, {
      x: x + dx,
      y: y + dy,
      w: cell,
      h: cell,
      fill: { color },
      line: { color, transparency: 100 },
    });
  }
}

function addBrandLockup(slide) {
  addMicrosoftLogo(slide, 12.5, 0.34, 0.14);
  slide.addText("x", {
    x: 12.68,
    y: 0.335,
    w: 0.08,
    h: 0.15,
    margin: 0,
    fontFace: font.sans,
    fontSize: 5.5,
    color: C.mutedText,
    align: "center",
  });
  addMicrosoftLogo(slide, 12.8, 0.34, 0.14);
}

function addHeader(slide, eyebrow, title, dotX) {
  slide.background = { color: C.bg };
  slide.addText(eyebrow.toUpperCase(), {
    x: 0.39,
    y: 0.36,
    w: 3.2,
    h: 0.18,
    margin: 0,
    fontFace: font.sans,
    fontSize: 7.2,
    bold: true,
    charSpacing: 3,
    color: C.fg,
    breakLine: false,
    fit: "shrink",
  });
  slide.addShape(S.ellipse, {
    x: dotX,
    y: 0.38,
    w: 0.055,
    h: 0.055,
    fill: { color: C.green },
    line: { color: C.green, transparency: 100 },
  });
  addBrandLockup(slide);
  slide.addText(title, {
    x: 0.39,
    y: 0.64,
    w: 12,
    h: 0.56,
    margin: 0,
    fontFace: font.sans,
    fontSize: 36,
    bold: true,
    color: C.fg,
    breakLine: false,
    fit: "shrink",
  });
  slide.addShape(S.line, {
    x: 0.39,
    y: 1.25,
    w: 12.56,
    h: 0,
    line: { color: C.border, width: 0.45 },
  });
}

function addRoundRect(slide, x, y, w, h, opts = {}) {
  slide.addShape(S.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    fill: { color: opts.fill ?? C.bg },
    line: {
      color: opts.line ?? C.border,
      width: opts.width ?? 0.9,
      dash: opts.dash,
      dashType: opts.dash,
    },
  });
}

function addBadge(slide, text, x, y, w, variant = "outline") {
  const dark = variant === "dark";
  const muted = variant === "muted";
  addRoundRect(slide, x, y, w, 0.18, {
    fill: dark ? C.fg : muted ? C.muted : C.bg,
    line: dark ? C.fg : C.border,
    width: 0.55,
  });
  slide.addText(text, {
    x,
    y: y + 0.025,
    w,
    h: 0.1,
    margin: 0,
    fontFace: font.sans,
    fontSize: 6.9,
    bold: true,
    color: dark ? C.bg : muted ? C.mutedText : C.fg,
    align: "center",
    fit: "shrink",
  });
}

function addButton(slide, text, x, y, w, variant = "outline") {
  const dark = variant === "dark";
  addRoundRect(slide, x, y, w, 0.22, {
    fill: dark ? C.fg : C.bg,
    line: dark ? C.fg : C.border,
    width: 0.6,
  });
  slide.addText(text, {
    x,
    y: y + 0.045,
    w,
    h: 0.1,
    margin: 0,
    fontFace: font.sans,
    fontSize: 6.8,
    bold: true,
    color: dark ? C.bg : C.fg,
    align: "center",
    fit: "shrink",
  });
}

function addCardText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x,
    y,
    w,
    h,
    margin: 0,
    fontFace: opts.fontFace ?? font.sans,
    fontSize: opts.fontSize ?? 9.5,
    bold: opts.bold ?? false,
    color: opts.color ?? C.fg,
    breakLine: false,
    fit: opts.fit ?? "shrink",
    valign: opts.valign ?? "top",
    align: opts.align ?? "left",
    charSpacing: opts.charSpacing,
    paraSpaceAfterPt: 0,
  });
}

function addNumberPill(slide, n, x, y, active = false) {
  addRoundRect(slide, x, y, 0.22, 0.22, {
    fill: active ? C.fg : C.muted,
    line: active ? C.fg : C.muted,
    width: 0.55,
  });
  addCardText(slide, String(n), x, y + 0.045, 0.22, 0.09, {
    fontSize: 7.2,
    bold: true,
    color: active ? C.bg : C.mutedText,
    align: "center",
  });
}

function addProgressBar(slide, x, y, w, fillW) {
  slide.addShape(S.roundRect, {
    x,
    y,
    w,
    h: 0.05,
    rectRadius: 0.025,
    fill: { color: C.bg },
    line: { color: C.bg, transparency: 100 },
  });
  slide.addShape(S.roundRect, {
    x,
    y,
    w: fillW,
    h: 0.05,
    rectRadius: 0.025,
    fill: { color: C.fg },
    line: { color: C.fg, transparency: 100 },
  });
}

function slideIntro() {
  const slide = pptx.addSlide();
  addHeader(slide, "Webslides template", "A slide deck, built like a web app.", 1.85);

  addBadge(slide, "Template concept", 0.39, 3.28, 0.86, "outline");
  addCardText(
    slide,
    "Put demos, data, and live components directly in the story you\npresent.",
    0.39,
    3.66,
    6.8,
    0.92,
    { fontSize: 21, bold: true },
  );
  addCardText(
    slide,
    "The deck is React, Tailwind, and your own component system. If it runs on the\nweb, it can live inside a slide.",
    0.39,
    4.7,
    4.2,
    0.34,
    { fontSize: 9.8, color: C.mutedText },
  );
  addButton(slide, "See a deployed example \u2192", 0.39, 5.2, 1.42, "outline");

  addCardText(slide, "CONTROLS", 7.44, 3.3, 1.2, 0.12, {
    fontSize: 7.2,
    bold: true,
    color: C.mutedText,
    charSpacing: 3,
  });

  [
    {
      key: "\u2190 / \u2192",
      title: "Move through the deck",
      detail: "Arrow keys step between slides.",
      active: true,
    },
    {
      key: "SPACE",
      title: "Cycle inside a slide",
      detail: "Moves the accent across local elements.",
      active: false,
    },
    {
      key: "SWIPE",
      title: "Navigate on mobile",
      detail: "Swipe left or right to move between slides.",
      active: false,
    },
  ].forEach((card, index) => {
    const y = 3.47 + index * 0.64;
    addRoundRect(slide, 7.44, y, 5.5, 0.55, {
      line: card.active ? C.fg : C.border,
      width: card.active ? 1.25 : 0.9,
    });
    addButton(
      slide,
      card.key,
      7.57,
      y + 0.18,
      0.56,
      card.active ? "dark" : "outline",
    );
    addCardText(slide, card.title, 8.24, y + 0.16, 2.3, 0.14, {
      fontSize: 9.2,
      bold: true,
    });
    addCardText(slide, card.detail, 8.24, y + 0.32, 3.2, 0.12, {
      fontSize: 8.1,
      color: C.mutedText,
    });
  });
}

function slideAuthoring() {
  const slide = pptx.addSlide();
  addHeader(
    slide,
    "Agent-driven authoring",
    "Customize the deck by asking for it.",
    2.25,
  );

  addRoundRect(slide, 0.39, 3.0, 5.24, 2.58, {
    line: C.border,
    width: 0.75,
  });
  slide.addShape(S.line, {
    x: 0.39,
    y: 3.29,
    w: 5.24,
    h: 0,
    line: { color: C.border, width: 0.45 },
  });
  [0.54, 0.66, 0.78].forEach((x) => {
    slide.addShape(S.ellipse, {
      x,
      y: 3.12,
      w: 0.065,
      h: 0.065,
      fill: { color: "CFCFCF" },
      line: { color: "CFCFCF", transparency: 100 },
    });
  });
  addCardText(slide, "localhost", 0.93, 3.12, 0.6, 0.12, {
    fontSize: 6.8,
    color: C.mutedText,
  });

  [
    ["$ npm run dev", C.mutedText],
    ["VITE ready  \u00b7  localhost:5173", C.fg],
    ["\u203a open the deck in GitHub Copilot App", C.mutedText],
    ['\u203a "Create a new product demo slide"', C.fg],
    ["\u203a iterate with Pick & Polish", C.mutedText],
  ].forEach(([text, color], i) => {
    addCardText(slide, text, 0.54, 3.48 + i * 0.25, 4.95, 0.12, {
      fontFace: font.mono,
      fontSize: 7.5,
      color,
    });
  });

  [
    {
      title: "Start the client",
      command: "npm run dev",
      detail: "Run the dev server so the deck is live locally.",
      active: true,
    },
    {
      title: "Open it in GitHub Copilot App",
      command: "localhost:5173",
      detail: "Point Copilot at the running deck.",
      active: false,
    },
    {
      title: "Ask for the change",
      command: '"Add a pricing demo slide"',
      detail: "Describe the slide, demo, or layout you want.",
      active: false,
    },
    {
      title: "Review and iterate",
      command: '"Polish this for mobile"',
      detail: "Refine in the browser until it feels right.",
      active: false,
    },
  ].forEach((item, i) => {
    const y = 3.0 + i * 0.67;
    addRoundRect(slide, 5.86, y, 7.09, 0.58, {
      line: item.active ? C.fg : C.border,
      width: item.active ? 1.25 : 0.9,
    });
    addNumberPill(slide, i + 1, 5.98, y + 0.12, item.active);
    addCardText(slide, item.title, 6.31, y + 0.16, 2.9, 0.14, {
      fontSize: 9,
      bold: true,
    });
    addCardText(slide, item.command, 11.35, y + 0.18, 1.45, 0.12, {
      fontFace: font.mono,
      fontSize: 6.8,
      color: C.mutedText,
      align: "right",
    });
    addCardText(slide, item.detail, 6.31, y + 0.35, 4.4, 0.12, {
      fontSize: 8.2,
      color: C.mutedText,
    });
  });
}

function slideEmbeddedDemo() {
  const slide = pptx.addSlide();
  addHeader(
    slide,
    "Embedded demo workflow",
    "Demos live inside the presentation.",
    2.34,
  );

  addRoundRect(slide, 0.39, 2.7, 6.2, 1.25, {
    line: C.fg,
    width: 1.2,
  });
  addBadge(slide, "@your_demo_slide", 0.54, 2.85, 0.9, "dark");
  addCardText(slide, "Drop a folder in, reference it in Copilot.", 0.54, 3.19, 4.3, 0.17, {
    fontSize: 12.5,
    bold: true,
  });
  [
    "components/slides/your_demo_slide/main.tsx",
    "components/slides/your_demo_slide/components/panel.tsx",
    "components/slides/your_demo_slide/data/sample.ts",
  ].forEach((line, i) => {
    addCardText(slide, line, 0.54, 3.45 + i * 0.14, 4.8, 0.1, {
      fontFace: font.mono,
      fontSize: 6.4,
      color: C.mutedText,
    });
  });

  addRoundRect(slide, 0.39, 4.08, 6.2, 0.67);
  addCardText(slide, "Server-backed demos", 0.54, 4.26, 1.3, 0.13, {
    fontSize: 8.2,
    bold: true,
  });
  addCardText(
    slide,
    "Need server logic? Copilot moves it into a server folder and exposes a route the slide calls from the client.",
    0.54,
    4.47,
    5.2,
    0.15,
    { fontSize: 8, color: C.mutedText },
  );

  addRoundRect(slide, 0.39, 4.86, 6.2, 1.03);
  addCardText(slide, "Live server call", 0.54, 5.05, 1.2, 0.13, {
    fontSize: 8.2,
    bold: true,
  });
  addBadge(slide, "GET /health", 5.82, 5.0, 0.62, "muted");
  slide.addShape(S.ellipse, {
    x: 0.54,
    y: 5.32,
    w: 0.055,
    h: 0.055,
    fill: { color: C.fg },
    line: { color: C.fg, transparency: 100 },
  });
  addCardText(slide, "Server healthy!", 0.65, 5.29, 1.2, 0.12, {
    fontFace: font.mono,
    fontSize: 6.8,
    color: C.mutedText,
  });
  addCardText(slide, "http://localhost:8000", 0.54, 5.58, 1.3, 0.11, {
    fontFace: font.mono,
    fontSize: 6.2,
    color: C.mutedText,
  });
  addButton(slide, "Call again", 5.88, 5.51, 0.55, "outline");

  addRoundRect(slide, 6.76, 2.7, 6.19, 3.19);
  slide.addShape(S.line, {
    x: 6.76,
    y: 3.12,
    w: 6.19,
    h: 0,
    line: { color: C.border, width: 0.45 },
  });
  addCardText(slide, "Embedded app fragment", 6.88, 2.87, 1.7, 0.14, {
    fontSize: 9.2,
    bold: true,
  });
  addBadge(slide, "Prototype", 12.27, 2.82, 0.55, "muted");

  addButton(slide, "Prototype", 6.91, 3.26, 1.93, "dark");
  addButton(slide, "Demo", 8.88, 3.26, 1.93, "outline");
  addButton(slide, "Narrative", 10.87, 3.26, 1.93, "outline");

  addRoundRect(slide, 6.91, 3.62, 5.89, 0.68, {
    fill: C.muted,
    line: C.border,
    width: 0.55,
  });
  [
    ["Prototype", 5.12],
    ["Demo", 1.7],
    ["Narrative", 1.7],
  ].forEach(([label, barWidth], i) => {
    const y = 3.77 + i * 0.17;
    addCardText(slide, label, 7.02, y - 0.01, 0.45, 0.1, {
      fontSize: 6.6,
      color: C.mutedText,
    });
    addProgressBar(slide, 7.55, y, 5.12, barWidth);
  });
  addCardText(
    slide,
    "Real controls keep working \u2014 deck navigation ignores inputs and interactive elements.",
    6.91,
    4.49,
    5.5,
    0.14,
    { fontSize: 8.3, color: C.mutedText },
  );
}

function slidePolish() {
  const slide = pptx.addSlide();
  addHeader(slide, "Customization system", "Pick, polish, and keep control.", 2.04);

  addCardText(slide, "SHARED DESIGN SYSTEM", 0.39, 3.13, 2.8, 0.14, {
    fontSize: 7.2,
    bold: true,
    color: C.mutedText,
    charSpacing: 2.4,
  });

  [
    ["components/ui", "Shared frame, cards, badges, and buttons.", true],
    ["index.css", "Monochrome tokens for color, borders, and accents.", false],
    ["components/slides", "Self-contained slide folders in deck order.", false],
  ].forEach(([name, detail, active], i) => {
    const y = 3.32 + i * 0.54;
    addRoundRect(slide, 0.39, y, 5.88, 0.43, {
      line: active ? C.fg : C.border,
      width: active ? 1.2 : 0.9,
    });
    const badgeW =
      name === "components/slides" ? 0.92 : name === "components/ui" ? 0.9 : 0.7;
    addBadge(slide, name, 0.52, y + 0.13, badgeW, active ? "dark" : "outline");
    addCardText(slide, detail, 0.52 + badgeW + 0.22, y + 0.16, 3.8, 0.12, {
      fontSize: 8.2,
      color: C.mutedText,
    });
  });

  addRoundRect(slide, 6.44, 3.1, 6.51, 2.39);
  slide.addShape(S.line, {
    x: 6.44,
    y: 3.38,
    w: 6.51,
    h: 0,
    line: { color: C.border, width: 0.45 },
  });
  addCardText(slide, "PICK & POLISH", 6.59, 3.22, 1.3, 0.12, {
    fontSize: 7,
    bold: true,
    color: C.mutedText,
    charSpacing: 2.2,
  });

  addRoundRect(slide, 6.59, 3.54, 6.2, 0.63, {
    line: C.fg,
    width: 1,
    dash: "dash",
  });
  addCardText(slide, "Selected slide element", 6.71, 3.7, 2, 0.15, {
    fontSize: 11,
    bold: true,
  });
  addCardText(
    slide,
    "Target one card or section instead of rewriting the slide.",
    6.71,
    3.93,
    3.6,
    0.12,
    { fontSize: 8.1, color: C.mutedText },
  );

  [
    "Select an element in GitHub Copilot App.",
    "Describe the change in plain language.",
    "Review locally and keep iterating.",
  ].forEach((step, i) => {
    const y = 4.28 + i * 0.25;
    slide.addShape(S.ellipse, {
      x: 6.59,
      y,
      w: 0.2,
      h: 0.2,
      fill: { color: C.fg },
      line: { color: C.fg, transparency: 100 },
    });
    addCardText(slide, String(i + 1), 6.59, y + 0.045, 0.2, 0.08, {
      fontSize: 6.4,
      bold: true,
      color: C.bg,
      align: "center",
    });
    addCardText(slide, step, 6.86, y + 0.05, 3, 0.11, {
      fontSize: 8.1,
      color: C.mutedText,
    });
  });

  slide.addShape(S.line, {
    x: 6.59,
    y: 5.08,
    w: 6.2,
    h: 0,
    line: { color: C.border, width: 0.45 },
  });
  addCardText(slide, "The limit goes beyond the sky.", 6.59, 5.24, 2.2, 0.12, {
    fontSize: 8.3,
    bold: true,
  });
}

const outputPath = resolveOutput(readOption("--output", defaultOutput));
await mkdir(path.dirname(outputPath), { recursive: true });

slideIntro();
slideAuthoring();
slideEmbeddedDemo();
slidePolish();

await pptx.writeFile({ fileName: outputPath });
await cleanPptxPackage(outputPath);

console.log(`PPTX exported to ${outputPath}`);
