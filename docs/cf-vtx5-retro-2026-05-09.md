# cf-vtx5 cluster retro — 2026-05-09

**Bead**: cf-z68o
**Author**: radahn
**Cluster scope**: cf-vtx5 (root), cf-yvs4 (audit), cf-hpb2, cf-bkxh, cf-0h9q

## TL;DR

22 cfw→Velo `/_functions/<module>/<method>` routes silently returned 404 in production. Stilgar's e2e thread ("wishlist not persisting", spin-grants not crediting, etc.) all rooted here. Fixed under P0 admin-merge override. Post-merge 6-agent audit surfaced an IDOR in `post_submitSurvey`, the `cf-tvbi` lying-status pattern reintroduced across all 22 routes, and zero test coverage despite a reference test pattern being available from rennala's earlier merge.

The fix shipped fast and resolved the user-visible symptom. The audit found everything we'd hope a pre-merge review would find. Net: emergency-merge protocol worked, but two systemic gaps (test coverage gating, lying-status pattern recurring) should be hardened.

## Timeline

| Time (MT) | Event |
|---|---|
| Pre-cluster | cf-jqkg surfaced webMethods missing HTTP wrappers (cfw→Velo gap audit). Did not enumerate the missing 22. |
| 2026-05-09 ~early | rennala shipped `post_wishlistService` reference dispatcher impl as PR #1164 with companion test (`wishlistServiceDispatcher.cfvtx5.test.js`). |
| 2026-05-09 mid | godfrey opened PR #1168 — 5 module dispatchers covering 19 sub-paths + 2 explicit gap wrappers (`post_recordSpinGrant`, `post_submitSurvey`). 263 lines added, 0 deletions, 0 tests. |
| ~T | radahn dispatched 6-agent pre-pass on PR #1168 per Stilgar PR-discipline directive. |
| ~T+5 min | melania merged PR #1168 under admin override on P0 user-impact urgency, before radahn's audit completed. Stage3-velo mirror PR #24 also merged. |
| ~T+15 min | code-simplifier returned (1st of 6). 6 alignment findings vs reference impl. |
| ~T+18 min | pr-test-analyzer + comment-analyzer returned. Both independently flagged `post_submitSurvey` IDOR. Test coverage = 0 of 22. |
| ~T+22 min | silent-failure-hunter returned. cf-tvbi lying-status pattern reintroduced across all 22 routes. |
| ~T+24 min | type-design-analyzer returned. Confirmed envelope-shape divergence. |
| ~T+28 min | code-reviewer returned. Confirmed IDOR with line citations + fix snippet. |
| ~T+30 min | radahn synthesis: filed cf-yvs4 (P0) consolidating findings, mailed verdict "FIX-FU" to melania. |

## What went well

1. **Fast unblock.** 19 silent 404s in prod ⇒ real user pain (wishlist not persisting, spin-grants not crediting). Admin-merge collapsed merge-window from "wait for full review" to "ship now, audit follows" and the user-facing symptom resolved within the same session.

2. **6-agent audit caught everything.** Independent agents on different lanes converged on the same critical finding (IDOR flagged by 4 of 6 reviewers without coordination). The cf-tvbi lying-status pattern, which we paid to remove from `get_deliveryZone` in cf-89xn earlier the same day, was caught despite being structurally subtle.

3. **Reference impl pattern.** rennala's PR #1164 set the test/dispatch shape. Findings could be expressed as "diverges from reference at X" rather than abstract design critiques.

4. **Followup-bead pattern worked.** melania's "audit becomes post-merge bead" protocol gave a clear handoff target (cf-yvs4 → godfrey). No findings dropped on the floor.

## What went wrong

1. **PR shipped with 0 of 22 tests.** rennala's reference test file (`wishlistServiceDispatcher.cfvtx5.test.js`) had been merged days before — godfrey's PR could have copied it 22 times mechanically. The IDOR would have been caught by a single test asserting "submitting another member's survey returns 403". Cost: a security gap in production until cf-yvs4 ships.

2. **cf-tvbi lying-status pattern recurred within hours.** The cf-89xn followup explicitly carried the recommendation to backport `get_deliveryZone`'s envelope discipline (200 → 503 on `internal_error`) to canonical so the next sync wouldn't reintroduce it. cf-vtx5 reintroduced the same pattern on 22 routes the same day. The recommendation was filed but not yet acted on; the convention exists in code only at one site.

3. **Admin-merge skipped the auth-shape verification.** The IDOR was visible in the JSDoc-vs-implementation diff (the JSDoc claimed an ownership check; the code didn't have one). A pre-merge skim wouldn't have needed deep context to catch it — but the user-impact pressure compressed review time below that threshold.

4. **Bead ID was placeholder ("cf-??") in the assignment nudge.** Minor process friction — radahn had to file the retro bead self-referentially. Cluster retros that show up after the fact are easier to staff if the dispatcher pre-files an empty bead.

## Recommendations

### P0 — would have prevented the IDOR

**Add an automated pre-merge test-coverage gate for new dispatcher routes.** When `src/backend/http-functions.js` gains a new `post_*` or `get_*` export, CI should require a companion `tests/<name>.http.test.js` or `tests/<name>Dispatcher.cfvtx5.test.js` with at minimum:
- Auth-required path returns 401 when unauthenticated
- Auth-required path returns 403 when authenticated as a non-owner (covers IDOR by default)
- Happy path returns 200 with expected envelope
- Unknown method returns 404 with `success: false` envelope
- Body parse failure returns 400 with `success: false` envelope

A `package.json` script + simple grep diff against `git diff main -- src/backend/http-functions.js` is enough — no new tooling. The IDOR test is 12 lines and would have failed on godfrey's PR before merge.

### P1 — would have prevented the lying-status recurrence

**Promote `_veloDispatch` to enforce the envelope discriminant.** When the underlying webMethod returns `{ success: false, error }`, the dispatcher must surface a non-2xx status (400 for known errors, 500 for unexpected). This is one if-statement in the shared helper; it removes the pattern from 22 routes at once and prevents the next 22 from inheriting it.

Add a focused unit test on `_veloDispatch` specifically (separate from the per-module tests) so the envelope contract is pinned at the dispatcher layer.

### P2 — small process tweaks

**Pre-file empty followup beads on emergency merges.** When melania admin-merges with intent to audit-after, opening the followup bead at merge time (with placeholder description) gives the auditor a target to commit findings into and saves the dispatch round-trip.

**Codify the "reference impl exists, copy its test" expectation.** A one-line note on PR templates pointing at the most recent reference impl in the same surface area (e.g. for new HTTP dispatchers: "test pattern in `tests/<reference>.cfvtx5.test.js`") nudges the contributor without requiring reviewer enforcement.

## Non-recommendations

- **Don't add review-time SLAs that block emergency merges.** The admin-override path here was correct given prod user-impact. The 30-minute window for the 6-agent audit was an acceptable cost; making the merge wait would have left wishlist/spin/survey broken for users in the meantime.

- **Don't expand the 6-agent suite by default for routine dispatcher PRs.** The audit's value here came from the production-impact stakes. For routine PRs the existing CR pre-pass shape (3-4 agents on diff scope) is right-sized.

## Cluster status as of retro

| Bead | Status | Owner | Note |
|---|---|---|---|
| cf-vtx5 | merged via #1168 | godfrey | 19 silent 404s resolved |
| cf-yvs4 | open P0 | godfrey | IDOR + lying-status + 0/22 tested — this retro's actionables |
| cf-hpb2 | open P2 | godfrey | referralService rename decision |
| cf-bkxh | open P2 | godfrey | giftRegistry dispatcher (probe-surfaced) |
| cf-0h9q | in progress P1 | godfrey | submitCommunityPhoto wrapper |

cf-yvs4 is the urgent thread — IDOR fix-window matters. The other followups are routine sweep work.
