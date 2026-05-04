# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 15:08 MT**

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

## 🔍 P0 PRODUCTS — CONFIRMED BROKEN

**Root cause:** Wix headless OAuth app `cb591c8e` returns `"No Metasite Context in identity"` — not installed on any Wix site with Stores.

**DEFERRED** — Stilgar will fix manually. FIX: halworker85@gmail.com → manage.wix.com/developer-center → My Apps → `cb591c8e-2147-4ca2-88f0-89b7e0f2b25a` → Install on carolinafutons.com

---

## 🧪 TEST RESULTS

| Suite | Result |
|-------|--------|
| Gamification / reward (5 files) | ✅ 139/139 PASS |
| Checkout route (cfW) | ✅ 3/3 PASS |
| Full cfutons vitest suite | ✅ **40,158/40,158 PASS** |
| E2E checkout (real payment) | ⛔ BLOCKED — P0 must resolve first; Stilgar enable Wix sandbox payment |
| E2E fixture-mode smoke test | ✅ PRs merged |

---

## 🎨 DESIGN MIGRATION STATUS — ✅ 100% COMPLETE

| Phase | Scope | PR | Status |
|-------|-------|----|--------|
| Quick wins | Delete orphaned botanical components | #406 | ✅ MERGED (95/100) |
| Phase 0 | MascotFooterDivider wired into layout | #400 | ✅ MERGED (95/100) |
| Phase 1 | PLP category cards — botanical imports removed | #404 | ✅ MERGED (95/100) |
| Phase 2 — /about | BotanicalMountainSkyline + Timeline + TeamPortrait → v3 | #401 | ✅ MERGED (87/100) |
| Phase 2 — /contact + /press | ContactHero → FogScene | #402 | ✅ MERGED (96/100) |
| Phase 2 — /visit + /design-a-room | BotanicalVisitUs + DesignARoom → v3 scenes | #403 | ✅ MERGED (87/100) |
| Phase 2 — /guides + /reviews | BotanicalGuides + Reviews → ReadingScene + FallsScene | #407 | ✅ MERGED (92/100) |
| Phase 2 — /spring-sale | LivingSky → VintageSunRays | #408 | ✅ MERGED (97/100) |
| Phase 3 | Empty states + 404 → v3 mascot spots | #405 + #409 | ✅ MERGED (74+97/100) |
| Cleanup | Final illustrations/ cleanup — ContactHero orphan deleted | #414 | ✅ MERGED (95/100) |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI | Note |
|----|-------|----|----|
| #419 | test(cf-3qt.8.26): redirect map unit tests (8 tests) | ⏳ CI | blaidd — awaiting merge |
| #418 | fix(cf-q5km): MascotCategoryCard useReducedMotion guard | ✅ CI | ❌ BLOCK — missing MascotCategoryCard.tsx, needs rebase |
| #417 | test(cf-3qt.16.2): homepage MascotCategoryCard E2E | ✅ MERGED | 88/100 |
| #415 | feat(cf-footer-anim): footer mascot animation | ✅ MERGED | 91/100 — Footer.tsx + motion + useReducedMotion |
| #392 | chore(deps): bump eslint 9→10 | ❌ FAIL | **HOLD** — major version |
| #391 | chore(deps): bump wix-sdk group | ✅ CI | **HOLD** |
| #376 | docs(cf-3qt.7): analytics env vars | ✅ CI | **BLOCK**: Stilgar replace GA4/Meta IDs |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ✅ CI | Stilgar approval needed |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ CI | draft |

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI | Note |
|----|-------|----|----|
| #1136 | chore(deps): bump dawidd6/action-send-mail | **HOLD** ✅ | |
| #1130 | chore(deps): dev-deps bump | **HOLD** ✅ | |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| millicent | cf-3qt.16.1 ✅ Footer animation unit tests — 5 pass | ⚡ needs bead |
| morgott | wix-retirement-checklist.md — cf-3qt.9 prep doc | 🔧 dispatched |
| radahn | cf-l6aj — parity audit gaps → bead backlog | 🔧 dispatched |
| blaidd | cf-3qt.8.26 ✅ PR #419 redirect map tests (8 tests) | 🔧 CI pending |
| rennala | cf-3qt.8.27 — /shop/sale PLP E2E spec | 🔧 dispatched |
| godfrey | cf-3qt.16.3 — MascotCategoryCard unit tests | 🔧 dispatched |
| miquella | cf-q5km — PR #418 BLOCK: rebase + add MascotCategoryCard.tsx fix | 🔧 fixing |

---

## Open Blockers (Stilgar actions)

| Issue | Status |
|-------|--------|
| **P0: 0 products** | **DEFERRED** — Stilgar doing manually. Fix: halworker85 → manage.wix.com/developer-center → cb591c8e → Install on carolinafutons.com |
| **Vercel account** | ⚠️ Project on personal account `dreadpiraterobertzs-projects` — must transfer to team OR upgrade personal before Pro cutover. See upgrade-runbook.md |
| **E2E checkout** | Wix Dashboard: enable sandbox payment + P0 fix |
| **cf-0s4l** | Create WIX_API_KEY under account ed8a7220 |
| **contactSubmissions** | Publish live Wix site |
| **PR #356** | Approve clipboard approach |
| **PR #376** | Replace real GA4/Meta Pixel IDs with placeholder strings |
| **GSC sitemap** | Deferred Phase 8 |
| **SwatchRequests CMS** | Create collection in Wix Dashboard |
| **SENTRY_AUTH_TOKEN** | Set in EAS |
| **Theme pick** | Choose /theme-a–d |
| **DNS flip** (cf-cb9s) | §1-§3 pending |

---

## In-Progress Beads

| Bead | Pri | Title | Status |
|------|-----|-------|--------|
| cf-q5km | P2 | PR #418 BLOCK: miquella rebase + add MascotCategoryCard.tsx | 🔧 fixing |
| cf-q90y.1 | P2 | Delete 9 orphan illustration components — radahn | 🔧 in progress |
| cf-3qt.16.3 | P2 | MascotCategoryCard unit tests — godfrey | 🔧 in progress |
| cf-3qt.8.27 | P2 | /shop/sale PLP E2E — rennala | 🔧 in progress |
| cf-l6aj | P2 | Parity audit gap → bead backlog — radahn | 🔧 in progress |
| cf-3qt.7 | P1 | SEO + analytics — code COMPLETE | PR #376 blocked Stilgar |
| cf-okwz | P3 | EasterEggBear clipboard | PR #356 pending Stilgar |

---

## Session Merges (this session)

| PR | Title | Score | When |
|----|-------|-------|------|
| #415 | feat(cf-footer-anim): footer mascot animation (Footer.tsx + motion) | 91/100 | 14:58 MT |
| #416 | feat(cf-home-animals): homepage mascot category cards | 90/100 | 14:41 MT |
| #414 | chore(design-migration): illustrations cleanup + 4 SVGs | 95/100 | 14:41 MT |
| #413 | test(cf-3qt.8.13): Wave 2 post-cutover E2E spec | 88/100 | 14:41 MT |
| #412 | feat(cf-3qt.8.6): pre-cutover redirect map | 85.8/100 avg | 11:2x MT |
| #411 | test(cf-3qt.8.9): Wave 1 post-cutover smoke | 88/100 | 11:22 MT |
| #410 | test(on-sale): discountedPrice edge cases | 97/100 | 17:13 UTC |
| #389 | feat(cf-3qt.12): /shop/sale PLP | 84/100 | 16:52 UTC |
| #408 | feat(design-migration): /spring-sale VintageSunRays | 97/100 | 16:38 UTC |
| #390 | test(cf-3qt.14): /search E2E smoke | 88/100 | 16:43 UTC |
| #406 | chore(design-migration): orphan botanical deletions | 95/100 | 16:31 UTC |
| #404 | feat(design-migration-p1): Phase 1 PLP botanical removal | 95/100 | 16:26 UTC |
| #403 | feat(design-migration): /visit + /design-a-room scenes | 87/100 | 16:26 UTC |
| #409 | refactor(mascot-palette): V3_NIGHT palette + Bear pose | 97/100 | 16:25 UTC |
| #407 | feat(design-migration): /guides + /reviews scenes | 92/100 | 16:25 UTC |
| #402 | feat(design-migration): FogScene /contact+/press | 96/100 | 16:25 UTC |
| #405 | feat(design-migration-p3): Phase 3 empty states | 74/100 | 10:17 UTC |
| #401 | feat(design-migration): /about botanical → v3 | 87/100 | 10:12 UTC |
| #400 | feat(design-migration-p0): MascotFooterDivider in layout | 95/100 | 10:12 UTC |
| Earlier PRs | #383–#397, #352–#368 | — | earlier |

---

## Shipping Test Report ✅

56/56 PASS · Parcel <70 lbs · LTL 70–499 lbs · Freight ≥500 lbs or palletized · White-glove NC only

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---

## Auto-Push Cron
Progress report auto-pushed every 10 min via cron `de1e2247` (session-only, 7-day TTL).

---
*Cron: 353ab5c0 (progress refresh) + de1e2247 (auto-push) · Design migration 100% COMPLETE · Session merges: #411–#417 (7 PRs) · #418 BLOCKED (miquella rebase+fix) · #419 CI pending · 6 crew active · radahn botanical audit: 9 orphans found → cf-q90y.1 deletion bead · Theme routes pre-exist (#252/#216/#255/#344) · ⚠️ Vercel personal account for Stilgar · P0 deferred Stilgar manual*
