# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 23:45 MT**

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
| LivingHero header | ✅ MERGED #347 |
| LivingHero day→night flash | ✅ FIXED (33cbe6e) |
| Footer white circles | ✅ FIXED (12978d4) |
| Footer scene integrated | ✅ MERGED #354 — LivingFooterScene now absolute, no float |
| Search product thumbnails | ✅ FIXED (b7c93cc) |
| Gift Registry /registry | ✅ MERGED #331 |
| EasterEggBear mobile modal | ✅ MERGED #353 — portal fix |
| SEO BlogPosting JSON-LD | ✅ MERGED #352 |
| Illustrations wired | ✅ MERGED #351 |
| Bear Easter egg persistence | ⏳ cf-okwz (P3) — Stilgar to pick: clipboard/localStorage/silent |
| **P0: Zero products on PLP** | ⚠️ PARTIALLY FIXED — plp.ts fixture-gated (306eca7). Awaiting Stilgar directive: set Preview WIX_CLIENT_ID_HEADLESS=cb591c8e (real catalog) OR USE_FIXTURE=1 (5 test items) |
| Font contrast audit | ⏳ miquella (cf-tu3q) |
| Theme pick | ⏳ Stilgar to choose /theme-a–d |

**carolinafutons.com still = Wix.** cfW on Vercel URL only until DNS flip (cf-3qt.8).

---

## ⚠️ P0 OPEN: Zero Products on PLP

**Root cause:** Vercel Preview env uses WIX_CLIENT_ID_HEADLESS=6b4d4894 (staging headless). Staging Wix site has no collections → CATEGORY_NOT_FOUND → items=[]. Also breaks CI E2E.

**Code fix pushed (306eca7):** `plp.ts` now honours USE_FIXTURE flag — fixture collection IDs no longer hit real Wix.

**Remaining:** Stilgar must choose preview env strategy:
- **Option A** (recommended): Change Preview WIX_CLIENT_ID_HEADLESS → cb591c8e (prod Wix client). Real catalog on preview URL.
- **Option B**: Set NEXT_PUBLIC_USE_FIXTURE_PRODUCTS=1 on Vercel Preview + CI. Shows 5 fixture products only.

---

## Vercel Env

| Env Var | Status |
|---------|--------|
| WIX_CLIENT_ID_HEADLESS (prod) | ✅ cb591c8e |
| WIX_CLIENT_ID_HEADLESS (preview) | ⚠️ 6b4d4894 — staging, no collections → P0 |
| SMTP_HOST/PORT/USER/PASS (prod) | ✅ Set |
| CROSS_RIG_SECRET (prod+EAS) | ✅ Set |
| EAS CFW_API_URL | ✅ carolina-futons-web.vercel.app |
| SENTRY_AUTH_TOKEN (EAS) | ⏳ Awaiting Stilgar |

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI |
|----|-------|----|
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail |
| #1130 | chore(deps): dev-deps bump | **HOLD** ⏳ |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ⚠️ codecov only |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI | Note |
|----|-------|----|----|
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ❌ fail | millicent fixing |
| #299 | fix(cf-urbq): dark mode font contrast | ❌ fail | morgott: rebase on latest main |
| #291 | feat(cf-ww8u): PdpSizeGuide | ❌ fail | morgott: rebase on latest main |
| #281 | feat(cf-7axq): Add to Compare | ❌ fail | godfrey: rebase on latest main |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | |

---

## Session Merges (this session)

| PR | Title |
|----|-------|
| ✅ #354 | fix(cf-duua): LivingFooterScene out of flow |
| ✅ #353 | fix(cf-ggvw): EasterEggBear portal fix |
| ✅ #352 | feat(cf-3qt.7): SEO BlogPosting JSON-LD |
| ✅ #351 | feat(cf-sb0i): illustrations wired |
| ✅ #350 | feat(cf-9izd): fixture products |
| ✅ #331 | feat(cf-4bhw): Gift Registry |

---

## Crew Assignments

| Crew | Current Task | Bead | Status |
|------|-------------|------|--------|
| radahn | cf-3qt.7 shipped — awaiting next | — | 🆓 free |
| rennala | cf-3qt.7 convoy done — awaiting next | — | 🆓 free |
| blaidd | cf-sb0i shipped — awaiting next | — | 🆓 free |
| godfrey | Rebase PR #281 on latest main | cf-7axq | rebasing |
| miquella | Font-contrast audit + cf-0s4l next | cf-tu3q | in progress |
| morgott | Rebase PRs #291+#299 on latest main | cf-duua closed | rebasing |
| millicent | Fix PR #319 CI (room planner) | cf-3ya6 closed | ❌ fixing |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **P0: PLP zero products** | Stilgar decision needed: Option A (prod Wix client on preview) vs Option B (USE_FIXTURE=1) |
| **PRs #281/#291/#299** | Need rebase on main after P0 fix commit (306eca7) |
| **CI E2E** | Fails until preview WIX env resolved — E2E hits staging Wix with no collections |
| **SENTRY_AUTH_TOKEN** | Mayor DM'd Stilgar — awaiting |
| **Font contrast** | cf-tu3q/miquella — audit in progress |
| **Theme pick** | /theme-a–d live — Stilgar to choose |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection pending |
| **contactSubmissions 404** | Awaiting Stilgar DNS clearance |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending |
| **v3 cabin/reading/falls/fog** | Need Stilgar page direction |
| **Vercel prod redeploy** | Needed to activate new WIX_CLIENT_ID_HEADLESS |

---

## In-Progress Beads

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-tu3q | P2 | Font contrast Playwright audit | miquella |
| cf-0s4l | P3 | /sustainability CMS | miquella (next) |
| cf-9t70 | P1 | /swatch-request — Wix CMS pending | — |
| cf-okwz | P3 | EasterEggBear false "Code saved ✓" | unassigned |
| cf-duua | P1 | Footer scene layout | ✅ closed (PR #354 merged) |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
