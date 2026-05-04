# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 22:35 MT**

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
Channel A dual-write active: mobile fires both cfW `/api/cross-rig` + Wix concurrently. CROSS_RIG_SECRET: **Vercel Production ✅ + Wix Staging ✅ + Mobile ✅** (dallas confirmed). DNS cutover pending cf-cb9s — §5 order-lookup 501 still open.

---

## 🔍 STILGAR SITE AUDIT — Vercel URL

**URL:** https://carolina-futons-web-git-main-dreadpiraterobertzs-projects.vercel.app/

| Feature | Status |
|---------|--------|
| LivingHero header | ✅ MERGED #347 — bears live (porch day + stargazing night) |
| Footer white circles | ✅ FIXED — STARS SVG removed from LivingFooterBg (direct to main) |
| Theme previews A/B/C/D | ✅ LIVE — /theme-a /theme-b /theme-c /theme-d |
| Design a Room | ✅ MERGED #343 |
| Auth dead-end redirect | ✅ MERGED #348 — safeNext() guard |
| /dashboard/profile | ✅ MERGED #349 |
| Sale lightbox session gate | ✅ MERGED Velo #1134 |
| PDP Financing (BNPL) | ✅ MERGED #279 — Afterpay 4-pay + term pills |
| Cart fixture preview | ⏳ PR #350 open — CI pending |
| SEO+analytics | ⏳ cf-3qt.7 in progress (radahn) |

**carolinafutons.com still = Wix.** cfW visible on Vercel URL only until DNS flip (cf-3qt.8).

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI |
|----|-------|----|
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail (test 20+22) |
| #1130 | chore(deps): dev-deps bump | **HOLD** ✅ pass |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ⚠️ codecov only |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail (test 20+22) |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI |
|----|-------|----|
| #350 | feat(cf-9izd): seeded fixture products for cart QA | ⏳ pending |
| #331 | feat(cf-4bhw): Gift Registry | ❌ fail — unassigned |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ❌ fail → rennala (cf-agzh) |
| #299 | fix(cf-urbq): dark mode font contrast | ❌ fail → morgott (cf-xu9g) |
| #291 | feat(cf-ww8u): PdpSizeGuide | ❌ fail — unassigned |
| #281 | feat(cf-7axq): Add to Compare | ❌ fail → godfrey (cf-arfx) |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass |

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| radahn | SEO+analytics — redirects, GA4, pixels, JSON-LD, OG, sitemap | cf-3qt.7 |
| rennala | Fix PR #319 lint/typecheck (2D room planner) | cf-agzh |
| morgott | Fix PR #299 lint/typecheck (dark mode contrast) | cf-xu9g |
| godfrey | Fix PR #281 lint/typecheck (Add to Compare) | cf-arfx |
| blaidd | Wire unwired illustrations (BotanicalFooterDivider + 4 PLP) | cf-sb0i |
| millicent | Standing by — next: PR #331 or #291 fix | — |
| miquella | CFW shipping tier system | cf-eihx |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **PR #331 #291** | Gift Registry + PdpSizeGuide — uncrewed lint fixes (millicent next) |
| **Theme pick** | /theme-a /theme-b /theme-c /theme-d live — Stilgar to choose |
| **Velo #1125** | Codecov-only fail — admin merge eligible? |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection pending |
| **contactSubmissions 404** | Awaiting Stilgar §1-§3 DNS clearance |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending; §5 order-lookup 501. Dallas holding. |
| **v3 cabin/reading/falls/fog** | No CFW components — need Stilgar page direction |

---

## In-Progress Beads (6 total)

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-3qt.7 | P1 | SEO+analytics (redirects, GA4, pixels, schema, OG, sitemap) | radahn |
| cf-9t70 | P1 | /swatch-request — code done, Wix CMS pending | — |
| cf-sb0i | P2 | Wire unwired illustrations (footer divider + 4 PLP) | blaidd |
| cf-agzh | P2 | Fix PR #319 lint errors (2D room planner) | rennala |
| cf-xu9g | P2 | Fix PR #299 lint errors (dark mode) | morgott |
| cf-arfx | P2 | Fix PR #281 lint errors (Add to Compare) | godfrey |

**Outside bd:** cf-d3hc closed · cf-eihx/miquella

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Fixed |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
