# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 00:14 MT**

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
Active: `trackCustomEvent` ✅ `sampleRequests` ✅ `notifyMe` ✅ `deliveryZone` ✅ `contactSubmissions` ⚠️ (code live in http-functions.js:2641 — Wix site PUBLISH needed) `crossRigEventReceiver` ✅

### Cross-Rig (Mobile ↔ cfW)
Channel A dual-write active. CROSS_RIG_SECRET: **Vercel Prod ✅ + EAS ✅ + Wix Staging ✅**. CFW_API_URL in EAS = `https://carolina-futons-web.vercel.app` (update to carolinafutons.com at DNS cutover). DNS cutover pending cf-cb9s.

---

## 🔍 STILGAR SITE AUDIT — Vercel URL

**URL:** https://carolina-futons-web-git-main-dreadpiraterobertzs-projects.vercel.app/

| Feature | Status |
|---------|--------|
| LivingHero + all phase fixes | ✅ MERGED |
| Footer scene integrated | ✅ MERGED #318 |
| Search product thumbnails | ✅ FIXED |
| Gift Registry /registry | ✅ MERGED #331 |
| EasterEggBear mobile modal | ✅ MERGED #353 |
| SEO BlogPosting JSON-LD | ✅ MERGED #352 |
| Illustrations wired (all pages) | ✅ MERGED #351 |
| Room planner 2D | ✅ MERGED #319 |
| Dark mode font contrast | ✅ MERGED #299 |
| PdpSizeGuide | ✅ MERGED #291 |
| Auth catch error surfacing | ✅ MERGED #358 |
| Blog OG + Twitter card | ❌ PR #355 CI fail — radahn fixing TS type errors |
| Footer scene alive (cf-qif2) | ⏳ godfrey |
| **P0: PLP zero products** | ⚠️ Code fix on main. Awaiting Stilgar: Option A (Preview WIX_CLIENT_ID→cb591c8e) or B (USE_FIXTURE=1) |
| Font contrast audit | ⏳ miquella cf-tu3q — 7 beads filed, crew assigned |
| Theme pick | ⏳ Stilgar to choose /theme-a–d |
| contactSubmissions live | ⚠️ Needs Wix site publish (Stilgar direct action) |

---

## ⚠️ P0 OPEN: Zero Products on PLP

**Root cause:** Preview env WIX_CLIENT_ID_HEADLESS=6b4d4894 (staging, no collections). Code fix pushed (306eca7). Awaiting Stilgar directive:
- **Option A** (recommended): Change Preview WIX_CLIENT_ID_HEADLESS → cb591c8e
- **Option B**: Set NEXT_PUBLIC_USE_FIXTURE_PRODUCTS=1 on Vercel Preview + CI

---

## Vercel Env

| Env Var | Status |
|---------|--------|
| WIX_CLIENT_ID_HEADLESS (prod) | ✅ cb591c8e |
| WIX_CLIENT_ID_HEADLESS (preview) | ⚠️ 6b4d4894 — no collections → P0 |
| SMTP / CROSS_RIG_SECRET (prod+EAS) | ✅ Set |
| SENTRY_AUTH_TOKEN (EAS) | ⏳ Awaiting Stilgar |

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI | Note |
|----|-------|----|----|
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail | |
| #1130 | chore(deps): dev-deps bump | **HOLD** ⏳ | |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ⚠️ codecov only | |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail | |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI | Note |
|----|-------|----|----|
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ⏳ pending | Needs Stilgar ok on clipboard approach |
| #355 | feat(cf-3qt.7): blog OG + Twitter card | ❌ fail | radahn: fix TS types (openGraph.type, twitter.card) + co-author line |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | draft |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | Fix PR #355 TS errors → then cf-52gi dark mode homepage | 🔧 fixing |
| rennala | cf-9t70: /swatch-request Wix CMS pending | ⏳ blocked |
| blaidd | cf-af7h: light mode PLP filter contrast (P2) | 🔧 new |
| godfrey | cf-qif2: footer bear animation → then cf-xbj9 (P1 card bg) | 🔧 in sequence |
| miquella | cf-0s4l: run --provision with WIX_API_KEY from secrets.env | 🔧 unblocked |
| morgott | cf-ydny + cf-ed89: dark mode CTA + sustainability gray | 🔧 new |
| millicent | 🆓 free | — |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **P0: PLP zero products** | Stilgar directive needed (Option A vs B) |
| **contactSubmissions 404** | Code present (http-functions.js:2641) — Stilgar must publish live Wix site |
| **PR #355** | radahn: fix TS types + co-author line |
| **PR #356** | cf-okwz clipboard approach — Stilgar approval needed |
| **SENTRY_AUTH_TOKEN** | Stilgar awaiting |
| **Theme pick** | /theme-a–d live — Stilgar to choose |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection pending |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending |
| **Vercel prod redeploy** | Needed to activate WIX_CLIENT_ID_HEADLESS prod swap |

---

## In-Progress Beads (font contrast wave)

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-xbj9 | P1 | dark mode: card bg-white → dark:bg-cf-espresso (92 nodes) | godfrey |
| cf-ydny | P2 | dark mode: CTA token #7ab8d0 fails with white text | morgott |
| cf-ed89 | P2 | dark mode: /sustainability gray bg contrast | morgott |
| cf-52gi | P2 | dark mode: homepage cream/sand collisions | radahn |
| cf-af7h | P2 | light mode: PLP filter label ratio 4.38 | blaidd |
| cf-ighf | P3 | light mode: homepage charcoal/50 (2 nodes) | unassigned |
| cf-32cy | P3 | dark mode: /contact orange (1 node) | unassigned |
| cf-qif2 | P1 | LivingFooterScene bear breathing + positioning | godfrey |
| cf-9t70 | P1 | /swatch-request Wix CMS pending | rennala |
| cf-tu3q | P2 | Font contrast Playwright audit | ✅ filed 7 beads |
| cf-0s4l | P3 | /sustainability provision | miquella — running now |

---

## Shipping LTL/Freight/Parcel — Test Report

**56/56 tests PASS** (shipping-estimate.test.ts + api-delivery-zone.test.ts)

| Weight | CONUS non-NC | NC Zone |
|--------|-------------|---------|
| 1–69 lbs | **Parcel** (UPS Ground) | White-glove |
| 70–499 lbs | **LTL** | White-glove |
| ≥500 lbs / palletized | **Freight** | White-glove |
| AK/HI/territories | **Unsupported** | — |

Delivery windows: NC 1-2d · SE 2-3d · Mid 3-5d · West 5-7d

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

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
