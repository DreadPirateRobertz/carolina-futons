# cf-3qt.8.32 — Vercel Pro Upgrade Checklist

**Bead:** cf-3qt.8.32
**Status:** ✅ **GATE CLEAR — no upgrade required**
**Last verified:** 2026-05-10 (millicent, via Vercel API)
**Account:** chrisdealglass@gmail.com → team `dreadpiraterobertzs-projects` (`team_WYNf264wCFjPfeUdTpci07wO`)

## TL;DR for Stilgar

You are **already on Pro Plus** (paid, active, Stripe-billed). **Nothing to upgrade**. The only Vercel-side action remaining for cutover night is **adding the two custom domains** (3-click path, ≈ 30 seconds, documented at the bottom of this doc).

## Current plan — confirmed via API

```
billing.plan          = "pro"
billing.planIteration = "plus"
billing.status        = "active"
billing.platform      = "stripe"
billing.currency      = "usd"
billing.period        = 2026-04-16T19:00:00Z → 2026-05-16T19:00:00Z
createdDirectToHobby  = true   ← team was created on Hobby, since upgraded
```

Full team payload available at `GET https://api.vercel.com/v2/teams/team_WYNf264wCFjPfeUdTpci07wO` with the user's CLI token.

### Spend controls already in place

```
billing.controls.analyticsSpendLimitInDollars  = 500   ← hard cap on analytics overage
billing.invoiceItems.includedAllocationUsd     = 20    ← $20/month included usage credit
```

## What Pro Plus gives you that cutover needs

| Cutover requirement | Hobby tier | Pro Plus tier | Status |
| --- | --- | --- | --- |
| Custom domains | ✅ unlimited | ✅ unlimited | both fine — we always could have done this |
| Production-domain commercial use | ❌ TOS forbids | ✅ allowed | **REQUIRED — Pro lifts the TOS block** |
| Serverless function execution timeout | 10 s max | 60 s max (configurable to 300 s) | ✅ Pro gives us 60s headroom for the cron-driven `runReviewRequestEmailsCron` + `scanAndTriggerWinbackCron` endpoints; Hobby's 10 s would time out under realistic batch sizes |
| Edge / Fluid CPU per invocation | limited | 2 GB | ✅ no risk |
| Bandwidth | 100 GB/month | 1 TB/month included | ✅ at projected steady-state traffic (≈ 5–15 GB/month based on cf-3qt.8 baselines), we won't hit overage |
| Web Analytics retention | 24 hours | 30 days | ✅ `observabilityBase.enabled: true` confirms we have it |
| Logs retention | 1 hour | 1 day (or longer) | ✅ |
| Skew protection (atomic deploys) | ❌ not on Hobby | ✅ enabled (`skewProtectionMaxAge: 43200` = 12h) | ✅ already configured |
| Image optimization quota | 1000/mo | 5000/mo | ✅ |
| Monorepo / Turborepo remote cache | limited | full | ✅ |
| Concurrent builds | 1 | up to 12 | ✅ helpful when Stilgar pushes a fixup while a preview is mid-build |
| Team seats | 1 | $20/seat | ✅ — Stilgar is sole owner per `membership.role: OWNER` |

The two **hard requirements** for cutover (commercial-use TOS + 60s function timeout) are both unlocked by Pro Plus. Already in place. **No action needed.**

## Cost estimate at current traffic

Pro Plus base is **$20/seat/month** with $20 of usage credit included (effectively a flat $20 with overage if you exceed the included quotas). At cf-3qt.8's projected steady-state:

| Metric | Projected monthly | Pro Plus included | Overage at this rate |
| --- | --- | --- | --- |
| Bandwidth (`fastDataTransfer`) | ≈ 5–15 GB | 1 TB | $0 |
| Function invocations (`functionInvocation`) | ≈ 50k–200k | 1 M | $0 |
| Function GB-seconds (`functionDuration`) | ≈ 5k–20k | 1k included × $1.06/k overage | ≈ $4–20 if traffic spikes |
| Image optimization | ≈ 500–1500 | 5k | $0 |
| Edge requests (`edgeRequest`) | ≈ 100k–500k | 10 M | $0 |
| ISR / Data cache reads | ≈ 50k | 10 M | $0 |
| Web Analytics events (if enabled) | ≈ 50k | OFF currently — `analytics.enabled: false` | enable post-cutover if desired ($10/month for analytics + $0.65/CPM events) |

**Steady-state estimate: ≈ $20–30/month** (base + minor function-duration overage during cron windows). Spend cap is **already set to $500** for analytics, so worst-case-runaway is bounded.

## What about credits / discounts?

Vercel doesn't widely advertise post-signup credits, but two paths Stilgar could investigate **after cutover** (not blockers):

- **Vercel for Startups** — requires $1M+ ARR or YC/incubator backing. Not applicable for an indie merchant.
- **Annual prepay** — single-line discount on the Pro plan. Probably not worth the lock-in given Stilgar may scale up to Team tier later.

Neither is a cutover gate. Skip for now; revisit at the 90-day mark if billing patterns warrant.

## Remaining Vercel-side action for cutover night

`GET https://api.vercel.com/v5/domains?teamId=...` returns **0 custom domains**. Stilgar needs to add two on the night of the flip:

```sh
# (already wired into cutover-verification-matrix.md Step 1, but documented here too)
vercel domains add carolinafutons.com
vercel domains add www.carolinafutons.com
```

Or via dashboard — `https://vercel.com/dreadpiraterobertzs-projects/carolina-futons-web/settings/domains` → **Add Domain** → enter both. Vercel auto-provisions SSL once DNS resolves.

Both domains must show `verified: true` before Stilgar updates the Wix DNS A records (cutover-verification-matrix.md Step 2).

## Gate status

**REQUIRED-BEFORE-CUTOVER → CLEAR.** No payment-method change, no plan-tier change, no billing action of any kind needed before DNS flip.

The single Vercel-side action remaining (`vercel domains add`) is part of cutover-night Step 1, not a pre-cutover gate.

## Verification path (re-runnable any time)

If at any point we want to re-confirm the plan (e.g., billing-failure rollback to Hobby would re-block the cutover), this is the single-command check:

```sh
TOKEN=$(python3 -c "import json; print(json.load(open(\"$HOME/Library/Application Support/com.vercel.cli/auth.json\")).get(\"token\",\"\"))")

curl -sS "https://api.vercel.com/v2/teams/team_WYNf264wCFjPfeUdTpci07wO" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c '
import json, sys
d = json.load(sys.stdin).get("billing", {})
print(f"plan={d.get(\"plan\")}  iteration={d.get(\"planIteration\")}  status={d.get(\"status\")}")
'
# Expected: plan=pro  iteration=plus  status=active
```

Anything other than `plan=pro status=active` means the cutover gate is no longer clear and needs a re-evaluation before flipping DNS.

## References

- Parent: cf-3qt.8 (DNS cutover, P1)
- Sibling: `cutover-verification-matrix.md` (uses `vercel domains add` in Step 1)
- Sibling: `dns-ttl-drop-runbook.md` (TTL drop must precede cutover)
- Sibling: `pre-cutover-curl-results-2026-05-10.md` (curl verification of preview URL)
- Vercel pricing reference: <https://vercel.com/pricing> (confirm current Pro Plus features as of cutover date)
