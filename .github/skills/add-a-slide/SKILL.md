---
name: add-a-slide
description: Create a new slide in the webslides deck. Use when the user asks to "add a slide", "create a new slide", "insert a slide", or add a new topic/section to the presentation. Covers the slide folder, the SlideProps contract, registering it in the deck, and the layout/design rules to follow.
---

# Add a slide

A slide is a **self-contained mini-app**: one folder under
`src/components/slides/<slide-id>/` exporting a React component. The deck is just
an ordered list of these. Keep slides independent — a slide must never import
from another slide's folder.

You have full creative freedom over the slide's content, visuals, and
interactions. The phases below define only the contract and guardrails that keep
the deck consistent and unbreakable.

## Phase 1 — Name it

- Pick a **descriptive, kebab-case id** tied to the slide's topic, e.g.
  `pricing-overview`. This id is the folder name, the registry id, and the
  shareable URL (`?slide=pricing-overview`).
- Do NOT use positional names like `slide_1` / `slide-2`. Ids are stable handles
  so slides can be reordered or inserted without renumbering anything.
- Create `src/components/slides/<slide-id>/main.tsx`. Put any sub-components in
  `<slide-id>/components/` and static data in `<slide-id>/data/`.

## Phase 2 — Build the component

- Export a named component typed with `SlideProps`
  (`@/components/slides/types`):
  ```ts
  {
    (isActive, cycleIndex, cycleCount, onSelectCycle);
  }
  ```
- Wrap the slide in `SlideFrame` (`@/components/ui/slide-frame`) with an
  `eyebrow` and `title` so the header matches the deck. Put your content as its
  children.
- Compose from the shared primitives: `Card`, `Button`, `Badge`
  (`@/components/ui/*`) and the `cn` helper (`@/lib/utils`). Reach for these
  before writing bespoke markup.
- If a primitive you need doesn't exist yet, **add it to the shared UI system**
  (`src/components/ui`) following the existing pattern — theme tokens + `cva`
  variants like `Button`/`Badge` — and reuse it. Don't hand-roll a one-off for
  something reusable, and don't pull in a heavy dependency for a primitive you
  can add in a few lines.

DO:

- Keep everything for the slide inside its own folder.
- Use semantic theme tokens only (`bg-background`, `text-foreground`, `bg-card`,
  `border-border`, `bg-muted`, `text-muted-foreground`, `bg-primary` /
  `text-primary-foreground`, …). This keeps the deck monochrome and
  user-themeable.

DON'T:

- Hardcode hex/RGB colors or Tailwind palette colors (`bg-blue-500`, …). The
  only acceptable exception is a deliberate semantic signal (e.g. red for an
  error state) — and only when the user wants it.
- Steal focus, autoplay audio/video, or run timers/animations while
  `isActive === false`. All slides stay mounted (opacity crossfade), so gate any
  heavy or attention-grabbing side effect behind `isActive`.

## Phase 3 — (Optional) Interactive "cycle" cards

The deck has a built-in selection mechanic: **spacebar** advances a highlight
through a slide's cards, and **tap/click** selects one directly.

- If your slide has N selectable cards, render each with
  `onClick={() => onSelectCycle(index)}`, `cursor-pointer`, and an active style
  driven by `cycleIndex` (active = `border-primary`, idle = `border-border`).
- You'll set the count (`cycleItems: N`) in Phase 4. Use `0` if the slide has no
  selectable cards.

## Phase 4 — Register it in the deck

Edit `src/Presentation.tsx` and add an entry to the `slides` array where you want
it to appear (array order = deck order):

```ts
{
  id: "pricing-overview",          // must equal the folder name; URL slug
  label: "Pricing overview",        // human label (a11y / progress)
  Component: PricingOverview,        // imported from ./components/slides/<id>/main
  cycleItems: 0,                     // number of selectable cards from Phase 3
}
```

- Import the component at the top with the other slide imports.
- `cycleItems` MUST match the real number of selectable cards, or spacebar
  cycling desyncs.

## Phase 5 — Layout & responsiveness guardrails

These rules prevent the two failure modes that actually break slides:

- Any responsive grid MUST include a base single-column track, e.g.
  `grid grid-cols-1 … lg:grid-cols-2`. A bare `grid` collapses to an
  `auto`-sized column on phones and overflows horizontally.
- Add `min-w-0` to any flex/grid child that contains `truncate` text or long
  unbroken strings (file paths, URLs), otherwise it forces the layout wide.
- Design mobile-first; the slide scrolls vertically on small screens and swipe
  navigation is handled globally — don't add your own horizontal scroll.

## Phase 6 — Verify

- The dev server (`npm run dev`, port 5173) hot-reloads. Open
  `http://localhost:5173/?slide=<slide-id>` and confirm it renders, cycles, and
  has no horizontal overflow at a narrow width.
- Run `npm run build` to typecheck, then format changed files with
  `npx prettier --write`.
