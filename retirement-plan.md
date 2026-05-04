# Wix Studio Retirement Plan — cf-3qt.9.1

**Author:** morgott  
**Date:** 2026-05-04  
**Status:** Draft — awaiting Stilgar sign-off  
**Execute after:** cf-3qt.8 complete + 24 h traffic stable on Vercel

---

## 1. Wix Studio Unpublish Steps

> **DO NOT EXECUTE** until Stilgar signs off on the checklist in §4.  
> DNS must already point to Vercel and be stable for ≥ 24 h before unpublishing.

### Pre-flight checks (run before starting)

- [ ] `curl -I https://carolinafutons.com` returns `server: Vercel` (not Wix)
- [ ] Wix Stores API still responds: `curl https://carolinafutons.com/api/healthcheck` → 200
- [ ] No active Wix Studio A/B tests or scheduled publishes pending
- [ ] Wix dashboard → **Analytics** → confirm zero organic traffic hitting Wix-rendered pages

### Unpublish sequence

1. Log in to **wix.com** with the Carolina Futons owner account.
2. Open the **Carolina Futons** site dashboard.
3. Top-right → **Site Actions** → **Manage Site** (or **Settings** depending on plan UI).
4. **Publishing** → **Unpublish Site**.
   - Wix will warn that the site will go offline. Confirm.
   - Effect: The Wix Studio rendering layer is disabled. The custom domain is unaffected (DNS still routes to Vercel). Wix Stores API, Velo backend, and the dashboard remain fully active.
5. Verify: navigate to `https://carolinafutons.com` — should still serve the Next.js storefront via Vercel (DNS unchanged).
6. Verify: Wix dashboard → **Store Products** still loads → API still functional.
7. Record the unpublish timestamp in this file under **Execution Log** below.

### Rollback

If the unpublish causes unexpected API breakage:  
**Wix dashboard → Publishing → Publish Site** to re-enable rendering instantly.  
No DNS changes are needed for rollback.

---

## 2. Archive EDITOR_HOOKUP_GUIDE

The guide was the primary developer reference for the Wix Studio front-end. It is no longer the live reference (replaced by `docs/SITE-OWNER-GUIDE.md` and `docs/TESTING-GUIDE.md`), but should be preserved for audit and historical context.

### Files to archive

| Source path | Archive destination |
|---|---|
| `cfutons/EDITOR_HOOKUP_GUIDE.html` | `docs/archive/EDITOR_HOOKUP_GUIDE.html` |
| `docs/EDITOR-HOOKUP-GUIDE.md` (if present) | `docs/archive/EDITOR-HOOKUP-GUIDE.md` |

### Archive steps (to be executed by dev)

```bash
mkdir -p docs/archive
git mv cfutons/EDITOR_HOOKUP_GUIDE.html docs/archive/EDITOR_HOOKUP_GUIDE.html
# If markdown version exists:
git mv docs/EDITOR-HOOKUP-GUIDE.md docs/archive/EDITOR-HOOKUP-GUIDE.md
git commit -m "chore: archive EDITOR_HOOKUP_GUIDE — Wix Studio retired"
```

> Note: Copies of `EDITOR_HOOKUP_GUIDE.html` in crew worktrees  
> (`crew/*/EDITOR_HOOKUP_GUIDE.html`) are crew-local files and can be  
> left in place or deleted at crew discretion — they are not in the  
> `carolina-futons-web` repo.

---

## 3. Wix Premium Downgrade Evaluation

### Current setup (assumed)

| Component | Used for |
|---|---|
| Wix Business / eCommerce plan | Full Wix Studio rendering + Stores + Velo |
| Custom domain connected to Wix | (now re-pointed to Vercel) |
| Wix Stores | Product catalog, inventory, orders, checkout |
| Velo (Wix Dev Mode) | Serverless backend functions, custom APIs |

### Requirements after Wix Studio retirement

After unpublishing, we no longer need Wix to render pages. We need only:

1. **Wix Stores** — product catalog, inventory management, order processing, payment processing
2. **Wix Headless API** — REST/SDK access from the Next.js backend (`@wix/stores`, `@wix/auto_sdk_stores_*`)
3. **Velo** — if any serverless functions are still active (e.g. webhook receivers, price-match automation)

### Wix plan options (as of late 2025 — verify current pricing at wix.com/upgrade)

> ⚠️ Pricing was last verified against Wix documentation ~August 2025.  
> Confirm current tiers at **wix.com/upgrade** before committing to a downgrade.

| Plan | ~Monthly (annual) | Wix Stores | Velo | Rendering | Notes |
|---|---|---|---|---|---|
| **Wix Headless** | ~$13 | ✅ API only | ✅ | ❌ None | Purpose-built for our use case |
| Business Basic | ~$17 | ✅ | ✅ | ✅ (unneeded) | Paying for rendering we don't use |
| Business Unlimited | ~$25 | ✅ | ✅ | ✅ (unneeded) | Current plan likely here or above |
| Business VIP | ~$35 | ✅ | ✅ | ✅ (unneeded) | Overpowered |

**Recommended path:** Downgrade to **Wix Headless** plan.

This plan was introduced specifically for sites that use Wix as a commerce backend while rendering elsewhere. It includes the Wix Stores API and Velo execution but drops the Wix Studio rendering infrastructure.

### Estimated cost delta

| Scenario | Monthly (annual billing) |
|---|---|
| Current (assumed Business Unlimited) | ~$25/mo |
| Target (Wix Headless) | ~$13/mo |
| **Estimated monthly savings** | **~$12/mo (~$144/yr)** |

Exact savings depend on the current plan and whether any promotional/legacy pricing applies. Check the Wix dashboard billing page before calculating final delta.

### Downgrade risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Plan downgrade removes a feature we rely on | Low | Verify Headless plan includes Stores API + Velo before committing |
| Velo function limits lower on Headless | Medium | Check Velo execution quota on Headless vs current plan |
| Checkout flow breaks (Wix-hosted checkout) | Low | Wix Stores checkout is backend — not tied to rendering plan |
| Price-match webhook receiver stops firing | Low | Velo is included in Headless; test in staging first |

---

## 4. Stilgar Sign-Off Checklist

**Instructions for Stilgar:** Review each item and confirm before morgott / melania proceeds with execution.

### Pre-conditions (must all be ✅ before executing)

- [ ] **DNS stable:** `carolinafutons.com` has served from Vercel for ≥ 24 h with no reported errors
- [ ] **cf-3qt.8 complete:** All Phase 8 work merged and confirmed live
- [ ] **Order history confirmed:** Verify Wix order history and fulfillment records are not stored solely in Wix Studio rendering layer (they are in Wix Dashboard — but confirm)
- [ ] **SEO baseline captured:** Google Search Console shows Vercel pages indexed, no lingering Wix-rendered URLs in coverage

### Execution approvals

- [ ] **Stilgar approves Wix Studio unpublish** (§1)
- [ ] **Stilgar approves EDITOR_HOOKUP_GUIDE archive** (§2) — or requests a copy emailed first
- [ ] **Stilgar confirms current Wix plan** (log in → Billing → current subscription name + monthly cost)
- [ ] **Stilgar approves Wix Headless downgrade** (§3) — or chooses to defer

### Post-execution sign-offs

- [ ] Store Products API smoke test passes post-unpublish
- [ ] `/shop/futon-frames`, `/shop/mattresses`, `/products/<any-slug>` all load on Vercel
- [ ] Wix dashboard order management still functional
- [ ] Price-match form submission still reaches email (ContactSubmissions webhook)

---

## Execution Log

_Fill in as steps are executed._

| Date | Action | Executed by | Notes |
|---|---|---|---|
| — | Wix Studio unpublished | — | — |
| — | EDITOR_HOOKUP_GUIDE archived | — | — |
| — | Wix plan downgraded | — | — |
