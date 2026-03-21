# CI Bot Health Report

**Audit date:** 2026-03-21
**Bead:** CF-dhzr
**Auditor:** cfutons/crew/miquella

All bots installed via CF-jyrq (PR #586, merged 2026-03-21T21:16Z).

---

## 1. Dependabot ✅

**Config:** `.github/dependabot.yml`
**Status:** HEALTHY

- Weekly Monday 08:00 ET schedule — first run will be 2026-03-23 (next Monday)
- PR #589 already created (2026-03-21T21:18Z) — Dependabot ran immediately on config push, not waiting for schedule. Correct behavior.
- PR #589 groups 4 dev-dep bumps (`@vitest/coverage-v8`, `@wix/cli`, `puppeteer`, `vitest`) into one PR per the `dev-dependencies` group config. Labels applied: `size/XL`, `dependencies`. ✅
- Major version bumps are ignored (config: `version-update:semver-major` excluded). ✅
- `open-pull-requests-limit: 10` set. ✅

**No issues found.**

---

## 2. CodeQL ✅ (with findings to review)

**Config:** `.github/workflows/codeql.yml`
**Status:** HEALTHY — scans completing, but findings present

- Triggers: push to `main`, PRs to `main`, weekly Monday 07:30 UTC. All working.
- Runs completing successfully (`security-extended` query suite). ✅
- Recent runs: all `success` (2026-03-21T22:34, 22:31, 22:29). ✅

**Findings:** 30 open alerts (from `gh api code-scanning/alerts`):

| Severity | Count | Notes |
|----------|-------|-------|
| error | 5 | XSS in `.wix.html` illustration assets |
| warning | 25 | `js/insecure-randomness` in `sanitize.js`, `js/file-access-to-http` in scripts, `js/incomplete-multi-character-sanitization` in test file |

**Error findings:** All 5 `js/xss` errors are in `src/assets/illustrations/*.wix.html` files (static illustration assets, not server-rendered code). These are likely false positives from CodeQL treating `.html` files as dynamic templates. **Action:** Review and dismiss if confirmed static assets; or add a CodeQL config to exclude `src/assets/illustrations/`.

**Warning findings:** `js/insecure-randomness` in `sanitize.js` — likely `Math.random()` usage. `js/file-access-to-http` in `scripts/provisionSecrets.js` and `scripts/photo-audit.mjs` — scripts that read local files and make HTTP calls (expected behavior for admin scripts). **Action:** Low priority; dismiss after review.

---

## 3. Codecov ✅

**Config:** `.github/codecov.yml`
**Status:** HEALTHY

- Coverage upload runs on `test (20)` job (Node 20 matrix leg only). ✅
- Node 22 matrix leg only runs `npm test` — no duplicate uploads. Correct. ✅
- Thresholds: project 90%, patch 85%. Match `vitest.config.js` thresholds (statements 90%, branches 85%). ✅
- `require_ci_to_pass: true` — Codecov errors fail CI. ✅
- `nightly` flag with `carryforward: true` — nightly integration coverage carries forward. ✅
- Upload step confirmed in last successful run (run ID 23390288602). ✅

**Note:** Badge not yet visible (Codecov needs at least one successful upload to generate badge URL). Will populate automatically after first coverage upload completes.

---

## 4. PR Labeler ✅

**Config:** `.github/labeler.yml` + `.github/workflows/labeler.yml`
**Status:** HEALTHY

- Triggers: PR opened/synchronize/reopened. ✅
- Path-based labels working: PR #600 correctly received `source` and `tests` labels. ✅
- Size labels working: PR #589 received `size/XL` (4 dependency bumps). PR #600 received `size/M`. ✅
- `fail_if_xl: false` — XL PRs are labeled but not blocked. ✅

**Gap found:** PR #564 (opened 2026-03-21T10:42Z, before CF-jyrq merged at 21:16Z) has no labels. Expected — labeler only applies to PRs opened/updated after it was installed. PRs predating the labeler will not be retroactively labeled.

**No config issues.**

---

## 5. CI Matrix: Node 20 + Node 22

**Status:** INTENTIONAL — both matrix legs are needed

- **Node 20:** runs full suite + coverage collection + Codecov upload
- **Node 22:** runs `npm test` only (no coverage) — validates compatibility with current LTS

Rationale: Node 22 became LTS in 2025. Running both ensures Wix Velo code doesn't use APIs that break between Node versions. The matrix is correct and non-redundant.

---

## 6. Nightly Integration Run

**Status:** NOT YET RUN (bots deployed today)

- Schedule: `0 6 * * *` (06:00 UTC daily)
- No `schedule` event runs visible in history — first nightly will fire 2026-03-22T06:00Z.
- `e2e-smoke` job is gated to `schedule || workflow_dispatch` events only — it will not block PRs. ✅

**E2E smoke note:** Recent `workflow_dispatch` runs of `e2e-smoke` are failing (4/6 tests, HTTP 404 errors against staging). This is a pre-existing issue unrelated to the bot setup — staging URLs may be stale. The `e2e-smoke` job is correctly not blocking PRs/pushes (`if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'`). Not a bot health issue, but worth a separate ticket to fix smoke test URLs.

---

## Summary

| Bot | Status | Issues |
|-----|--------|--------|
| Dependabot | ✅ Healthy | None — PR #589 correctly created |
| CodeQL | ✅ Healthy | 5 error-severity alerts in `.wix.html` assets (likely false positives) |
| Codecov | ✅ Healthy | Badge pending first upload; thresholds correct |
| PR Labeler | ✅ Healthy | Path + size labels working; pre-install PRs unlabeled (expected) |
| CI Matrix (20/22) | ✅ Correct | Both legs needed; no redundancy |
| Nightly integration | ⏳ Pending | First run 2026-03-22T06:00Z |

**Recommended follow-up:**
1. Dismiss or investigate the 5 `js/xss` CodeQL alerts in `src/assets/illustrations/` — likely false positives on static SVG/HTML assets.
2. Fix staging smoke test URLs (separate bead).
3. Check Codecov badge after first PR with coverage upload completes.
