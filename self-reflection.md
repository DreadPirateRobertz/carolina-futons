# Melania Self-Reflection Log

## Session 2026-03-22 (Sprint 4 wave 2 + review cycle)

### What worked well
- 5-agent review catching real criticals: onItemReady stacking (CartUpsell), initialized-before-await (ProductInfoModal), rate limiting gap (Social Proof), client-trusted quantityInStock (Badge System). All high-value catches that would have shipped bugs.
- Parallel nudges with precise fix lists: sent all 4 crew members targeted nudges immediately after collating review findings. No ambiguity in instructions.
- Pre-staging next wave beads (CF-gj26, CF-r0dr, CF-ku3x) while crew is in fix rounds — keeps engine primed.
- CodeQL failure investigation: recognized that 3s "fail" on CodeQL could be infrastructure noise vs real alerts. Correctly distinguished the orphaned check-run (404 run ID) and noted godfrey should investigate.

### Gaps / improvement opportunities
- Should have checked crew mail BEFORE launching all 4 review agents — miquella's "ready for merge" mail (11:55) would have told me she'd already addressed previous-cycle findings. The review still found new criticals (popstate, initialized flag) but I wasted no tokens on that.
- The CodeQL check on #656 showed "fail" in a stale previous call, then "pass" in the fresh call — timing confusion. Note to self: always re-check CI after a fresh `gh pr checks` call, don't trust cached output.
- Radahn punted on pre-existing silent catches ("out of scope — needs separate bead"). He's right but I need to enforce that boundary more clearly upfront in bead specs: "Fix any pre-existing silent failures you encounter in files you touch."

### Pattern notes
- `gh pr checks <num>` can show stale results when exit code 1 (failing check) — the output IS the check list but may be from the previous run if the new one is queued. Re-run to confirm.
- onItemReady stacking in Wix Velo is a systemic trap. Should add this to bead templates as a "known footgun" warning for any repeater work.
- Silent failure in catch blocks is still the #1 review finding pattern. Should add to crew standing orders: every catch block must call logError or console.error minimum.

### Metrics (session so far)
- PRs merged: 7 (#641, #642, #649, #650, #651, #652, #653)
- PRs in review loop: 4 (#654, #655, #656, #657) — all blocked on criticals
- Beads created: 5 (CF-me8p, CF-gj26, CF-r0dr, CF-ku3x + one earlier)
- New stories queued for next wave: 3

## Session 2026-03-22 (wave 3 — post-compaction continuation)

### What worked well
- Post-compaction recovery was clean: checked CI immediately, merged PRs that were ready (#665, #666, #667)
- `homePageMapping.test.js` failure diagnosis was fast: CI logs identified `announcementBarLink` as the unmapped ID. Exact nudge to godfrey with line-level fix (96→97 count + add element to map).
- Keeping both the old Badge System section AND my new CF+ Upgrade Prompt section when resolving the HTML guide merge conflict — both needed, neither should be dropped.
- Radahn's fix commit removed `findSharedCategory`/`getComparisonData`/`trackComparison` entirely (simplified API) — my pre-compaction review criticals became moot. Reviewing current code rather than relying on old review is the right call.

### Gaps
- Should have checked the latest commit message on PR #667 BEFORE re-running full 5-agent review — "fix(CF-r0dr): apply 5-agent review findings" in the headline tells the story. Could have been faster.
- Merge conflict in EDITOR_HOOKUP_GUIDE.html: caused by pushing guide docs directly to main from melania dir. The upstream already had Product Badge System section from a previous crew push. Need to always pull before committing guide docs.

### Pattern notes
- When a rebase conflict hits in a guide file: almost always means another crew member also updated the guide independently. Keep BOTH new sections — they each correspond to a separate PR/bead.
- `homePageMapping.test.js` is a coverage-enforcement test — it explicitly checks that every `$w('#elementId')` reference in Home.js appears in the element map. Any new element added to Home.js code must also be added to this map or the test breaks.

### CRITICAL gap: merged before background agents finished
Background review agents for PR #666 and #667 were launched before compaction and ran during downtime. I resumed after compaction, ran NEW manual reviews, and merged both PRs WITHOUT checking if background agents had results. Both agents found real bugs:
- PR #666: ariaLabelledBy not wired (WCAG P1) — follow-up bead CF-of4v created
- PR #667: stale slot image/name not cleared (P2) — follow-up bead CF-d5dq created

**RULE: On session resume after compaction, check task-notification queue BEFORE doing any merges. Background agents may have findings that should block merge.**

### Metrics (this wave)
- PRs merged: #665, #666, #667 (3 PRs, 3 beads closed: CF-ku3x, CF-llrd, CF-r0dr)
- Follow-up beads created: CF-of4v (P1 WCAG), CF-d5dq (P2 stale slot)
- Editor guides: updated with CF+ Upgrade Prompt Modal, Comparison Tray, Continue Shopping nicknames (both MD + HTML)
- Crew dispatched: radahn → CF-wigv (Swatch Filter), godfrey → #658 mapping fix, miquella+rennala status-checked

## Session 2026-03-22 (wave 4 — post-second-compaction)

### What worked well
- Parallel agent orchestration: launched 5-agent reviews on 5 PRs simultaneously (#673, #679, #681, #686, #687, #688) while handling other dispatch/merge/bead work — no idle time
- Bundle Builder HTML guide update: caught that the spec names in HTML were stale vs actual implementation in Bundle.js. Updated HTML to match real element IDs from merged PR #677. This is the right process — verify against actual merged code, not the original spec.
- Shipping intelligence layer bead creation: read the full spec (231 lines), correctly split work into 3 parallel tracks (godfrey=UPS+CMS, rennala=WWEX SOAP, radahn=widget), and dispatched godfrey+radahn immediately.
- PR #679 aria-current fix: 5-agent found the exact line — `i <= active` should only set ariaCurrent when `i === active`. Nudge was precise with exact code fix. Radahn applied it correctly.
- Element name correction to radahn: caught that my bead spec used different element names than the HTML guide (shippingEstimateWidget vs shippingEstimateSection, etc.). Sent correction nudge immediately. HTML guide is source of truth.

### Gaps
- Mailed chrome/dust polecats with useSessionTimer.ts fix but their sessions don't exist — had to fall back to gt mail. Should check session existence before gt nudge (use gt mail for polecats by default since they're ephemeral).
- PR #687 got a merge conflict because I merged #686 (Q&A consolidation) to main while miquella's TrendingSearches branch was in-flight. Should check branch dependency before merging to avoid creating conflicts for other open PRs.
- HTML guide spec names vs actual implementation names: the Bundle Builder section had old spec names. This gap existed since PR #677 merged earlier in session. I should have updated HTML immediately after #677 merged, not hours later. Standing order compliance.

### Pattern notes
- `gt nudge <target>` fails with "session not found" for polecats — they're ephemeral, sessions may not exist. Always use `gt mail send` for polecats.
- Wix Secrets Manager API nested body format: `{"secret": {"name": ..., "value": ...}}` — not flat.
- CI shows "no checks reported" when a PR branch has a conflict (CONFLICTING state) — CI won't run on conflicting branches. Check `gh pr view --json mergeable` when CI seems missing.
- Self-reflection should be written DURING session waves, not deferred to end. Pattern: write after major bead wave completes.

### Metrics (this wave)
- PRs merged: #679, #681, #684, #685, #686 (5 PRs, 5 beads closed: CF-vp8k, CF-m7kw, CF-mjvo, CF-pgux, CF-qa8c)
- Orphaned polecat PRs handled: #682/#683 (2 criticals each, fixes mailed), #684/#685 (clean, merged)
- Beads created: CF-cffy (shipping intelligence UPS), CF-wzkm (WWEX SOAP), CF-o0va (product page widget)
- Crew dispatched: godfrey→CF-cffy, radahn→CF-o0va, rennala→CF-wzkm (queued)
- WWEX_ACCOUNT_NUMBER stored in Wix Secrets Manager (all 3 WWEX creds now live)
- Editor guides: HTML updated — Bundle Builder actual nicknames + Q&A Widget section
- 5-agent reviews run: #673, #679, #681, #686, #687, #688 (6 PRs this wave)

## Session 2026-03-22 (wave 5 — post-third-compaction)

### What worked well
- 5-agent review on #689 caught CRITICAL: 'OrderLookupRateLimit' is a new collection name that doesn't exist in Wix CMS. checkRateLimit fails open — rate limit would silently never enforce in production. Good catch before merge.
- Multiple agents giving conflicting verdicts on #689 collection name — adjudicated by reading the source directly (grep for existing usage). Always verify agent disagreements against the code.
- #687 TrendingSearches merged cleanly after miquella rebased — notified dallas + closed CF-ts4n promptly so hicks (mobile) could unblock immediately.
- Parallel 5-agent launches on #689, #681, #687 during GitHub API downtime prep — ready to act immediately when GitHub recovered.

### Gaps
- GitHub API had two intermittent outages this wave — no fallback strategy. Should use `curl -H "Authorization: Bearer $(gh auth token)"` as a fallback when `gh` CLI fails, rather than waiting and retrying blindly.
- RAM at ~0.6GB free — should alert mayor earlier when system is resource-constrained. Stale logs in godfrey's .playwright-mcp dir are bloat from March 14–16.
- PR #681 RecentlyViewed had 4 issues (including CRITICAL Cart Page repeater ordering) that rennala's round 2 didn't catch. Should have requested round 2 specifically call out the Cart Page integration pattern.

### Pattern notes
- When a hotfix PR uses a new CMS collection name vs existing ones: always verify the collection exists in Wix CMS. checkRateLimit fails open by design — a missing collection is a silent security bypass, not a noisy error.
- Agent disagreements on the same code (here: collection name) should be resolved by reading the source directly, not by weighing which agent sounds more confident.
- GitHub API flakiness pattern: DNS resolves (ping works, curl google works) but api.github.com refuses connections. Not a local network issue — likely transient GitHub API overload. Wait 15–30s and retry once; if still failing, notify mayor and work on non-GitHub tasks.

### Metrics (this wave)
- PRs merged: #687 (CF-ts4n TrendingSearches) — 1 PR
- PRs blocked (reviews posted): #689 (collection name + broken test), #681 (CRITICAL repeater order + 3 majors), #688 (setTimeout race), #673 (still conflicting)
- New PRs in queue: #690 (CF-cffy godfrey), #691 (CF-o0va radahn), #692 (CF-wzkm rennala)
- Crew dispatched: miquella→CF-drka (catalog rename), nudges sent to radahn, rennala, godfrey, ghoul
- Beads created: CF-drka (catalog rename P1)
