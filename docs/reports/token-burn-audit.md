# Token Burn Audit — cfutons Rig
**Auditor:** radahn | **Period:** 2026-02-23 to 2026-02-28 | **Report Date:** 2026-02-27

## Executive Summary

The cfutons rig has been highly productive this period: **30 PRs merged** (29→58), **4,607 tests passing** (up from 3,200), 126 test files. One PR open (#58). Two tests currently failing (memoryLeaks.test.js). Production rate is strong across active crew. Main waste vectors: witness bead proliferation, stale report, uncleaned branches.

---

## Per-Crew Production Metrics (2026-02-23 → 2026-02-28)

| Crew Member | Commits | PRs Opened | PRs Merged | Beads Closed | Role |
|-------------|---------|------------|------------|--------------|------|
| **cfutons/refinery** | 24 | 18 | 18 | ~18 | Automated pipeline |
| **miquella** | 10 | 3 (#53,#54,#58) | 1 (#54) | ~2 | Executor |
| **melania** | 9 | 0 | 0 | — | PM/coordinator |
| **radahn** | 8 | 1 (#57) | 1 (#57) | CF-d7dr | Executor + reviewer |
| **godfrey** | 5 | 1 (#56) | 1 (#56) | CF-3qj3, CF-1b86 | Executor |
| **rennala** | 4 | 2 (#52,#55) | 2 (#52,#55) | cf-8iy, CF-wy0m | Executor |
| **cfutons/witness** | 4 | 0 | 0 | — | Patrol watchdog |
| **caesar** | 1 | 0 | 0 | — | Executor (prior cycle) |

### Efficiency Rankings (code commits per session)

1. **cfutons/refinery** — 24 commits. Highest raw output but automated; no token cost comparison applicable.
2. **miquella** — 10 commits, 3 PRs. Good volume but PR #53 was closed/wasted (replaced by rennala's #52). PR #58 still open.
3. **melania** — 9 commits. PM role — reports, test fixes, coordination. Token spend is coordination overhead (acceptable).
4. **radahn** — 8 commits, 1 PR merged + 3 PR reviews. Lean sessions, focused output.
5. **godfrey** — 5 commits, 1 PR (2 fixes bundled). Efficient.
6. **rennala** — 4 commits, 2 PRs merged. Solid ratio.
7. **witness** — 4 commits, patrol only. See waste section.

---

## Waste Identification

### 1. Witness Bead Proliferation (HIGH)
**Impact:** Database clutter, slows `bd list`, wastes auditor time.
- **38 wisp-wisp beads** in the database from patrol cycles
- Each patrol cycle creates sub-beads (inspect polecats, check timers, inbox hygiene, etc.)
- These are transient operational tasks stored as permanent beads
- **Recommendation:** Witness should NOT create beads for routine patrol cycles. Use logs instead. Or auto-close patrol beads on cycle completion.

### 2. Duplicate/Wasted PR (MEDIUM)
**Impact:** One wasted session worth of tokens.
- PR #53 (miquella) was closed without merge — same work done by rennala in PR #52
- Both were public utils audits (cf-8iy)
- **Root cause:** Lack of coordination — two agents claimed same bead
- **Recommendation:** Melania should enforce single-assignment per bead. `bd update --owner` must be checked before starting work.

### 3. Stale Report (MEDIUM)
**Impact:** Human overseer has outdated information.
- `report_to_human.md` last meaningfully updated 2026-02-22
- Current data shows crew that no longer exist (architect, brainstorm)
- Missing: latest sprint (Feb 27 batch merge of 18 PRs), current test count (4,607)
- **Recommendation:** Report must be updated every session by melania or active crew.

### 4. Uncleaned Remote Branches (LOW)
**Impact:** Repo clutter, minor git overhead.
- **28 feature branches** still on origin after PR merge
- All merged PRs should have branches deleted
- **Recommendation:** Enable GitHub auto-delete on merge, or add branch cleanup to PR merge protocol.

### 5. Failing Tests (MEDIUM)
**Impact:** 2 tests failing in memoryLeaks.test.js — quality gate broken.
- `galleryHelpers: initImageLightbox returns cleanup` — 2 failures
- These are from rennala's PR #55 (memory leak fixes) — likely a regression
- **Recommendation:** Must be fixed before any new PR merges. Assign immediately.

---

## Test Suite Health

| Metric | Value |
|--------|-------|
| Total tests | 4,609 (4,607 pass, 2 fail) |
| Test files | 126 (125 pass, 1 fail) |
| Growth since Feb 23 | +1,409 tests, +38 files |
| Duration | 2.67s |
| Failing | memoryLeaks.test.js (2 tests) |

---

## Recommendations to Mayor

1. **Fix witness bead spam** — 38 patrol beads cluttering DB. Switch to log-based patrol or auto-close.
2. **Fix 2 failing tests** — memoryLeaks.test.js regression. Assign to rennala (authored the PR).
3. **Update report_to_human.md** — stale since Feb 22. Assign to melania.
4. **Enable branch auto-delete** on GitHub repo settings.
5. **Enforce bead ownership** — prevent duplicate work (miquella/rennala overlap on cf-8iy).
6. **Close PR #58** or merge it — miquella's CF-ax12 rollup has been open since Feb 28 01:25.

---

## Standing Observations

- **Refinery is the workhorse** — 24 commits, 18 PRs. Automated pipeline is the highest-ROI token spend.
- **Crew agents are lean** — 4-10 commits per session is appropriate for the work scope.
- **Melania overhead is justified** — PM coordination prevents more waste than it costs (the miquella/rennala overlap happened when coordination broke down).
- **Report cadence needs enforcement** — human overseer relies on report_to_human.md.
