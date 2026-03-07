# Sprint Plan: Illustrations -> Frontend Features
**Date:** 2026-03-06
**PM:** melania
**Crew:** godfrey, miquella, radahn, rennala

## Phase 1: Clear the Deck (immediate)

| Member | Action | Bead |
|--------|--------|------|
| miquella | Review PRs #174 + #175 | — |
| godfrey | Finish P0 bug fix, open PR | cf-v0t |
| radahn | Continue BUILD-SPEC + JSDoc batch 2 | cf-65a, cf-b17 |
| rennala | Standby for PR feedback | hq-i6ep, cf-k3o |

Melania merges #174/#175 once reviews pass -> unblocks illustration pipeline.

## Phase 2: Illustration Pipeline (after #174 merges)

All 4 beads unblock when hq-i6ep (Figma design system) merges.

| Member | Bead | Scope |
|--------|------|-------|
| godfrey | cf-pdv (P1) | Comfort illustrations — 3 Product Page scenes |
| miquella | cf-g4f (P2) | About + Contact illustrations |
| rennala | cf-t3c (P2) | Empty state illustrations — 8 scenes |
| radahn | cf-aij (P2) | Cart + Onboarding illustrations |

## Phase 3: Frontend Features (as crew finishes illustrations)

Roll into frontend features as illustration beads close. Priority order:

1. **cf-fp01 Product Page UX** (P1) — variant stock, remind-me popup, gallery refinement
2. **cf-fp02 Category Page Filtering** (P1) — comfort filter, chips, review stars
3. **cf-fp03 Search Results** (P1) — autocomplete, filters, sorting, chips
4. **cf-fp04 Checkout Flow** (P2) — payment methods, afterpay, financing
5. **cf-fp05 Homepage Hero Polish** (P2) — featured modal, trust bar, newsletter

Assignment: first crew member done with illustrations gets #1, second gets #2, etc.

## Quality Standards (ALL phases, ALL crew)

- TDD: tests BEFORE implementation, all paths covered
- JSDoc on ALL public functions + module headers
- Comments explain WHY not WHAT, no unexplained abbreviations
- webMethod pattern, try/catch on all async, sanitize user input
- All colors from designTokens, zero hardcoded hex
- PR process: branch -> PR -> melania reviews -> merge
- Peer review pairs: miquella<->radahn, rennala<->godfrey

## Cross-Rig Sharing

Findings, patterns, and quality standards shared with:
- dallas (cfutons_mobile PM) — illustration pipeline, quality bar
- zhora (gastown PM) — JSDoc standards, lessons learned
