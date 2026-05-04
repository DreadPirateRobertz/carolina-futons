# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 00:19 MT**

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

## 🔍 PROD VERIFICATION (2026-05-04 00:19 MT)

**URL checked:** https://carolina-futons-web.vercel.app/shop/futon-frames
- **Products:** ✅ Real Wix products rendering (`static.wixstatic.com/media/e04e89_*` images confirmed in HTML)
- **Current deployment:** dpl_3fY9hGzN9h14BSygypaNKcCrgGPC (supersedes Stilgar's dpl_81vGDWyL3j — our merges triggered newer builds)
- **Delivery zone API:** ✅ `/api/delivery-zone?zip=28801` → white-glove NC
- **WIX_CLIENT_ID_HEADLESS (prod):** ✅ cb591c8e active
- **P0 status:** Products loading. If images still appear broken visually → screenshot needed from Stilgar to diagnose further

---

## 🔍 STILGAR SITE AUDIT — Vercel URL

**URL:** https://carolina-futons-web-git-main-dreadpiraterobertzs-projects.vercel.app/

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
| Blog OG + Twitter card | ⏳ PR #355 CLEAN — refinery running |
| Footer scene alive (cf-qif2) | ⏳ PR #359 CLEAN — refinery running |
| Add to Compare | ⏳ PR #281 CLEAN — refinery re-checking boxes |
| **P0: PLP zero products (preview)** | ⚠️ Awaiting Stilgar: Option A (Preview WIX_CLIENT_ID→cb591c8e) or B (USE_FIXTURE=1) |
| Theme pick | ⏳ Stilgar to choose /theme-a–d |
| contactSubmissions live | ⚠️ Needs Wix site publish (Stilgar direct action) |

---

## Vercel Env

| Env Var | Status |
|---------|--------|
| WIX_CLIENT_ID_HEADLESS (prod) | ✅ cb591c8e — confirmed active on latest build |
| WIX_CLIENT_ID_HEADLESS (preview) | ⚠️ 6b4d4894 — no collections → P0 on preview URL |
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
| #361 | fix(cf-af7h): PLP filter labels zinc-500→zinc-600 | ⚠️ UNSTABLE | blaidd — CI running |
| #360 | fix(cf-xbj9): dark:bg-cf-espresso card wrappers | ⚠️ UNSTABLE | godfrey — CI running |
| #359 | feat(cf-qif2): bear-breathe animation + footer fix | ✅ CLEAN | refinery running |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ⏳ pending | Needs Stilgar ok on approach |
| #355 | feat(cf-3qt.7): blog OG + Twitter card metadata | ✅ CLEAN | refinery running |
| #281 | feat(cf-7axq): Add to Compare | ✅ CLEAN | refinery re-checking boxes |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | draft |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | PR #355 fixed → cf-52gi dark mode homepage | ⏳ #355 pending merge |
| rennala | cf-9t70: /swatch-request Wix CMS pending | ⏳ blocked on CMS collection |
| blaidd | PR #361 cf-af7h PLP filter labels | 🔧 CI running |
| godfrey | PR #360 cf-xbj9 dark mode card bg + PR #359 footer | 🔧 CI running |
| miquella | cf-0s4l: running --provision with WIX_API_KEY | 🔧 unblocked |
| morgott | cf-ydny + cf-ed89 dark mode CTA + sustainability | 🔧 new |
| millicent | 🆓 free | — |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **P0: PLP zero products (preview)** | Stilgar env decision needed (Option A vs B) |
| **contactSubmissions 404** | Stilgar must publish live Wix site |
| **PR #356** | cf-okwz clipboard approach — Stilgar approval needed |
| **PR #355** | Refinery running — pending result |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection pending |
| **SENTRY_AUTH_TOKEN** | Stilgar awaiting |
| **Theme pick** | /theme-a–d live — Stilgar to choose |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending |

---

## In-Progress Beads

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-xbj9 | P1 | dark:bg-cf-espresso card wrappers (92 nodes) | godfrey PR #360 |
| cf-qif2 | P1 | Footer bear animation + abs positioning | godfrey PR #359 |
| cf-9t70 | P1 | /swatch-request Wix CMS | rennala |
| cf-52gi | P2 | dark mode homepage cream/sand | radahn (after #355) |
| cf-ydny | P2 | dark mode CTA token fix | morgott |
| cf-ed89 | P2 | dark mode /sustainability gray bg | morgott |
| cf-af7h | P2 | light mode PLP filter labels | blaidd PR #361 |
| cf-okwz | P3 | EasterEggBear clipboard approach | PR #356 pending |
| cf-ighf | P3 | light mode charcoal/50 (2 nodes) | unassigned |
| cf-32cy | P3 | dark mode /contact orange (1 node) | unassigned |
| cf-0s4l | P3 | /sustainability provision | miquella — running now |

---

## Shipping Test Report ✅ (delivered to Stilgar)

56/56 tests PASS · Parcel <70 lbs · LTL 70-499 lbs · Freight ≥500 lbs or palletized · White-glove NC only

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
