# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 20:05 MT**

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

## ⚠️ STILGAR VISIBILITY ISSUE — ACTION NEEDED

**carolinafutons.com still serves Wix** — DNS cutover (cf-cb9s) has NOT happened.
LivingSky header + all illustration PRs are in **cfW (Next.js/Vercel)**, live at:

> **https://carolina-futons-web-git-main-dreadpiraterobertzs-projects.vercel.app/**

Stilgar must check the Vercel URL to see cfW changes. Wix won't show them until DNS flip.

**Wix republish needed?** Yes — for Velo changes (PR #1114 contactSubmissions endpoint). Stilgar needs to push Publish in Wix Studio to activate Velo code changes on carolinafutons.com.

---

## Session Merges — SHIPPED TO VERCEL ✅

### This Session (23 CFW + 3 Velo merged)
| PR | What |
|----|------|
| #340 | refactor(cf-jegx): SwatchContactInfo.state → UsState literal union ✅ |
| #339 | feat(cf-jegx): Turnstile reset + degraded-mode banner ✅ |
| #334–#338 + 17 others | See previous entries — all shipped ✅ |

**Vercel production URL:** https://carolina-futons-web-git-main-dreadpiraterobertzs-projects.vercel.app/

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI |
|----|-------|----|
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail |
| #1130 | chore(deps): dev-deps bump | **HOLD** |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ❌ fail (codecov only) |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI |
|----|-------|----|
| #331 | feat(cf-4bhw): Gift Registry — /registry + /registry/[slug] | ❌ fail |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ❌ fail |
| #299 | fix(cf-urbq): dark mode font contrast | ❌ fail |
| #291 | feat(cf-ww8u): PdpSizeGuide | ❌ fail |
| #281 | feat(cf-7axq): Add to Compare | ❌ fail |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass |

**All 5 failing = lint/typecheck errors.**

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| blaidd | Cart QA seeded fixtures | cf-9izd |
| godfrey | PDP Financing BNPL | cf-10fx |
| radahn | /sustainability CMS wiring | cf-0s4l |
| rennala | Sitemap 404 fix | cf-rb07 |
| millicent | Illustration wiring — v1/v2/v3 into sub-pages | cf-tyuk |
| morgott | cf-9t70 swatch — Wix CMS collection + email templates | cf-9t70 |
| miquella | **Design a Room — futon-in-room visual (NEW Stilgar directive)** | cf-c0dh |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **Stilgar can't see header/illustrations** | cfW on Vercel URL — NOT carolinafutons.com (Wix). DNS flip pending. |
| **Wix republish needed** | Stilgar must Publish in Wix Studio for Velo #1114 (contactSubmissions) to go live |
| **Velo #1125** (sampleRequests) | Codecov-only fail — admin merge eligible? |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection + email templates needed |
| **contactSubmissions 404** | Velo endpoint exists; awaiting Stilgar §1-§3 DNS clearance |
| **DNS flip** (cf-cb9s) | Stilgar manual §1-§3 pending; §5 order-lookup 501. Dallas holding. |

---

## In-Progress Beads (11 total)

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-10fx | P1 | PDP Financing / BNPL — Afterpay + Affirm | godfrey |
| cf-d3hc | P1 | PDP Financing / BNPL section | — |
| cf-9t70 | P1 | /swatch-request — code done, Wix CMS pending | morgott |
| cf-c0dh | P1 | Design a Room — futon-in-room visual ← **NEW Stilgar** | miquella |
| cf-c77s | P1 | E2E auto emails + challenges + rewards | — |
| cf-eihx | P1 | CFW shipping tier system | — |
| cf-rtd7 | P1 | cf-3qt full prod parity audit | — |
| cf-yfvl | P1 | cf-theme-experiments A/B/C/D variants | — |
| cf-9fd8 | P2 | PDP back-in-stock notify me | — |
| cf-9izd | P2 | Cart QA seeded-fixture preview deploy | blaidd |
| cf-0s4l | P3 | /sustainability — wire Wix CMS | radahn |

**Outside bd (active):** cf-rb07/rennala · cf-tyuk/millicent

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Fixed — E2E 30s timeout + skip on PRs |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
