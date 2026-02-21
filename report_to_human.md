# Story Manager Report — Cross-Rig Status

**Last Updated:** 2026-02-20 17:45 MST
**Role:** Story Manager (all rigs)
**Reporting to:** Mayor

---

## Executive Summary

6 active epics across 3 rigs. 3 P0, 3 P1. Reviewed and strengthened acceptance criteria on all P0 stories. Found critical issues requiring immediate attention.

### CRITICAL ISSUES

| # | Issue | Rig | Impact |
|---|-------|-----|--------|
| 1 | **furiosa NUKED** — cm-vx9 (Expo scaffold) orphaned, no polecat working it | cfutons_mobile | Entire mobile P0 epic stalled |
| 2 | **cf-c6u UNASSIGNED** — P0 smoke test, blocks tonight's testing | cfutons | Tonight's live test blocked |
| 3 | **cf-sc2 UNASSIGNED** — P0 placeholder images, blocks tonight's testing | cfutons | Tonight's live test blocked |
| 4 | **cm-330, cm-5wg, cm-wi5 UNASSIGNED** — P0 mobile blockers, no polecats available | cfutons_mobile | Mobile scaffold blocked after cm-vx9 |
| 5 | **cfutons polecats 54 & 55 NUKED** — could pick up cf-c6u/cf-sc2 if respawned | cfutons | Available capacity wasted |

---

## Epic Tracker

### P0 Epics

#### cf-4aj: Live Testing & Gallery Verification (cfutons) — TONIGHT
| Story | Priority | Status | Assignee | AC Reviewed |
|-------|----------|--------|----------|-------------|
| cf-qxo: Gallery hookup audit | P0 | IN_PROGRESS | polecat-56 | STRENGTHENED |
| cf-o1a: Lightbox & zoom smoke test | P0 | IN_PROGRESS | polecat-57 | STRENGTHENED |
| cf-c6u: Full user flow smoke test | P0 | **OPEN — UNASSIGNED** | — | STRENGTHENED |
| cf-sc2: Placeholder image verification | P0 | **OPEN — UNASSIGNED** | — | STRENGTHENED |

**Risk:** 2 of 4 blockers unassigned. polecat-54 and polecat-55 are nuked. Need respawn or crew assignment for cf-c6u and cf-sc2.

#### cm-821: Mobile App Scaffold & Design System (cfutons_mobile)
| Story | Priority | Status | Assignee | AC Reviewed |
|-------|----------|--------|----------|-------------|
| cm-vx9: Expo/RN scaffold | P0 | IN_PROGRESS | **furiosa (NUKED)** | Approved |
| cm-330: Design tokens & theme | P0 | OPEN — UNASSIGNED | — | STRENGTHENED |
| cm-5wg: Navigation (tab+stack) | P0 | OPEN — UNASSIGNED | — | STRENGTHENED |
| cm-wi5: Core component library | P0 | OPEN — UNASSIGNED | — | STRENGTHENED + dep added (needs cm-330) |

**Risk:** furiosa is dead. cm-vx9 work may be lost. 3 of 4 blockers unassigned. Need polecat respawn for this rig.

#### tb-ni1: ML Decision Intelligence Engine (tradingbot)
| Story | Priority | Status | Assignee | AC Reviewed |
|-------|----------|--------|----------|-------------|
| tb-bel: OHLCV data pipeline | P0 | IN_PROGRESS | onyx (spawning) | STRENGTHENED |
| tb-v8l: ML framework research | P0 | IN_PROGRESS | jasper (spawning) | STRENGTHENED |
| tb-91k: Train signal model | P0 | OPEN (blocked by bel+v8l) | — | Approved (excellent AC already) |

**Risk:** LOW. Both blocking stories have active polecats. tb-91k correctly blocked until dependencies close.

### P1 Epics

#### cf-47t: Site Polish & Bug Triage (cfutons)
| Story | Priority | Status | Assignee |
|-------|----------|--------|----------|
| cf-eo2: Design review | P1 | OPEN (ready) | — |
| cf-ez0: Performance audit | P2 | OPEN (ready) | — |

**Risk:** Low urgency. Waiting on P0 completion. Stories are ready when polecats free up.

#### cm-hv9: Core Mobile Shopping Experience (cfutons_mobile)
| Story | Priority | Status | Assignee |
|-------|----------|--------|----------|
| cm-8u2: Product detail screen | P1 | OPEN (blocked by cm-330, cm-vx9) | — |
| cm-rsl: Category navigation | P1 | OPEN (blocked by cm-vx9) | — |
| cm-t3b: Cart screen | P1 | OPEN (blocked by cm-vx9) | — |
| cm-w04: Product browsing grid | P1 | OPEN (blocked by cm-330, cm-vx9) | — |

**Risk:** All blocked on P0 scaffold. No action needed until cm-821 stories land.

#### tb-oeo: Enhanced Data Sources & Live Readiness (tradingbot)
| Story | Priority | Status | Assignee |
|-------|----------|--------|----------|
| tb-3qi: Extended paper trading | P1 | OPEN (blocked by tb-91k) | — |
| tb-bz0: Twitter/X sentiment API | P1 | OPEN (ready) | — |
| tb-vwx: On-chain whale tracking | P1 | OPEN (ready) | — |

**Risk:** Medium. tb-bz0 and tb-vwx are ready but no polecats available. Need assignment when tradingbot workers free up.

---

## Polecat Status

| Agent | Rig | State | Hook | Notes |
|-------|-----|-------|------|-------|
| polecat-54 | cfutons | **NUKED** | — | Available for respawn |
| polecat-55 | cfutons | **NUKED** | — | Available for respawn |
| polecat-56 | cfutons | spawning | cf-qxo | Working gallery audit |
| polecat-57 | cfutons | spawning | cf-o1a | Working lightbox test |
| furiosa | cfutons_mobile | **NUKED** | — | cm-vx9 orphaned |
| onyx | tradingbot | spawning | tb-bel | Working data pipeline |
| jasper | tradingbot | spawning | tb-v8l | Working ML research |

---

## AC Review Summary

**Reviewed:** All 13 P0 stories + 3 P0 epics across all rigs
**Strengthened:** 10 stories (added numbered, testable criteria)
**Approved as-is:** 3 stories (tb-91k had excellent quantitative AC already, cm-vx9 clear and testable, tb-bel already strong but still strengthened)
**Dependencies added:** cm-wi5 now formally depends on cm-330 (components need tokens)

### AC Standards Applied
- Every AC is numbered and testable (pass/fail)
- Behavioral ACs specify user interaction → expected result
- Audit ACs require documented output (matrix, checklist, beads)
- Epic ACs require all blocking stories closed before epic can close

---

## Recommended Actions for Mayor

1. **URGENT:** Respawn cfutons polecats 54+55 → assign cf-c6u and cf-sc2 (tonight's testing)
2. **URGENT:** Respawn cfutons_mobile furiosa (or new polecat) → check cm-vx9 progress, resume or restart
3. **MEDIUM:** Once tradingbot polecats finish, assign tb-bz0 and tb-vwx
4. **LOW:** After P0 epic closures, assign cf-eo2 and cf-ez0 (site polish)

---

*Story Manager: melania | Next review: on polecat completion or in 30 minutes*
