# Vercel Pro Upgrade Runbook — Carolina Futons Web

**Prepared by:** blaidd  
**Bead:** cf-3qt.8.1  
**Date:** 2026-05-04  
**Scope:** Documentation only — no upgrade performed here.

---

## 1. Upgrade Steps

### 1.1 Pre-flight checklist (do before upgrading)

- [ ] Confirm the person performing the upgrade has **Owner** role on the Vercel team (Settings → Members)
- [ ] Have a credit card ready — Pro is $20/seat/month billed monthly (or $16/seat/month annual)
- [ ] Verify DNS cutover is NOT in-flight — upgrading mid-deploy is safe but confusing to debug

### 1.2 Upgrade path

1. Log in to **vercel.com** as the account owner
2. Navigate to **Dashboard → (team selector, top-left) → Settings → Billing**
3. Click **Upgrade to Pro**
4. Select billing cycle (monthly vs annual) and enter payment info
5. Confirm — the team upgrades immediately; no redeploy required
6. Verify: Dashboard shows **Pro** badge next to team name

### 1.3 Post-upgrade verification

```bash
# Confirm project is linked to the upgraded team
vercel whoami            # should show team slug, not personal account
vercel project ls        # carolina-futons-web should appear

# Trigger a fresh deploy to exercise Pro limits
vercel --prod
```

---

## 2. Team Account Confirmation

**Current project URL:** `https://carolina-futons-web.vercel.app`  
**GitHub repo:** `DreadPirateRobertz/carolina-futons-web`

The Vercel project name visible in CI deploy URLs (from PR check links in PRs #389, #394, #402, #408) is **`dreadpiraterobertzs-projects/carolina-futons-web`** — this is a *personal account* project under the `DreadPirateRobertz` user, **not a team account**.

**Action required before upgrading:**
- Either upgrade the `DreadPirateRobertz` personal account to Pro, **or**
- Transfer the project to a dedicated team account (recommended for multi-crew access)

To transfer: Vercel Dashboard → carolina-futons-web → Settings → Transfer Project → select/create team

**Recommendation:** Create a `carolinafutons` Vercel team, transfer the project, then upgrade the team to Pro. This gives Stilgar team-level access controls and shared env vars.

---

## 3. Hobby-Only Config Audit

### 3.1 No `vercel.json` found

The repo has **no `vercel.json`**. All Vercel config is implicit via Next.js conventions. This is fine — no Hobby-specific flags to clear.

### 3.2 `next.config.ts` — no blockers

- No `cron` jobs configured
- No `edge` runtime declarations
- No `maxDuration` exports
- `dynamic = "force-dynamic"` on 15 routes — this is valid on both Hobby and Pro, but on Hobby serverless functions have a **10s timeout**; Pro raises this to **300s**. The force-dynamic PLP/PDP routes (`/shop/[category]`, `/products/[slug]`, member dashboard) will benefit immediately.

### 3.3 ISR `revalidate` settings

| Route | revalidate |
|---|---|
| `/blog` | 300s (5 min) |
| `/blog/[slug]` | 300s (5 min) |
| `/press` | 86400s (24h) |
| `/community-gallery` | 3600s (1h) |

All within Hobby limits. Pro raises ISR to unlimited revalidation frequency — no changes needed.

### 3.4 Env vars — nothing Hobby-locked

`.env.example` lists standard Wix + Sentry vars. No Hobby-specific env vars. `NEXT_PUBLIC_USE_FIXTURE_PRODUCTS` is Preview-only by convention (documented in `.env.example`).

---

## 4. What Upgrades Unlock

| Feature | Hobby | Pro |
|---|---|---|
| Serverless function timeout | 10s | 300s |
| Bandwidth | 100 GB/mo | 1 TB/mo |
| Build minutes | 6,000/mo | 24,000/mo |
| Preview deployments | Unlimited | Unlimited |
| Team members | 1 (personal) | Unlimited |
| Password protection (preview) | ✗ | ✓ |
| Custom log drains (Sentry) | ✗ | ✓ |
| Vercel Analytics (Web Vitals) | Limited | Full |
| Support | Community | Email |

The 10s → 300s function timeout is the critical unlock for `/shop/[category]` (force-dynamic, Wix SDK calls) and member dashboard routes during peak load.

---

## 5. Rollback

Vercel does not offer a "downgrade" path mid-billing-cycle, but there are no config changes to revert — the upgrade is purely account-level. If the upgrade causes unexpected billing, contact Vercel support within 24h for a prorated refund.

---

## 6. DNS Cutover Dependency

This upgrade should happen **before** DNS cutover (`cf-3qt.8` milestone) so:
- The Pro timeout limit is in place when real traffic hits force-dynamic routes
- Stilgar can add team members (crew) to the Vercel project before go-live
- Custom log drains (Sentry) can be configured pre-launch

---

*Runbook owner: blaidd | Review with Stilgar before executing.*
