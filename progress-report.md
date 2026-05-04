# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 23:05 MT**

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
| LivingHero header | ✅ MERGED #347 — bears live |
| LivingHero day→night flash | ✅ FIXED — !mounted guard on all 4 phase opacities (33cbe6e, main) |
| Footer white circles | ✅ FIXED — STARS SVG removed |
| Theme previews A/B/C/D | ✅ LIVE — /theme-a /theme-b /theme-c /theme-d |
| Design a Room | ✅ MERGED #343 |
| Auth dead-end redirect | ✅ MERGED #348 |
| /dashboard/profile | ✅ MERGED #349 |
| Sale lightbox session gate | ✅ MERGED Velo #1134 |
| PDP Financing (BNPL) | ✅ MERGED #279 |
| Font contrast audit | ⏳ miquella (cf-tu3q) — Playwright audit in progress |
| SEO+analytics | ⏳ cf-3qt.7 in progress (radahn) |

**carolinafutons.com still = Wix.** cfW on Vercel URL only until DNS flip (cf-3qt.8).

---

## Vercel Env (Stilgar directive — all done)

| Env Var | Status |
|---------|--------|
| WIX_CLIENT_ID_HEADLESS (prod) | ✅ Swapped → cb591c8e live prod value |
| SMTP_HOST/PORT/USER/PASS (prod) | ✅ Set |
| CROSS_RIG_SECRET (prod) | ✅ Set |
| EAS CROSS_RIG_SECRET | ✅ Set (dallas confirmed) |
| EAS CFW_API_URL | ✅ Set = https://carolina-futons-web.vercel.app |

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI |
|----|-------|----|
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail |
| #1130 | chore(deps): dev-deps bump | **HOLD** ✅ |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ⚠️ codecov only |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI |
|----|-------|----|
| #350 | feat(cf-9izd): fixture products for cart QA | ⏳ pending → millicent |
| #331 | feat(cf-4bhw): Gift Registry | ❌ fail → rennala (cf-yhep) |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ⏳ CI re-running (rennala fixed) |
| #299 | fix(cf-urbq): dark mode font contrast | ⏳ CI pending (morgott fixed) |
| #291 | feat(cf-ww8u): PdpSizeGuide | ❌ fail → morgott (cf-sk49) |
| #281 | feat(cf-7axq): Add to Compare | ❌ fail → godfrey (cf-arfx) |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass |

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| radahn | SEO+analytics — redirects, GA4, pixels, JSON-LD, OG, sitemap | cf-3qt.7 |
| blaidd | Wire unwired illustrations (BotanicalFooterDivider + 4 PLP) | cf-sb0i |
| godfrey | Fix PR #281 lint (Add to Compare) | cf-arfx |
| miquella | Playwright font-contrast audit (light + dark mode) | cf-tu3q |
| rennala | Fix PR #331 lint (Gift Registry) | cf-yhep |
| morgott | Fix PR #291 lint (PdpSizeGuide) | cf-sk49 |
| millicent | PR #350 check + merge if green | cf-3ya6 |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **Font contrast** | cf-tu3q/miquella — audit in progress, beads to follow |
| **Theme pick** | /theme-a–d live — Stilgar to choose |
| **Velo #1125** | Codecov-only — admin merge eligible? |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection pending |
| **contactSubmissions 404** | Awaiting Stilgar DNS clearance |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending; §5 order-lookup 501 |
| **v3 cabin/reading/falls/fog** | No CFW components — need Stilgar page direction |
| **Vercel prod redeploy** | Needed to activate new WIX_CLIENT_ID_HEADLESS |

---

## In-Progress Beads

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-3qt.7 | P1 | SEO+analytics | radahn |
| cf-sb0i | P2 | Wire unwired illustrations | blaidd |
| cf-arfx | P2 | Fix PR #281 lint (Add to Compare) | godfrey |
| cf-tu3q | P2 | Font contrast Playwright audit | miquella |
| cf-yhep | P2 | Fix PR #331 lint (Gift Registry) | rennala |
| cf-sk49 | P2 | Fix PR #291 lint (PdpSizeGuide) | morgott |
| cf-3ya6 | P2 | PR #350 check + merge | millicent |
| cf-9t70 | P1 | /swatch-request — Wix CMS pending | — |
| cf-0s4l | P3 | /sustainability CMS | miquella |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
