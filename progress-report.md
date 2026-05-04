# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 08:59 MT**

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
| E2E fixture-mode smoke test | ✅ PR #368 MERGED |

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
| Theme pick | ⏳ Stilgar to choose /theme-a–d |
| contactSubmissions live | ⚠️ Stilgar must publish live Wix site |

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
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail | **CONVOY** blogContent — blaidd to rebase after rennala fix lands |
| #1130 | chore(deps): dev-deps bump | **HOLD** ⏳ | |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ⏳ test(22) running | **CONVOY** rennala fix landed → test(20) ✅, test(22) in progress |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ⏳ test(22) running | **CONVOY** rennala fix landed → test(20) ✅, test(22) in progress |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI | Note |
|----|-------|----|----|
| #374 | fix(cf-3qt): fixture addToCart + getOrder | ⏳ CI running / Vercel ✅ | millicent — refinery dispatched |
| #373 | test(cf-3qt.2.13): search/compare/wishlist smoke | ❌ Vercel fail | morgott — nudged to fix |
| #372 | test(cf-3qt.2.14): PLP E2E fixture specs | ⏳ CI running / Vercel ✅ | godfrey |
| #371 | feat(cf-3qt.2.8): Murphy Cabinet Beds PLP | ✅ CLEAN | miquella — refinery running |
| #370 | feat(cf-3qt.2): PLP Futon Frames | ❌ Vercel fail | morgott — #370 fix priority over #373 |
| #369 | feat(cf-3qt.2.6): Home page collections grid | ✅ CLEAN | godfrey — refinery running, ready to merge |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ✅ CLEAN | Stilgar approach approval needed |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | draft |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | cf-3qt.2.14 PLP E2E specs → PR #372 CI running | ⏳ |
| rennala | blogContent 17→21 fix → **CONVOY UNBLOCKING** — test(20) ✅ on #1125/#1120 | 🔧 |
| blaidd | CF #1133 — rebase needed after rennala convoy fix confirms green | ⏳ |
| godfrey | PR #369 ✅ CLEAN + PR #372 CI running | 🔧 |
| miquella | PR #371 ✅ CLEAN (ranchero fix pushed) — refinery pending | 🔧 |
| morgott | Fix PR #370 Vercel (priority) → then PR #373 Vercel | 🔧 |
| millicent | PR #374 fixture addToCart+getOrder — CI running | 🔧 |

---

## Open Blockers (Stilgar actions)

| Issue | Status |
|-------|--------|
| **P0: 0 products** | wix.com/developers: install OAuth app cb591c8e on carolinafutons.com |
| **E2E checkout** | Wix Dashboard: enable sandbox payment (Test Mode) + P0 fix |
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
| cf-3qt.2.12 | P1 | Checkout audit → fixture blockers → PR #374 CI running | millicent |
| cf-3qt.2.13 | P2 | Search/compare/wishlist smoke → PR #373 Vercel fail | morgott |
| cf-3qt.2.14 | P1 | PLP E2E fixture specs → PR #372 CI running | godfrey |
| cf-9t70 | P1 | /swatch-request Wix CMS | rennala (convoy fix in flight) |
| cf-okwz | P3 | EasterEggBear clipboard | PR #356 pending Stilgar |

---

## Shipping Test Report ✅

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
| #365 | Dark mode CTA hover + /contact WCAG AA | 08:33 UTC |
| #363 | Dark mode card bg-white → bg-cf-cream WCAG AA | 08:37 UTC |
| #366 | Light mode charcoal/50→/70 FilterFirst WCAG AA | 08:38 UTC |
| #367 | Light mode charcoal/50→/70 alt nodes WCAG AA | 08:4x UTC |
| #368 | E2E checkout fixture-mode smoke | 08:55 UTC |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
