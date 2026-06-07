# Copilot instructions for Webslides

This repository is a presentation template for people who want to build slide
decks as web apps. Treat the user as a presenter, storyteller, or solution
engineer first. They usually care about getting a polished deck, live demo,
export, or shareable presentation working quickly; the React/Vite/FastAPI code
is the implementation detail behind that experience.

## Product view

Webslides lets a user:

- present a browser-based slide deck with keyboard and swipe navigation;
- put live React components, data views, and demos directly inside slides;
- ask Copilot to add, edit, theme, or polish slides;
- run local-only server-backed demos during a presentation;
- export private static PDF/PPTX files locally;
- publish the interactive deck to GitHub Pages when the content is safe to make
  public.

The deck should feel like a custom presentation, not a generic app scaffold.
Changes should preserve the presenter workflow: start locally, iterate visually,
export privately, and optionally publish publicly.

## How to interpret user requests

- If the user asks to change the story, content, visual style, layout, or demo,
  make the deck better from a presentation perspective.
- If the user asks for a slide, create or update an actual slide in the deck,
  not just supporting code.
- If the user mentions a customer, account, event, or audience, tailor copy and
  visual choices to that audience.
- If the user asks for export, prefer the built-in local export paths:
  `exports/webslides.pdf` and `exports/webslides.pptx`.
- If the user asks about publishing or sharing, distinguish private local
  artifacts from public GitHub Pages deployment.

## Experience principles

- Optimize for clear presentation flow, strong visual hierarchy, and live-demo
  usefulness.
- Prefer concise slide copy. Slides should support a speaker, not become a
  document.
- Keep interactive demos usable inside the deck; presentation keyboard shortcuts
  should not break form controls or app fragments.
- Treat generated exports as local artifacts. Do not commit files in `exports/`.
- Keep customer-specific or private content local unless the user explicitly
  wants to publish it.

## Existing Copilot workflows

Use the repo skills when they match the task:

- `add-a-slide`: add a new slide or section.
- `edit-a-slide`: change existing slide copy, layout, behavior, or ordering.
- `integrate-demo-into-slides`: turn an app/demo into a slide.
- `theming`: re-theme the deck or replace the account logo.

