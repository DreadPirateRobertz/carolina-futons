# cfw PR Triage — 2026-05-15 Stilgar Morning Batch

**Operator:** millicent (cfutons/crew, dispatched by melania)
**Run:** 2026-05-15
**Repo:** `DreadPirateRobertz/carolina-futons-web`
**Open PR count:** 28 (numbers #540, #552–#576, #485, #136)
**Source:** `gh pr list --state open --json number,title,headRefName,mergeable,mergeStateStatus,statusCheckRollup`

## TL;DR — Stilgar's GO order

🚨 **First action**: fix `SaleLightbox.test.tsx:217`. **One pre-existing test failure on cfw main is blocking the entire 7-PR docs/dependabot batch** (#568–575 except #570, #569). Until this lands, **none of those 7 PRs are mergeable** even after admin approval — they'll re-inherit the same red check on every push.

After the SaleLightbox fix:

| Wave | PRs (in order) | Why this wave |
|---|---|---|
| **Wave 0 — unblock** | fix SaleLightbox + open small fixup PR | All 7 FAILING PRs share this single root cause |
| **Wave 1 — P1 cutover-critical** | #576 (cf-r9r3 scroll/flash), #570 (cf-bbo8 PDP+PLP canonical), #569 (cf-89fb +8 static canonicals), #540 (cf-jo07 logo) | Cutover SEO + brand fidelity |
| **Wave 2 — P2 infra/SEO** | #565 (cf-ukc6.1 ratchet-exclude — meta-saving), #554 (cf-x6ph /api/health), #485 (cf-r192 server-only wix-client), #136 (cf-93rb design-tokens), #561, #562 (gating to server-only), #555, #558 (a11y aria fixes), #564 (cleanup), #560 (postcss override) | All CI-clean, just need admin review |
| **Wave 3 — P2 SEO/OG** | #556, #557, #559, #566, #567 (openGraph + twitter, popup wiring, hashing) | Lower urgency, CI-clean |
| **Wave 4 — P2 a11y/test/docs** | #552, #553, #563 (hq-psmi state-cleanup, fixture-OFF E2E, a11y smoke) | Test/infra, batch-mergeable |
| **Wave 5 — P2 docs** | #571–575 (cf-tqwn day-30, cf-4f6l rollback, cf-2r02 master checklist, cf-v8jj day-1, cf-5f9o post-mortem), #568 (dependabot next bump) | Doc-only; unblock with Wave 0 SaleLightbox fix |

## Headline finding — Wave 0 unblock

**7 PRs are FAILING on `lint-typecheck-test` with an identical root cause**:

```
FAIL  src/components/site/__tests__/SaleLightbox.test.tsx > "writes a dismiss timestamp to localStorage"
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name `/close sale popup/i`
Ignored nodes: comments, script, style
<body>
  <div />
</body>
```

The `SaleLightbox` component has `aria-label="Close sale popup"` at line 225 — the markup is correct. The test's `openLightbox()` helper is rendering empty DOM in the "writes a dismiss timestamp" case (line 215–222), but rendering correctly in the immediately-preceding `Escape key closes` and `backdrop is clicked` cases. **Looks like an order-dependent test isolation regression**, possibly Vitest 4 + testing-library interaction.

`beforeEach(() => localStorage.clear())` is already in place, so the obvious cause is not the cause.

Affected: **#568, #569, #571, #572, #573, #574, #575** (7 of 28 PRs).

**Recommend P0 fix bead** before Stilgar starts the morning approval pass. Without this fix, even admin-overriding the failing check produces a dirty merge that prevents follow-up CI from going green.

## Per-PR table

Sorted P1 → P2, then by PR number.

### P1 — cutover-critical

| PR | Bead | Title (truncated) | CI | mergeState | Verdict | Notes |
|---:|---|---|---|---|---|---|
| **#540** | cf-jo07 | restore CF logo in header (full + shrunken) | 3✓ 1pending | BLOCKED | **CI-CLEAN, admin review needed** | Visual confirm needed (Stilgar) |
| **#569** | cf-89fb | extend cf-bbo8 canonical to 8 static routes | 1✓ 1✗ 2pending | BLOCKED | **FAILING — SaleLightbox shared cause** | Wave-0 prereq; otherwise mergeable |
| **#570** | cf-bbo8 | add alternates.canonical to PDP + PLP pages | 1✓ 1pending | **DIRTY** | **NEEDS REBASE** | Out-of-date with main; rebase + push |
| **#576** | cf-r9r3 | scroll jitter + initial-white-flash on Hero | 1✓ 3pending | BLOCKED | **CI-IN-PROGRESS, admin review needed** | Cutover-night brand polish |

### P2 — infra / SEO / a11y / docs

CI-clean, BLOCKED-by-policy (awaiting Stilgar admin review per `enforce_admins=true`). Sorted by PR number:

| PR | Bead | Title (truncated) | mergeState | Notes |
|---:|---|---|---|---|
| #136 | cf-93rb-B | docs: design-tokens delta matrix vs Wix hookup | BLOCKED | Old (oldest open). Doc only. |
| #485 | cf-r192 | perf: `import "server-only"` to wix-client | BLOCKED | Bundle-size, low risk |
| #552 | hq-psmi | stop committing agent runtime state to main | BLOCKED | gitignore + cleanup |
| #553 | cf-v4py | fixture-OFF E2E spec for cfutons Velo wrapper | BLOCKED | Test infra |
| #554 | cf-x6ph | `/api/health` liveness endpoint + monitoring runbook | BLOCKED | **Cutover prereq — closes my cf-xzj1 P1 gap** |
| #555 | cfw-4la | aria-hidden on decorative drop-cap spans | BLOCKED | a11y micro-fix |
| #556 | cfw-x84 | per-page openGraph blocks on 10 non-admin pages | BLOCKED | SEO |
| #557 | cfw-z32 | twitterFromOpenGraph helper + apply to PDP | BLOCKED | SEO |
| #558 | cfw-tca | drop redundant `role="img"` on aria-hidden | BLOCKED | a11y micro-fix |
| #559 | cfw-3ma | broaden twitterFromOpenGraph to 6 more pages | CI-IN-PROGRESS | Awaiting CI complete |
| #560 | cfw-42z | force postcss ^8.5.10 via npm overrides | BLOCKED | Dep-pin |
| #561 | cfw-75m | gate src/lib/wix/products.ts to server-only | BLOCKED | Bundle-size, low risk |
| #562 | cfw-rcc | gate src/lib/auth/member.ts to server-only | BLOCKED | Bundle-size, low risk |
| #563 | cfw-mny.1 | Playwright a11y smoke spec — layout stability | BLOCKED | Test infra |
| #564 | cfw-d3q | drop unused `screen` import from HomePage | BLOCKED | Cleanup |
| #565 | cf-ukc6.1 | exclude `chore/coverage-ratchet-bump` from previews | BLOCKED | **Meta-saving: closes 39% daily preview burn (my work)** |
| #566 | cfw-xnd | wire EmailCapturePopup submit to subscribe | BLOCKED | Wiring |
| #567 | cfw-coc | hash subscriber email + redact cross-rig | BLOCKED | Privacy |
| #568 | (dependabot) | bump next from 16.2.4 to 16.2.6 | BLOCKED | **FAILING — SaleLightbox shared cause** |
| #571 | cf-tqwn | docs: Phase 9 day-30 stability report TEMPLATE | BLOCKED | **FAILING — SaleLightbox shared cause** (miquella's work) |
| #572 | cf-4f6l | docs: cf-3qt Phase 8 rollback runbook — DNS revert | BLOCKED | **FAILING — SaleLightbox shared cause** |
| #573 | cf-2r02 | docs: cfw cutover-night master checklist | BLOCKED | **FAILING — SaleLightbox shared cause** |
| #574 | cf-v8jj | docs: cfw Phase 8 day-1 stability report TEMPLATE | BLOCKED | **FAILING — SaleLightbox shared cause** (miquella's work) |
| #575 | cf-5f9o | docs: cutover post-mortem TEMPLATE | BLOCKED | **FAILING — SaleLightbox shared cause** |

## Status legend

- **CI-CLEAN, admin review needed**: All checks pass; mergeStateStatus = `BLOCKED` means awaiting admin per `enforce_admins=true` on cfw main protection. Stilgar approves + merges.
- **FAILING — SaleLightbox shared cause**: `lint-typecheck-test` job fails on the same `SaleLightbox.test.tsx:217`. Wave-0 fix unblocks the whole group.
- **NEEDS REBASE**: `mergeStateStatus: DIRTY` — out of date with main. Rebase + push to refresh CI.
- **CI-IN-PROGRESS**: still running, check back in 5–10 min.

## Notes on PRs Stilgar should pay attention to

- **#554** is **a cutover prereq** — it closes the `/api/health` 404 hard-FAIL I documented in cf-xzj1 (PR #1269). UptimeRobot polling fails without this. Should be in the first review round.
- **#565** is also worth merging early — it's the cfw side of cf-ukc6.1 (ratchet branch excluded from previews). After this lands, daily Vercel preview burn drops by ~39%. Free up build credits for the cutover-night fast-iteration window.
- **#570** is `DIRTY` (NEEDS REBASE) — anyone with checkout privileges can `git pull --rebase origin/main && git push --force-with-lease`. blaidd authored it.
- **#136** is the oldest open PR (cf-93rb-B design-tokens). Doc-only; no urgency but worth closing the queue.

## What I'd send Stilgar in chat

> Morning batch ready. ~28 cfw PRs to triage. **One blocker to clear first**: `src/components/site/__tests__/SaleLightbox.test.tsx:217` is failing on main and bleeding into 7 PRs. After that one-test fix, the priority order is: P1 (#576, #570 rebase first, #569, #540), then any of the CI-clean P2 batch (#554 + #565 are highest-leverage; rest are doc/cleanup). Triage doc: `docs/cf-3qt.8/cfw-pr-triage-2026-05-15.md`.

## Suggested follow-up beads (Stilgar / melania to dispatch)

| Pri | Bead title | Owner candidate |
|---|---|---|
| **P0** | Fix `SaleLightbox.test.tsx:217` order-dependent test isolation regression | UI/test lane (rennala, miquella, or melania) |
| P1 | Rebase cfw PR #570 (cf-bbo8) onto current main | blaidd (author) |
| P2 | Confirm cf-ukc6.1 cfw merge actually drops daily preview deploys (verifier — uses my audit script) | millicent |

## Reference

- Bead context: morning-batch dispatch from melania
- Source command: `gh pr list --repo DreadPirateRobertz/carolina-futons-web --state open --limit 50 --json number,title,headRefName,mergeable,mergeStateStatus,statusCheckRollup`
- Failure log sample (PR #568): https://github.com/DreadPirateRobertz/carolina-futons-web/actions/runs/25708854620
- Companion: `docs/cf-3qt.8/go-no-go-gate-status-2026-05-10.md` (gates currently NO-GO; PR triage unblocks several of those gates)
- cf-ukc6 standing order: PR pushes deploy; doc PRs in cfutons do not. This triage shipped via cfutons-only doc.
