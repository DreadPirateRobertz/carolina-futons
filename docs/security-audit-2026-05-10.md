# Security Audit — 2026-05-10

**Bead:** cf-1vov (Stilgar mandate 2026-05-10)
**Auditor:** millicent (cfutons/crew)
**Repos:** `DreadPirateRobertz/carolina-futons`, `DreadPirateRobertz/carolina-futons-web`
**Tool:** `gitleaks 8.x` + GitHub secret scanning + manual greps

---

## TL;DR

- **No active exposed secret in either repo's current `main`.** GitHub secret-scanning shows zero open alerts on both.
- **One historical artifact** — a hardcoded `INLINE_AUTH_TOKEN` literal lived in `src/backend/http-functions.js` between PR #1143 and PR #1208 (cfutons). The endpoint that gated on it has since been deleted; the token has no live attack surface but does remain in git history. **Not P0** — recommend documenting; rewriting history is the only way to fully remove it and isn't worth the disruption.
- **Branch protection gap on `carolina-futons-web`** — `main` has no protection at all. Anyone with write access can push directly to main without review. **Recommend enabling** before cutover-night so the cf-3qt.8 cutover commits go through PR review like the rest.
- **Minor**: dependabot_security_updates is **disabled** on `carolina-futons-web` (was deleted with `dependabot.yml` in #459 per Stilgar's noisy-bot pruning, then partially restored by cf-s5cs PR #464). Re-enable as a separate concern only if Stilgar wants security-update PRs again.

37 + 3 raw `gitleaks` hits, all triaged — see [Findings](#findings) for the full breakdown.

---

## Methodology

1. `gitleaks detect --source .` against full git history of both repos (cfutons 631 commits, cfutons-web 969 commits).
2. GitHub secret-scanning alert query (open + provider patterns).
3. Manual `grep` for: `INLINE_AUTH_TOKEN`, `JSON.stringify(process.env...)` shapes, `manage.wix.com|wixstudio.com|halworker85` in client-side files, `_REQUIRED` env-var fallbacks.
4. `.gitignore` review against melania's checklist.
5. Branch-protection + secret-scanning settings on both repos via the GitHub REST API.

---

## Findings

### 1. `INLINE_AUTH_TOKEN` literal — historical, no live surface

- **What:** `INLINE_AUTH_TOKEN = 'cf-9ieq-godfrey-2026-05-05-diagnostic'` in `src/backend/http-functions.js`.
- **History:** introduced in PR #1143 (commit `5495df7` 2026-05-05, cf-9ieq fix that added a `post_contactSubmissionsDiagnostic` probe endpoint), removed in PR #1208 (commit `dfb455e` 2026-05-09, "remove one-shot contactSubmissionsDiagnostic endpoint"). Lived in `main` for ~4 days.
- **Attack surface today:** **none.** The endpoint that consumed the token was deleted with the same commit that removed the literal. A historical attacker who pulled the repo during the 4-day window could have replayed the token against the live diagnostic endpoint to dump diagnostic state, but the endpoint is gone.
- **Recommendation:** **document, don't rewrite history.** History rewrites force every collaborator + every CI runner + every fork to re-clone. The attack surface is closed by the endpoint deletion; leaving the literal in history is a documented diagnostic-token artifact, not an active leak. If Stilgar wants belt-and-suspenders, the future pattern is: any one-shot diagnostic auth uses an env-var-backed secret, never an inline literal — even for ephemeral debug routes.

### 2. Branch protection — `carolina-futons-web` has none

```
$ gh api /repos/DreadPirateRobertz/carolina-futons-web/branches/main/protection
"Branch not protected"  HTTP 404
```

`carolina-futons` has minimal protection (1 required PR review, no required status checks, enforce_admins=false), but `carolina-futons-web` has nothing — direct pushes to main are accepted. Notable because:

- The cf-3qt.8 cutover-night flow involves DNS + Vercel changes that should land in main via reviewable PRs, not direct pushes from a console.
- `pin-head-sha` (the merge-guard workflow shipped in cf-r1cl PR #1201) **only enforces if added to required status checks** — it isn't yet on the required list of either repo. Owner-only toggle.

**Recommendation (Stilgar action):**

1. On both repos: Settings → Branches → main → Edit → enable "Require a pull request before merging" + at least 1 review.
2. Add `pin-head-sha` to required status checks on both repos (cf-r1cl follow-up that's been pending since #1201 merged).
3. Optionally enable "Require branches to be up to date before merging" so the check runs against the latest head SHA.

### 3. `dependabot_security_updates` disabled on cfutons-web

GitHub setting per repo:

```
carolina-futons        dependabot_security_updates: enabled
carolina-futons-web    dependabot_security_updates: disabled
```

This is a residual from #459 (Stilgar's "remove noisy bots" sweep). The `.github/dependabot.yml` was restored on cfutons-web in PR #464 (cf-s5cs), but the dashboard-side toggle was not re-enabled. Effect: cfutons-web won't auto-receive security-advisory PRs; manual `npm audit` is the only signal.

**Recommendation:** re-enable IF Stilgar wants the security-update feed back. Otherwise document the trade-off and rely on `npm audit` runs during routine dev.

### 4. `gitleaks` raw hits — 40 total, all triaged

All 40 raw findings are false positives or already-mitigated. Breakdown:

| File | Count | Pattern | Verdict |
| --- | ---: | --- | --- |
| `src/backend/siteContentSeed.web.js` | 10 | `key: 'announcement.rotation.X.cta-label'` | **False positive** — these are SiteContent CMS row keys (literal dotted paths), not API keys. |
| `tests/httpFunctions.test.js` | 7 | `ALERT_CRON_KEY: 'test-cron-key-123'` etc | **False positive** — unit-test placeholder values. |
| `tests/deliverySchedulingDeep.test.js` | 4 | `cancelToken: 'abc123def456ghi789jkl012'` | **False positive** — test fixture string. |
| `tests/provisionSecrets.test.js` | 4 | `WIX_BACKEND_KEY: 'IST.abcdefghij1234567890abcdefghij'` | **False positive** — fake `IST.` prefix obvious in context. |
| `tests/deliveryScheduling.test.js` | 3 | same `abc123…` token | **False positive** — same as above. |
| `tests/deliveryEstimator.integration.test.js` | 3 | `tok123…012345678901` | **False positive** — explicit test placeholder. |
| `tests/klaviyoIntegration.test.js` | 3 | `ESP_API_KEY: 'pk_test_abc123'` | **False positive** — Stripe-style test-key prefix. |
| `scripts/build-live-audit.mjs` | 2 | UUIDs `9bead16f-…` and `7516f85b-…` | **False positive** — Wix App IDs (e.g. `9bead16f-…` = "Wix REST API"), publicly known, not site-specific secrets. |
| `src/backend/http-functions.js` | 1 | `INLINE_AUTH_TOKEN = 'cf-9ieq-godfrey-…'` | **Historical** (Finding 1). |
| `cfw/scripts/provision-site-content/seed-data.json` | 2 | `key": "announcement.rotation.3.cta-label"` | **False positive** — same SiteContent key pattern as cfutons. |
| `cfw/src/__tests__/api-admin-site-content.test.ts` | 1 | `key: "announcement.rotation.3.cta-href"` | **False positive** — same. |

`gitleaks` heuristics flag any quoted-hex-or-base64-looking string ≥ 16 chars in code that mentions `key`/`token`/`secret`/`password`. The CMS-key + test-fixture patterns trip it but none are real credentials.

### 5. `.gitignore` coverage — comprehensive on both repos

**`carolina-futons`:**
- `.env`, `*.env`, `.gt-secrets`, `*.secret`, `credentials*` — secrets ✓
- `node_modules/`, `coverage/`, `.next/`, `.vercel/`, `.beads/`, `dolt-server.port`, `/snapshots/` — build/runtime ✓
- `crew/`, `polecats/`, `mayor/`, `memory.md`, `CLAUDE.md`, `AGENTS.md`, `_mayor_backup/` — Gas Town internal ✓
- `scripts/secrets.env`, `scripts/secrets.env.example` — local dev secrets ✓
- `state.json`, `town.json`, `overseer.json`, `daemon.json` — runtime state ✓

**`carolina-futons-web`:**
- `/node_modules`, `/coverage`, `/playwright-report`, `/test-results`, `/.next/`, `/build`, `/.pnp.*` — build/test ✓
- `.DS_Store`, `*.pem`, `npm-debug.log*` — OS / debug ✓
- `.env*` — env files ✓
- `.vercel`, `*.tsbuildinfo`, `next-env.d.ts` — Vercel + TS ✓
- `/data/newsletter-contacts.json`, `/e2e/brenda-admin-guide-out`, `/e2e/.wix-auth.json` — runtime PII ✓

Both .gitignores cover melania's checklist. No gaps.

### 6. Untracked PNGs in cfutons working dir — not a security issue

`git status` in cfutons crew/millicent worktree shows ~25 untracked PNGs (`cfw-*.png`, `pdp-baseline-*.png`, `qa-*.png`, etc) that are QA screenshots from prior sessions. None are committed; they're tracked by `.gitignore`-implicit exclusion (no rule explicitly covers them but they're not added to any commit). Worth a one-time `rm` to declutter the worktree, but not a leak.

### 7. API routes returning `process.env` in JSON — none found

`grep -rln "JSON.stringify.*process\.env" src/` on both repos returns 0 hits. No debug route leaks env variables to clients.

### 8. Wix dashboard URLs in client bundles — none found

`grep -rln "manage\.wix\.com|wixstudio\.com|halworker85" src/ public/` on cfutons-web returns 0 hits. Wix dashboard / staging URLs are kept server-side.

### 9. `env.ts` fallback values — no required-secret leakage

`src/lib/env.ts` `_REQUIRED` keys (`WIX_CLIENT_ID_HEADLESS`, `WIX_BACKEND_KEY`, `WIX_WEBHOOK_SECRET`, `WIX_API_KEY`) all throw on missing. `OPTIONAL_WITH_DEFAULT` only contains `WIX_VELO_SITE_URL` defaulting to `"https://www.carolinafutons.com"` — a public URL, not a secret.

### 10. GitHub secret scanning — both repos have it enabled with push protection

```
                       secret_scanning  push_protection  validity_checks
carolina-futons         enabled         enabled          disabled
carolina-futons-web     enabled         enabled          disabled
```

Both have the core scanner + push protection. `validity_checks` (GitHub auto-pings the issuing service to check if a flagged token is live) is disabled on both — opportunity to enable since it's free and adds confidence to scanner verdicts. `non_provider_patterns` (custom regex match for non-vendor tokens) is also disabled on both — same opportunity.

---

## Recommendations summary

| Pri | Recommendation | Owner |
| --- | --- | --- |
| **P1** | Enable branch protection on `carolina-futons-web` main (require PR + 1 review). Add `pin-head-sha` to required status checks on both repos (cf-r1cl follow-up still pending from PR #1201). | Stilgar (admin-only) |
| P2 | Enable `dependabot_security_updates` on `carolina-futons-web` (decision: re-accept the security-update PR feed?). | Stilgar |
| P2 | Enable `secret_scanning_validity_checks` + `secret_scanning_non_provider_patterns` on both repos. | Stilgar |
| P3 | Document the historical `INLINE_AUTH_TOKEN` artifact (this doc covers it). Don't rewrite history. | Done by this doc. |
| P3 | One-time `rm` of untracked QA screenshots in cfutons working tree to declutter `git status`. | Cosmetic; any dev. |

No P0 escalations.

---

## What is NOT in scope for this audit

- Velo backend API key rotation cadence — not a code/repo concern, lives in Wix Dashboard.
- Vercel env var values themselves — confirmed shape via `vercel env ls` (cf-3qt.8 prerequisite audit), no values inspected.
- Wix Members PII / customer data — not a code-repo audit concern.
- Third-party SaaS posture (Cloudflare, Stripe, Klaviyo, UPS) — out of scope per Stilgar's mandate, which was limited to "the two repos."
