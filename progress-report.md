# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 00:24 MT**

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
| Blog OG + Twitter card | ✅ MERGED #355 (06:23 UTC) |
| Footer scene alive (cf-qif2) | ✅ MERGED #359 (06:23 UTC) |
| Add to Compare | ✅ MERGED #281 |
| Dark mode CTA + sustainability | ⏳ PR #362 CLEAN — refinery running |
| PLP filter labels | ⏳ PR #361 CLEAN — refinery running |
| Dark mode card wrappers | ⏳ PR #360 UNSTABLE — awaiting CI |
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
| #362 | fix(cf-ydny,cf-ed89): dark mode CTA + sustainability | ✅ CLEAN | morgott — refinery running |
| #361 | fix(cf-af7h): PLP filter labels zinc-500→zinc-600 | ✅ CLEAN | blaidd — refinery running |
| #360 | fix(cf-xbj9): dark:bg-cf-espresso card wrappers | ⚠️ UNSTABLE | godfrey — CI running |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ⏳ pending | Needs Stilgar ok on approach |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | draft |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | cf-52gi dark mode homepage cream/sand | 🔧 unblocked — #355 merged |
| rennala | cf-9t70: /swatch-request Wix CMS pending | ⏳ blocked on CMS collection |
| blaidd | PR #361 cf-af7h PLP filter labels | 🔧 refinery running |
| godfrey | PR #360 cf-xbj9 dark mode card bg | ⏳ CI unstable |
| miquella | cf-0s4l: running --provision with WIX_API_KEY | 🔧 in progress |
| morgott | PR #362 cf-ydny + cf-ed89 | 🔧 refinery running |
| millicent | cf-ighf light mode charcoal/50 (2 nodes) | 🔧 assigned |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **P0: PLP zero products (preview)** | Stilgar env decision needed (Option A vs B) |
| **contactSubmissions 404** | Stilgar must publish live Wix site |
| **PR #356** | cf-okwz clipboard approach — Stilgar approval needed |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection pending |
| **SENTRY_AUTH_TOKEN** | Stilgar awaiting |
| **Theme pick** | /theme-a–d live — Stilgar to choose |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending |

---

## In-Progress Beads

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-xbj9 | P1 | dark:bg-cf-espresso card wrappers (92 nodes) | godfrey PR #360 |
| cf-9t70 | P1 | /swatch-request Wix CMS | rennala |
| cf-52gi | P2 | dark mode homepage cream/sand | radahn — unblocked |
| cf-af7h | P2 | light mode PLP filter labels | blaidd PR #361 |
| cf-okwz | P3 | EasterEggBear clipboard approach | PR #356 pending Stilgar |
| cf-ighf | P3 | light mode charcoal/50 (2 nodes) | millicent |
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
| #281 | Add to Compare | 06:20 UTC |
| #355 | Blog OG + Twitter card metadata | 06:23 UTC |
| #359 | Footer bear-breathe animation | 06:23 UTC |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
