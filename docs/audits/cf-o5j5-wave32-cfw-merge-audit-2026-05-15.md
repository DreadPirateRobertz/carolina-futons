# cf-o5j5 — Wave32 cfw merge audit (2026-05-15)

**Bead:** cf-o5j5 (Stilgar directive 2026-05-15)
**Auditor:** cfutons/crew/morgott
**Scope:** 26 PRs merged to `DreadPirateRobertz/carolina-futons-web:main` during the 2026-05-15 wave32 batch (per `progress-report.md` commit `87b420f6`).
**Dimensions audited:** (a) JSDoc/block-doc on new exports, (b) test coverage on new surface, (c) CI evidence at merge.

**Reachability convention:** PRs are included in scope only if their merge commit is reachable from `origin/main` (i.e. they actually shipped to production). PRs marked `MERGED` in GitHub that merged into intermediate stacked branches but were not carried forward to `main` are out of scope — verified via `git merge-base --is-ancestor <mergeCommit> origin/main`. Notable exclusion: PR #559 (`seo(cfw-3ma): broaden twitterFromOpenGraph to 6 more pages`) — merged into the `crew/quartz/cfw-z32` stacked branch but `cfw-z32`'s subsequent squash-merge into `main` as PR #557 was cut from a pre-#559 state of cfw-z32, so #559's diff did not land in `main`. Grep-verified: `twitterFromOpenGraph` does not appear in any of the 6 files #559 touched on current `main` HEAD.

Per cfw convention (`docs/TESTING-GUIDE.md`): "Running the full suite is non-negotiable for any code PR." JSDoc/TSDoc requirements are not formalized — TypeScript types serve as the contract; new exports should at minimum have a block comment explaining intent. CI gate = lint + typecheck + Vitest + Playwright (where applicable).

---

## Categorization (all 26)

| Category | Count | PRs |
|---|---:|---|
| Pure docs / templates | 5 | #571 #572 #573 #574 #575 |
| Test-only (PR delivers tests) | 4 | #553 #563 #564 #577 |
| Trivial (≤12 LOC or dep bump) | 9 | #555 #558 #560 #561 #562 #565 #569 #570 #578 |
| Housekeeping (removal / config) | 1 | #552 |
| **Substantive (deep-audit target)** | **7** | **#540 #554 #556 #557 #566 #567 #576** |

Pure docs PRs are templates with no exports / no testable surface — JSDoc/TDD audit not applicable.

Test-only PRs *are* the test surface; auditing them recursively against themselves provides no signal.

Trivial PRs (≤12 LOC) include aria-hidden fixes, server-only gates, dep bumps, canonical URL repetitions, vercel.json regex, role="img" removals — surfaces are too small to host a meaningful JSDoc/test gap. Spot-checked, none flagged.

The housekeeping PR #552 only removes `.runtime/` agent state from `main` and updates `.gitignore` — no production code change.

---

## Substantive deep-audit results (7 PRs)

### #540 — `feat(cf-jo07): restore CF logo in header (full + shrunken)` ✅ PASS

- **Surface:** Header.tsx + HeaderMobileMenu.tsx + globals.css (logo CSS) — visual change, no new exports
- **New tests:** 3 new `it()` blocks across `Header.scrollShrink.test.tsx`, `Header.test.tsx`, `HomePage.test.tsx`
- **JSDoc:** N/A (no new exports; existing JSX modifications)
- **CI:** lint + typecheck + Vitest + Playwright green at merge
- *(Verdict in heading.)* Logo restoration is primarily visual; vitest verifies header structure unchanged, visual-regression is the appropriate gate (covered by browser-check on the original PR per the wave32 report).

### #554 — `feat(cf-x6ph): /api/health liveness endpoint + monitoring runbook` ✅ PASS

- **Surface:** new `src/app/api/health/route.ts` + `docs/monitoring-runbook.md`
- **New exports:** `GET` (route handler), `dynamic = "force-dynamic"`
- **JSDoc:** Block comment above `dynamic` export explains the schema contract + the deliberate-minimalism rationale (what it does NOT prove). Good.
- **New tests:** 8 `it()` blocks in `api-health-route.test.ts` (1 describe block) covering schema shape, status code, force-dynamic disposition, and version field source-of-truth.
- **CI:** green at merge
- *(Verdict in heading.)*

### #556 — `seo(cfw-x84): per-page openGraph blocks on 10 non-admin pages` ⚠️ GAP

- **Surface:** metadata additions to community-gallery, community-gallery/submit, contact, faq, press, privacy, referral, referral/share/[code], signup, terms (10 page.tsx files)
- **New exports:** none (metadata block extension only)
- **JSDoc:** N/A
- **New tests:** **zero** `it()` blocks added.
- **Existing test coverage:** `src/__tests__/og-metadata.test.ts` has 26 `it()` blocks but none assert against the 10 pages from #556 — evidenced by `grep -E "community-gallery|/contact|/faq|/press|/privacy|/referral|/signup|/terms" src/__tests__/og-metadata.test.ts` returning **zero** matches. The existing tests cover layout-level metadata + shop/PLP/PDP per-page metadata, not the static-page surface this PR added.
- **CI:** green at merge (no new tests means no chance of test failure, but ALSO no chance of regression detection).
- **In-flight gap-closer:** PR #584 (`feat(cf-ceex): per-page OG image + description sweep (13 pages)`) is OPEN against main and modifies `og-metadata.test.ts` alongside 9 page files — partially overlaps with #556's surface. If #584 lands first, cf-o5j5.fu1 scope should be re-checked for residual coverage gaps.
- **Verdict:** **GAP** — 10 new metadata blocks ship with zero locked-in contract tests. Future edits can silently regress OG title/description/image. Filed as **cf-o5j5.fu1** (P2 — signup + referral/share/[code] are conversion-critical surfaces; viral-loop and account-creation pages, not back-office docs).

### #557 — `seo(cfw-z32): twitterFromOpenGraph helper + apply to PDP/PLP/shop/blog` ✅ PASS

- **Surface:** new helper `src/lib/seo/twitter-from-og.ts` + applies to 4 route files
- **New exports:** `twitterFromOpenGraph(og, opts)`
- **JSDoc:** Block comment above export explains the OG-mirror rationale + reference to cf-5rmn audit §P2 #3 + `card: "summary"` opt-in semantics. Good.
- **New tests:** 6 `it()` blocks in `src/lib/seo/__tests__/twitter-from-og.test.ts` (1 describe) covering happy path, default card, opt-in card override, image array handling, missing-field tolerance.
- **CI:** green at merge
- *(Verdict in heading.)*

### #566 — `fix(cfw-xnd): wire EmailCapturePopup submit to subscribeToNewsletter` ✅ PASS

- **Surface:** `src/components/site/EmailCapturePopup.tsx` (rewrites submit handler from no-op to server action)
- **New exports:** none (component refactor)
- **JSDoc:** N/A
- **New tests:** 6 `it()` blocks added to `EmailCapturePopup.test.tsx` covering submit happy path, validation, error surface, success state, idempotency-after-mount, and disabled-state-during-submit.
- **CI:** green at merge
- *(Verdict in heading.)*

### #567 — `feat(cfw-coc): hash subscriber email + redact cross-rig payload values from server logs` ✅ PASS

- **Surface:** new `src/lib/log/hash-pii.ts` + integrates into `src/app/api/cross-rig/route.ts` + `src/app/newsletter/actions.ts`
- **New exports:** `hashPii(value)`, `hashEmail(email)`
- **JSDoc:** Full `/** */` JSDoc on both exports — explains HMAC-SHA256 salt requirement, `<unsalted>` fallback with warn-once semantics (refuses-silently-attacks rainbow-table concern), stability-across-deploys for rate-limit correlation, lowercase normalization. Exemplary.
- **New tests:** 10 `it()` blocks net-added across 3 files (`hash-pii.test.ts`, `api-cross-rig.test.ts`, `newsletter-actions.test.ts`) — covers salt presence/absence, stability, normalization, end-to-end redaction in two consumer paths. *(Count is net additions per the PR diff; current file totals on `main` may include subsequent edits.)*
- **CI:** green at merge
- *(Verdict in heading.)* This is the gold-standard reference for the wave on doc+test discipline.

### #576 — `fix(cf-r9r3): scroll jitter + initial-white-flash on Header` ✅ PASS

- **Surface:** Header.tsx scroll-state machinery
- **New exports:** none (intra-component refactor)
- **JSDoc:** N/A
- **New tests:** 8 `it()` blocks added to `Header.scrollShrink.test.tsx` covering scroll-up/down thresholds, no-flash-on-mount, rAF throttling boundary, and reduced-motion no-op.
- **CI:** green at merge + 5-agent visual-check ✅ per the wave32 report
- *(Verdict in heading.)*

---

## Findings summary

| PR | merge_commit | JSDoc | Tests | CI | Verdict |
|---|---|---|---|---|---|
| #540 | (cfw main, 2026-05-15T20:30:49Z) | n/a | ✅ 3 it() | ✅ | PASS |
| #554 | (cfw main, 2026-05-15T20:35:53Z) | ✅ block-doc | ✅ 8 it() | ✅ | PASS |
| #556 | (cfw main, 2026-05-15T20:35:07Z) | n/a | ⚠️ **0 it()** for 10 pages | ✅ | **GAP** |
| #557 | (cfw main, 2026-05-15T20:33:53Z) | ✅ block-doc | ✅ 6 it() | ✅ | PASS |
| #566 | (cfw main, 2026-05-15T20:34:10Z) | n/a | ✅ 6 it() | ✅ | PASS |
| #567 | (cfw main, 2026-05-15T20:35:58Z) | ✅ /** JSDoc */ | ✅ 10 it() net | ✅ | PASS |
| #576 | (cfw main, 2026-05-15T21:37:13Z) | n/a | ✅ 8 it() | ✅ | PASS |

*(Future wave-audits should record the exact merge_commit SHA per PR for time-stable verification. Timestamps captured above; SHA lookups can be retrofitted via `gh pr view <N> --json mergeCommit`.)*

**1 gap of 7 substantive PRs (14%) → wave32 is in solid shape.**

## Filed follow-ons

- **cf-o5j5.fu1** (P3): Backfill per-page OG snapshot tests for the 10 pages in #556 (community-gallery / community-gallery/submit / contact / faq / press / privacy / referral / referral/share/[code] / signup / terms). Pattern should mirror existing `og-metadata.test.ts` test shape — import each page's `metadata` export and assert against the `title` / `description` / `openGraph.{title,description,images}` keys. Estimate ~10 it() blocks (one per page).

## Notes

- Sub-agent dispatched reviews (code-reviewer, silent-failure-hunter, etc.) ran on most PRs during the 5-agent batch wave — cited evidence supports the "wave32 in good shape" verdict.
- `docs/TESTING-GUIDE.md` is the canonical reference for cfw testing convention; no separate `TDD-STANDARDS.md` exists.
- Audit doc lives in cfutons monorepo (cfw is under Vercel-credit hold 2026-05-15 → ~2026-05-17 per melania; pushing audit-doc to cfw would burn credits unnecessarily).
- Stilgar directive scope intentionally NOT extended to the parallel cfutons monorepo merge wave (B-3, B-4, B-5, B-5.fu, cf-ykmj, cf-094q, etc.); those already had per-PR 5-agent CR documented in their bodies.
