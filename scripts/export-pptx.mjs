import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import JSZip from "jszip";

const require = createRequire(import.meta.url);
const pptxgen = require("pptxgenjs");

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
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
pptx.subject = "GPT Realtime Whisper and Translate on Azure";
pptx.title = "GPT Realtime Whisper + Translate on Azure";
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
    hyperlink: opts.hyperlink,
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

function addSource(slide, label, url, y = 6.94) {
  addCardText(slide, `${label}: ${url}`, 0.39, y, 12.2, 0.12, {
    fontSize: 6.1,
    color: C.mutedText,
    fit: "shrink",
  });
}

function slideOpportunity() {
  const slide = pptx.addSlide();
  const addModelTag = (text, x, y, w) => {
    addRoundRect(slide, x, y, w, 0.22, {
      fill: C.bg,
      line: C.border,
      width: 0.6,
    });
    addCardText(slide, text, x + 0.04, y + 0.055, w - 0.08, 0.1, {
      fontFace: font.mono,
      fontSize: 6.6,
      bold: true,
      fit: "shrink",
    });
  };

  addHeader(
    slide,
    "Realtime speech AI",
    "Realtime AI transcription and translation.",
    1.34,
  );

  addBadge(
    slide,
    "Microsoft Foundry + Azure OpenAI",
    0.39,
    2.7,
    1.82,
    "outline",
  );
  addCardText(
    slide,
    "Transcribing and translating in realtime with AI.",
    0.39,
    3.08,
    6.8,
    0.7,
    { fontSize: 21, bold: true },
  );
  addCardText(slide, "Use", 0.39, 4.03, 0.26, 0.1, {
    fontSize: 9.8,
    color: C.mutedText,
  });
  addModelTag("gpt-realtime-whisper", 0.72, 3.96, 1.62);
  addCardText(slide, "and", 2.42, 4.03, 0.28, 0.1, {
    fontSize: 9.8,
    color: C.mutedText,
  });
  addModelTag("gpt-realtime-translate", 2.76, 3.96, 1.72);
  addCardText(
    slide,
    "for multilingual, LLM-based realtime transcription and translation on Azure through Microsoft Foundry.",
    0.39,
    4.32,
    5.3,
    0.28,
    { fontSize: 9.8, color: C.mutedText },
  );

  [
    {
      metric: "Transcribe",
      title: "gpt-realtime-whisper",
      detail:
        "Stream live speech-to-text deltas while the speaker is still talking.",
      source: "Source: Foundry audio models",
      sourceUrl:
        "https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-sold-directly-by-azure?pivots=azure-openai#audio-models",
      active: true,
    },
    {
      metric: "Translate",
      title: "gpt-realtime-translate",
      detail:
        "Stream source transcript and translated output from one microphone session.",
      source: "Source: Foundry audio models",
      sourceUrl:
        "https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-sold-directly-by-azure?pivots=azure-openai#audio-models",
      active: false,
    },
  ].forEach((card, index) => {
    const y = 2.85 + index * 1.12;
    addRoundRect(slide, 7.15, y, 5.8, 0.92, {
      line: card.active ? C.fg : C.border,
      width: card.active ? 1.25 : 0.9,
    });
    addBadge(
      slide,
      card.metric,
      12.25,
      y + 0.15,
      0.5,
      card.active ? "dark" : "muted",
    );
    addCardText(slide, card.title, 7.34, y + 0.17, 2.8, 0.14, {
      fontSize: 9.2,
      bold: true,
    });
    addCardText(slide, card.detail, 7.34, y + 0.37, 4.5, 0.18, {
      fontSize: 8.1,
      color: C.mutedText,
    });
    addCardText(slide, card.source, 7.34, y + 0.67, 2.1, 0.1, {
      fontSize: 6.8,
      bold: true,
      color: C.fg,
      hyperlink: { url: card.sourceUrl },
    });
  });

  addSource(
    slide,
    "Source",
    "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio",
  );
}

function slideLandscape() {
  const slide = pptx.addSlide();
  addHeader(
    slide,
    "Model landscape",
    "The spotlight is on Whisper and Translate; the rest is comparison context.",
    1.78,
  );

  addRoundRect(slide, 0.39, 1.62, 7.25, 5.0);
  addCardText(slide, "Audio model map", 0.62, 1.88, 1.4, 0.12, {
    fontSize: 9,
    bold: true,
  });
  addCardText(
    slide,
    "Hero models are highlighted; nearby models explain positioning.",
    0.62,
    2.08,
    4.0,
    0.1,
    { fontSize: 7.4, color: C.mutedText },
  );
  addBadge(slide, "Focus: 2 models", 6.28, 1.86, 1.08, "dark");
  addRoundRect(slide, 0.62, 2.36, 6.78, 3.88, {
    fill: C.muted,
    line: C.border,
    width: 0.6,
  });
  slide.addShape(S.line, {
    x: 1.36,
    y: 5.9,
    w: 5.72,
    h: 0,
    line: { color: C.border, width: 0.65 },
  });
  slide.addShape(S.line, {
    x: 1.36,
    y: 2.62,
    w: 0,
    h: 3.28,
    line: { color: C.border, width: 0.65 },
  });
  [
    ["Voice-agent\ncontext", 0.75, 2.78],
    ["Translated\ntranscript", 0.75, 4.15],
    ["Transcript", 0.75, 5.55],
  ].forEach(([label, x, y]) => {
    addCardText(slide, label, x, y, 0.55, 0.26, {
      fontSize: 5.6,
      bold: true,
      color: C.mutedText,
      fit: "shrink",
    });
  });
  addCardText(slide, "Batch file", 1.36, 6.08, 0.8, 0.1, {
    fontSize: 6.5,
    bold: true,
    color: C.mutedText,
  });
  addCardText(slide, "Streaming", 3.78, 6.08, 0.8, 0.1, {
    fontSize: 6.5,
    bold: true,
    color: C.mutedText,
    align: "center",
  });
  addCardText(slide, "Realtime", 6.28, 6.08, 0.8, 0.1, {
    fontSize: 6.5,
    bold: true,
    color: C.mutedText,
    align: "right",
  });

  [
    ["whisper", 1.55, 5.48, false],
    ["gpt-4o-mini-transcribe", 2.3, 5.35, false],
    ["gpt-4o-transcribe", 3.15, 5.1, false],
    ["gpt-realtime-whisper", 4.95, 4.55, true],
    ["gpt-realtime-translate", 5.82, 3.48, true],
    ["gpt-realtime", 6.62, 2.98, false],
  ].forEach(([name, x, y, active]) => {
    addRoundRect(slide, x, y, active ? 1.55 : 1.35, 0.38, {
      fill: C.bg,
      line: active ? C.fg : C.border,
      width: active ? 1.0 : 0.6,
    });
    slide.addShape(S.ellipse, {
      x: x + 0.1,
      y: y + 0.12,
      w: 0.08,
      h: 0.08,
      fill: { color: active ? C.fg : C.mutedText },
      line: { color: active ? C.fg : C.mutedText, transparency: 100 },
    });
    addCardText(slide, name, x + 0.24, y + 0.12, active ? 1.15 : 0.96, 0.1, {
      fontSize: 6.3,
      bold: active,
      fit: "shrink",
    });
  });

  [
    ["whisper", "Audio API", "Batch file baseline", false],
    ["gpt-4o-mini-transcribe", "Audio API", "Batch STT cost option", false],
    ["gpt-4o-transcribe", "Audio API", "Batch STT quality option", false],
    ["gpt-realtime-whisper", "Hero model", "Focus: live transcription", true],
    ["gpt-realtime-translate", "Hero model", "Focus: live translation", true],
    ["gpt-realtime", "Context only", "Adjacent voice-agent option", false],
  ].forEach(([name, category, detail, active], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 7.86 + col * 2.58;
    const y = 1.62 + row * 1.52;
    addRoundRect(slide, x, y, 2.42, 1.36, {
      line: active ? C.fg : C.border,
      width: active ? 1.15 : 0.75,
    });
    addCardText(slide, name, x + 0.14, y + 0.18, 2.12, 0.12, {
      fontSize: 8.6,
      bold: true,
      fit: "shrink",
    });
    addBadge(
      slide,
      category,
      x + 0.14,
      y + 0.5,
      active ? 0.82 : 0.92,
      active ? "dark" : "muted",
    );
    addCardText(slide, detail, x + 0.14, y + 0.9, 2.05, 0.12, {
      fontSize: 7.4,
      color: C.mutedText,
    });
  });

  addCardText(
    slide,
    "Source: https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-sold-directly-by-azure#audio-models",
    7.86,
    6.3,
    5.05,
    0.14,
    { fontSize: 6.1, color: C.mutedText, fit: "shrink" },
  );
}

function slideTranscriptionDemo() {
  const slide = pptx.addSlide();
  addHeader(
    slide,
    "Realtime transcription",
    "Speak once. Watch the transcript stream back.",
    1.86,
  );

  addRoundRect(slide, 0.39, 2.72, 4.2, 2.8);
  addBadge(slide, "Local demo", 0.6, 2.96, 0.72, "outline");
  addCardText(
    slide,
    "Browser mic to GPT Realtime Whisper.",
    0.6,
    3.38,
    3.2,
    0.34,
    { fontSize: 17, bold: true },
  );
  addCardText(
    slide,
    "Audio streams through the local FastAPI proxy to an Azure realtime transcription session.",
    0.6,
    3.92,
    3.25,
    0.35,
    { fontSize: 9.2, color: C.mutedText },
  );
  addButton(slide, "Start microphone", 0.6, 4.68, 3.2, "dark");

  addRoundRect(slide, 4.88, 2.72, 8.07, 2.8);
  addCardText(slide, "Transcript", 5.1, 2.98, 1.2, 0.14, {
    fontSize: 10,
    bold: true,
  });
  addBadge(slide, "Live deltas", 11.9, 2.94, 0.7, "muted");
  addRoundRect(slide, 5.1, 3.45, 7.58, 1.55, {
    fill: C.muted,
    line: C.border,
    width: 0.6,
    dash: "dash",
  });
  addCardText(
    slide,
    "Start the microphone and speak naturally. Transcript text appears here as the model streams it back.",
    5.48,
    4.02,
    5.4,
    0.28,
    { fontSize: 11, color: C.mutedText, align: "center" },
  );
}

function slideTranslationDemo() {
  const slide = pptx.addSlide();
  addHeader(
    slide,
    "Realtime translation",
    "Speak once. Stream transcript and translation together.",
    1.74,
  );

  addRoundRect(slide, 0.39, 2.72, 3.4, 2.95);
  addBadge(slide, "Local demo", 0.6, 2.96, 0.72, "outline");
  addCardText(
    slide,
    "Browser mic to GPT Realtime Translate.",
    0.6,
    3.38,
    2.5,
    0.42,
    {
      fontSize: 15,
      bold: true,
    },
  );
  addCardText(
    slide,
    "One audio stream returns both source transcript and translated output.",
    0.6,
    4.0,
    2.45,
    0.32,
    {
      fontSize: 8.8,
      color: C.mutedText,
    },
  );
  addBadge(slide, "Target: Dutch", 0.6, 4.75, 0.85, "muted");
  addButton(slide, "Start microphone", 0.6, 5.15, 2.55, "dark");

  [
    ["Raw transcript", "Input transcript deltas", "Source"],
    ["Translation", "Translated output deltas", "Dutch"],
  ].forEach(([title, subtitle, badge], i) => {
    const x = 4.05 + i * 4.45;
    addRoundRect(slide, x, 2.72, 4.25, 2.95);
    slide.addShape(S.line, {
      x,
      y: 3.2,
      w: 4.25,
      h: 0,
      line: { color: C.border, width: 0.45 },
    });
    addCardText(slide, title, x + 0.22, 2.92, 1.5, 0.13, {
      fontSize: 9.4,
      bold: true,
    });
    addCardText(slide, subtitle, x + 0.22, 3.08, 1.7, 0.1, {
      fontSize: 6.8,
      color: C.mutedText,
    });
    addBadge(slide, badge, x + 3.26, 2.9, 0.72, "muted");
    addRoundRect(slide, x + 0.22, 3.52, 3.82, 1.56, {
      fill: C.muted,
      line: C.border,
      width: 0.6,
      dash: "dash",
    });
    addCardText(
      slide,
      i === 0
        ? "Source transcript stream appears here."
        : "Translated output stream appears here.",
      x + 0.6,
      4.12,
      3.0,
      0.2,
      { fontSize: 10, color: C.mutedText, align: "center" },
    );
  });
}

function slideSolutionOverview() {
  const slide = pptx.addSlide();
  addHeader(
    slide,
    "Solution overview",
    "One demo pattern, two focused realtime model routes.",
    2.05,
  );

  addBadge(slide, "High-level architecture", 0.39, 2.55, 1.24, "outline");
  addCardText(
    slide,
    "The browser handles the presentation. The local server chooses the focused route: Whisper for transcription, Translate for bilingual output.",
    0.39,
    2.95,
    5.1,
    0.54,
    { fontSize: 18, bold: true },
  );
  addCardText(
    slide,
    "That keeps the model story clean: two demos, two endpoint contracts, one reusable proxy pattern for Azure OpenAI in Microsoft Foundry.",
    0.39,
    3.74,
    4.7,
    0.28,
    { fontSize: 9.2, color: C.mutedText },
  );

  [
    ["1", "Browser mic", "Presenter speaks into the deck."],
    ["2", "Webslides client", "Streams small audio chunks."],
    ["3", "FastAPI proxy", "Trusted bridge to Azure."],
    ["4", "Two model routes", "Whisper or Translate endpoint."],
    ["5", "Slide output", "Exactly what each model streams back."],
  ].forEach(([n, title, detail], i) => {
    const y = 2.35 + i * 0.7;
    addRoundRect(slide, 6.0, y, 6.95, 0.58, {
      fill: i === 2 ? C.bg : C.muted,
      line: i === 2 ? C.fg : C.border,
      width: i === 2 ? 1.2 : 0.7,
    });
    addNumberPill(slide, n, 6.18, y + 0.17, i === 2);
    addCardText(slide, title, 6.55, y + 0.15, 1.6, 0.12, {
      fontSize: 8.8,
      bold: true,
    });
    addCardText(slide, detail, 8.25, y + 0.15, 3.9, 0.12, {
      fontSize: 8.2,
      color: C.mutedText,
    });
  });

  addSource(
    slide,
    "Sources",
    "learn.microsoft.com/.../realtime-audio ; docs/realtime-technical-walkthrough.md",
  );
}

function slideCostEstimate() {
  const slide = pptx.addSlide();
  addHeader(
    slide,
    "Cost estimate",
    "Estimate the two demo models directly: live transcription and live translation.",
    1.62,
  );

  addBadge(
    slide,
    "Azure OpenAI list-price framing",
    0.39,
    2.48,
    1.72,
    "outline",
  );
  [
    [
      "gpt-realtime-whisper",
      "$1.02 / hour",
      "$102 for 100 live audio hours",
      true,
    ],
    [
      "gpt-realtime-translate",
      "$2.04 / hour",
      "$204 for 100 live audio hours",
      false,
    ],
  ].forEach(([model, price, example, active], i) => {
    const y = 2.9 + i * 1.28;
    addRoundRect(slide, 0.39, y, 5.85, 1.05, {
      line: active ? C.fg : C.border,
      width: active ? 1.2 : 0.8,
    });
    addCardText(slide, model, 0.62, y + 0.2, 2.3, 0.13, {
      fontSize: 9,
      bold: true,
    });
    addCardText(slide, price, 0.62, y + 0.42, 2.0, 0.18, {
      fontSize: 17,
      bold: true,
    });
    addCardText(slide, example, 0.62, y + 0.72, 2.2, 0.12, {
      fontSize: 8,
      color: C.mutedText,
    });
  });

  addRoundRect(slide, 6.55, 2.48, 6.4, 2.68);
  addBadge(slide, "Scope", 6.78, 2.72, 0.52, "muted");
  addCardText(
    slide,
    "Only the two showcased models are estimated here.",
    6.78,
    3.15,
    4.6,
    0.3,
    {
      fontSize: 9.5,
      bold: true,
    },
  );
  addCardText(
    slide,
    "Batch transcribe models and full voice-agent models are useful comparison points on the landscape slide, but they are not part of this demo estimate.",
    6.78,
    3.62,
    5.55,
    0.54,
    { fontSize: 8.5, color: C.mutedText },
  );

  addRoundRect(slide, 6.55, 5.34, 6.4, 0.8);
  addCardText(
    slide,
    "Use this as a planning estimate, not a bill.",
    6.78,
    5.55,
    2.9,
    0.12,
    {
      fontSize: 8.6,
      bold: true,
    },
  );
  addCardText(
    slide,
    "Validate region, deployment type, agreement, and date in the Azure Pricing Calculator or customer contract.",
    6.78,
    5.75,
    5.4,
    0.14,
    { fontSize: 7.5, color: C.mutedText },
  );

  addSource(
    slide,
    "Source",
    "https://azure.microsoft.com/en-us/pricing/details/azure-openai/",
  );
}

const outputPath = resolveOutput(readOption("--output", defaultOutput));
await mkdir(path.dirname(outputPath), { recursive: true });

slideOpportunity();
slideLandscape();
slideTranscriptionDemo();
slideTranslationDemo();
slideSolutionOverview();
slideCostEstimate();

await pptx.writeFile({ fileName: outputPath });
await cleanPptxPackage(outputPath);

console.log(`PPTX exported to ${outputPath}`);
