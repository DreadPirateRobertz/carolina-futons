# Codecov Integration Audit — CF-7eop

**Date**: 2026-03-16
**Auditor**: godfrey

## Summary

Codecov is fully operational on the `carolina-futons` repo. PR comment bot posts coverage diffs, reports upload successfully, and tokens are configured in both repos.

## Findings

### carolina-futons (main repo)

| Check | Status | Notes |
|-------|--------|-------|
| CODECOV_TOKEN in GitHub Secrets | Pass | Set and active |
| CI uploads coverage (Node 20) | Pass | `codecov/codecov-action@v5` with `flags: unit` |
| Nightly CI uploads coverage | Pass | `flags: nightly` in nightly-integration job |
| Codecov bot posts PR comments | Pass | Verified on PRs #380, #381 |
| Coverage thresholds configured | Pass | lines 70%, branches 60%, functions 70% |
| `fail_ci_if_error: false` | Info | Coverage upload failure won't block CI |
| README badge | Added | `codecov.io/gh/DreadPirateRobertz/carolina-futons` |

### carolina-futons-stage3-velo (production repo)

| Check | Status | Notes |
|-------|--------|-------|
| CODECOV_TOKEN in GitHub Secrets | Pass | `CODECOV_TOKEN` set (separate from `CODECOV_TOKEN_STAGE3_VELO`) |
| CI runs | Fail | CI failing on recent runs (build/config issue, not Codecov-specific) |
| Coverage reporting | Unknown | Cannot verify until CI passes |

## Recommendations

1. **Stage3-velo CI**: Fix the build failures — coverage can't upload if CI fails before the coverage step.
2. **Coverage thresholds**: Consider raising from 70% to 80% as test count grows (currently 16,658 tests).
3. **Dashboard link**: https://app.codecov.io/gh/DreadPirateRobertz/carolina-futons

## Actions Taken

- Added Codecov badge to README.md
- Updated test count in README (12,993 → 16,658 across 409 files)
