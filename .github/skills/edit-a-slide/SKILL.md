---
name: edit-a-slide
description: Modify an existing slide in the webslides deck. Use when the user asks to "edit a slide", "change/update/tweak a slide", adjust copy, layout, styling, or interactions on a slide, reorder slides, or rename/remove one. Covers how to locate the slide and the rules that keep edits safe.
---

# Edit a slide

Each slide is a self-contained folder under `src/components/slides/<slide-id>/`.
Edit only that folder for content/visual changes; touch `src/Presentation.tsx`
only for deck-level changes (order, id, registration). You keep full creative
freedom over content and design — the phases below just keep edits safe.

## Phase 1 — Locate the slide

- The id is in the URL: `?slide=<slide-id>`. The slide lives at
  `src/components/slides/<slide-id>/main.tsx`, with sub-components in
  `components/` and data in `data/`.
- If the user pointed at an element in the browser, match its visible text to
  the JSX in that slide's files.
- The deck order, ids, labels, and `cycleItems` are defined in the `slides`
  array in `src/Presentation.tsx`.

## Phase 2 — Make the change

Scope your edit to the smallest surface that fully satisfies the request.

DO:

- Keep the slide wrapped in `SlideFrame`; edit `eyebrow`/`title`/children rather
  than rebuilding the header.
- Reuse the shared primitives (`Card`, `Button`, `Badge`, `cn`) and existing
  patterns in the slide for consistency. If the change needs a primitive that
  doesn't exist yet, add it to the shared UI system (`src/components/ui`) in the
  existing style (theme tokens + `cva` variants) and use it — rather than a
  one-off or a new heavy dependency.
- Use semantic theme tokens (`bg-card`, `border-border`, `text-muted-foreground`,
  `bg-primary`, …) so the slide stays monochrome and themeable.

DON'T:

- Hardcode colors or introduce off-theme palette classes (one exception:
  intentional semantic states like red for errors, when requested).
- Refactor or restyle parts the user didn't ask about, or change the global
  design system / UI primitives to fix one slide.

## Phase 3 — Keep invariants intact

These are the things that silently break a slide if ignored:

- **Cycle count**: if you add or remove selectable cards, update that slide's
  `cycleItems` in `src/Presentation.tsx` to match, and keep each card's
  `onClick={() => onSelectCycle(index)}` + active style (`border-primary` vs
  `border-border`) consistent with its index.
- **Responsiveness**: keep a base `grid-cols-1` on responsive grids and
  `min-w-0` on flex/grid children holding `truncate`/long strings — removing
  these reintroduces horizontal overflow on phones.
- **Always-mounted**: slides render even when inactive (opacity crossfade). Gate
  timers, autoplay, and focus changes behind `isActive`.
- **Ids are contracts**: changing a slide's `id` changes its shareable URL. Only
  rename when asked, and update the `slides` entry. Reordering = move the array
  entry (don't renumber anything; ids are positional-free by design).
- **Removing a slide**: delete its folder AND its `slides` entry (and the
  import). Don't leave dead references.

## Phase 4 — Verify

- Dev server hot-reloads on save (`http://localhost:5173/?slide=<slide-id>`).
  Confirm the change, that cycling still works, and that there's no horizontal
  overflow at a narrow width.
- Run `npm run build` to typecheck and `npx prettier --write` on changed files.
