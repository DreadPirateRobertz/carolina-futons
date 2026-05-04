# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 05:10 MT**

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

## 🔍 P0 PRODUCTS — CONFIRMED BROKEN

**Root cause:** Wix headless OAuth app `cb591c8e` returns `"No Metasite Context in identity"` — not installed on any Wix site with Stores.

**STILGAR MUST FIX (wix.com/developers):** Manage Apps → find `cb591c8e-2147-4ca2-88f0-89b7e0f2b25a` → install on carolinafutons.com. No code change can resolve this.

---

## 🧪 TEST RESULTS

| Suite | Result |
|-------|--------|
| Gamification / reward (5 files) | ✅ 139/139 PASS |
| Checkout route (cfW) | ✅ 3/3 PASS |
| Full cfutons vitest suite | ✅ **40,158/40,158 PASS** |
| E2E checkout (real payment) | ⛔ BLOCKED — P0 must resolve first; Stilgar enable Wix sandbox payment |
| E2E fixture-mode smoke test | ✅ PR #368 + #377 MERGED |

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
| **Products loading (ALL PLPs)** | ❌ 0 products — Wix OAuth not connected |
| Dark mode card wrappers | ✅ MERGED #363 |
| CTA hover + /contact dark | ✅ MERGED #365 |
| Light mode charcoal/50→/70 | ✅ MERGED #366 + #367 |
| Home featured collections grid | ✅ MERGED #369 |
| Fixture cart + order (E2E) | ✅ MERGED #374 |
| PLP E2E smoke (5 routes) | ✅ MERGED #372 |
| Render audit /registry /gift-cards | ✅ MERGED #375 |
| Hamburger menu z-index | ✅ MERGED #378 |
| PLP Futon Frames getCollectionPlp | ✅ MERGED #370 |
| Search/compare/wishlist E2E smoke | ✅ MERGED #373 |
| Theme pick | ⏳ Stilgar to choose /theme-a–d |
| contactSubmissions live | ⚠️ Stilgar must publish live Wix site |
| Footer living animation | 🔧 radahn — cf-45uk |

---

## Vercel Env

| Env Var | Status |
|---------|--------|
| WIX_CLIENT_ID_HEADLESS (prod) | ❌ cb591c8e — no Metasite context. Stilgar fix in Wix Dev Center |
| WIX_CLIENT_ID_HEADLESS (preview) | ⚠️ 6b4d4894 — same root issue |
| SMTP / CROSS_RIG_SECRET (prod+EAS) | ✅ Set |
| SENTRY_AUTH_TOKEN (EAS) | ⏳ Awaiting Stilgar |

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI | Note |
|----|-------|----|----|
| #1130 | chore(deps): dev-deps bump | **HOLD** ✅ | |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI | Note |
|----|-------|----|----|
| #380 | feat(cf-3qt.3): Playwright auth fixture | ✅ Vercel | **BLOCK**: checkout-smoke:44 `toBeVisible()` on in-stock — element absent when no error. Rennala must change to `toHaveCount(0)` |
| #376 | docs(cf-3qt.7): analytics env vars | ✅ Vercel | **BLOCK**: real GA4/Meta Pixel IDs in .env.example — Stilgar replaces with placeholders |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ✅ CLEAN | Stilgar approach approval needed |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | draft |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | cf-45uk — footer living animation (LivingFooter.tsx) | 🔧 |
| rennala | PR #380 — fix `checkout-smoke.spec.ts:44` `toHaveCount(0)` | 🔧 fix needed |
| blaidd | cf-uaoz — plp.spec.ts CI flakiness stabilize | 🔧 |
| godfrey | cf-1409 — reward + challenge E2E tests | 🔧 |
| miquella | cf-s44d — email trigger E2E (cart recovery + welcome) | 🔧 |
| morgott | cf-2jq9 — globals.css .dark --cf-smoke token fix | 🔧 |
| millicent | cf-h2em — Platform Beds PLP /shop/platform-beds | 🔧 |

---

## Open Blockers (Stilgar actions)

| Issue | Status |
|-------|--------|
| **P0: 0 products** | wix.com/developers: install OAuth app cb591c8e on carolinafutons.com |
| **E2E checkout** | Wix Dashboard: enable sandbox payment (Test Mode) + P0 fix |
| **cf-0s4l** | Wix Dashboard: create WIX_API_KEY under account ed8a7220 |
| **contactSubmissions** | Publish live Wix site |
| **PR #356** | Approve clipboard approach |
| **PR #376** | ⚠️ MORNING FLAG: Replace real GA4/Meta Pixel IDs with placeholder strings |
| **cf-9t70 CMS** | Create SwatchRequests collection in Wix Dashboard |
| **SENTRY_AUTH_TOKEN** | Set in EAS |
| **Theme pick** | Choose /theme-a–d |
| **DNS flip** (cf-cb9s) | §1-§3 pending |

---

## In-Progress Beads

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-3qt.3 | P1 | Account — Playwright auth fixture | rennala — PR #380 fix pending |
| cf-3qt.7 | P1 | SEO + analytics env vars | PR #376 BLOCK (Stilgar) |
| cf-9t70 | P1 | /swatch-request Wix CMS | blocked on Stilgar CMS creation |
| cf-45uk | P2 | Footer living animation distinct from header | radahn |
| cf-uaoz | P2 | plp.spec.ts CI flakiness stabilize | blaidd |
| cf-1409 | P2 | Reward + challenge system E2E tests | godfrey |
| cf-s44d | P2 | Email trigger E2E (cart recovery + welcome) | miquella |
| cf-2jq9 | P2 | globals.css .dark --cf-smoke missing token | morgott |
| cf-h2em | P2 | Platform Beds PLP /shop/platform-beds | millicent |
| cf-okwz | P3 | EasterEggBear clipboard | PR #356 pending Stilgar |

---

## Shipping Test Report ✅

56/56 PASS · Parcel <70 lbs · LTL 70–499 lbs · Freight ≥500 lbs or palletized · White-glove NC only

---

## Session Merges (this session)

| PR | Title | When |
|----|-------|------|
| #352–#367 | WCAG + dark mode wave (14 PRs) | 05:41–08:4x UTC |
| #368 | E2E checkout fixture-mode smoke | 08:55 UTC |
| #1120 | Delivery zone distance calc | 09:02 UTC |
| #372 | PLP fixture-mode E2E smoke (5 routes) | 09:1x UTC |
| #375 | Render audit /registry /gift-cards | 09:1x UTC |
| #369 | Home featured collections grid | 09:2x UTC |
| #374 | Fixture mode addToCart + getOrder | 09:2x UTC |
| #1125 | sampleRequests Velo endpoint | 10:47 UTC |
| #377 | E2E inline fixture check + OOS assert | 10:50 UTC |
| #1133 | feat(cf-y2l3): trade-in/trade-up program | 10:5x UTC |
| #371 | feat(cf-3qt.2.8): Murphy Cabinet Beds PLP | 11:0x UTC |
| #378 | fix(cf-hmb1): hamburger z-index (z-[55]/z-[56]) | 11:0x UTC |
| #370 | feat(cf-3qt.2): PLP Futon Frames getCollectionPlp | 11:0x UTC |
| #373 | test(cf-3qt.2.13): search/compare/wishlist smoke | 11:0x UTC |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
