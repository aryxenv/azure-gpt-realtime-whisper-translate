# Webslides template

React + Vite + Tailwind starter for building slide decks as web applications.
Each slide can be a self-contained mini-app while sharing the presentation UI
system in `src/components/ui`.

Inspired & driven by...

- Github Copilot App "Pick & Polish" feature.
- Powerful models & reasoning of Github Copilot.
- In-slide demos to deliver presentations in a unique & powerful way.

## Run locally

### Client (Presentation)

```pwsh
npm install
npm run dev
```

Open http://localhost:5173.

### Server (Optional)

```pwsh
uv sync
uv run fastapi dev
```

Available at http://localhost:8000 (no config needed - automatically available on client)

## Controls

- **Left / Right arrows**: move between slides on a computer.
- **Spacebar**: cycle the active slide's accent through local elements by
  default. Individual slides can customize this behavior for demos.
- **Swipe**: on phones, swipe left or right to move between slides.

## Export locally

The local dev presentation includes an **Export** icon in the footer. It opens a
popup menu where each option opens its own dialog. The control is hidden from
production builds and GitHub Pages.

- **PDF - Static (Private)**: starts the local FastAPI export route, renders the
  full deck, writes `exports/webslides.pdf`, and downloads the same file.
- **PowerPoint - Static (Private)**: starts the local FastAPI export route,
  generates the native PowerPoint deck, writes `exports/webslides.pptx`, and
  downloads the same file.
- **GitHub Pages - Interactive (Public)**: use the existing Pages workflow when
  the deck contains no customer-specific data.

Generated files in `exports/` are ignored by git by default so private PDF/PPTX
artifacts do not get pushed or deployed accidentally.

For PDF and PowerPoint export, run both the client (`npm run dev`) and the server
(`uv run fastapi dev`) locally.

PDF export uses Playwright. It first tries the local Microsoft Edge browser; if
that is unavailable, install Playwright's browser with:

```pwsh
npx playwright install chromium
```

## Theming

The demo uses a monochrome palette by default, the idea would be to modify the theme to your liking for a specific project.

Simply ask Github Copilot with what you want the theme to be like, and if there is a logo for a specific account you would like, best to provide this logo as attachment.

The `theming` skill will handle the changes for you.

## Agent-driven authoring

This template is intended to be customized with GitHub Copilot App:

1. Start the client dev server with `npm run dev`.
2. Open the local deck at http://localhost:5173 inside GitHub Copilot App.
3. Ask for the slide, demo, layout, or copy change you want.
4. Use Pick & Polish to select individual slide elements and make targeted
   edits.

## Build with Copilot (skills)

This repo ships ready-made skills in `.github/skills/` so you don't have to
re-explain the structure each time. Just describe what you want and Copilot
follows the matching skill:

- **Theming**: modify palette and other supported options, change account logo for `MS x Account`.
- **Add a slide**: create a new slide as a self-contained mini-app.
- **Edit a slide**: change copy, layout, styling, or interactions safely.
- **Integrate demo into slides**: drop in a whole app (in the repo or shared in
  chat) and map it into the deck, wiring up the `server/` backend if needed.
Slides live in `src/components/slides/<topic>/` and are listed, in order, in
`src/Presentation.tsx`. Folders are named by topic (not `slide_1`, `slide_2`), so
slides can be inserted or reordered freely. Demos that need backend logic use the
FastAPI app in `server/`. The skills cover the details.

## Share / deploy to GitHub Pages

A GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) builds and
publishes the deck to GitHub Pages automatically on every push to `main`. Once
it's live, sharing is just `git push` — the deck is served at:

```text
https://<owner>.github.io/<repo>/
```

One-time setup in the repo: **Settings → Pages → Build and deployment →
Source: "GitHub Actions"**. After that, no further configuration is needed — the
workflow auto-detects the repo name for the asset base path, so the template
deploys correctly in any repo without edits. You can also trigger it manually
from the **Actions** tab.

The active slide is stored in the URL (`?slide=<slide-id>`), so you can deep-link
or share a specific slide, e.g. `https://<owner>.github.io/<repo>/?slide=embedded-demo-workflow`.

> [!NOTE]
> GitHub Pages is static, so the FastAPI `server/` demo only runs locally.
> The live server-call card will show "server unavailable" on the deployed deck
> unless you point `VITE_SERVER_URL` at a publicly hosted server.

## Customize the design system

- Shared UI primitives live in `src/components/ui`.
- Theme tokens live in `src/index.css`.
- Tailwind token mappings live in `tailwind.config.ts`.

The default template is monochrome. Change the CSS variables in `src/index.css`
to rebrand the deck without rewriting slide components.
