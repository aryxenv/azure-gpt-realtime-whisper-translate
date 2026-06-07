---
name: integrate-demo-into-slides
description: Map an existing app or demo into the deck as a slide. Use when the user drops a whole app/project into a slide folder or elsewhere in the repo (or points at code in chat) and wants it turned into a slide — "integrate this demo", "make this app a slide", "embed my project". Handles client UI mapping, server/backend dependencies, and npm deps.
---

# Integrate a demo into the slides

This skill takes an existing app — dropped inside a slide folder, sitting
elsewhere in the repo, or referenced in chat — and maps it into the deck's
structure so it becomes a self-contained slide. The goal: the demo runs **inside
the presentation** with the same isolation and design contract as a native
slide.

You keep creative latitude over how the demo looks and is framed in the deck.
The phases enforce only structure, isolation, and the server wiring.

## Phase 1 — Assess the source

Before moving anything, understand what you were given:

- Locate the source (the path the user dropped, or the code referenced in chat).
- Separate it into: **client/UI** (renders), **server/backend** (any code that
  needs to run on a server — DB access, secrets, heavy compute, external APIs
  with keys), **static assets/data**, and **dependencies**.
- Identify the framework and entry point. If it's a React/Vite app, mapping is
  direct. If it's another framework, port the rendered UI into React rather than
  embedding a second framework runtime.

State your integration plan briefly before large moves.

## Phase 2 — Map the client into a slide

- Create `src/components/slides/<slide-id>/` (descriptive kebab-case id) and port
  the demo's UI into `main.tsx`, exported as a component typed with `SlideProps`
  (`@/components/slides/types`).
- Keep the demo's own components/data **inside that slide folder**
  (`components/`, `data/`). The slide must not import from other slides.
- Wrap the demo in `SlideFrame` (eyebrow + title) so it sits in the deck, with
  the live demo as its children. Preserve the demo's real interactivity — deck
  navigation already ignores inputs on interactive elements.
- Move static assets into the slide folder (or `src/assets` / `public` if shared)
  and fix import paths.
- Styling: prefer adapting to the shared primitives and theme tokens (`Card`,
  `Button`, `Badge`, `bg-card`, `border-border`, …) for a consistent look. If the
  demo's own styling is essential to the point being made, keep it but scope it
  to the slide and don't leak global CSS. If you need a reusable primitive the
  deck doesn't have, add it to the shared UI system (`src/components/ui`) in the
  existing `cva`/token style and use it instead of a one-off or a heavy dep.

DON'T:

- Hardcode colors unless the demo's identity requires it.
- Run the demo's timers/sockets/autoplay while the slide is inactive — gate on
  `isActive` (slides stay mounted via opacity crossfade).
- Register more than one deck entry for one demo.

## Phase 3 — Handle server / backend dependencies

If the demo needs server logic, use the existing FastAPI server in `server/`
instead of bundling a second backend:

- Add a route file under `server/src/router/<feature>.py` (an `APIRouter`), put
  the actual logic in `server/src/utils/`, and include the router in
  `server/src/main.py` via `app.include_router(...)`. Mirror the existing
  `diagnostics` route as the template. CORS is already open.
- On the client, add a typed fetch in `src/lib/api.ts` (or a sibling `lib` file)
  and call it through TanStack Query's `useQuery`, using the shared client in
  `src/lib/query-client.ts`. Follow the pattern in
  `src/components/slides/embedded-demo-workflow/components/server-health-card.tsx`.
- The server base URL defaults to `http://localhost:8000`; override it with
  `VITE_SERVER_URL` (optional, e.g. in `.env.local`) when the server lives
  elsewhere. Never hardcode URLs and never put secrets/keys in client code —
  keep them server-side.
- The server runs locally with `cd server` then `uv run fastapi dev`. Note for
  the user: GitHub Pages is static, so server-backed demos only work when a
  server is reachable.

## Phase 4 — Dependencies

- Add any npm packages the demo needs to the **root** `package.json` (single app)
  and install. Reuse versions already present; avoid pulling in a second copy of
  something the deck already has.
- For Python deps, add them to the server's project config and `uv sync`.
- Prefer the lightest integration that works; don't add heavy global tooling for
  one slide.

## Phase 5 — Register and verify

- Add the slide to the `slides` array in `src/Presentation.tsx` (id, label,
  Component import, and `cycleItems` if it uses the cycle mechanic — else `0`).
- Keep responsive grids on a base `grid-cols-1` and add `min-w-0` where long
  strings/`truncate` appear, so the embedded demo doesn't overflow on phones.
- Verify at `http://localhost:5173/?slide=<slide-id>`: the demo renders and is
  interactive, the server route responds (if used), and there's no horizontal
  overflow. Run `npm run build` to typecheck and `npx prettier --write` on
  changed files.
