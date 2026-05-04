# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 06:31 MT**

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
| Footer living animation | ✅ MERGED #381 (valley mist particles) |

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
| #388 | test(cf-3qt.13): E2E smoke /shop index hub | ⏳ PENDING | radahn — 2 commits, CI running |
| #387 | fix(cf-uaoz): plp.spec.ts stabilize | ✅ MERGED | 12:28 UTC — refinery 88/100 PASS; squash safe |
| #383 | feat(cf-s44d): email trigger E2E | ⏳ PENDING | **BLOCK** 57.6/100 — route.ts fix in flight (miquella) |
| #386 | test(cf-1409): rewards E2E | ✅ MERGED | 11:58 UTC |
| #384 | fix(cf-2jq9): .dark --cf-smoke token | ✅ MERGED | 11:58 UTC |
| #382 | feat(cf-3qt.10): sofa-beds PLP | ✅ MERGED | 11:47 UTC |
| #376 | docs(cf-3qt.7): analytics env vars | ✅ CLEAN | **BLOCK**: Stilgar replace real GA4/Meta IDs |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ✅ CLEAN | Stilgar approach approval needed |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | draft |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | cf-3qt.13 — PR #388 open, CI pending | 🔧 |
| rennala | freed — seeking next bead | ⏳ |
| blaidd | cf-3qt.12 — Sale PLP /shop/sale (branch: feat/cf-announcement-rotate — wrong) | ⚠️ |
| godfrey | cf-3qt.14 — /search results page (branch: feat/cf-y2l3 — wrong) | ⚠️ |
| miquella | cf-s44d — PR #383 BLOCK 57.6/100 — route.ts fix in flight | ⚠️ |
| morgott | cf-3qt.15 pre-resolved ✅ (bead closed) — taking cf-3qt.11 Mattresses | 🔧 |
| millicent | cf-h2em — Platform Beds PLP (branch: feat/cf-oht1 — wrong, respawn pending) | ⚠️ |

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
| **cf-3qt.7 live verify** | GA4 realtime check + Pixel Helper + Rich Results Test (needs TikTok/Pinterest IDs too) |
| **GSC sitemap** | Deferred to Phase 8 — no action now |
| **SwatchRequests CMS** | cf-9t70 code MERGED — create SwatchRequests collection in Wix Dashboard to activate swatch-request page |
| **SENTRY_AUTH_TOKEN** | Set in EAS |
| **Theme pick** | Choose /theme-a–d |
| **DNS flip** (cf-cb9s) | §1-§3 pending |

---

## In-Progress Beads

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-3qt.7 | P1 | SEO + analytics — code COMPLETE, blocked Stilgar verify | PR #376 BLOCK + live verify |
| cf-3qt.11 | P2 | Mattresses PLP /shop/mattresses | radahn |
| cf-3qt.12 | P2 | Sale PLP /shop/sale | blaidd |
| cf-3qt.13 | P2 | /shop index hub page | radahn |
| cf-3qt.14 | P2 | /search results page | godfrey (new) |
| cf-3qt.15 | P2 | Newsletter wire mailingListSignups | ✅ PRE-RESOLVED — bead closed (code on main) |
| cf-h2em | P2 | Platform Beds PLP /shop/platform-beds | millicent — respawn pending |
| cf-s44d | P2 | Email trigger E2E (cart recovery + welcome) | miquella — PR #383 BLOCK 57.6/100 — route.ts fix pending |
| cf-okwz | P3 | EasterEggBear clipboard | PR #356 pending Stilgar |

---

## Shipping Test Report ✅

56/56 PASS · Parcel <70 lbs · LTL 70–499 lbs · Freight ≥500 lbs or palletized · White-glove NC only

---

## Session Merges (this session)

| PR | Title | When |
|----|-------|------|
| #387 | fix(cf-uaoz): stabilize plp.spec.ts timeouts + selectors | 12:28 UTC |
| #386 | test(cf-1409): rewards & gamification E2E | 11:58 UTC |
| #384 | fix(cf-2jq9): globals.css .dark --cf-smoke token | 11:58 UTC |
| #382 | feat(cf-3qt.10): sofa-beds PLP /shop/sofa-beds | 11:47 UTC |
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
| #380 | feat(cf-3qt.3): Playwright auth fixture + checkout-smoke fix | 11:21 UTC |
| #381 | feat(cf-45uk): valley mist particles LivingFooterScene | 11:22 UTC |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min · 7 beads active · #388 new (radahn cf-3qt.13 CI pending); #383 BLOCK miquella fix in flight; cf-3qt.15 pre-resolved closed*
