# cf-3qt.9 — Wix Studio Retirement Checklist

**Phase:** cf-3qt.9 (final phase of the cf-3qt epic — full migration to Next.js + Wix Headless)
**Status:** Pre-work — DOCUMENTATION ONLY. Execution gated on cf-3qt.8 (DNS cutover) + the 30-day stability report defined in the cf-3qt.9 bead (uptime, order rate, performance, P0/P1 incident review).
**Audience:** Stilgar (sign-off), melania (PM), engineering (execution)
**Predecessors (research provenance — do NOT redirect operators back to these):** cf-3qt.9.1 (`crew/melania/retirement-plan.md`) and cf-3qt.9.2 (`crew/melania/wix-retirement-checklist.md`), both authored by morgott on 2026-05-04. This document is the single canonical source for execution; predecessors are kept for audit trail only.

> ⚠️ **Do NOT execute any step in this document until:**
> 1. cf-3qt.8 (DNS cutover) is complete AND `carolinafutons.com` has served from Vercel for the **30-day stability window** (cf-3qt.9 acceptance gate) with zero unaddressed P0/P1 rollback signals, AND
> 2. Stilgar has signed every box in §6 below.
>
> The "≥ 24 h" wording from the morgott predecessor docs is a *sub-gate* of the 30-day window (no execution within 24 h of any rollback signal), NOT a substitute. **§6 wins** if any other section appears to disagree on the gate.

---

## 0. Scope at a glance

| What gets retired | What stays active |
|---|---|
| Wix Studio rendering layer (the page editor + published front-end) | Wix Stores (catalog, inventory, orders, payments, fulfillment) |
| `EDITOR_HOOKUP_GUIDE.html` as the live developer reference | Wix Headless APIs (`@wix/stores`, `@wix/auto_sdk_*`) consumed by Next.js |
| The `cf-yw0m` editor-hookup standing order | Wix CMS collections (read-only data source for cfw) |
| Free-tier staging site `My Site 5` (metaSiteId `3af610bf`) | Velo backend (`src/backend/**`) — webhooks, events, **22 cron jobs** (`jobs.config`) |
| | Production carolinafutons.com (DNS already pointing at Vercel) |

The migration retires the *front-end rendering* and *page editor* — not Wix as a backend.

---

## 1. Production Wix Studio Unpublish (carolinafutons.com)

### 1.1 Pre-flight checks

Execute every check **before** clicking Unpublish. **Each must hold for ≥ 24 h continuously**, not just at this moment, AND the 30-day window in §6.1 must already be green.

- [ ] **Origin verification** (the `server: Vercel` header alone is bypassable by CDN/cache rewrites, so combine two signals): `dig +short carolinafutons.com` → resolves to a Vercel A record (currently `76.76.21.21` family) AND `curl -sI https://carolinafutons.com -H 'Cache-Control: no-cache'` returns Vercel-specific headers (`x-vercel-id`, `x-vercel-cache`).
- [ ] **Wix Stores API reachability via cfw**: `curl -sI https://carolinafutons.com/api/products` (verify exact route name against `carolina-futons-web/src/app/api/`) returns 200 with cached product JSON. **Do NOT use `/api/healthcheck` — that route does not exist in cfw.**
- [ ] Vercel dashboard: production deploy stable for ≥ 24 h, error rate at baseline, no traffic anomalies.
- [ ] **SEO/coverage check** (replaces the unfalsifiable "zero organic traffic on Wix-rendered URLs" check — Wix Analytics will report zero by definition once DNS is on Vercel): in **Google Search Console → Coverage → All known pages**, confirm zero pages flagged "Discovered – currently not indexed" or "Crawled – currently not indexed" that resolve to Wix-rendered URLs. Pull the indexed-URL list and compare against Vercel's `/sitemap.xml` — every important URL must appear in both for ≥ 24 h.
- [ ] No active Wix Studio A/B tests, no scheduled publishes, no draft saved-but-unpublished editor changes (these become the rollback baseline — see §1.5).
- [ ] **Sentry baseline numeric thresholds** (defined by Stilgar before this gate signs): `<defined> P0 events/24 h` and `<defined> P1 events/24 h`. Use the 7-day median as baseline. Rate at or below baseline for ≥ 24 h continuously.

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
| Velo Jobs Scheduler (22 cron jobs in `jobs.config`) | ✅ Should still fire — verify in §8.3 |
| Custom domain `carolinafutons.com` | ✅ Unaffected — DNS routes to Vercel |
| Wix dashboard / order management | ✅ Still functional |

### 1.4 Risks + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Wix Stores API breaks because rendering is off | Low | Stores API is plan-tier, not render-tier. Smoke-test §8.5. |
| Velo HTTP functions stop firing | Low | Velo is plan-tier, not render-tier. Smoke-test §8.2. |
| **Velo Jobs Scheduler stops firing** | **Medium** | Jobs run server-side and *should not* depend on rendering, but Wix's plan-tier feature gating is opaque. Verify in §8.3 (cron heartbeat probe) before declaring success. |
| Wix-hosted checkout page breaks | Low | Checkout is backend; not tied to Wix Studio rendering. |
| **SEO regression — Google still has Wix-rendered URLs in index** | **High** | Pull the indexed-URL list from Search Console pre-unpublish. Diff against Vercel `/sitemap.xml`. Every important URL in both for ≥ 24 h. Track de-indexing of Wix-rendered URLs for the 30 days post-unpublish. |
| **Submission forms break because their markup lived in the Wix render layer** | **High** | The Velo *handler* is decoupled but the *form* may have been Wix-rendered. Audit cfw to confirm every Velo-backed form is now rendered by Next.js (not iframed from Wix) before §6 sign-off. Smoke-test each in §8.6. |
| Email triggers (post-purchase, abandoned cart, fulfillment) stop reaching customers | Low | Velo `events.js` is plan-tier-agnostic. Verify each handler in §8.4. |

### 1.5 Rollback — NOT one-click

Three failure modes hide under the "click Publish" path; understand each before relying on it.

1. **Editor-content drift since last canonical publish.** If anyone edited the Wix Studio site after the last published version (in the editor, even without publishing), `Publish Site` will publish *those edits*, not the version that was live at unpublish time. **Mitigation:** before §1.2, capture the current published source — Wix Dashboard → Site Actions → **Save as Site Template** OR export editor content via Wix support if no UI export exists. Record the snapshot location in §7.
2. **Plan-tier ordering with §4.** If the Wix plan was downgraded to **Wix Headless** after unpublishing, **the Publish button is no longer available** — Headless plans don't include the rendering tier. Rollback then requires re-upgrading the plan first (Wix billing transaction, ~hours not seconds). **Therefore: do NOT execute §4 until §1 has been live for ≥ 7 days with no rollback signal.**
3. **A/B tests + scheduled publishes are not restored.** `Publish Site` does not recreate experiments or scheduled-publish state. Document any active experiments in §7 *pre-execution* so they can be re-created manually if rollback is needed.

**Recommended ordering:**

```
§1 unpublish → 7-day soak → §5 archive → §4 plan downgrade
```

No DNS changes are needed for rollback in either case.

---

## 2. Staging Site Unpublish (`My Site 5`, metaSiteId `3af610bf`)

`My Site 5` is a free-plan dev sandbox under the halworker85 account at
`https://chrisdealglass.wixstudio.com/my-site`. **Not** the same site as production.

### 2.1 Pre-flight

- [ ] Confirm `My Site 5` has no active integrations expecting it to be published
- [ ] Confirm no Velo webhooks under `My Site 5` receive production traffic

### 2.2 Unpublish (UI Path A — Wix Dashboard, recommended)

1. `https://manage.wix.com/dashboard/3af610bf/home`
2. Sidebar → **Site & Mobile App** → **Site Actions** → **Unpublish Site**
3. Confirm dialog
4. Verify `chrisdealglass.wixstudio.com/my-site` returns the "site is not published" page

### 2.3 Unpublish (UI Path B — Wix Studio Editor, fallback if dashboard path fails)

1. Open `My Site 5` in the Wix Studio editor.
2. Top bar → **Publish ▾** dropdown (top-right area).
3. Select **Unpublish**.
4. Confirm in dialog.
5. Verify same as Path A step 4.

### 2.4 Notes

- Stilgar sign-off in §6.2 still applies even though staging has no production traffic — it's a checklist box, not a separate gate. **No self-approval.**
- No subscription action: `My Site 5` is already on the free tier.
- The production STAGING_SITE used for editor work pre-migration is on free/Lite (Upgrade CTA visible in dashboard) — same treatment applies.

---

## 3. What Wix services stay active post-cutover

> Required by Phase 9 to ensure no service we depend on gets dropped.

### 3.1 Active dependencies

| Service | What we use it for | Where it's wired |
|---|---|---|
| **Wix Stores** | Product catalog, variants, inventory, orders, payment processing, fulfillment records | cfw `src/actions/*` calling Wix Headless SDK |
| **Wix Headless API (`@wix/stores`, `@wix/auto_sdk_stores_*`)** | Cart, checkout, member sessions, redirect-to-checkout flow | cfw `src/lib/wix-client.ts` + `src/actions/cart.ts` |
| **Wix CMS collections** | Static-ish content (Blog, FAQs, ContactSubmissions, NewsletterSubscribers, etc.) | cfw reads via the Wix Headless SDK; Velo `*.web.js` for writes |
| **Velo HTTP functions (`src/backend/http-functions.js`)** | Server-side endpoints for webhooks, rate-limited writes (contact form, swatch request, etc.), price-match orchestrator. **81 endpoints** as of 2026-05-09. | cfw calls via `/_functions/*` (dispatcher: `carolina-futons-web/src/lib/wix/velo-client.ts`) |
| **Velo events (`src/backend/events.js`, `*.events.js`)** | All `wixEcom_on*` order/fulfillment lifecycle handlers, `wixMembers_on*`, `wixBlog_on*`, abandoned-checkout handlers — drive the email/SMS notification orchestrator. (cf-fovb wired `onFulfillmentCreated` + `onFulfillmentUpdated` — already on main.) | Velo runtime |
| **Velo Jobs Scheduler (`src/backend/jobs.config`)** | **22 cron jobs** — EmailQueue drain (every 15 min), inventory sync (every 30 min), wishlist alerts, social stories, lifecycle email cohorts, winback campaign, review-request, analytics digest, etc. | Velo runtime — scheduled jobs |
| **Wix Secrets Manager (`wix-secrets-backend`)** | WWEX SOAP credentials, Turnstile keys, mailer creds, signing keys (~10 import sites in `http-functions.js`) | Velo runtime |
| **Wix dashboard** | Manual order management, customer support, Stores admin | Stilgar / ops |

### 3.2 Services we explicitly stop using

| Service | Replacement |
|---|---|
| Wix Studio page editor | n/a — Next.js source in `carolina-futons-web` repo |
| Wix Studio rendering layer (HTML/CSS/JS bundle Wix shipped to browsers) | Vercel-hosted Next.js |
| `EDITOR_HOOKUP_GUIDE.html` as the live reference | `docs/brenda-admin-guide.md` + `docs/TESTING-PROCEDURE.md` |
| Wix Studio analytics dashboard | Vercel Analytics + custom events |
| Wix Studio A/B testing tool | Application-layer feature flags / experiments |

### 3.3 Future scope (NOT in cf-3qt.9)

Tracked separately in **cf-xe2** (full Wix exit — Velo → Vercel Functions, Stores → headless commerce, CMS → Sanity/Payload). Do not pull forward into Phase 9.

---

## 4. Wix Premium plan downgrade evaluation

### 4.1 Why downgrade

Once Wix Studio rendering is unpublished, the only Wix infrastructure we still use is:
- Wix Stores API (catalog + checkout backend)
- Wix CMS API (read-only data source)
- Velo backend execution (webhooks, cron, custom APIs)

No part of that requires the rendering tier.

### 4.2 Plan options + cost delta (verify current pricing at wix.com/upgrade)

> ⚠️ Pricing last verified ~August 2025 per morgott's research. **Re-verify current tiers at wix.com/upgrade before committing.**

| Plan | ~Monthly (annual) | Wix Stores API | Velo | Wix Studio Rendering | Notes |
|---|---|---|---|---|---|
| **Wix Headless** *(target)* | ~$13 | ✅ | ✅ | ❌ (we don't need it) | **Recommended** — purpose-built for our use case |
| Business Basic | ~$17 | ✅ | ✅ | ✅ (unused) | Pays for rendering we won't use |
| Business Unlimited *(assumed current)* | ~$25 | ✅ | ✅ | ✅ (unused) | Likely current plan |
| Business VIP | ~$35 | ✅ | ✅ | ✅ (unused) | Overprovisioned |

**Estimated monthly savings:** ~$12/mo (~$144/yr) on the Business Unlimited → Wix Headless path. Exact savings depend on actual current plan and whether legacy/promotional pricing applies. Stilgar must pull the current subscription cost from **Wix Dashboard → Billing & Subscriptions** and record it in §7 before committing.

### 4.3 Downgrade path (UI)

1. Wix Dashboard → **Billing & Subscriptions**
2. Identify the current active plan (record exact name + monthly cost in §7)
3. **Change Plan** → select **Wix Headless**
4. Wix may prompt for cancellation confirmation; review what the downgrade removes (rendering tier features) — for us, nothing required
5. Confirm
6. Record in §7 Execution Log

### 4.4 Downgrade risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Headless plan removes a feature we still rely on | Low | Verify Wix Headless plan page lists Stores API + Velo before committing |
| **Velo execution quotas lower on Headless** | **High** | Velo Jobs Scheduler runs 22 cron jobs (some every 15 min). Pull 30-day quota usage from Wix dashboard, compare to Headless plan documented quota. Stilgar must record exact numbers in §7 before approving §4. **No "test if uncertain" escape — confirm or defer.** |
| Wix Stores checkout flow breaks | Low | Checkout is backend-only and plan-tier-agnostic. |
| Webhook delivery breaks | Low | Velo is included in Headless; smoke-test §8.2 + §8.4. |
| Pricing changes by the time we execute | Medium | Re-verify at wix.com/upgrade before clicking |

### 4.5 Approval

Downgrade approval flows through §6.2. No separate gate.

---

## 5. Guide archival

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
> as part of cf-3qt (full migration to Next.js + Wix Headless). Archived on
> YYYY-MM-DD for historical reference. The current developer reference is
> [brenda-admin-guide.md](../brenda-admin-guide.md) +
> [TESTING-PROCEDURE.md](../TESTING-PROCEDURE.md).
```

HTML equivalent (top of `<body>`):

```html
<div style="background:#fee;border:2px solid #c33;padding:1em;margin-bottom:1em;font-weight:bold">
  🚫 RETIRED — Do not use for new work. Wix Studio was retired as part of cf-3qt.
  Archived YYYY-MM-DD. Current reference: docs/brenda-admin-guide.md.
</div>
```

> **Verify the link targets exist before baking the banner into the archived
> HTML — a broken path baked into an archive permanently rots.** Run
> `ls docs/brenda-admin-guide.md docs/TESTING-PROCEDURE.md` in repo root before
> committing the archival PR.

### 5.4 Crew worktree copies

Copies of `EDITOR_HOOKUP_GUIDE.html` exist in some `crew/*/` dirs. These are crew-local files, not in the published doc tree, and can be left in place or deleted at crew discretion.

### 5.5 Standing-order removal

After archive lands, AND ≥ 7 days post-unpublish (premature removal blocks rollback context):

- [ ] Remove `cf-yw0m` (editor hookup standing order) from melania's auto-memory
- [ ] Remove related instructions from any active `CLAUDE.md` / `AGENTS.md` files
- [ ] Mail godfrey + remaining crew about the retirement

---

## 6. Stilgar sign-off

**Instructions:** Each box must be checked before any §1, §4, or §5 step executes. **No box may be self-approved.**

### 6.1 Pre-conditions (gate execution)

- [ ] **DNS stable:** `carolinafutons.com` served from Vercel for the **30-day stability window** (cf-3qt.9 acceptance gate) with zero unaddressed P0/P1 rollback signals
- [ ] **cf-3qt.8 complete:** Phase 8 PRs all merged + confirmed live
- [ ] **30-day stability report:** uptime ≥ 99.9%, order rate ≥ 95% of baseline, Core Web Vitals at or better than baseline, P0/P1 incident review by Stilgar — report attached to this doc
- [ ] **Sentry numeric thresholds defined** (§1.1): P0 events/24h baseline = `<defined>`, P1 baseline = `<defined>`. Both at-or-below baseline for ≥ 24 h continuously
- [ ] **Order history confirmed durable:** Verified in Wix Dashboard, NOT solely in the Studio rendering layer
- [ ] **SEO list captured:** Indexed-URL list pulled from Search Console + diffed against Vercel `/sitemap.xml`. No important URLs missing from the Vercel side
- [ ] **Form-rendering audit complete:** every Velo-backed form (price-match, Q&A, contact, swatch request, mailing list) confirmed rendered by Next.js, not iframed from Wix
- [ ] **Pre-unpublish snapshot captured** (§1.5 mitigation 1): Wix site template saved OR editor-content export filed with timestamp in §7

### 6.2 Per-step approvals

All five require explicit Stilgar sign-off, including staging — the §2 box is a sign-off ceremony, not a gating decision.

- [ ] **Stilgar approves Wix Studio production unpublish** (§1)
- [ ] **Stilgar approves staging site unpublish** (§2)
- [ ] **Stilgar approves EDITOR_HOOKUP_GUIDE archive** (§5) — or requests a copy emailed first
- [ ] **Stilgar confirms current Wix plan + monthly cost** (§4.2 — pulled from Billing dashboard, recorded in §7)
- [ ] **Stilgar approves Wix Headless downgrade** (§4) — or defers; if approved, MUST be ≥ 7 days after §1 unpublish per §1.5 mitigation 2
- [ ] **Stilgar reviews Velo quota delta** (§4.4 — Headless plan documented quota vs current 30-day usage; cron jobs from `src/backend/jobs.config` must fit)

### 6.3 Post-execution sign-offs

Tied to §8 — each box below is a §8 step.

- [ ] All §8 smoke-test groups (1–9) pass
- [ ] No Sentry P0/P1 events above thresholds in 24 h post-unpublish AND 24 h post-downgrade
- [ ] Tag `v-wix-studio-retired` in both `carolina-futons` and `carolina-futons-web` repos
- [ ] Retrospective doc opened (will live at `docs/cf-3qt-retrospective.md`)
- [ ] cf-yw0m standing order removed from memory (gated on §5.5 conditions)

---

## 7. Execution log

| Date | Action | Executed by | Notes |
|---|---|---|---|
| — | Pre-flight checks complete | — | — |
| — | Pre-unpublish snapshot captured | — | location/template id |
| — | Active A/B tests / scheduled publishes documented | — | — |
| — | Stilgar §6.1 sign-off | — | — |
| — | Stilgar §6.2 sign-off | — | — |
| — | Production carolinafutons.com unpublished | — | — |
| — | §8 smoke groups 1–4 passed | — | — |
| — | 7-day soak passed | — | — |
| — | Staging `My Site 5` unpublished | — | — |
| — | EDITOR_HOOKUP_GUIDE archived | — | — |
| — | Wix plan downgraded | — | from `<plan>` ($X) → Wix Headless ($Y), savings $Z/mo |
| — | §8 smoke groups 1–9 passed (post-downgrade) | — | — |
| — | Tag `v-wix-studio-retired` pushed | — | both repos |
| — | Retrospective opened | — | — |
| — | cf-yw0m standing order removed from memory | — | — |

---

## 8. Smoke-test playbook (post-unpublish, post-downgrade)

Run groups 1–4 within 1 h of §1 unpublish. Run all groups within 1 h of §4 downgrade. Each step must pass — **no "or" outcomes**. A 401 where 200 is expected is a regression, not a soft pass.

### 8.1 Vercel storefront serving

```bash
curl -sI https://carolinafutons.com -H 'Cache-Control: no-cache' \
  | grep -E 'HTTP|x-vercel-id'                                          # 200; x-vercel-id present

# Render-content check (more robust than `grep -c name` which matches 404 pages):
curl -s https://carolinafutons.com/products/savannah \
  | grep -E '<meta property="og:title" content="[^"]+"'                 # >= 1 match (real product page)

curl -sI https://carolinafutons.com/shop/futon-frames | head -1         # HTTP/2 200
curl -sI https://carolinafutons.com/shop/mattresses | head -1           # HTTP/2 200
```

### 8.2 Velo HTTP — health + sample of real endpoints

```bash
# Liveness — get_health is a real http-functions.js export at ~line 116
curl -s https://carolinafutons.com/_functions/health                    # 200, JSON body

# Sample of dispatcher endpoints (verify against http-functions.js for current names):
curl -sI https://carolinafutons.com/_functions/sitemapXml | head -1     # 200
curl -sI https://carolinafutons.com/_functions/manifest | head -1       # 200

# CORS preflight (the cfw → Velo contract):
curl -s -X OPTIONS https://carolinafutons.com/_functions/health \
  -H 'Origin: https://carolinafutons.com' \
  -H 'Access-Control-Request-Method: POST' \
  -i | grep -i 'access-control-allow'                                   # headers present

# Sample dispatcher POSTs (use real method names per http-functions.js):
curl -s -X POST https://carolinafutons.com/_functions/wishlistService/getWishlist \
  -H 'Content-Type: application/json' -H 'Origin: https://carolinafutons.com' \
  -d '{"method":"getWishlist","args":[]}'                               # 200 (anonymous read)
```

> Probe ≥ 5 distinct dispatcher endpoints in addition to the above (contactSubmissions, mailingListSignups, notifyMe, swatchRequest, surveyService — see `src/backend/http-functions.js` for current allowlist). The smoke test cannot exhaustively cover all 81; pick the highest-traffic surface.

### 8.3 Velo Jobs Scheduler (cron) — highest-risk dependency

22 cron jobs run server-side without a heartbeat endpoint. Verification is indirect.

- [ ] **Pre-check:** in Wix Dashboard → **Code** (Velo) → **Site Backend** → **Jobs**, confirm all 22 jobs in `src/backend/jobs.config` are listed as **Active**, not paused.
- [ ] **EmailQueue drain heartbeat (every 15 min):** insert a test row into the `EmailQueue` collection (status `pending`, near-future `scheduledFor`). Within 20 min, confirm row state transitions to `sent` (or `failed` with logged reason).
- [ ] **Inventory sync (every 30 min):** capture inventory snapshot, edit one SKU's stock in Wix Dashboard, wait 35 min, confirm cfw catalog reflects new value.
- [ ] **24 h job audit:** Wix Dashboard → **Code** → **Site Monitoring** → **Logs** → confirm all 22 jobs logged at least one execution in the last 24 h, no error spikes.

If ANY job has not executed in the expected window post-downgrade → **rollback the plan downgrade immediately** before remediating; cron is the most plan-tier-sensitive surface.

### 8.4 Velo events — order lifecycle end-to-end

Place a 1-cent test product order via cfw checkout. Verify each lifecycle handler fires:

- [ ] `wixEcom_onOrderCreated` → order confirmation email received within 60 s
- [ ] `wixEcom_onOrderApproved` → payment-confirmed email
- [ ] Mark order shipped in Wix Dashboard → `wixEcom_onFulfillmentCreated` → "your order has shipped" email + tracking link
- [ ] Mark order fulfilled → `wixEcom_onOrderFulfilled` → final confirmation
- [ ] Cancel a separate test order → `wixEcom_onOrderCanceled` → cancellation email
- [ ] Abandoned-checkout: open cfw checkout, add item, exit before pay, wait 1 h → confirm `wixEcom_onAbandonedCheckoutCreated` fired (email or log)

### 8.5 Wix Stores reachability from cfw

```bash
# Sample cfw API routes that proxy to Wix Stores. Verify path against
# carolina-futons-web/src/app/api/ before running:
curl -sI https://carolinafutons.com/api/products | head -1              # 200
```

(`/api/healthcheck` does NOT exist — do not probe it.)

### 8.6 Form submissions — actually post a payload

Each Velo-backed form must accept a submission and route to its destination:

- [ ] **Contact form:** submit a test entry → confirm row in `ContactSubmissions` CMS + ops email received
- [ ] **Price-match form:** submit a test entry → confirm appears in price-match queue + ops email
- [ ] **Q&A submit:** submit a test question → confirm Velo `submitQuestion` webhook logs success
- [ ] **Swatch request:** submit → confirm in `SwatchRequests` CMS
- [ ] **Mailing list signup:** submit → confirm row in `NewsletterSubscribers` + welcome email triggered

### 8.7 Wix Secrets Manager probe

Indirect — secrets are server-side. Test paths that depend on them:

- [ ] **WWEX SOAP (live freight rate):** trigger a freight-eligible cart → cfw fetches LTL rate → confirm WWEX API responded (Sentry / Velo logs).
- [ ] **Turnstile verification:** submit a CAPTCHA-gated form (e.g. swatch request) with a valid token → submission accepted.
- [ ] **Mailer credentials:** any email trigger above reaching the recipient confirms the mailer secret resolved.

### 8.8 CMS write probe

```bash
# Use a real http-functions write endpoint (verify name in http-functions.js):
curl -s -X POST https://carolinafutons.com/_functions/contactSubmissions \
  -H 'Content-Type: application/json' -H 'Origin: https://carolinafutons.com' \
  -d '{"method":"submitContact","args":[{"name":"smoke-test","email":"smoke@example.com","message":"cf-3qt.9 post-retirement probe"}]}'  # 200, id returned
```

Verify the row landed in the `ContactSubmissions` CMS via Wix Dashboard.

### 8.9 Rollback dry-run rehearsal (BEFORE §1 unpublish)

In a maintenance window pre-unpublish, rehearse the rollback once:

1. From the Wix dashboard, click `Publish Site` on a non-load-bearing branch/draft.
2. Confirm the published-version delta is what you expect (no surprise edits going live).
3. Time the round trip — the "instant" claim should be < 30 s; if it's not, document actual time in §7 so the rollback budget is realistic.
4. If §4 has already executed, rehearse the plan re-upgrade path too.

### Failure handling

If any step fails after §1 but before §4: **execute §1.5 rollback (Publish Site)** within the 7-day window.
If any step fails after §4: rollback requires re-upgrading the plan first (§1.5 mitigation 2). Page Stilgar.

---

## 9. Linked beads

- **Parent:** cf-3qt (epic — full migration to Next.js + Wix Headless)
- **Predecessor:** cf-3qt.8 (DNS cutover)
- **Closed siblings (research that fed this doc):**
  - cf-3qt.9.1 (`crew/melania/retirement-plan.md` — production unpublish + downgrade research)
  - cf-3qt.9.2 (`crew/melania/wix-retirement-checklist.md` — staging site unpublish)
- **Future scope:** cf-xe2 (full Wix exit — backend → Vercel Functions, Stores → headless commerce, CMS → Sanity/Payload)
