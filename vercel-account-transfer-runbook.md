# Vercel Account Transfer Runbook — Personal → Team/Pro

**Bead:** cf-3qt.8.25
**Author:** radahn
**Date:** 2026-05-04
**Audience:** Stilgar (site owner — Vercel Dashboard work)
**Estimated time:** 10 minutes (transfer flow) + ~5 min for payment setup if creating a new team
**Risk profile:** **Zero downtime** — Vercel guarantees no service interruption during transfer. Risks below are about post-transfer cleanup, not customer-visible outages.
**Source of truth:** <https://vercel.com/docs/projects/transferring-projects> (last updated 2026-02-26 per Vercel docs)

---

## Why this matters

The `carolina-futons-web` project currently lives on the personal Vercel account
`dreadpiraterobertzs-projects` (Hobby plan). Hobby has hard limits that bite at
production scale:

| Limit | Hobby | Pro |
|---|---|---|
| Serverless function timeout | **10s** | 300s |
| Concurrent builds | 1 | configurable |
| Team seats | 0 (single user only) | 1 included + $20/seat/mo |
| Paid add-ons (SAML, log drains, etc.) | unavailable | available |
| Commercial use allowed | **no** | yes |
| Build minutes / bandwidth | capped | $20/mo platform fee + on-demand |

**The 10s function timeout is the immediate blocker.** Several routes use
`force-dynamic` (`/shop/[category]`, `/products/[slug]`, member dashboard, etc.)
and call the Wix SDK during render. Under load these can exceed 10s and start
returning 504s on Hobby. Pro raises this to 300s.

**This must happen before the DNS cutover at cf-3qt.8.** Once `carolinafutons.com`
points at the project, the project name change (transfer renames the URL slug)
won't affect the apex domain — but you want the larger limits in place when real
traffic hits.

---

## Decision: Option A or Option B?

| Option | What it does | Recommended when |
|--------|--------------|------------------|
| **A — Transfer to a new team** | Creates a fresh Vercel team (e.g. `carolinafutons`), transfers the project there, upgrades the team to Pro. | **Default recommendation.** Lets Stilgar add crew/contractors later, gives shared env vars at team scope, and isolates billing from the personal account. |
| **B — Upgrade personal account to Pro** | Leaves the project on `dreadpiraterobertzs-projects`, just upgrades that personal account to Pro. | Faster (no transfer step), but a personal Pro account still has only one user — no way to share access without transferring later. |

> **If unsure, do Option A.** The transfer is zero-downtime and reversible
> (you can transfer back to the personal account later). Picking B and switching
> later means doing the whole transfer flow during/after DNS cutover, which is
> riskier than doing it now.

---

## Option A — Transfer to a new team (recommended)

### Pre-flight (5 min)

- [ ] You are signed in as `DreadPirateRobertz` (the current Owner of the personal account / Hobby team).
- [ ] You have a credit card ready — Pro is **$20/month platform fee + on-demand usage** (1 deploying seat included, $20 monthly usage credit included, $20/mo per additional Owner/Member seat, Viewer seats free).
- [ ] Pick a team slug. Recommendation: `carolinafutons` (matches the brand domain).
- [ ] Confirm no deploys are in flight: <https://vercel.com/dreadpiraterobertzs-projects/carolina-futons-web/deployments>. The active deploy queue freezes during transfer (10s–10min window).

### Step 1 — Create the target team

1. Open <https://vercel.com/dashboard>.
2. Click the **team switcher** at the top-left of the nav bar.
3. Choose **Create Team**.
4. **Team name:** `Carolina Futons`. **Slug:** `carolinafutons`.
5. Pick **Pro** plan (or start with Hobby if you want to add the payment method during transfer — Vercel will prompt before the transfer completes).
6. Add the credit card if prompted.

> The new team starts with **only you** as a member. You can invite crew later
> via Settings → Members.

### Step 2 — Initiate the transfer

1. Switch back to the personal account team in the team switcher (top-left).
2. Open the project: <https://vercel.com/dreadpiraterobertzs-projects/carolina-futons-web>.
3. **Settings** in the top nav → **General** in the sidebar.
4. Scroll to the very bottom of the page → **Transfer Project** section → click **Transfer**.
5. In the modal:
   - **Target team:** select the `Carolina Futons` team you just created.
   - **Project name:** keep `carolina-futons-web` (or rename — but only if no other project on the target team uses that name; the dropdown will warn you).
   - Review the displayed list of **domains, aliases, and environment variables** about to transfer. **Sanity check:** any custom domain (`carolinafutons.com`) and all `WIX_*`, `SENTRY_*`, `TURNSTILE_*`, `NEXT_PUBLIC_*` env vars should appear.
6. Click **Transfer**.
7. Vercel redirects you to the new project URL on the target team
   (`https://vercel.com/carolinafutons/carolina-futons-web`) and shows in-progress
   indicators. **Do not** create deployments or edit settings until the spinner
   resolves. Total: 10s–10min depending on history size.
8. Both the initiator and the target team's owners receive an email when complete.

### Step 3 — Reconfigure things that don't carry over

Per Vercel docs, the following do NOT transfer and must be reconfigured on the
target team **after** transfer completes:

| Item | Action | Notes |
|------|--------|-------|
| **Integrations** | Re-add via target team **Settings → Integrations** | Likely: Sentry, GitHub (Git connection itself transfers, but the Sentry integration is separate). |
| **`vercel.json` env vars** | N/A — repo has no `vercel.json` (per blaidd's audit) | Confirmed in upgrade-runbook.md §3.1. Skip. |
| **Custom Log Drains** | Re-add via Settings → Log Drains | Currently none configured (per blaidd's audit). Skip. |
| **Edge Configs** | Use the [separate transfer flow](https://vercel.com/docs/storage#transferring-your-store) | Not used by this project as of 2026-05-04. Skip unless added later. |
| **Vercel Blob** | Use the [separate transfer flow](https://vercel.com/docs/storage#transferring-your-store) | Not used by this project. Skip. |
| **Secure Compute / Static IPs** | Disconnect on origin, reconnect on target | Not used by this project. Skip. |
| **Active Branches list** | Will repopulate as new pushes arrive | Cosmetic — no action needed. |
| **Usage counters** | Reset to 0 on the new team | Expected — gives Pro plan a clean billing-cycle baseline. |
| **Monitoring data + log history** | Lost — does not transfer | Sentry holds error history independently; only Vercel-native logs reset. |

**What DOES transfer automatically** (no action needed):
deployments, environment variables (non-`vercel.json`), project config, domains
and aliases (see "Domain handling" below), administrators, project name, builds,
**Git repository link**, security settings, cron jobs, preview comments, Web
Analytics, Speed Insights, Function Region, directory-listing setting.

### Step 4 — Domain handling

Per Vercel's transfer docs, behavior depends on whether the domain is a root,
subdomain, or wildcard:

| Domain pattern | Transfer behavior |
|----------------|-------------------|
| Root domain (`carolinafutons.com`) | **Moved** to target team. Target team becomes primary owner & billing entity (if purchased through Vercel). |
| Subdomain (`blog.carolinafutons.com`) | **Delegated** to target team. Root stays on origin. |
| Wildcard (`*.carolinafutons.com`) | **Delegated** to target team. Root stays on origin. |

**Carolina Futons is on an external registrar** (cf-3qt.8 will set up DNS),
so the root-domain billing nuance doesn't apply — there's no Vercel-side
domain bill to move. DNS records continue to point at the same Vercel IPs;
no DNS change is needed during the transfer itself.

### Step 5 — Verify

```bash
# CLI verification (run from the carolina-futons-web repo)
vercel whoami            # should show 'carolinafutons' team slug, not 'dreadpiraterobertz'
vercel link              # re-link the local repo to the new team (one-time)
vercel project ls        # carolina-futons-web should appear under the new team
vercel env ls production # spot-check WIX_*, SENTRY_*, TURNSTILE_* are present
```

Dashboard verification:

- [ ] <https://vercel.com/carolinafutons/carolina-futons-web> loads with deployment history intact.
- [ ] **Production deployment** badge points at the same commit hash that was production before transfer.
- [ ] <https://vercel.com/carolinafutons/~/settings/billing> shows **Pro** plan with $20 platform fee on next invoice.
- [ ] **Settings → Domains** lists `carolinafutons.com` (or whatever domains exist) with green "Configured" status.
- [ ] **Settings → Environment Variables** matches the env-var count from before transfer (compare with a screenshot taken pre-transfer).
- [ ] Trigger a fresh deploy: `vercel --prod` (or push a no-op commit) and confirm it builds with the new project URL `https://vercel.com/carolinafutons/...`.

### Step 6 — Update CI / scripts (if any)

```bash
# Search the repo for any hard-coded references to the old team slug
grep -r "dreadpiraterobertzs-projects" /Users/hal/gt/carolina-futons-web
```

If any matches show up (CI configs, scripts, README badges), update them to
`carolinafutons`. As of 2026-05-04, blaidd's audit found no `vercel.json` and
no hardcoded team references — but verify.

---

## Option B — Upgrade personal account to Pro (in place)

Use this only if Stilgar wants single-user ownership for now and is OK
re-doing the transfer flow later when adding crew.

1. Sign in to Vercel as `DreadPirateRobertz`.
2. Top-left team switcher → ensure the personal account is selected.
3. **Settings** → **Billing** → **Upgrade to Pro**.
4. Enter payment info, confirm.
5. Pro takes effect immediately — no redeploy needed.
6. Verify via dashboard that the **Pro** badge appears next to the account name.
7. Trigger `vercel --prod` to exercise the new function-timeout budget.

### Limitations of Option B

- A personal Pro account still cannot have multiple Owner/Member seats — Pro on
  a personal account = single-user with bigger limits, no collaboration features.
- Future addition of crew (e.g., merlin, godfrey for shared deploys) requires
  doing Option A's transfer flow later. **At that point** all of the
  "not-transferred" items from Step 3 reset on the new team — meaning if Sentry
  integration, log drains, or analytics history were added during the personal-Pro
  era, they'd need re-adding.
- Doing Option A now (when very little custom config exists) is cheaper than
  doing it later.

---

## Rollback

Vercel transfers are not strictly "undoable" with a single click, but they're
trivially reversible by running the transfer flow in the opposite direction
(target team → personal account). The same zero-downtime guarantee applies.

If post-transfer issues arise:

1. **Don't panic.** Production traffic continues serving from the same edge
   network — only the Vercel control plane / billing entity changed.
2. Check Sentry, the deployment logs on the new team, and the env-var diff
   (compare against the pre-transfer screenshot).
3. If integrations broken: re-add them on the target team (Step 3 table).
4. If genuinely catastrophic: initiate a transfer back to `dreadpiraterobertzs-projects`
   from the new team's project Settings → General → Transfer.

For Pro billing surprises, contact Vercel support within 24h of the upgrade
for a prorated refund (per blaidd's earlier note in `upgrade-runbook.md`).

---

## DNS cutover dependency (cf-3qt.8)

This runbook should run **before** cf-3qt.8 (DNS cutover). Sequence:

1. Today: complete Option A (transfer + Pro upgrade).
2. Verify all checklist items in Step 5.
3. Configure custom domain `carolinafutons.com` on the new team's project (if
   not already attached): Settings → Domains → Add → `carolinafutons.com` →
   follow Vercel's DNS-record instructions.
4. Update DNS at the registrar to point at Vercel's nameservers / records
   (cf-3qt.8 main runbook covers this).
5. Monitor: Vercel Pro analytics + Sentry for the 24h post-cutover.

---

## Acceptance

- [ ] Project `carolina-futons-web` lives under team slug `carolinafutons` (or
      personal Pro, if Option B chosen).
- [ ] Plan badge shows **Pro**.
- [ ] All environment variables reconciled against a pre-transfer snapshot.
- [ ] All custom domains attached and **Configured** (green status).
- [ ] Sentry integration re-added (if it was on the source).
- [ ] No `vercel.json` env-var orphans (none expected — repo has no `vercel.json`).
- [ ] Fresh `vercel --prod` deploys cleanly from the local CLI.
- [ ] Bead `cf-3qt.8.25` closed.

---

## References

- Vercel docs — Transferring a project: <https://vercel.com/docs/projects/transferring-projects>
- Vercel docs — Pro plan pricing: <https://vercel.com/docs/plans/pro-plan>
- Vercel docs — Account management: <https://vercel.com/docs/accounts>
- Predecessor runbook: `crew/melania/upgrade-runbook.md` (blaidd, cf-3qt.8.1) — covers the upgrade-in-place flow + Hobby-only config audit. This runbook supersedes its transfer section with current Vercel UX.
