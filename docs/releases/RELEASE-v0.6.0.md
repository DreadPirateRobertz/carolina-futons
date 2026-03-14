# Release v0.6.0

**Date:** 2026-03-14
**Since:** v0.5.0 (2026-03-14)
**PRs merged:** 25

## Highlights

- Element ID audit: 815 IDs across 14 pages for Velo nickname remap (CF-03jx)
- Product Videos page with 11 CF demo videos and category filters (CF-tuvk)
- CSS v7: 13 custom properties, collection card heading fix, mobile 480px breakpoints
- CI guard prevents sibling-repo import paths in tests (CF-sdlo)
- Mandatory testing procedure document for all crew
- Test suite grew from 12,847 to 13,380 tests (351 files)
- Getting It Home + Sale pages shipped

---

## Features (7)

| PR | Title |
|----|-------|
| #313 | Getting It Home page — delivery & assembly info |
| #314 | Sale page with TDD — helpers, page, and tests |
| #326 | Product Videos page with 11 CF demo videos (CF-tuvk) |
| #331 | CI guard for test import conventions (CF-sdlo) |
| #332 | Element ID audit for Velo nickname remap — 815 IDs (CF-03jx) |
| #319 | Mobile responsiveness — comprehensive 480px breakpoint |
| #324 | CSS custom properties — 13 brand tokens in :root |

## Fixes (12)

| PR | Title |
|----|-------|
| #315 | Correct JSDoc example and file headers per review |
| #327 | Announcement bar with full showroom address + phone |
| #330 | Footer hours alignment (Wed–Sat 10–5) |
| #333 | Collection card heading CSS — tame inflated h3 |
| — | Call-for-price products show CTA instead of $0/$1 price |
| — | Build errors — undefined refs in Category Page + exitIntentCapture |
| — | Footer cleanup — replace template tagline with copyright, fix social URLs |
| — | Banner message missing from getActivePromotion return |
| — | CSS: use [id$=] suffix match to bypass Wix wixui- prefix |
| — | CSS: hide template sections by component ID |
| — | CSS: header/footer background via colorUnderlay targeting |
| — | Mountain illustrations bold and visible |

## Tests (8)

| PR | Title |
|----|-------|
| #317 | 4 untested public helpers — 60 new tests |
| #320 | Page-level coverage for 7 complex pages — 234 tests |
| #321 | Page-level coverage for radahn pages |
| #322 | Video page coverage (godfrey) |
| #323 | Rennala page coverage |
| #325 | Newsletter page + 5 untested modules — 136 tests |
| #328 | Radahn page coverage batch 2 |
| #316 | Backend coverage (radahn) |

## Docs (3)

| PR | Title |
|----|-------|
| #329 | Test import path conventions (CF-sdlo) |
| #334 | Mandatory testing procedure for all crew |
| — | MASTER-HOOKUP + README stats update |

## Style (1)

| PR | Title |
|----|-------|
| #324 | CSS custom properties — 13 CF brand tokens |

---

## Stats

| Metric | v0.5.0 | v0.6.0 | Delta |
|--------|--------|--------|-------|
| Test files | 343 | 351 | +8 |
| Tests | 12,847 | 13,380 | +533 |
| Source files | ~90 | ~90 | — |
