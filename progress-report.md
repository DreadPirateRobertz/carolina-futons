# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 00:35 MT**

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

## 🔍 PROD STATUS (2026-05-04 00:35 MT)

**P0 ROOT CAUSE FOUND:** WIX_CLIENT_ID_HEADLESS env var had trailing `\n` → malformed client ID → Wix SDK auth failure → `getCollectionBySlug` errors → 0 products ALL PLPs.

**FIX DEPLOYED:** `env().trim()` added to src/lib/env.ts (commit 99f71ef, main). Vercel redeploy in progress (~2-4 min).

**Stilgar action needed:** Remove + re-add WIX_CLIENT_ID_HEADLESS in Vercel Dashboard (prod) without trailing newline: `cb591c8e-2147-4ca2-88f0-89b7e0f2b25a`

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
| Blog OG + Twitter card | ✅ MERGED #355 |
| Footer scene alive (cf-qif2) | ✅ MERGED #359 |
| Add to Compare | ✅ MERGED #281 |
| PLP filter labels (cf-af7h) | ✅ MERGED #361 |
| Dark mode CTA + sustainability | ✅ MERGED #362 |
| **Products loading (ALL PLPs)** | 🔧 FIX DEPLOYING — env.ts trim committed, Vercel building |
| Dark mode card wrappers (cf-xbj9) | ⛔ PR #363 DO NOT MERGE — 2 inputs missing dark token, QA unchecked |
| Dark mode homepage (cf-52gi) | ⏳ PR #364 UNSTABLE CI |
| Light mode charcoal/50 (cf-ighf) | ⏳ millicent in progress |
| **P0: PLP zero products (preview)** | ⚠️ Also affected — same root cause. Fix deploying. |
| Theme pick | ⏳ Stilgar to choose /theme-a–d |
| contactSubmissions live | ⚠️ Needs Wix site publish (Stilgar direct action) |

---

## Vercel Env

| Env Var | Status |
|---------|--------|
| WIX_CLIENT_ID_HEADLESS (prod) | ⚠️ Has trailing \\n — fix in env.ts deployed; Stilgar should also fix in Vercel Dashboard |
| WIX_CLIENT_ID_HEADLESS (preview) | ⚠️ 6b4d4894 — same trim fix will help; may also need Stilgar to set correct value |
| SMTP / CROSS_RIG_SECRET (prod+EAS) | ✅ Set |
| SENTRY_AUTH_TOKEN (EAS) | ⏳ Awaiting Stilgar |

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI | Note |
|----|-------|----|----|
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail | |
| #1130 | chore(deps): dev-deps bump | **HOLD** ⏳ | |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ❌ fail | |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail | |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI | Note |
|----|-------|----|----|
| #364 | fix(cf-52gi): dark mode homepage token inversions | ⚠️ UNSTABLE | radahn — awaiting CI |
| #363 | fix(cf-xbj9): dark mode card bg WCAG AA | ⛔ DO NOT MERGE | godfrey — 2 input fixes + QA boxes needed |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ✅ CLEAN | Needs Stilgar approach approval |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | draft |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | PR #364 cf-52gi dark mode homepage | ⏳ CI unstable |
| rennala | cf-9t70: /swatch-request Wix CMS | ⏳ blocked on Wix CMS collection (Stilgar) |
| blaidd | cf-32cy dark mode /contact orange | 🔧 in progress |
| godfrey | PR #363 cf-xbj9 — fixing 2 inputs + QA | 🔧 rework needed |
| miquella | cf-0s4l BLOCKED — WIX_API_KEY account mismatch | ⛔ needs Stilgar new API key |
| morgott | cf-jcta CTA hover dark contrast gap | 🔧 in progress |
| millicent | cf-ighf light mode charcoal/50 (2 nodes) | 🔧 in progress |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **P0: Products = 0** | Fix deploying — env.ts trim pushed to main. Stilgar also fix env var in Vercel Dashboard. |
| **cf-0s4l BLOCKED** | Stilgar must create WIX_API_KEY under account ed8a7220 in Wix Dashboard → Settings → API Keys |
| **contactSubmissions 404** | Stilgar must publish live Wix site |
| **PR #356** | cf-okwz clipboard approach — Stilgar approval needed |
| **cf-9t70 swatch CMS** | Stilgar create SwatchRequests collection in Wix Dashboard |
| **SENTRY_AUTH_TOKEN** | Stilgar awaiting |
| **Theme pick** | /theme-a–d live — Stilgar to choose |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending |

---

## In-Progress Beads

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-xbj9 | P1 | dark:bg-cf-cream card wrappers | godfrey PR #363 rework |
| cf-9t70 | P1 | /swatch-request Wix CMS | rennala (blocked) |
| cf-52gi | P2 | dark mode homepage cream/sand | radahn PR #364 |
| cf-32cy | P3 | dark mode /contact orange (1 node) | blaidd |
| cf-okwz | P3 | EasterEggBear clipboard | PR #356 pending Stilgar |
| cf-ighf | P3 | light mode charcoal/50 (2 nodes) | millicent |
| cf-jcta | P3 | CTA hover dark contrast gap | morgott |
| cf-0s4l | P3 | /sustainability provision | miquella (blocked) |

---

## Shipping Test Report ✅ (resent to mayor 00:34 MT)

56/56 PASS · Parcel <70 lbs · LTL 70–499 lbs · Freight ≥500 lbs or palletized · White-glove NC only

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
| #361 | PLP filter labels zinc-600 | 06:25 UTC |
| #362 | Dark mode CTA + sustainability | 06:26 UTC |
| env.ts trim fix | P0 products loading fix | 06:33 UTC |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
