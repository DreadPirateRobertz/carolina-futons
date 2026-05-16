# RED-MERGE Audit: cf-wv1s (PR #1355)

**Date:** 2026-05-16 04:15 MT  
**PR:** DreadPirateRobertz/carolina-futons#1355  
**Branch:** feat/cf-wv1s-dashboard-ur-sentry-live  
**Merged by:** DreadPirateRobertz (admin-merge)  
**Bead:** cf-wv1s (wire UR + Sentry live-API paths in dashboard.sh)  
**Audit bead:** cf-v6zo

## Violation

PR #1355 was admin-merged with CI **FAILING** on two required checks:

| Check | Outcome |
|-------|---------|
| test (20) | FAILURE |
| test (22) | FAILURE |
| lint | SUCCESS |
| element-id-sync | SUCCESS |
| hookup-assistant | SUCCESS |

This violates the Stilgar TDD mandate: **no PR may be merged with a failing test suite.**

## Root Cause

Dashboard.sh changes in cf-wv1s introduced regressions in test shards 20 and 22. The merge proceeded before the CI run completed or results were checked.

## Recovery

- **Recovery PR:** Dispatched to morgott. Must fix test20+test22 regressions, file TDD-first, post 5-agent review, verify ALL CI green before merge.
- **Audit bead:** cf-v6zo (P1, assigned morgott)
- **No further admin-merges with red CI.** Stilgar TDD mandate is non-negotiable.

## Process Failure

Admin-merge must not bypass failing CI. The merge-guard workflow passed (pin-head-sha) but does not block on test failures — CI results must be manually verified before every admin-merge.

**Going forward:** Before any `gh pr merge --admin`, verify `gh pr view <N> --json statusCheckRollup` shows SUCCESS on all non-skipped checks.
