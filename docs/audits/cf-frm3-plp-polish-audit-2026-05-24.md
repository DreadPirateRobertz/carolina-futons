# cf-frm3: PLP Card Polish Audit
**Date:** 2026-05-24  
**Auditor:** cfutons/crew/millicent  
**PLPs audited:** /shop/futon-frames · /shop/murphy-cabinet-beds · /shop/platform-beds  
**Viewport tested:** 1280×800 (desktop) · 390×844 (mobile)  
**Site:** https://carolina-futons-web.vercel.app

---

## Summary

| Dimension | futon-frames | murphy-cabinet-beds | platform-beds |
|---|---|---|---|
| Products | 22 | 9 | 9 |
| Card size (desktop) | 355×435px | 355×435px | 355×435px |
| Image aspect ratio | 1:1 | 1:1 | 1:1 |
| Grid gap (desktop) | 24px | 24px | 24px |
| Grid gap (mobile) | 24px | 24px | 24px |
| Sub-category filter chips | ✅ 5 chips | ❌ none | ❌ none |
| Sale/New badges | ❌ none | ❌ none | ❌ none |
| Editor's Picks section | ✅ (Kingston/Sedona/Asheville) | ❌ none | ❌ none |
| Price range dash style | `$N – $N` (en-dash + spaces) | `$N – $N` | `$N – $N` |
| CTA | Quick view only | Quick view only | Quick view only |

---

## Issue 1: Missing prices on Editor's Picks cards (P3 — bug)

On `/shop/futon-frames`, the "Where most people start" Editor's Picks section shows three cards:
- **Kingston Futon Frame** — price renders correctly: `$619 – $699`
- **The Sedona Full Futon** — **no price rendered** (empty)
- **The Asheville Full Futon** — **no price rendered** (empty)

The same products in the main grid below do render prices. This is a data-binding issue specific to the Editor's Picks component variant. The Sedona and Asheville are likely single-SKU or have no fallbackPrice in that slot.

→ Filed: **cf-frm3-f1** (see follow-on beads below)

---

## Issue 2: Single-variant price omits `.00` decimals (P3 — inconsistency)

All single-price products omit `.00`:

| PLP | Product | Price shown |
|---|---|---|
| futon-frames | Winter Futon Frame | `$779` |
| futon-frames | Trelli Futon Frame | `$773` |
| murphy-cabinet-beds | Murphy Cube Cabinet Bed | `$1,898` |
| murphy-cabinet-beds | Sagebrush Murphy Cabinet Bed | `$2,878` |
| murphy-cabinet-beds | Ranchero Murphy Cabinet Bed | `$2,978` |
| murphy-cabinet-beds | Poppy Murphy Bed Cabinet | `$2,958` |
| murphy-cabinet-beds | Clover Murphy Bed Cabinet | `$2,598` |
| murphy-cabinet-beds | Daisy Murphy Bed Cabinet | `$2,798` |
| platform-beds | Folding Platform Bed | `$199` |
| platform-beds | Charleston Platform Bed | `$319` |
| platform-beds | Nomad Platform Bed | `$259` |
| platform-beds | Ekko Platform Bed | `$249` |

Range prices render consistently as `$N – $N` (en-dash with surrounding spaces).  
The `.00` omission is intentional per the fallbackPrice utility convention (see cf-6zba), but needs a decision: unify everywhere or document as intentional.

→ Filed: **cf-frm3-f2** (follow-on: decision bead)

---

## Issue 3: No Sale/New badge layer exists on any PLP (P3 — missing feature)

Zero badge/tag elements found across all 3 PLPs. Products on sale or newly added have no visual indicator. The DOM has no `[class*="badge"]`, `[class*="sale"]`, or `[class*="new"]` elements anywhere in the product grid.

This means:
- Sales-priced products look identical to full-price products
- New arrivals are indistinguishable from existing catalog
- No strike-through original price shown alongside sale price

→ Filed: **cf-frm3-f3** (follow-on: add badge component)

---

## Issue 4: Sub-category filter chips absent on Murphy + Platform Beds (P4 — inconsistency)

`/shop/futon-frames` has a sub-category nav (`All`, `Front Loading & Nesting`, `Wall Huggers`, `Unfinished Wood`, `Rustic Log`) with clear active state styling (filled navy pill: `bg-cf-navy text-white`).

`/shop/murphy-cabinet-beds` and `/shop/platform-beds` have **no sub-category filter chips** despite having categorizable inventory (e.g., cabinet beds by size/brand, platform beds by height/material).

→ Filed: **cf-frm3-f4** (follow-on: add chips to murphy + platform)

---

## Issue 5: Price range filter uses bare spinbutton inputs (P4 — UX)

All 3 PLPs use plain `<input type="number">` spinbuttons for min/max price filtering. This is functional but visually inconsistent with the pill/chip aesthetic used for sub-category filters. A slider or styled range-pill input would match the design language better.

---

## Dash Treatment: CONSISTENT ✅

Range prices across all 3 PLPs use en-dash (`–`, U+2013) with a space on each side: `$709 – $759`. No bare hyphens found. No inconsistency detected on this dimension.

---

## Card + Grid Consistency: CONSISTENT ✅

All three PLPs are pixel-identical on structure:
- **Desktop**: 3-column grid, 24px gap, 355×435px cards, 355×355px 1:1 images
- **Mobile (390px)**: Single-column, 24px gap preserved

No aspect-ratio drift, no grid-gap inconsistency between PLPs.

---

## CTA Visual Weight: ONE VARIANT ONLY

All cards use "Quick view: [Name]" as the only CTA. There is no "View details" primary CTA. For products with no Quick View (or in the Editor's Picks section), the entire card is a link. The Quick View button is visually subtle (appears on hover on desktop). No primary/secondary CTA distinction exists between featured and non-featured cards.

---

## Follow-on Beads Filed

| ID | Priority | Title |
|---|---|---|
| cf-vglx | P3 | fix(cfw): Editor's Picks on futon-frames PLP — Sedona + Asheville render no price |
| cf-gm5d | P3 | polish(cfw): Decide/unify single-variant price `.00` treatment (cf-6zba follow-on) |
| cf-30d5 | P3 | polish(cfw): Add Sale/New badge layer to PLP product cards |
| cf-lrm9 | P4 | polish(cfw): Add sub-category filter chips to Murphy + Platform Beds PLPs |
