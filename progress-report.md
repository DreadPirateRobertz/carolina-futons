# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 22:25 MT**

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
| LivingHero header | ✅ MERGED #347 — LivingHero in header, bears live (porch day + stargazing night) |
| Footer white circles | ✅ FIXED — STARS SVG removed from LivingFooterBg (P0, pushed direct to main) |
| Theme previews A/B/C/D | ✅ LIVE on main — /theme-a /theme-b /theme-c /theme-d |
| Design a Room | ✅ MERGED #343 — futon-in-room scene viewer live |
| Auth dead-end redirect | ✅ MERGED #348 — safeNext() guard live |
| /dashboard/profile | ✅ MERGED #349 — name, email, join date, logout live |
| Sale lightbox session gate | ✅ MERGED Velo #1134 — session-gated |
| Cart fixture preview | ✅ PR #350 open — NEXT_PUBLIC_USE_FIXTURE_PRODUCTS env gate |

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
| #331 | feat(cf-4bhw): Gift Registry | ❌ fail |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ❌ fail |
| #299 | fix(cf-urbq): dark mode font contrast | ❌ fail |
| #291 | feat(cf-ww8u): PdpSizeGuide | ❌ fail |
| #281 | feat(cf-7axq): Add to Compare | ❌ fail |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass |

**#331/#319/#299/#291/#281 all failing = lint/typecheck errors.**

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| blaidd | Wire unwired illustrations (BotanicalFooterDivider + 4 PLP category) | cf-sb0i |
| godfrey | PDP Financing / BNPL | cf-10fx |
| radahn | /sustainability CMS wiring | cf-0s4l |
| rennala | BNPL Afterpay/Affirm | cf-d3hc |
| millicent | Standing by — cf-9izd closed, bd ready | — |
| miquella | CFW shipping tier system | cf-eihx |
| morgott | Standing by — cf-etv3 closed, reassign pending | — |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **5 failing CFW PRs** | #331/#319/#299/#291/#281 lint/typecheck — needs crew |
| **Theme pick** | /theme-a /theme-b /theme-c /theme-d live — Stilgar to choose |
| **Velo #1125** | Codecov-only fail — admin merge eligible? |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection pending |
| **contactSubmissions 404** | Awaiting Stilgar §1-§3 DNS clearance |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending; §5 order-lookup 501. Dallas holding. |
| **v3 cabin/reading/falls/fog** | No CFW components built — need Stilgar page direction |
| **morgott/millicent idle** | Both free — dispatch to failing PRs or new beads |

---

## In-Progress Beads (5 total)

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-10fx | P1 | PDP Financing / BNPL | godfrey |
| cf-9t70 | P1 | /swatch-request — code done, Wix CMS pending | morgott |
| cf-sb0i | P2 | Wire unwired illustrations (footer divider + 4 PLP) | blaidd |
| cf-0s4l | P3 | /sustainability — wire Wix CMS | radahn |
| cf-eihx | P2 | CFW shipping tier system | miquella |

**Outside bd:** cf-d3hc/rennala

---

## Illustration Inventory (design-harvest/)

### v2 Botanical — WIRED ✅
BotanicalMountainSkyline → /about | BotanicalTimeline → /about | BotanicalDesignARoom → /design-a-room | BotanicalGuides → /guides | BotanicalVisitUs → /visit | BotanicalReviews → /reviews

### v2 Botanical — IN PROGRESS (cf-sb0i/blaidd)
BotanicalFooterDivider → above Footer (every page) | FutonsCategory → /shop/futon-frames | MurphyCategory → /shop/murphy-cabinet-beds | PlatformCategory → /shop/platform-beds | MattressesCategory → /shop/mattresses

### v3 Mascot — WIRED ✅
MascotWorldHero (porch, daytime) → LivingHero/header | StargazingHero (night) → LivingHero/header | MascotCategoryCard → /shop

### v3 Mascot — NO COMPONENT YET
cabin (v3-03), reading (v3-04), falls (v3-05), fog (v3-06) — need Stilgar page direction

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Fixed — E2E 30s timeout + skip on PRs |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
