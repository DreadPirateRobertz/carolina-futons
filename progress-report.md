# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 00:08 MT**

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
Active: `trackCustomEvent` ✅ `sampleRequests` ✅ `notifyMe` ✅ `deliveryZone` ✅ `contactSubmissions` ❌ (HTTP fn missing — cf-ybpi rennala) `crossRigEventReceiver` ✅

### Cross-Rig (Mobile ↔ cfW)
Channel A dual-write active. CROSS_RIG_SECRET: **Vercel Prod ✅ + EAS ✅ + Wix Staging ✅**. CFW_API_URL in EAS = `https://carolina-futons-web.vercel.app` (update to carolinafutons.com at DNS cutover). DNS cutover pending cf-cb9s.

---

## 🔍 STILGAR SITE AUDIT — Vercel URL

**URL:** https://carolina-futons-web-git-main-dreadpiraterobertzs-projects.vercel.app/

| Feature | Status |
|---------|--------|
| LivingHero + all phase fixes | ✅ MERGED |
| Footer scene integrated | ✅ MERGED #318 |
| Footer white circles | ✅ FIXED |
| Search product thumbnails | ✅ FIXED |
| Gift Registry /registry | ✅ MERGED #331 |
| EasterEggBear mobile modal | ✅ MERGED #353 |
| SEO BlogPosting JSON-LD | ✅ MERGED #352 |
| Illustrations wired | ✅ MERGED #351 |
| Room planner 2D | ✅ MERGED #319 |
| Dark mode font contrast | ✅ MERGED #299 |
| Dark mode font contrast | ✅ MERGED #299 |
| Blog OG + Twitter card | ❌ PR #355 CI fail — radahn fixing TS type error |
| Footer scene alive (cf-qif2) | ⏳ godfrey — bear breathing + absolute positioning |
| PLP illustrations + botanical footer | ⏳ cf-sb0i blaidd — branch push pending |
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
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail | |
| #1130 | chore(deps): dev-deps bump | **HOLD** ⏳ | |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ⚠️ codecov only | |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail | |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI | Note |
|----|-------|----|----|
| #358 | fix(cf-04b5): surface auth catch errors | ✅ pass | refinery running |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ⏳ pending | crew-proposed approach, needs Stilgar ok |
| #355 | feat(cf-3qt.7): blog OG + Twitter card metadata | ❌ fail | radahn fixing TS type error (openGraph.type, twitter.card) |
| #291 | feat(cf-ww8u): PdpSizeGuide | ✅ pass | morgott ticking 3 test plan boxes |
| #281 | feat(cf-7axq): Add to Compare | ✅ pass | godfrey ticking 5 test plan boxes then cf-qif2 |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | PR #355 blog OG — fix TS type errors + co-author line | 🔧 fixing |
| rennala | cf-ybpi: add post_contactSubmissions HTTP fn to Velo | 🔧 new |
| blaidd | Push feat/cf-sb0i branch → PR; then cf-04b5 | 🔧 push pending |
| godfrey | Tick PR #281 boxes → PR merge → cf-qif2 (footer anim) | 🔧 in sequence |
| miquella | cf-tu3q font audit — file systemic dark mode beads | 🔧 in progress |
| morgott | Tick PR #291 test plan boxes | 🔧 fixing |
| millicent | ✅ PR #319 MERGED | 🆓 free |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **P0: PLP zero products** | Stilgar directive needed (Option A vs B) |
| **PR #355** | radahn: fix TS types in blog-pages.test.tsx (openGraph.type, twitter.card) |
| **PR #291** | morgott: tick 3 test plan checkboxes |
| **PR #281** | godfrey: tick 5 test plan checkboxes |
| **PR #356** | cf-okwz clipboard approach — Stilgar approval needed |
| **cf-sb0i** | blaidd: push feat/cf-sb0i to remote → PR |
| **cf-0s4l provision** | rennala: needs hal to log in to Wix dashboard for API key (account ed8a7220) |
| **SENTRY_AUTH_TOKEN** | Mayor DM'd Stilgar — awaiting |
| **Theme pick** | /theme-a–d live — Stilgar to choose |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection pending |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending |
| **cf-okwz** (P3) | Bear Easter egg clipboard approach — PR #356 pending Stilgar ok |
| **Vercel prod redeploy** | Needed to activate WIX_CLIENT_ID_HEADLESS prod swap |

---

## In-Progress Beads

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-tu3q | P2 | Font contrast Playwright audit | miquella |
| cf-0s4l | P3 | /sustainability CMS | ✅ PR #1135 MERGED — blocked on Wix API key for provision |
| cf-9t70 | P1 | /swatch-request — Wix CMS pending | rennala |
| cf-qif2 | P1 | LivingFooterScene bear breathing + positioning fix | godfrey (after #281) |
| cf-ybpi | P1 | post_contactSubmissions HTTP function in Velo | rennala |
| cf-okwz | P3 | EasterEggBear clipboard approach | (PR #356 pending) |

---

## Session Merges (this session)

| PR | Title | When |
|----|-------|------|
| #352 | SEO BlogPosting JSON-LD | 05:41 UTC |
| #351 | Illustrations wired | 05:41 UTC |
| #319 | 2D drag-drop room planner | 06:02 UTC |
| #299 | Dark mode font contrast | 06:03 UTC |
| #1135 | Sustainability CMS collections | 06:06 UTC |

---

## Illustration Inventory (per Stilgar directive)

| Component | Location | Status |
|-----------|----------|--------|
| LivingFooterBg | All pages (layout) | ✅ LIVE — animated sky tint |
| LivingFooterScene | All pages (layout) | ✅ LIVE — static scene, fix incoming cf-qif2 |
| StargazingHero | Home (night phase) | ✅ LIVE via LivingHero |
| MascotWorldHero | Home (day/dusk/dawn) | ✅ LIVE via LivingHero |
| BotanicalMountainSkyline | /about | ✅ LIVE |
| BotanicalTimeline | /about | ✅ LIVE |
| TeamPortrait | /about | ✅ LIVE |
| ContactHero | /contact + /press | ✅ LIVE |
| BotanicalDesignARoom | /design-a-room | ✅ LIVE |
| BotanicalGuides | /guides | ✅ LIVE |
| BotanicalReviews | /reviews | ✅ LIVE |
| BotanicalVisitUs | /visit | ✅ LIVE |
| EmptySearchIllustration | /search | ✅ LIVE |
| NotFoundIllustration | /not-found | ✅ LIVE |
| BotanicalFooterDivider | All pages (above footer) | ⏳ cf-sb0i — blaidd pushing branch |
| FutonsCategory | /shop/futon-frames | ⏳ cf-sb0i |
| MurphyCategory | /shop/murphy-cabinet-beds | ⏳ cf-sb0i |
| PlatformCategory | /shop/platform-beds | ⏳ cf-sb0i |
| MattressesCategory | /shop/mattresses | ⏳ cf-sb0i |
| CartIllustration | Cart | not wired |
| EmptyCartIllustration | Cart (empty) | not wired |
| AboutIllustrationClient | /about | not wired |
| BlueRidgeTimeline | unknown | not wired |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
