# CI Silence Verification — 2026-05-05

**Bead:** cf-yj8u
**Owner:** millicent (cfutons/crew)
**Verifies:** PRs #1137 (carolina-futons) + #459 (carolina-futons-web) — Stilgar 2026-05-04 directive to silence noisy CI.

---

## Summary

| Acceptance criterion | Status |
| --- | --- |
| 1. Nightly run completes without email to carolinafutons@gmail.com | ⏳ **PENDING** — today's nightly hasn't fired yet |
| 2. No new Dependabot PRs since deletion of dependabot.yml | ⚠️ **ONE STRAGGLER** — #1142, then quiet |
| 3. Codecov GitHub App uninstalled (Stilgar owner-only) | ❓ **UNKNOWN** (effectively silent regardless) |
| 4. Pre-merge CI still surfaces lint/typecheck/test status in PR view | ✅ **PASS** |

---

## 1. Nightly email silence

Cron schedule: `0 6 * * *` UTC. GitHub Actions schedule drift typically lands the run between 07:00–08:30 UTC.

**Recent nightlies (most recent first):**

| Date (UTC) | SHA | Conclusion |
| --- | --- | --- |
| 2026-05-04 08:24 | d806315 | success |
| 2026-05-03 07:56 | 11ba4c2 | success |
| 2026-05-02 07:26 | 11ba4c2 | success |
| 2026-05-01 08:06 | 11ba4c2 | success |
| 2026-04-30 08:12 | 11ba4c2 | success |

**Status at audit time (07:33 UTC):** today's 2026-05-05 nightly has not yet fired. Once it does, it will run against the post-merge `ci.yml` (HEAD = `be3e1ae`, `2eeb3fb` then merged into main) which has no `dawidd6/action-send-mail` step. Expected behavior: GitHub Issue still opens on failure; **no email** to `carolinafutons@gmail.com`.

**Workflow file confirmation:**
```
$ grep -iE "codecov|action-send-mail|MAIL_USERNAME|carolinafutons@gmail" .github/workflows/ci.yml
(none — clean)
```

**File deletions confirmed on main:**
- `.github/codecov.yml` — gone
- `.codecov.yml` (root) — gone (caught in fixup commit `2eeb3fb`)
- `.github/dependabot.yml` — gone

**carolina-futons-web ci.yml:** had no codecov/email steps to begin with. `.github/dependabot.yml` removed in #459.

**Verification gap:** Cannot directly check `carolinafutons@gmail.com` inbox from this session. Recommend visual confirmation tomorrow (2026-05-06) that no `[CF CI] Nightly tests …` email arrives.

---

## 2. Dependabot stopped creating PRs

**Merge timeline:**
- carolina-futons-web #459 merged: 2026-05-05T03:02:15Z
- carolina-futons #1137 merged: 2026-05-05T06:50:26Z

**carolina-futons Dependabot PRs since #1137 merge:**

| # | Created | State | Title |
| --- | --- | --- | --- |
| 1142 | 2026-05-05T06:52:14Z | MERGED | bump axios from 1.15.0 to 1.16.0 in /packages/hookup-assistant |

**One PR opened ~2 minutes after #1137 merge.** Dependabot's own scan was likely already in-flight when `dependabot.yml` was deleted from main; the deletion does not retroactively cancel queued runs. Axios 1.16.0 release notes flag the upgrade as "security-adjacent" (redirect, abort, header fixes) — it is also possible this was triggered as a security update, which runs independently of `dependabot.yml`. Either way: **no further Dependabot PRs have appeared in the ~40 minutes since.**

**carolina-futons-web Dependabot PRs since #459 merge (03:02 UTC):** none. Open PR #392 (eslint bump) was created 2026-05-04T15:19, before the cleanup.

**Disposition:** straggler #1142 already merged. Watch over next 24–48h to confirm Dependabot scans have fully stopped. If new version-update PRs continue to appear, security-update mode may need to be disabled in repo settings (owner-only).

---

## 3. Codecov GitHub App uninstall

Cannot read GitHub App installations directly from this token (lacks the necessary scope; `/repos/:owner/:repo/installation` returns 401).

**Indirect signal:** PRs #1142, #1143 (both merged after #1137) show **no `codecov[bot]` comments and no `codecov/*` check runs**. Effectively silent regardless of whether the App is technically still installed — without `codecov-action@v5` uploading coverage, Codecov has nothing to comment on.

**Owner-only action item still outstanding:**
- Settings → Integrations → Applications → uninstall Codecov on both repos (cosmetic; no operational impact while uploads remain disabled).
- Settings → Secrets → Actions → delete `CODECOV_TOKEN` (cfutons), `MAIL_USERNAME`, `MAIL_PASSWORD` (cfutons).

---

## 4. PR check visibility (loud-in-GitHub, silent-in-email)

Sampled the two PRs merged after #1137:

**#1142 — bump axios (merged 2026-05-05T07:28Z)** — checks: `test (20)`, `test (22)`, `lint`, `hookup-assistant`, `element-id-sync`, `Analyze JavaScript` (CodeQL), `label`, `size-label`. Skipped: `nightly-integration`, `e2e-smoke` (correct — only run on schedule/dispatch).

**#1143 — fix(cf-9ieq) (merged 2026-05-05T07:05Z)** — same check set. `test (22)` reported FAILURE; PR was admin-merged anyway. Failure is unrelated to CI cleanup; flagged separately for Melania to triage if desired.

**Conclusion:** lint/typecheck/test status continue to surface on every PR. PRs are loud inside GitHub UI. ✅

---

## Outstanding items (owner-only)

For Chris (DreadPirateRobertz account, repo settings):

- [ ] **Verify carolinafutons@gmail.com inbox** receives no nightly email after 2026-05-06 ~07:00 UTC firing
- [ ] **Uninstall Codecov GitHub App** on both repos (Settings → Integrations)
- [ ] **Delete secrets** on carolina-futons: `CODECOV_TOKEN`, `MAIL_USERNAME`, `MAIL_PASSWORD`
- [ ] **Confirm GitHub account profile email** is not `cdeal@mines.edu` (Account → Emails) — token here lacks `notifications` scope
- [ ] **If Dependabot PRs reappear** after 48h, disable Dependabot security updates in Settings → Code security & analysis (per Stilgar directive — security feed is also "noise")

---

## Audit window

- Audit performed: 2026-05-05 07:33 UTC
- carolina-futons HEAD on main: post-merge of `be3e1ae` + `2eeb3fb` (PR #1137)
- carolina-futons-web HEAD on main: post-merge of `2d29c5a` (PR #459)
