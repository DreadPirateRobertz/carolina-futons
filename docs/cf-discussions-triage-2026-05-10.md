# GitHub Discussions triage — 2026-05-10

**Bead:** cf-qc7a
**Auditor:** rennala
**Method:** `gh api repos/DreadPirateRobertz/carolina-futons/discussions` + per-discussion comment fetch. cfw repo (`carolina-futons-web`) has Discussions disabled (HTTP 410 — confirmed via `gh api`).
**Scope:** every open discussion thread on the cfutons monorepo as of 2026-05-10.

## Summary

- **2 open discussions**, both informational sprint-summary threads from 2026-03-16 (~8 weeks stale).
- **Zero discussions need a response** — every thread is self-resolved by its OP via in-thread updates.
- **Both threads recommended for closure** to clear the open-discussions queue.
- **No new beads or PR-worthy work surfaced.**
- cfw repo: discussions feature disabled — no triage needed.

## Per-thread triage

### Discussion #383 — "v0.7.0 Test Coverage Milestone — 800+ new tests in one day"
- **URL:** https://github.com/DreadPirateRobertz/carolina-futons/discussions/383
- **Author:** @DreadPirateRobertz
- **Opened:** 2026-03-16T03:26 UTC
- **Comments:** 2 (both by OP)
- **Last activity:** 2026-03-16T06:20 UTC
- **Category:** sprint-summary / announcement
- **State (functional):** SELF-RESOLVED. OP's two follow-up comments report ongoing test-suite growth (17,404 tests / 413 files at last update) and confirm zero flaky tests. No reader question. No actionable item.
- **Action:** **recommend closure** — no further work needed. Suggest comment: "Closing as stale-resolved: announcement thread, all updates already posted by OP."

### Discussion #384 — "Shared test utility: extracting the $item mock factory"
- **URL:** https://github.com/DreadPirateRobertz/carolina-futons/discussions/384
- **Author:** @DreadPirateRobertz
- **Opened:** 2026-03-16T03:26 UTC
- **Comments:** 3 (all by OP)
- **Last activity:** 2026-03-16T06:14 UTC
- **Category:** technical-discussion / completed
- **State (functional):** **EXPLICITLY RESOLVED.** OP's last comment (2026-03-16T06:14) reads: *"Resolved — PR #401 merged the shared createItemScope helper. 4 files migrated (-460 lines)."* The proposed work shipped + merged.
- **Action:** **recommend closure** — explicitly resolved by the OP. Suggest closing with a "Resolved per PR #401" annotation.

## What this triage did NOT find

- No bug reports needing engineering attention.
- No feature requests needing PM input.
- No external-contributor questions waiting on a response.
- No threads tagged `help wanted` / `question` / `needs-triage`.

## Why responses weren't posted

Both threads are author-self-resolved announcements where the OP (the same human Stilgar / Chris) is the sole commenter. Posting "this is stale" or "this is resolved" comments on the OP's own threads as a different agent would clutter the timeline without adding signal. The right action is closure, which only the OP / repo admin can do — recommended below.

## Recommended actions for melania / Stilgar

1. **Close #383** with the comment: *"Closing — informational sprint-summary thread; current state captured in v0.7.0+ release notes."*
2. **Close #384** with the comment: *"Closing — resolved by PR #401 (createItemScope helper landed; 4 files migrated)."*
3. (Optional) If team wants future test-sprint summaries to live somewhere persistent, redirect to `docs/releases/` or an internal log so they don't accumulate as open Discussions.

## cfw repo note

`gh api repos/DreadPirateRobertz/carolina-futons-web/discussions` returns HTTP 410 "Discussions are disabled for this repo." Either intentional (Discussions feature off) or never enabled. If enabling Discussions on cfw is desired post-cutover (cf-3qt.8) for community engagement, that's a separate small bead. No action needed here.

## References

- cf-qc7a (this audit)
- Discussions API — REST: https://docs.github.com/rest/repos/discussions (read-only) + GraphQL for comment creation (intentionally not used here since no responses needed)
