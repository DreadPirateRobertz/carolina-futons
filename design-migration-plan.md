# CF Design Migration Plan — v2 Botanical → v3 Mascot+Bear

**Issued by:** Stilgar (site owner)
**Managed by:** Melania (PM)
**Date:** 2026-05-04
**Status:** ACTIVE — immediate execution

---

## Directive Summary

Remove all v2 botanical/lineart illustrations site-wide. Wire in v3 mascot/bear scenes as replacements. Preserve all bear + animal character work (V1/V2/V3 iterations). No regressions on live routes.

---

## Quick Wins — Orphaned Components (No Active Routes)

Delete immediately. No page audit required. No replacement needed.

| Component | Notes |
|---|---|
| `BlueRidgeTimeline` | No active route |
| `MountainSkyline` | No active route |
| `FooterMountainDivider` | No active route (mascot version already exists) |
| `StargazingHero` (in `illustrations/`) | Experimental `/theme-c` only — not a main route; mascot version wired in `mascot/` |

**Assigned:** radahn  
**Acceptance:** Components deleted, no build errors, no 404s on live routes.

---

## Phase 0 — Already Done (Verify Only)

| Item | Status |
|---|---|
| `BotanicalFooterDivider` | Removed via PR #398 — ✅ done |
| `MascotFooterDivider` | Exists but NOT in layout — **wire it in** |

**Action:** Import `MascotFooterDivider` from `@/components/mascot/MascotFooterDivider` into layout.tsx between `</main>` and `<Footer />`.

**Assigned:** millicent  
**Acceptance:** Footer renders mascot divider on all pages.

---

## Phase 1 — High-Traffic Pages

**Target:** `/shop/[category]` PLPs  
**Priority:** Highest

### Component Mapping

| Old Component | Page | New v3 Replacement |
|---|---|---|
| `FutonsCategory` | `/shop/futons` | `MascotCategoryCard` (already wired) — verify no old import |
| `MurphyCategory` | `/shop/murphy-beds` | `MascotCategoryCard` — verify |
| `PlatformCategory` | `/shop/platform-beds` | `MascotCategoryCard` — verify |
| `MattressesCategory` | `/shop/mattresses` | `MascotCategoryCard` — verify |

**v3-mascot spots** (`v3-mascot-01` → futon, `v3-mascot-02` → murphy, `v3-mascot-03` → platform, `v3-mascot-04` → mattresses) for PLP header spots if needed.

**Assigned:** godfrey  
**Acceptance:** Zero botanical category imports in `/shop/[category]/page.tsx`.

---

## Phase 2 — Editorial + Marketing Pages

### Scene-to-Page Canonical Map

| Scene File | Page | Semantic Logic |
|---|---|---|
| `v3-01-porch.svg` | `/about` hero | Welcome, brand home — bear on mountain porch |
| `v3-02-stargazing.svg` | `/design-a-room` | Dreaming/planning your space |
| `v3-03-cabin.svg` | `/visit` | Physical place — come find us |
| `v3-04-reading.svg` | `/guides` | Knowledge, reading content — direct match |
| `v3-05-falls.svg` | `/reviews` | Flowing, natural energy |
| `v3-06-fog.svg` | `/contact` + `/press` | Quiet, approachable |

### Old → New Mapping

| Old Component | Page | New Replacement |
|---|---|---|
| `BotanicalMountainSkyline` | `/about` hero | `v3-01-porch.svg` scene |
| `BotanicalTimeline` | `/about` timeline | Character vignettes from `v3-characters.jsx` |
| `TeamPortrait` | `/about` | Remove — use character ensemble |
| `ContactHero` | `/contact` + `/press` | `v3-06-fog.svg` scene |
| `BotanicalVisitUs` | `/visit` | `v3-03-cabin.svg` |
| `BotanicalGuides` | `/guides` | `v3-04-reading.svg` |
| `BotanicalReviews` | `/reviews` | `v3-05-falls.svg` |
| `BotanicalDesignARoom` | `/design-a-room` | `v3-02-stargazing.svg` |
| `LivingSky` | `/spring-sale` | `VintageSunRays` (already wired) |

### Crew Assignments

| Crew | Scope |
|---|---|
| **rennala** | `/about` (hero, timeline, team portrait — 3 components) |
| **blaidd** | `/contact` + `/press` (shared ContactHero → fog scene) |
| **miquella** | `/visit` + `/design-a-room` |
| **morgott** | `/guides` + `/reviews` |

---

## Phase 3 — Empty States + Error Pages

| Old Component | Location | New Replacement |
|---|---|---|
| `EmptySearchIllustration` | `/search` empty | Bear spot from `v3-mascot-spots.jsx` |
| `EmptyCartIllustration` | Cart empty state | `v3-mascot-02.svg` or `v3-mascot-03.svg` spot |
| `CartIllustration` | Cart populated | Remove or minimal mascot spot |
| `NotFoundIllustration` | 404 page | `v3-02-stargazing.svg` (lost but peaceful) |

**Assigned:** millicent  
**Acceptance:** 404, empty search, empty cart render mascot replacements — QA at 375px/768px/1280px.

---

## Cleanup Pass — Post All Phases

**Assigned:** radahn

- Delete all remaining files in `src/components/illustrations/` no longer imported anywhere
- Grep-verify zero active imports of every removed component
- Remove dead CSS scoped to removed components
- Archive `design-harvest/` SVG sources to `/public/design-assets/` or similar permanent location

---

## Crew Assignment Summary

| Crew | Scope |
|---|---|
| **radahn** | Quick wins (orphan deletes) + final cleanup pass |
| **millicent** | Phase 0 (footer wire-in) + Phase 3 (empty states, 404) |
| **godfrey** | Phase 1 (PLP category cards) |
| **rennala** | Phase 2 — `/about` |
| **blaidd** | Phase 2 — `/contact` + `/press` |
| **miquella** | Phase 2 — `/visit` + `/design-a-room` |
| **morgott** | Phase 2 — `/guides` + `/reviews` |

---

## Sequencing

```
Quick Wins (radahn)      — no deps, start immediately
Phase 0 (millicent)      — no deps, start immediately
Phase 1 (godfrey)        — after Phase 0 footer confirmed
Phase 2 (all 4 crew)     — parallel, no inter-deps
Phase 3 (millicent)      — parallel with Phase 2
Cleanup (radahn)         — after all phases complete
```

---

## Global Acceptance Criteria (Stilgar Sign-Off)

- [ ] Zero botanical/lineart components render on any live route
- [ ] All v3 scenes wired per canonical scene-to-page map
- [ ] `MascotFooterDivider` live in layout footer
- [ ] All four PLPs render mascot category cards
- [ ] 404, empty search, empty cart render mascot replacements
- [ ] `src/components/illustrations/` cleaned of all removed components
- [ ] Build passes, zero TypeScript errors
- [ ] No visual regressions at 375px / 768px / 1280px
- [ ] All bear + animal character assets preserved — nothing deleted from `src/components/mascot/`

---

*Plan owner: Melania | Escalate blockers to Stilgar.*
