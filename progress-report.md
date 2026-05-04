# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 00:10 MT**

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
Active: `trackCustomEvent` ✅ `sampleRequests` ✅ `notifyMe` ✅ `deliveryZone` ✅ `contactSubmissions` ⚠️ (prod sync pending) `crossRigEventReceiver` ✅

### Cross-Rig (Mobile ↔ cfW)
Channel A dual-write active. CROSS_RIG_SECRET: **Vercel Prod ✅ + EAS ✅ + Wix Staging ✅**. CFW_API_URL in EAS = `https://carolina-futons-web.vercel.app` (update to carolinafutons.com at DNS cutover). DNS cutover pending cf-cb9s.

---

## 🔍 STILGAR SITE AUDIT — Vercel URL

**URL:** https://carolina-futons-web-git-main-dreadpiraterobertzs-projects.vercel.app/

| Feature | Status |
|---------|--------|
| LivingHero + all phase fixes | ✅ MERGED |
| Footer scene integrated | ✅ MERGED #354 |
| Footer white circles | ✅ FIXED |
| Search product thumbnails | ✅ FIXED |
| Gift Registry /registry | ✅ MERGED #331 |
| EasterEggBear mobile modal | ✅ MERGED #353 |
| SEO BlogPosting JSON-LD | ✅ MERGED #352 |
| Illustrations wired | ✅ MERGED #351 |
| Blog OG + Twitter card | ⏳ PR #355 — review running |
| **P0: PLP zero products** | ⚠️ Code fix on main (306eca7). Awaiting Stilgar: Option A (Preview WIX_CLIENT_ID→cb591c8e) or B (USE_FIXTURE=1) |
| Font contrast audit | ⏳ miquella cf-tu3q |
| Theme pick | ⏳ Stilgar to choose /theme-a–d |

---

## ⚠️ P0 OPEN: Zero Products on PLP

**Root cause:** Preview env WIX_CLIENT_ID_HEADLESS=6b4d4894 (staging, no collections). Code fix pushed (306eca7). Awaiting Stilgar directive:
- **Option A** (recommended): Change Preview WIX_CLIENT_ID_HEADLESS → cb591c8e. Real catalog visible on preview URL.
- **Option B**: Set NEXT_PUBLIC_USE_FIXTURE_PRODUCTS=1 on Vercel Preview + CI. Shows 5 fixture products.

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
| #1135 | feat(cf-0s4l): Sustainability CMS collections | ⏳ pending | miquella: fix test counts (31→34) |
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail | |
| #1130 | chore(deps): dev-deps bump | **HOLD** ⏳ | |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ⚠️ codecov only | |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail | |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI | Note |
|----|-------|----|----|
| #355 | feat(cf-3qt.7): blog OG + Twitter card metadata | ⏳ pending | radahn — refinery review running |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ✅ pass | ⚠️ merge conflict — millicent rebasing |
| #299 | fix(cf-urbq): dark mode font contrast | ✅ pass | ⚠️ refinery blockers → morgott fixing |
| #291 | feat(cf-ww8u): PdpSizeGuide | ✅ pass | ⚠️ refinery blockers → morgott fixing |
| #281 | feat(cf-7axq): Add to Compare | ⏳ CI running | godfrey fixes pushed — awaiting green |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | PR #355 blog OG/Twitter card — in review | ⏳ CI pending |
| rennala | cf-0s4l schema sign-off + Wix site ID for provision | ⏳ dependency |
| blaidd | Free — awaiting next assignment | 🆓 |
| godfrey | PR #281 refinery fixes pushed | ⏳ CI running |
| miquella | Fix PR #1135 test count (31→34) | 🔧 fixing |
| morgott | Fix PRs #291+#299 refinery blockers | 🔧 fixing |
| millicent | Rebase PR #319 on latest main | 🔧 rebasing |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **P0: PLP zero products** | Stilgar directive needed (Option A vs B) |
| **PR #291** | morgott: delete dead code, fix SVG marker IDs, unit label |
| **PR #299** | morgott: test plan boxes + toHaveClass assertions |
| **PR #319** | millicent: rebase conflict |
| **PR #1135** | miquella: fix test counts 31→34, tick plan boxes |
| **rennala** | Provide headless Wix site ID for cf-0s4l --provision |
| **SENTRY_AUTH_TOKEN** | Mayor DM'd Stilgar — awaiting |
| **Theme pick** | /theme-a–d live — Stilgar to choose |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection pending |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending |
| **cf-okwz** (P3) | Bear Easter egg false persistence — Stilgar picks approach |
| **Vercel prod redeploy** | Needed to activate WIX_CLIENT_ID_HEADLESS prod swap |

---

## In-Progress Beads

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-tu3q | P2 | Font contrast Playwright audit | miquella |
| cf-0s4l | P3 | /sustainability CMS | miquella (PR #1135) |
| cf-9t70 | P1 | /swatch-request — Wix CMS pending | — |
| cf-okwz | P3 | EasterEggBear false persistence | unassigned |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
