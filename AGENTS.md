# Agent Instructions

This project is a standalone HTML PPT deck for an ecommerce course presentation:

- Topic: `超商型智慧 3D 列印電商企劃`
- Format: fixed-stage HTML presentation
- Deck basis: `1600 x 900`
- Visual style: beige luxury editorial, minimal, thin-line, high whitespace

## Project Structure

- `index.html`: slide content, navigation script, AI Slide Adjuster hooks
- `deck.css`: all slide layout and visual styling
- `assets/`: images used by the deck
- `ai-slide-adjuster/`: local AI Slide Adjuster runtime
- `ecommerce-luxury-editorial.pdf`: exported PDF version

## Editing Rules

- Keep the deck portable as a standalone folder.
- Keep `.deck[data-deck-size="1600x900"]` and fixed `1600px x 900px` slide geometry.
- Keep every slide as `.slide[data-slide-id="slide-XX"]`.
- Preserve existing `data-ai-id` values unless a slide element is deliberately removed.
- Use `data-ai-id` on new editable slide elements.
- Do not use viewport-based layout inside slides such as `100vw` or `100vh`.
- Do not add shadows, gradients, saturated colors, or busy decorative elements.
- Preserve the beige editorial visual language:
  - background: `#F1ECE6`
  - content background: `#F7F7F2`
  - text: `#3F3F3E`
  - thin lines: `1px solid #5F5C5B`
  - small accents: `#AE8A65` or `#5E7A68`

## Content Guidance

- Keep the original `ecommerce_html_ppt` meaning and sequence unless the user asks for content changes.
- Prefer short, presentation-ready text over dense paragraphs.
- Use large images sparingly and keep screenshots contained in simple thin-line frames.
- Maintain generous whitespace and thin separators.
- Do not convert the deck into a general responsive website.

## Preview

From this directory:

```sh
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

For a clean export/preview without the AI Slide Adjuster:

```text
http://127.0.0.1:4173/?adjuster=off
```

## Verification

Run the HTML PPT verifier after edits:

```sh
node /Users/lawrencelee0113/.codex/skills/html-ppt-workflow/scripts/verify-deck.mjs /Users/lawrencelee0113/workspace/ecommerce-luxury-editorial --pdf /Users/lawrencelee0113/workspace/ecommerce-luxury-editorial/ecommerce-luxury-editorial.pdf
```

If the PDF was changed, confirm it still has 19 pages and 16:9 page size.

## PDF Export

Use Chrome headless with CSS page size:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new \
  --disable-gpu \
  --no-first-run \
  --no-default-browser-check \
  --hide-scrollbars \
  --force-color-profile=srgb \
  --print-to-pdf=/Users/lawrencelee0113/workspace/ecommerce-luxury-editorial/ecommerce-luxury-editorial.pdf \
  --print-to-pdf-no-header \
  "http://127.0.0.1:4173/?adjuster=off"
```

## Git

- Keep generated edits scoped to this project.
- Do not modify files outside this repository unless the user explicitly asks.
- Commit meaningful completed changes.
