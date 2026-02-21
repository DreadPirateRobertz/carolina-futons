# Story Manager Report — Cross-Rig Status

**Last Updated:** 2026-02-20 18:30 MST
**Role:** Story Manager (all rigs: cfutons, cfutons_mobile, tradingbot, gastown)
**Reporting to:** Mayor / Human

---

## Sprint Health Dashboard

| Rig | Health | Open | In-Progress | Closed | P0 Status | Key Risk |
|-----|--------|------|-------------|--------|-----------|----------|
| **cfutons** | GREEN | 22 | 4 | 3 | cf-4aj: 2/4 done, 2 in-progress with active polecats | Brainstorm flooding backlog (18 new beads) |
| **cfutons_mobile** | RED | 17 | 1 | 0 | cm-821: 0/4 done, furiosa nuked | No active workers, zero velocity |
| **tradingbot** | GREEN | 14 | 2 | 6 | tb-ni1: tb-91k now in-progress, both deps merged | Good momentum |
| **gastown** | YELLOW | 19 | 0 | 2 | No P0s, 5 P1 bugs (build/test/race) | Build broken by ICU dependency |

---

## Active Assignments (Monitoring)

### Polecats
| Agent | Bead | Status | Output Quality | Notes |
|-------|------|--------|----------------|-------|
| polecat-56 | cf-qxo (gallery audit) | WORKING | GOOD | Found real bug: `initImageLightbox`/`initImageZoom` called with string selectors instead of `$w()` elements. Branch pushed. AC items 1-2 addressed, 4-5-8 pending. |
| polecat-57 | cf-o1a (lightbox test) | WORKING | Pending | No branch pushed yet. Monitoring. |

### Crew
| Agent | Bead | Status | AC Verified | Notes |
|-------|------|--------|-------------|-------|
| caesar | cf-l31 (structured data) | IN_PROGRESS | YES — strengthened: 8 testable criteria, review schema scoped out, files identified | Was brainstorm idea with vague AC. Now has clear scope: Product + FAQ schema only, no reviews until platform exists. |
| radahn | cf-b9o (shared design tokens) | IN_PROGRESS | YES — strengthened: 9 testable criteria, architecture decided (plain JSON, not npm package) | Was brainstorm idea. Resolved open question: JSON file format, not git submodule. |
| algo (tradingbot) | tb-91k (train ML model) | IN_PROGRESS | YES — excellent quantitative AC already (>55% directional accuracy) | P0 critical path — unblocked after tb-bel + tb-v8l merged. |
| quant (tradingbot) | tb-nxs (mean reversion) | IN_PROGRESS | YES — strengthened: signal frequency target, profit factor > 1.0 | Using my strengthened AC with quantitative thresholds. |

---

## Brainstorm Triage (44 beads total)

### Priority Adjustments Made
| Bead | Change | Rationale |
|------|--------|-----------|
| cf-d3u | P2 → **P1** | Abandoned cart recovery = highest-ROI action. 5-15% recovery rate. Backend already built. |
| tb-f2i | P2 → **P1** | MCP server is force multiplier. Makes every tradingbot bead AI-manageable. |
| cm-0au | P2 → **P3** | Mobile app has no screens yet. Offline catalog is premature optimization. |
| cf-zl7 | P2 → **P3** | Blocked by physical video production. Not actionable until content exists. |

### Dependencies Added
| Bead | Now Depends On | Why |
|------|---------------|-----|
| cm-gmo (checkout) | cm-t3b (cart screen) | Cart must exist before checkout |
| cm-ke0 (style quiz) | cm-w04 (product browsing) | Home screen must exist |
| cm-qtp (push alerts) | cm-8u2 (product detail) | "Watch" button lives on product page |
| cm-u59 (swatch viz) | cm-8u2 (product detail) | Component lives on product detail |

### Cross-Rig Overlaps Flagged
| Cluster | Beads | Action |
|---------|-------|--------|
| Swatch kit | cf-5w9 (web) + cm-u59 (mobile) | Both have $5 swatch purchase. Shared fulfillment backend needed. |
| Mean reversion / pairs | tb-nxs (P1) + tb-1dt (P2) | Spread-based MR mentioned in both. tb-1dt may partially resolve tb-nxs. |
| Regime + strategy | tb-zfw → tb-1dt | Regime detection should come first (affects all strategy weights). |
| Email + reviews | cf-d3u (P1) + cf-g94 (P2) | Review request email is part of post-purchase sequence. Coordinate. |

### AC Quality Issues Fixed
| Bead | Issue | Fix |
|------|-------|-----|
| cf-tpy (AfterShip) | Vague on carriers, SMS ETA | Specified carriers (FedEx/UPS/USPS), removed vague SMS, added fallback |
| cf-l31 (structured data) | Review schema mixed in | Scoped out reviews, identified files, added edge case tests |
| cf-b9o (shared tokens) | Architecture undecided | Resolved: plain JSON, not npm/submodule |

### Brainstorm Quality Assessment
**Overall: GOOD.** Ideas are well-structured with AC, realistic cross-rig thinking. Two quality issues:
1. Tendency to include future/aspirational features in otherwise scoped stories (cf-l31 reviews, cm-ke0 collaborative filtering)
2. Some P2s should be P3 (physical content deps, premature optimization)

Funnel working correctly. brainstorm is a net positive — just needs triage oversight.

---

## Velocity Tracking

| Rig | Closed This Session | Merged | In-Progress | Ready |
|-----|---------------------|--------|-------------|-------|
| cfutons | 3 | direct push | 4 | 5 |
| tradingbot | 6 | via refinery | 2 | 5 |
| cfutons_mobile | 0 | — | 1 (orphaned) | 3 |
| gastown | 2 | — | 0 | 0 (bugs need assignment) |
| **Total** | **11** | | **7** | **13** |

---

## Risk Register

| Risk | Prob | Impact | Mitigation | Status |
|------|------|--------|------------|--------|
| cfutons_mobile stalls (no workers) | HIGH | HIGH | Need polecat respawn for cm-vx9 | OPEN |
| Brainstorm backlog grows faster than capacity | MEDIUM | MEDIUM | Triage protocol active, P3/P4 parked | MITIGATED |
| gastown build broken (ICU dep) | MEDIUM | HIGH | Build tags or brew install | OPEN |
| Cross-rig token divergence (web vs mobile) | MEDIUM | LOW | cf-b9o in progress (radahn) | MITIGATED |
| report_to_human.md contention (brainstorm overwrites) | LOW | LOW | Separated to STORY-MANAGER-REPORT.md | RESOLVED |

---

## Quality Gates Status

| Gate | Status | Details |
|------|--------|---------|
| Definition of Ready | ACTIVE | Applied to cf-l31, cf-b9o (both failed initial DoR, now passing) |
| Definition of Done | ACTIVE | Monitoring polecat-56/57 outputs against AC |
| AC Standards | ACTIVE | 27+ stories strengthened, all P0/P1 stories have numbered testable AC |
| Bug Report Standard | ACTIVE | All gastown bugs now have repro steps + AC |
| Brainstorm Triage | ACTIVE | 44 beads triaged, 4 priority adjustments, 4 deps added, 3 ACs fixed |

---

## Recommended Actions

### Immediate
1. **Respawn cfutons_mobile polecat** — cm-vx9 is orphaned, entire rig stalled
2. **Monitor polecat-56 branch** for remaining AC items (pages 4-5, audit doc)
3. **Monitor polecat-57** for first output

### This Sprint
4. Assign gastown P1 bugs (gt-7px, gt-axm, gt-0fz, gt-0de, gt-xox)
5. When cf-4aj closes: start cf-d3u (email automation, newly promoted P1)
6. When cm-821 closes: start cm-hv9 stories

### Next Sprint
7. tb-zfw (regime detection) before tb-1dt (pairs trading)
8. cfutons P2 extraction tasks (cf-072, cf-4ef, cf-a9q)
9. gt-ar2 dashboard improvements (after bugs fixed)

---

*Story Manager: melania | 57 stories across 4 rigs under management*
*Quality framework: STORY-MANAGEMENT.md | Brainstorm triage: active*
*Next review: on polecat completion*
