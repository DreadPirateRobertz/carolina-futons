# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 10:06 MT**

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
| E2E fixture-mode smoke test | ✅ PRs #368 + #377 MERGED |

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
| /shop/sale PLP + Mesa discountedPrice | ✅ MERGED #389 + #394 |
| data-slot=category-card + E2E | ✅ MERGED #395 |
| Rewards E2E scaffold | ✅ MERGED #396 |
| Email routes + verify spec | ✅ MERGED #397 |
| Bear image (BotanicalFooterDivider) | 🔧 PR #398 CI running |
| **Design migration plan** | ✅ PLAN COMPLETE — crew dispatched |

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
| #1136 | chore(deps): bump dawidd6/action-send-mail | **HOLD** ✅ | |
| #1130 | chore(deps): dev-deps bump | **HOLD** ✅ | |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI | Note |
|----|-------|----|----|
| #399 | fix(cf-2idp): Mesa sale fixture | ⏳ RUNNING | morgott, needs CI confirm |
| #398 | fix(cf-bear-img): remove BotanicalFooterDivider | ⏳ RUNNING | melania, Stilgar directive |
| #392 | chore(deps): bump eslint 9→10 | ❌ FAIL | **HOLD** — major version, CI breaking |
| #391 | chore(deps): bump wix-sdk group | ✅ CLEAN | **HOLD** — review before merge |
| #390 | test(cf-3qt.14): /search page E2E smoke | ✅ CLEAN | **BLOCK** 77/100 — fix in progress (godfrey) |
| #376 | docs(cf-3qt.7): analytics env vars | ✅ CLEAN | **BLOCK**: Stilgar replace real GA4/Meta IDs |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ✅ CLEAN | Stilgar approach approval needed |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | draft |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | **Design migration — quick wins**: delete orphaned botanical components (`BlueRidgeTimeline`, `MountainSkyline`, `FooterMountainDivider`, `StargazingHero` in illustrations/) + final cleanup pass | 🆕 |
| rennala | **Design migration — /about**: replace `BotanicalMountainSkyline` + `BotanicalTimeline` + `TeamPortrait` with v3-01-porch.svg scene + character vignettes | 🆕 |
| blaidd | **Design migration — /contact + /press**: replace `ContactHero` with v3-06-fog.svg scene | 🆕 |
| godfrey | cf-3qt.14 — PR #390 BLOCK 77/100 — form submit test + data-slot (fix sent) | ⚠️ |
| miquella | **Design migration — /visit + /design-a-room**: v3-03-cabin.svg + v3-02-stargazing.svg | 🆕 |
| morgott | cf-2idp PR #399 CI running → then design migration /guides + /reviews (v3-04-reading + v3-05-falls) | 🔧 |
| millicent | **Design migration — Phase 0 + Phase 3**: wire MascotFooterDivider into layout, then empty states (search/cart/404) | 🆕 |

---

## Design Migration Plan

**Stilgar direct order: 2026-05-04.** Full plan in `crew/melania/design-migration-plan.md`.

| Phase | Scope | Owner | Status |
|-------|-------|-------|--------|
| Quick wins | Delete orphaned botanical components | radahn | 🆕 |
| Phase 0 | Wire MascotFooterDivider into layout | millicent | 🆕 |
| Phase 1 | PLPs category cards (verify, not replace) | godfrey (after #390) | ⏳ |
| Phase 2 | /about, /contact, /press, /visit, /guides, /reviews, /design-a-room | rennala/blaidd/miquella/morgott | 🆕 |
| Phase 3 | Empty states + 404 | millicent | ⏳ (after Phase 0) |
| Cleanup | Final illustrations/ audit + delete | radahn | ⏳ (last) |

---

## Open Blockers (Stilgar actions)

| Issue | Status |
|-------|--------|
| **P0: 0 products** | wix.com/developers: install OAuth app cb591c8e on carolinafutons.com |
| **E2E checkout** | Wix Dashboard: enable sandbox payment (Test Mode) + P0 fix |
| **cf-0s4l** | Wix Dashboard: create WIX_API_KEY under account ed8a7220 |
| **contactSubmissions** | Publish live Wix site |
| **PR #356** | Approve clipboard approach |
| **PR #376** | Replace real GA4/Meta Pixel IDs with placeholder strings |
| **cf-3qt.7 live verify** | GA4 realtime check + Pixel Helper + Rich Results Test |
| **GSC sitemap** | Deferred to Phase 8 — no action now |
| **SwatchRequests CMS** | Create SwatchRequests collection in Wix Dashboard |
| **SENTRY_AUTH_TOKEN** | Set in EAS |
| **Theme pick** | Choose /theme-a–d |
| **DNS flip** (cf-cb9s) | §1-§3 pending |

---

## In-Progress Beads

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-3qt.7 | P1 | SEO + analytics — code COMPLETE, blocked Stilgar verify | PR #376 BLOCK |
| cf-gjhu | P2 | E2E: Reward system → PR #396 MERGED, UI phases pending | radahn (design migration next) |
| cf-okwz | P3 | EasterEggBear clipboard | PR #356 pending Stilgar |

---

## Shipping Test Report ✅

56/56 PASS · Parcel <70 lbs · LTL 70–499 lbs · Freight ≥500 lbs or palletized · White-glove NC only

---

## Session Merges (this session)

| PR | Title | When |
|----|-------|------|
| #397 | feat(cf-nujp): email routes + verify spec (87/100) | 10:05 UTC |
| #396 | test(cf-gjhu): rewards E2E scaffold | 10:05 UTC |
| #395 | feat(cf-8xw1): data-slot=category-card (97/100) | 10:05 UTC |
| #394 | fix(cf-3qt.12): Mesa discountedPrice hotfix | ~09:55 UTC |
| #389 | feat(cf-3qt.12): /shop/sale PLP (100/100) | ~09:50 UTC |
| #383 | feat(cf-s44d): email trigger E2E — cart recovery + welcome | 15:42 UTC |
| #388 | test(cf-3qt.13): E2E smoke /shop index hub | 12:39 UTC |
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
| #393 | fix(cf-m07g): checkout real-payment E2E (gated) | 15:49 UTC |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 353ab5c0 · Next refresh ~10 min · Design migration ACTIVE — 6 crew dispatched · #390 BLOCK 77/100 godfrey fix in progress · #398/#399 CI running*
