# Velo MCP E2E Verification Results

**Date:** 2026-03-07
**Bead:** CF-cloc
**Tester:** cfutons/crew/rennala

## Summary

| Tool | Status | Notes |
|------|--------|-------|
| velo_status | PASS | Auth confirmed, repo clean, tag v0.0.0 |
| velo_diff | PASS (bug) | Functional but includes node_modules in diff output — rsync excludes not applied |
| velo_sync | PASS | Tag validation works, synced v0.0.0 successfully, pushed to remote |
| velo_preview | EXPECTED FAIL | Wix token renewal broken — overseer aware, working on fix |
| velo_publish | PASS (safety gate) | Correctly refused publish due to failing tests in prod repo |
| velo_preview_stop | NOT TESTED | Depends on velo_preview succeeding first |
| Unit tests | PASS | 86/86 tests pass across 7 test files |

## Tool Details

### velo_status
- Auth: Logged in as chrisdealglass@gmail.com
- Wix CLI version: 1.1.164 (update available to 1.1.166)
- Repo: clean
- Deployed tag: v0.0.0
- Last commit: `06b480d docs: add detailed README`

### velo_diff (tag: v0.0.0)
- Tool executes and returns diff output
- BUG: rsync command includes node_modules, .wix/, and other excluded dirs in output
- Root cause: rsync include/exclude patterns in veloDiff.ts need fixing — current pattern `--include=src/***` doesn't properly exclude everything else when node_modules exists in the source worktree
- Recommendation: Fix exclude patterns or use git-based diff instead of rsync

### velo_sync (tag: v0.0.0)
- Tag validation correctly rejects non-semver refs (tested with "main" -> ERROR)
- Successfully synced v0.0.0: 3 files changed, 367 insertions
- Pushed to remote successfully
- Files synced: brand-colors.md, auditProductMedia.test.js, enrichProductImages.test.js

### velo_preview
- Failed with: "Failed to renew access token"
- This is the known Wix token issue the overseer flagged
- Tool implementation is correct — failure is external (Wix auth)

### velo_publish
- Pre-flight safety checks work correctly:
  - Dirty worktree check: would block (not triggered — repo was clean)
  - Test suite check: correctly blocked publish because prod repo tests are failing
- Did NOT attempt actual `wix publish` — blocked by test failures (correct behavior)

## MCP Server Health

- Server starts and responds to JSON-RPC initialize
- All 6 tools registered and discoverable via tools/list
- Protocol version: 2024-11-05
- Server info: wix-velo-mcp v0.0.0

## Blocking Issues

1. **Wix token renewal broken** — velo_preview and velo_publish (the actual wix publish step) cannot complete. Overseer is working on this.
2. **Prod repo test failures** — velo_publish safety gate correctly blocks, but tests need to pass before publish can work.
3. **velo_diff rsync noise** — Non-blocking but should be fixed. Diff output includes node_modules which makes it hard to read.

## Recommendations

1. Once overseer fixes Wix token: re-run velo_preview and velo_publish E2E tests
2. Fix velo_diff rsync excludes (separate bead)
3. Fix prod repo test failures so velo_publish can complete full flow
4. Update Wix CLI to 1.1.166 when convenient
