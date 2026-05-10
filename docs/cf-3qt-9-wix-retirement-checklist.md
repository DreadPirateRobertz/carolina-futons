# cf-3qt.9 — Wix Studio Retirement Checklist

**Phase:** cf-3qt.9 (final phase of the cf-3qt epic — full migration to Next.js + Wix Headless)
**Status:** Pre-work — DOCUMENTATION ONLY. Execution gated on cf-3qt.8 (DNS cutover) + 24 h prod stability.
**Audience:** Stilgar (sign-off), melania (PM), engineering (execution)
**Predecessors:** This consolidates the retirement research from cf-3qt.9.1 (`crew/melania/retirement-plan.md` — production focus) and cf-3qt.9.2 (`crew/melania/wix-retirement-checklist.md` — staging focus). Both authored by morgott on 2026-05-04.

> ⚠️ **Do NOT execute any step in this document until:**
> 1. cf-3qt.8 (DNS cutover) is complete AND `carolinafutons.com` has served from Vercel for ≥ 24 h with zero P0/P1 rollback triggers, AND
> 2. Stilgar has signed every box in §6 below.

---

## 0. Scope at a glance

| What gets retired | What stays active |
|---|---|
| Wix Studio rendering layer (the page editor + published front-end) | Wix Stores (catalog, inventory, orders, payments, fulfillment) |
| `EDITOR_HOOKUP_GUIDE.html` as the live developer reference | Wix Headless APIs (`@wix/stores`, `@wix/auto_sdk_*`) consumed by Next.js |
| The `cf-yw0m` editor-hookup standing order | Wix CMS collections (read-only data source for cfw) |
| Free-tier staging site `My Site 5` (metaSiteId `3af610bf`) | Velo backend (`src/backend/**`) — webhooks, cron, custom APIs |
| | Production carolinafutons.com (DNS already pointing at Vercel) |

The migration retires the *front-end rendering* and *page editor* — not Wix as a backend.

---

## 1. Production Wix Studio Unpublish (carolinafutons.com)

> Detail: `crew/melania/retirement-plan.md §1`. Summary follows.

### 1.1 Pre-flight checks

Execute every check **before** clicking Unpublish:

- [ ] `curl -I https://carolinafutons.com` → header `server: Vercel` (NOT Wix)
- [ ] `curl https://carolinafutons.com/api/healthcheck` → `200 OK`
- [ ] Vercel dashboard: production deploy stable for ≥ 24 h, no traffic anomalies
- [ ] Wix dashboard → **Analytics** → confirm zero organic traffic on Wix-rendered URLs in the last 24 h
- [ ] No active Wix Studio A/B tests, no scheduled publishes
- [ ] Sentry P0/P1 rate at baseline for ≥ 24 h post-cutover

### 1.2 Unpublish sequence (UI)

1. Log in at **wix.com** with the Carolina Futons owner account.
2. Open the **Carolina Futons** site dashboard.
3. **Site Actions** → **Manage Site** (or **Settings** depending on plan UI).
4. **Publishing** → **Unpublish Site** → confirm.
5. Verify `https://carolinafutons.com` still serves the Next.js storefront via Vercel.
6. Verify Wix dashboard → **Store Products** still loads (API still functional).
7. Record timestamp in §7 Execution Log.

### 1.3 What unpublish does (and doesn't)

| Effect | After unpublish |
|---|---|
| Wix Studio page rendering | ❌ Disabled |
| Wix Stores REST/SDK API | ✅ Still live |
| Velo backend (`src/backend/**`) | ✅ Still live |
| Custom domain `carolinafutons.com` | ✅ Unaffected — DNS routes to Vercel |
| Wix dashboard / order management | ✅ Still functional |

### 1.4 Risks + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Wix Stores API breaks because rendering is off | Low | Stores API is plan-tier, not render-tier. Verified per Wix docs. Smoke-test §8. |
| Velo HTTP functions stop firing | Low | Velo is plan-tier, not render-tier. Test in §8. |
| Wix-hosted checkout page breaks | Low | Checkout is backend; not tied to Wix Studio rendering. |
| SEO regression — Google still has Wix-rendered URLs in index | Medium | Vercel pages must be in Search Console coverage report ≥ 24 h pre-unpublish. |
| Email triggers (price-match, Q&A) stop reaching ops | Low | Webhooks live in Velo; un-coupled from rendering. Verify §8. |
| Wix dashboard login breaks | None | Dashboard is decoupled from site publish status. |

### 1.5 Rollback

Rollback is one click: **Wix dashboard → Publishing → Publish Site**. No DNS changes needed.

---

## 2. Staging Site Unpublish (`My Site 5`, metaSiteId `3af610bf`)

> Detail: `crew/melania/wix-retirement-checklist.md`.

`My Site 5` is a free-plan dev sandbox under the halworker85 account at
`https://chrisdealglass.wixstudio.com/my-site`. **Not** the same site as production.

### 2.1 Pre-flight

- [ ] Confirm `My Site 5` has no active integrations expecting it to be published
- [ ] Confirm no Velo webhooks under `My Site 5` receive production traffic

### 2.2 Unpublish (UI Path A — recommended)

1. `https://manage.wix.com/dashboard/3af610bf/home`
2. Sidebar → **Site & Mobile App** → **Site Actions** → **Unpublish Site**
3. Confirm dialog
4. Verify `chrisdealglass.wixstudio.com/my-site` returns the "site is not published" page

### 2.3 Notes

- No Stilgar sign-off needed for `My Site 5` — it's a staging/dev site with no production traffic.
- No subscription action: it's already on the free tier.
- The production STAGING_SITE used for editor work pre-migration is on free/Lite (Upgrade CTA visible in dashboard) — same treatment applies.

---

## 3. What Wix services stay active post-cutover

> Required by Phase 9 to ensure no service we depend on gets dropped.

### 3.1 Active dependencies

| Service | What we use it for | Where it's wired |
|---|---|---|
| **Wix Stores** | Product catalog, variants, inventory, orders, payment processing, fulfillment records | cfw `actions/*` calling Wix Headless SDK |
| **Wix Headless API (`@wix/stores`, `@wix/auto_sdk_stores_*`)** | Cart, checkout, member sessions, redirect-to-checkout flow | cfw `lib/wix-client.ts` + `actions/cart.ts` |
| **Wix CMS collections** | Static-ish content (Blog, FAQs, ContactSubmissions, NewsletterSubscribers, etc.) | cfw `lib/wix-cms.ts`; Velo `*.web.js` for writes |
| **Velo HTTP functions (`src/backend/http-functions.js`)** | Server-side endpoints for webhooks, rate-limited writes (contact form, swatch request, etc.), price-match orchestrator | cfw calls via `/_functions/*` |
| **Velo events (`src/backend/events.js`, `*.events.js`)** | `wixEcom_onOrderCreated`, `wixEcom_onOrderApproved`, `wixEcom_onOrderFulfilled`, `wixEcom_onFulfillmentCreated` (post cf-fovb) — drive the email/SMS notification orchestrator | Velo runtime |
| **Wix Secrets Manager** | WWEX SOAP credentials, Turnstile keys, mailer creds | Velo runtime via `wix-secrets-backend` |
| **Wix dashboard** | Manual order management, customer support, Stores admin | Stilgar / ops |

### 3.2 Services we explicitly stop using

| Service | Replacement |
|---|---|
| Wix Studio page editor | n/a — Next.js source in `carolina-futons-web` repo |
| Wix Studio rendering layer (HTML/CSS/JS bundle Wix shipped to browsers) | Vercel-hosted Next.js |
| `EDITOR_HOOKUP_GUIDE.html` as the live reference | `docs/SITE-OWNER-GUIDE.md` + `docs/TESTING-GUIDE.md` |
| Wix Studio analytics dashboard | Vercel Analytics + custom events |
| Wix Studio A/B testing tool | Application-layer feature flags / experiments |

### 3.3 Future scope (NOT in cf-3qt.9)

Tracked separately in **cf-xe2** (full Wix exit — Velo → Vercel Functions, Stores → headless commerce, CMS → Sanity/Payload). Do not pull forward into Phase 9.

---

## 4. Wix Premium plan downgrade evaluation

> Detail: `crew/melania/retirement-plan.md §3`.

### 4.1 Why downgrade

Once Wix Studio rendering is unpublished, the only Wix infrastructure we still use is:
- Wix Stores API (catalog + checkout backend)
- Wix CMS API (read-only data source)
- Velo backend execution (webhooks, cron, custom APIs)

No part of that requires the rendering tier.

### 4.2 Plan options (verify current pricing at wix.com/upgrade)

> ⚠️ Pricing last verified ~August 2025 per morgott's research. **Re-verify current tiers at wix.com/upgrade before committing.**

| Plan | ~Monthly (annual) | Wix Stores API | Velo | Wix Studio Rendering | Notes |
|---|---|---|---|---|---|
| **Wix Headless** | ~$13 | ✅ | ✅ | ❌ (we don't need it) | **Recommended** — purpose-built for our use case |
| Business Basic | ~$17 | ✅ | ✅ | ✅ (unused) | Pays for rendering we won't use |
| Business Unlimited | ~$25 | ✅ | ✅ | ✅ (unused) | Likely current plan |
| Business VIP | ~$35 | ✅ | ✅ | ✅ (unused) | Overprovisioned |

### 4.3 Estimated cost delta

| Scenario | ~Monthly (annual) |
|---|---|
| Current (assumed Business Unlimited) | $25 |
| Target (Wix Headless) | $13 |
| **Estimated savings** | **~$12/mo (~$144/yr)** |

Exact savings depend on the actual current plan and whether legacy/promotional pricing applies. Have Stilgar pull the current subscription cost from **Wix Dashboard → Billing & Subscriptions** before committing.

### 4.4 Downgrade path (UI)

1. Wix Dashboard → **Billing & Subscriptions**
2. Identify the current active plan (record exact name + monthly cost in §7)
3. **Change Plan** → select **Wix Headless**
4. Wix may prompt for cancellation confirmation; review what the downgrade removes (rendering tier features) — for us, nothing required
5. Confirm
6. Record in §7 Execution Log

### 4.5 Downgrade risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Headless plan removes a feature we still rely on | Low | Verify Wix Headless plan page lists Stores API + Velo before committing |
| Velo execution quotas lower on Headless | Medium | Pull current Velo quota usage. Compare to Headless quota. Test in staging if uncertain. |
| Wix Stores checkout flow breaks | Low | Checkout is backend-only and plan-tier-agnostic. |
| Webhook delivery breaks | Low | Velo is included in Headless; smoke-test §8. |
| Pricing changes by the time we execute | Medium | Re-verify at wix.com/upgrade before clicking |

### 4.6 Stilgar approval gate

Downgrade does NOT execute until Stilgar (a) confirms current plan + cost, (b) reviews the Wix Headless feature page, (c) signs §6.

---

## 5. Guide archival

> Detail: `crew/melania/retirement-plan.md §2`.

### 5.1 Files to archive

| Source path | Archive destination |
|---|---|
| `cfutons/EDITOR_HOOKUP_GUIDE.html` | `docs/archive/EDITOR_HOOKUP_GUIDE.html` |
| `docs/EDITOR-HOOKUP-GUIDE.md` (if present) | `docs/archive/EDITOR-HOOKUP-GUIDE.md` |

### 5.2 Archive steps (executed by dev — single PR)

```bash
mkdir -p docs/archive

# Header banner: prepend a RETIRED notice to each file before moving.
# (HTML — insert above <body>, MD — top-of-file blockquote.)

git mv cfutons/EDITOR_HOOKUP_GUIDE.html docs/archive/EDITOR_HOOKUP_GUIDE.html
git mv docs/EDITOR-HOOKUP-GUIDE.md docs/archive/EDITOR-HOOKUP-GUIDE.md  # if present

git commit -m "chore(cf-3qt.9): archive EDITOR_HOOKUP_GUIDE — Wix Studio retired (see cf-3qt)"
```

### 5.3 Banner template

Markdown header to prepend to each archived doc:

```markdown
> **🚫 RETIRED — DO NOT USE FOR NEW WORK**
>
> This document described the Wix Studio editor hookup pattern, which was retired
> as part of [cf-3qt](../bd/cf-3qt) (full migration to Next.js + Wix Headless).
> Archived on YYYY-MM-DD for historical reference. The current developer reference
> is [SITE-OWNER-GUIDE.md](../SITE-OWNER-GUIDE.md) +
> [TESTING-GUIDE.md](../TESTING-GUIDE.md).
```

HTML equivalent (top of `<body>`):

```html
<div style="background:#fee;border:2px solid #c33;padding:1em;margin-bottom:1em;font-weight:bold">
  🚫 RETIRED — Do not use for new work. Wix Studio was retired as part of cf-3qt.
  Archived YYYY-MM-DD. Current reference: docs/SITE-OWNER-GUIDE.md.
</div>
```

### 5.4 Crew worktree copies

Copies of `EDITOR_HOOKUP_GUIDE.html` exist in some `crew/*/` dirs. These are crew-local files, not in the published doc tree, and can be left in place or deleted at crew discretion.

### 5.5 Standing-order removal

After archive lands:

- [ ] Remove `cf-yw0m` (editor hookup standing order) from melania's auto-memory
- [ ] Remove related instructions from any active `CLAUDE.md` / `AGENTS.md` files
- [ ] Mail godfrey + remaining crew about the retirement

---

## 6. Stilgar sign-off

**Instructions:** Each box must be checked before any §1, §4, or §5 step executes.

### 6.1 Pre-conditions (gate execution)

- [ ] **DNS stable:** `carolinafutons.com` served from Vercel for ≥ 24 h with no errors
- [ ] **cf-3qt.8 complete:** Phase 8 PRs all merged + confirmed live
- [ ] **30-day stability report green:** uptime, order rate, performance, P0/P1 incident review (cf-3qt.9 acceptance gate)
- [ ] **Order history confirmed durable:** Verified in Wix Dashboard, NOT solely in the Studio rendering layer
- [ ] **SEO baseline captured:** Search Console shows Vercel pages indexed; no significant Wix-only URLs in coverage

### 6.2 Per-step approvals

- [ ] **Stilgar approves Wix Studio production unpublish** (§1)
- [ ] **Stilgar approves staging site unpublish** (§2) — *can be self-approved by ops if not gated*
- [ ] **Stilgar approves EDITOR_HOOKUP_GUIDE archive** (§5) — or requests a copy emailed first
- [ ] **Stilgar confirms current Wix plan + monthly cost** (§4.3 — pulled from Billing dashboard)
- [ ] **Stilgar approves Wix Headless downgrade** (§4) — or chooses to defer to a separate decision

### 6.3 Post-execution sign-offs

Run **after** unpublishing + downgrading. Each must pass.

- [ ] Wix Stores API smoke test passes (§8 below)
- [ ] cfw `/shop/futon-frames`, `/shop/mattresses`, `/products/<slug>` all 200 from Vercel
- [ ] Wix dashboard order management still functional (place test order)
- [ ] Price-match form submission still reaches email (ContactSubmissions webhook fires)
- [ ] Q&A submission still reaches Velo (`submitQuestion` webhook fires)
- [ ] No Sentry P0/P1 spike in 24 h post-unpublish
- [ ] Tag `v-wix-studio-retired` in both `carolina-futons` and `carolina-futons-web` repos
- [ ] Retrospective doc opened (will live at `docs/cf-3qt-retrospective.md`)

---

## 7. Execution log

| Date | Action | Executed by | Notes |
|---|---|---|---|
| — | Pre-flight checks complete | — | — |
| — | Stilgar §6.1 sign-off | — | — |
| — | Stilgar §6.2 sign-off | — | — |
| — | Production carolinafutons.com unpublished | — | — |
| — | Staging `My Site 5` unpublished | — | — |
| — | EDITOR_HOOKUP_GUIDE archived | — | — |
| — | Wix plan downgraded | — | from `<plan>` ($X) → Wix Headless ($Y), savings $Z/mo |
| — | Tag `v-wix-studio-retired` pushed | — | both repos |
| — | Retrospective opened | — | — |
| — | cf-yw0m standing order removed from memory | — | — |

---

## 8. Smoke-test playbook (post-unpublish)

Run within 1 h of unpublishing. Each must pass.

```bash
# 1. Vercel storefront still serving
curl -I https://carolinafutons.com                                     # 200, server: Vercel
curl -I https://carolinafutons.com/shop/futon-frames                   # 200
curl -s https://carolinafutons.com/products/savannah | grep -c name    # >= 1

# 2. Velo HTTP functions still firing
curl -X POST https://carolinafutons.com/_functions/wishlistService \
  -H 'Content-Type: application/json' -H 'Origin: https://carolinafutons.com' \
  -d '{"args":[]}'                                                      # 200 or 401 (NOT 404)

# 3. Wix Stores API still serving from cfw
curl -I https://carolinafutons.com/api/healthcheck                     # 200

# 4. Order placement (manual, 1 cent test product)
#    - place order via cfw checkout flow
#    - confirm appears in Wix Dashboard within 60s
#    - confirm wixEcom_onOrderCreated → confirmation email received
#    - confirm cfw success page renders
```

If any step fails → **rollback immediately** per §1.5 and §4 cancellation flow.

---

## 9. Linked beads

- **Parent:** cf-3qt (epic — full migration to Next.js + Wix Headless)
- **Predecessor:** cf-3qt.8 (DNS cutover)
- **Closed siblings (research that fed this doc):**
  - cf-3qt.9.1 (`crew/melania/retirement-plan.md` — production unpublish + downgrade research)
  - cf-3qt.9.2 (`crew/melania/wix-retirement-checklist.md` — staging site unpublish)
- **Future scope:** cf-xe2 (full Wix exit — backend → Vercel Functions, Stores → headless commerce, CMS → Sanity/Payload)
