# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 00:44 MT**

---

## Vercel ↔ Wix Integration — How It Works

### Product Updates (Live — No Manual Import Needed)
- **cfW queries Wix Stores live** via `@wix/sdk` — new products in Wix Dashboard appear in cfW **immediately**
- PDP: two-step fetch (slug→ID→full product with variants). PLP: paginated by collection (≤48). Search: full-catalog scan ≤500.
- **Wix Dashboard → Wix Stores** is the single source of truth for inventory, pricing, images, variants

### Velo Backend → cfW (Vercel)
```
cfW Server Action → POST https://www.carolinafutons.com/_functions/<endpoint>
                          ↓ Wix Velo HTTP function (http-functions.js) ↓ wixData/webMethod
```
Active: `trackCustomEvent` ✅ `sampleRequests` ✅ `notifyMe` ✅ `deliveryZone` ✅ `contactSubmissions` ⚠️ (code at http-functions.js:2641 — live Wix site PUBLISH needed by Stilgar) `crossRigEventReceiver` ✅

### Cross-Rig (Mobile ↔ cfW)
Channel A dual-write active. CROSS_RIG_SECRET: **Vercel Prod ✅ + EAS ✅ + Wix Staging ✅**. CFW_API_URL in EAS = `https://carolina-futons-web.vercel.app` (update to carolinafutons.com at DNS cutover). DNS cutover pending cf-cb9s.

---

## 🔍 P0 PRODUCTS — CONFIRMED BROKEN (browser-verified 00:42 MT)

**Wix API test:** `"No Metasite Context in identity." (UNAUTHORIZED)` — headless OAuth app `cb591c8e` is not installed on any Wix site with Stores. env.ts trim did NOT fix this.

**STILGAR ACTION (wix.com/developers):** Manage Apps → find `cb591c8e-2147-4ca2-88f0-89b7e0f2b25a` → install on carolinafutons.com. OR create new OAuth app + update `WIX_CLIENT_ID_HEADLESS` in Vercel.

---

## 🧪 TEST RESULTS (00:44 MT)

### Gamification / Reward System
| Suite | Result |
|-------|--------|
| badgeDisplayWidget | ✅ PASS |
| streakMultiplierEvents | ✅ PASS |
| gamificationProductChip | ✅ PASS |
| referralService | ✅ PASS |
| cartAbandonPayload | ✅ PASS |
| membershipPrompt | ✅ PASS |
| pushNotificationService | ✅ PASS |
| reviewsFlow (integration) | ✅ PASS |
| **Total reward/gamification** | **139 / 139 PASS** |

### Checkout / Payment
| Suite | Result |
|-------|--------|
| checkout-route (cfW) | ✅ 3/3 PASS |
| Full cfutons vitest suite | ✅ **40,158 / 40,158 PASS** (5 todo) |

### E2E Checkout with Real Payment — BLOCKED ⛔
Cannot run until: (1) P0 fixed — products must load to add to cart; (2) Stilgar enables Wix sandbox payment in Dashboard → Settings → Payments → Test Mode. Once unblocked: Playwright E2E ready to build (add-to-cart → checkout → Wix payment → order confirm).

---

## 🔍 STILGAR SITE AUDIT

| Feature | Status |
|---------|--------|
| LivingHero + all phase fixes | ✅ MERGED |
| Illustrations wired (all pages) | ✅ MERGED #351 |
| Room planner 2D | ✅ MERGED #319 |
| Dark mode font contrast | ✅ MERGED #299 |
| PdpSizeGuide | ✅ MERGED #291 |
| Auth catch error surfacing | ✅ MERGED #358 |
| SEO BlogPosting JSON-LD | ✅ MERGED #352 |
| Gift Registry /registry | ✅ MERGED #331 |
| Blog OG + Twitter card | ✅ MERGED #355 |
| Footer scene alive | ✅ MERGED #359 |
| Add to Compare | ✅ MERGED #281 |
| PLP filter labels | ✅ MERGED #361 |
| Dark mode CTA + sustainability | ✅ MERGED #362 |
| Dark mode homepage | ✅ MERGED #364 |
| **Products loading** | ❌ 0 products — Stilgar must fix OAuth in Wix Dev Center |
| Dark mode card wrappers | ⛔ PR #363 BLOCKED (2nd warning, godfrey not fixing) |
| CTA hover + /contact dark | ⏳ PR #365 — visual QA boxes needed (conf 77) |
| Light mode charcoal/50 | ⏳ millicent in progress |
| Theme pick | ⏳ Stilgar to choose /theme-a–d |
| contactSubmissions live | ⚠️ Stilgar publish Wix site |

---

## Vercel Env

| Env Var | Status |
|---------|--------|
| WIX_CLIENT_ID_HEADLESS (prod) | ❌ cb591c8e — not connected to Wix site. Stilgar fix in Wix Dev Center |
| WIX_CLIENT_ID_HEADLESS (preview) | ⚠️ 6b4d4894 — same root issue |
| SMTP / CROSS_RIG_SECRET (prod+EAS) | ✅ Set |
| SENTRY_AUTH_TOKEN (EAS) | ⏳ Awaiting Stilgar |

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI | Note |
|----|-------|----|----|
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail | |
| #1130 | chore(deps): dev-deps bump | **HOLD** ⏳ | |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ❌ fail | |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail | |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI | Note |
|----|-------|----|----|
| #365 | fix(cf-jcta+cf-32cy): CTA hover + /contact dark | ✅ CLEAN | conf 77 — visual QA boxes needed |
| #363 | fix(cf-xbj9): dark mode card wrappers | ✅ CLEAN | ⛔ 2nd block — godfrey not applying fixes |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ✅ CLEAN | Stilgar approach approval needed |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | draft |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | cf-52gi MERGED ✅ | 🆓 free — needs new bead |
| rennala | cf-9t70 /swatch-request | ⏳ blocked on Wix CMS (Stilgar) |
| blaidd | PR #365 visual QA | 🔧 checking boxes |
| godfrey | PR #363 — 2nd block issued | ⛔ not applying fixes |
| miquella | cf-0s4l BLOCKED — account mismatch | ⛔ Stilgar API key needed |
| morgott | PR #365 visual QA | 🔧 checking boxes |
| millicent | cf-ighf light mode charcoal/50 | 🔧 in progress |

---

## Open Blockers (Stilgar actions)

| Issue | Status |
|-------|--------|
| **P0: 0 products** | Wix Dev Center: install OAuth app cb591c8e on carolinafutons.com |
| **E2E checkout** | Wix Dashboard: enable sandbox payment (Test Mode) + P0 fix first |
| **cf-0s4l** | Wix Dashboard: create WIX_API_KEY under account ed8a7220 |
| **contactSubmissions** | Publish live Wix site |
| **PR #356** | Approve clipboard approach |
| **cf-9t70 CMS** | Create SwatchRequests collection in Wix Dashboard |
| **SENTRY_AUTH_TOKEN** | Set in EAS |
| **Theme pick** | Choose /theme-a–d |
| **DNS flip** (cf-cb9s) | §1-§3 pending |

---

## In-Progress Beads

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-xbj9 | P1 | dark:bg-cf-cream card wrappers | godfrey PR #363 ⛔ 2nd block |
| cf-9t70 | P1 | /swatch-request Wix CMS | rennala (blocked) |
| cf-ighf | P3 | light mode charcoal/50 (2 nodes) | millicent |
| cf-okwz | P3 | EasterEggBear clipboard | PR #356 pending Stilgar |
| cf-0s4l | P3 | /sustainability provision | miquella (blocked) |

---

## Shipping Test Report ✅ (delivered to mayor)

56/56 PASS · Parcel <70 lbs · LTL 70–499 lbs · Freight ≥500 lbs or palletized · White-glove NC only

---

## Session Merges (this session)

| PR | Title | When |
|----|-------|------|
| #352 | SEO BlogPosting JSON-LD | 05:41 UTC |
| #351 | Illustrations wired | 05:41 UTC |
| #319 | 2D drag-drop room planner | 06:02 UTC |
| #299 | Dark mode font contrast | 06:03 UTC |
| #1135 | Sustainability CMS collections | 06:06 UTC |
| #358 | Auth catch error surfacing | 06:11 UTC |
| #291 | PdpSizeGuide | 06:12 UTC |
| #281 | Add to Compare | 06:20 UTC |
| #355 | Blog OG + Twitter card | 06:23 UTC |
| #359 | Footer bear-breathe animation | 06:23 UTC |
| #361 | PLP filter labels | 06:25 UTC |
| #362 | Dark mode CTA + sustainability | 06:26 UTC |
| #364 | Dark mode homepage | 06:44 UTC |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
