---
name: theming
description: Re-theme the webslides deck and swap the account logo. Use when the user asks to "theme", "rebrand", "change the colors", "match our brand", "apply <company>'s look", "use this palette/screenshot/website", or "set the account logo". Extracts a palette from a reference (image, website, company brand, or described colors) and applies it to the design tokens, and replaces the account logo when one is provided or requested.
---

# Theming

This is usually the **first** thing a user does with the template: it ships
monochrome on purpose so it can be rebranded in one pass. Theming means two
independent things, do whichever the user asked for:

1. **Palette** — rewrite the CSS design tokens in `src/index.css`.
2. **Account logo** — replace the "Account" mark in the brand lockup.

Everything in the deck reads from semantic tokens, so a correct palette edit
re-skins every slide and primitive at once. You have creative latitude in
choosing exact shades; the phases below are the guardrails that keep contrast
and structure intact.

## Phase 1 — Read the intent and the source

Figure out two things before touching files:

- **Palette source.** It may be: an attached image/screenshot, a website URL, a
  company/brand name, an explicit list of colors, or just a vibe ("warm and
  editorial", "dark terminal"). If it's a URL or company and you can't see it,
  use web tools to find the brand's primary colors. If it's an image, sample the
  dominant + accent colors from it.
- **Logo intent.** Did the user attach a logo, ask for one, or not mention it?
  This decides Phase 4. Don't touch the logo if they only asked for colors.

If the source is genuinely ambiguous (e.g. "make it pop" with no reference and
no described direction), ask **one** focused question. Otherwise proceed and
state the palette you derived.

## Phase 2 — Derive the palette

Map the source to this token set. Tokens are **HSL channel triplets**
(`H S% L%`), consumed as `hsl(var(--token))` — never write `hsl(...)` or hex
*into* the variable value.

Required pairs (each `*-foreground` must stay legible on its base):

- `background` / `foreground` — page surface + primary text.
- `card` / `card-foreground`, `popover` / `popover-foreground` — raised surfaces.
- `primary` / `primary-foreground` — the brand/accent color used for active
  states, selected cycle cards, filled buttons. This is the main "color" knob.
- `secondary` / `secondary-foreground`, `muted` / `muted-foreground` — quiet
  surfaces + secondary text.
- `accent` / `accent-foreground` — secondary emphasis.
- `destructive` / `destructive-foreground` — error styling.
- `border`, `input`, `ring` — hairlines + focus ring (usually a tint of
  foreground or primary).
- `--radius` — only change if the user wants rounder/sharper corners.

DO:

- Keep a clear lightness gap between `background` and `foreground`
  (aim for a strong contrast, WCAG AA body text or better).
- Keep `muted` close to `background` and `border` a subtle step from it.
- For a **colored** theme, it's fine to put the hue on `primary`/`accent`/`ring`
  and keep surfaces near-neutral (tinted greys) — this reads as "branded" without
  becoming a rainbow.
- For a **monochrome** rebrand (e.g. a different mono like warm greys), keep
  saturation at/near `0%` and only move lightness.

DON'T:

- Rename tokens, restructure `:root`, or change `tailwind.config.ts` — the token
  names are the contract every slide depends on. Only edit
  `tailwind.config.ts` if you are *adding* a brand-new token the user needs.
- Recolor the intentional semantic signals (the red server-error dot, the green
  health dot) unless the user explicitly asks — they're deliberate, not part of
  the neutral palette.
- Introduce hardcoded hex/RGB in slide components. All color flows through tokens.

If the user wants a dark theme, set the `:root` values to the dark palette
directly (simplest), or add a `.dark { … }` block mirroring every variable and
apply `class="dark"` — only do the latter if they want a runtime toggle.

## Phase 3 — Apply the palette

- Edit the `:root` block in `src/index.css`, replacing the triplet values in
  place. Keep the same variable names and order.
- After editing, sanity-check three high-traffic combinations render legibly:
  filled button (`primary` on `primary-foreground`), selected cycle card
  (`border-primary` on `card`), and muted helper text (`muted-foreground` on
  `background`/`card`).

## Phase 4 — Account logo (only if attached or requested)

The brand lockup is `src/components/ui/brand-lockup.tsx`: it shows
`microsoft.svg` × `account.svg`. The **Microsoft** mark is the platform brand —
leave it. You only swap the **Account** side (`src/assets/account.svg`), which
is currently a placeholder.

- **Logo attached:**
  - If it's an **SVG**, overwrite `src/assets/account.svg` with its markup
    (keep the filename so the existing import just works).
  - If it's a **raster** (png/jpg/webp), save it as `src/assets/account.<ext>`
    and update the import + `src` in `brand-lockup.tsx` to point at it. Update
    the `alt` text from `"Account"` to the brand name, and the lockup's
    `aria-label` accordingly.
  - Make sure it reads well at ~20px tall against the deck background; if the
    logo has its own padding/box, trim or rely on `object-contain` (already
    applied).

- **No logo attached but the user asked for one:** try to source an appropriate
  mark first — e.g. the referenced company's official logo/wordmark via web
  tools, saved into `src/assets/`. If you can't find something clean and
  correct, **ask the user to attach a logo** rather than inventing or shipping a
  low-quality one.

- **Logo not mentioned:** don't touch the lockup.

> Respect brand/trademark usage — only use a company's real logo when the user
> is clearly theming *their own* brand or explicitly requested it. Don't
> fabricate a fake version of a real brand's mark.

## Phase 5 — Verify

- `npm run dev` (port 5173) hot-reloads. Open the deck and click through a
  couple of slides: confirm text stays legible, active/selected states use the
  new `primary`, and nothing fell back to an unreadable contrast.
- If you changed `brand-lockup.tsx` or added an asset, run `npm run build` to
  typecheck, then `npx prettier --write` on changed files.
- Briefly tell the user the palette you applied (and the logo source, if any) so
  they can fine-tune.
