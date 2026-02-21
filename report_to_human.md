# Story Manager Report — Cross-Rig Status

**Last Updated:** 2026-02-20 18:15 MST
**Role:** Story Manager (all rigs: cfutons, cfutons_mobile, tradingbot, gastown)
**Reporting to:** Mayor / Human

---

## Sprint Health Dashboard

| Rig | Health | Open | In-Progress | Closed | P0 Status | Key Risk |
|-----|--------|------|-------------|--------|-----------|----------|
| **cfutons** | GREEN | 5 | 2 | 3 | cf-4aj: 2/4 blockers done, 2 in-progress | Polecats 54+55 nuked |
| **cfutons_mobile** | RED | 8 | 1 | 0 | cm-821: 0/4 blockers done, furiosa nuked | No active workers |
| **tradingbot** | YELLOW | 8 | 0 | 6 | tb-ni1: tb-91k unblocked, needs assignment | Both polecats done, no one picking up tb-91k |
| **gastown** | YELLOW | 16 | 0 | 2 | No P0s, but 5 P1 bugs (build/test/race) | Build broken by ICU dependency |

---

## Critical Issues

| # | Severity | Issue | Rig | Action Needed |
|---|----------|-------|-----|---------------|
| 1 | P0 | **tb-91k UNBLOCKED** — both deps (tb-bel, tb-v8l) closed. P0 story ready, no one assigned | tradingbot | Assign polecat or crew immediately |
| 2 | P0 | **cm-vx9 ORPHANED** — furiosa nuked, Expo scaffold work status unknown | cfutons_mobile | Respawn polecat, assess cm-vx9 progress |
| 3 | P1 | **gastown build broken** — ICU dependency (gt-7px / gt-axm) blocks test execution | gastown | Fix or build-tag around ICU |
| 4 | P1 | **cfutons_mobile has zero workers** — no polecats, crew artemis+tester idle | cfutons_mobile | Spawn polecats for cm-330, cm-5wg, cm-wi5 |

---

## Velocity Tracking

| Rig | Stories Closed (this session) | Merged | Notes |
|-----|-------------------------------|--------|-------|
| cfutons | 3 (cf-c6u, cf-eo2, cf-sc2) | direct push | Polecats 56+57 still working |
| tradingbot | 6 (tb-bel, tb-v8l, tb-ekg, tb-vxm, tb-vsx + onyx agent) | via refinery | Both P0 blockers DONE |
| cfutons_mobile | 0 | — | Stalled — furiosa nuked |
| gastown | 2 (gt-05r, gt-m58) | — | Slow — many open bugs |
| **Total** | **11** | | |

---

## Epic Tracker

### P0 Epics

#### cf-4aj: Live Testing & Gallery Verification (cfutons)
| Story | Status | Assignee | Hill | AC |
|-------|--------|----------|------|-----|
| cf-c6u: Full user flow smoke test | CLOSED | — | 5/5 | Approved |
| cf-sc2: Placeholder image verification | CLOSED | — | 5/5 | Approved |
| cf-o1a: Lightbox & zoom test | IN_PROGRESS | polecat-57 | 3-4/5 | Strengthened |
| cf-qxo: Gallery hookup audit | IN_PROGRESS | polecat-56 | 3-4/5 | Strengthened |

**Status:** 2/4 done. 2 in-progress with active polecats. Epic close depends on polecat-56 and polecat-57 completing.

#### cm-821: Mobile App Scaffold & Design System (cfutons_mobile)
| Story | Status | Assignee | Hill | AC |
|-------|--------|----------|------|-----|
| cm-vx9: Expo scaffold | IN_PROGRESS | furiosa (NUKED) | ?/5 | Approved |
| cm-330: Design tokens | OPEN | — | 0/5 | Strengthened |
| cm-5wg: Navigation | OPEN | — | 0/5 | Strengthened |
| cm-wi5: Core components | OPEN (blocked by cm-330) | — | 0/5 | Strengthened |

**Status:** 0/4 done. Stalled. furiosa dead, 3 stories unassigned, cm-wi5 now correctly blocked by cm-330.

#### tb-ni1: ML Decision Intelligence Engine (tradingbot)
| Story | Status | Assignee | Hill | AC |
|-------|--------|----------|------|-----|
| tb-bel: OHLCV pipeline | CLOSED (merged) | onyx (done) | 5/5 | Strengthened |
| tb-v8l: ML framework research | CLOSED (merged) | jasper (done) | 5/5 | Strengthened |
| tb-91k: Train signal model | **READY** | **UNASSIGNED** | 0/5 | Approved |

**Status:** 2/3 done. tb-91k is UNBLOCKED and ready for pickup. This is the critical path.

### P1 Epics

#### cf-47t: Site Polish & Bug Triage (cfutons)
- Blocked by cf-ez0 (P2 perf audit). cf-eo2 (design review) already closed.
- Ready for work when P0 testing wraps up.

#### cm-hv9: Core Mobile Shopping Experience (cfutons_mobile)
- All 4 stories blocked on cm-vx9 and/or cm-330. No action until P0 scaffold lands.

#### tb-oeo: Enhanced Data Sources & Live Readiness (tradingbot)
- tb-bz0 (Twitter API) and tb-vwx (whale tracking) are READY, no assignee.
- tb-3qi blocked by tb-91k. New stories: tb-6ft (ML integration), tb-nxs (mean reversion), tb-opn (trailing stops) — all need assignment.

---

## Polecat & Agent Status

| Agent | Rig | State | Hook | Output |
|-------|-----|-------|------|--------|
| polecat-54 | cfutons | NUKED | — | Available for respawn |
| polecat-55 | cfutons | NUKED | — | Available for respawn |
| polecat-56 | cfutons | spawning | cf-qxo | Working gallery audit |
| polecat-57 | cfutons | spawning | cf-o1a | Working lightbox test |
| furiosa | cfutons_mobile | NUKED | — | cm-vx9 orphaned |
| onyx | tradingbot | COMPLETED | — | tb-bel done + merged |
| jasper | tradingbot | COMPLETED | — | tb-v8l done + merged |
| brainstorm | cfutons | idle | — | Filed 3 ideas (see triage below) |
| algo | tradingbot | idle | — | — |
| tester | tradingbot | idle | — | Filed tb-1tl bug |
| artemis | cfutons_mobile | idle | — | — |

**Team utilization:** 2/11 agents actively working. 4 nuked/completed. 5 idle. Significant underutilization.

---

## Quality Gates Established

See **STORY-MANAGEMENT.md** for full framework. Key gates:

1. **Definition of Ready** — 9-point checklist. No story starts without passing.
2. **Definition of Done** — 6-point checklist. No story closes without meeting all criteria.
3. **AC Standards** — numbered, testable, binary pass/fail. Three formats: checklist, Given/When/Then, scenario.
4. **Bug Report Standard** — steps to reproduce, expected vs actual, severity, evidence.
5. **Merge Checklist** — tests cover changes, no lint warnings, AC approved before work started.
6. **Hill Chart Progress** — 5-position tracking (Started → Approach found → Validated → Building → Done).

---

## Brainstorm Triage

| Bead | Title | Author | Decision | Rationale |
|------|-------|--------|----------|-----------|
| cf-7ik | ML-powered product recommendations | brainstorm | DEFER (P3) | Needs tradingbot ML infra first, no analytics data yet |
| cf-b9o | Shared design tokens web+mobile | brainstorm | REFINE (P2) | Good idea, blocked by cm-330 and cf-a9q landing first |
| gt-3bz | Prometheus/OTel metrics | brainstorm | DEFER (P3) | Premature — fix P1 bugs before observability |

**Brainstorm quality:** Good. Ideas are well-structured with AC. Realistic cross-rig thinking (cf-b9o linking web+mobile tokens). Tendency to propose P3 moonshots — funnel is working correctly.

---

## AC Review Scorecard (All Rigs)

| Rig | Total Stories Reviewed | AC Added/Strengthened | Dependencies Fixed | Junk Cleaned |
|-----|----------------------|----------------------|-------------------|-------------|
| cfutons | 8 | 6 | 1 (cm-wi5→cm-330) | — |
| cfutons_mobile | 7 | 4 | 1 (cm-wi5→cm-330) | — |
| tradingbot | 10 | 7 | — | — |
| gastown | 16 | 10 | 3 (gt-bvk→race fixes) | 3 (--help junk closed) |
| **Total** | **41** | **27** | **5** | **3** |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| cfutons_mobile stalls completely (no workers) | HIGH | HIGH | Respawn furiosa or spawn new polecats |
| tb-91k sits unassigned while polecats are done | HIGH | HIGH | Immediately assign to crew/algo or spawn polecat |
| gastown build stays broken (ICU dep) | MEDIUM | HIGH | Build tags to skip ICU in tests, or install headers |
| Brainstorm floods backlog with low-priority ideas | LOW | MEDIUM | Triage protocol in place, melania reviews all |
| Cross-rig token divergence (web vs mobile) | MEDIUM | LOW | cf-b9o (shared tokens) queued after prerequisites |

---

## Recommended Next Sprint Priorities

### Immediate (next hour)
1. Assign tb-91k to crew/algo or spawn tradingbot polecat — P0 critical path
2. Respawn cfutons_mobile polecat for cm-vx9 (check if work survived)
3. Wait for polecat-56 and polecat-57 to close cf-qxo and cf-o1a

### This session
4. Once cf-4aj closes: start cf-47t (site polish) — assign cf-ez0
5. Once cm-vx9 closes: spawn polecats for cm-330, cm-5wg, cm-wi5
6. Assign tb-bz0 and tb-vwx to tradingbot workers

### Next sprint
7. Fix gastown P1 bugs (gt-7px/gt-axm ICU, gt-0fz/gt-l0e/gt-tvl races, gt-xox test)
8. cfutons P2 refactoring (cf-072, cf-4ef, cf-a9q extraction tasks)
9. gt-ar2 dashboard improvements (after bugs fixed)

---

*Story Manager: melania | All 41 stories across 4 rigs reviewed and quality-gated*
*Framework: STORY-MANAGEMENT.md (DoR, DoD, AC standards, hill charts)*
*Next review: on polecat completion or 30 minutes*
