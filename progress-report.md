# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 00:39 MT**

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

## 🔍 P0 STATUS (2026-05-04 00:39 MT) — STILGAR ACTION REQUIRED

**TRUE ROOT CAUSE:** Wix headless OAuth app (`cb591c8e`) has NO Metasite Context — it is not installed/connected to any Wix site with Stores. Direct API test returns: `"No Metasite Context in identity." (UNAUTHORIZED)`.

**STILGAR MUST FIX IN WIX DEV CENTER (wix.com/developers):**
1. Open Manage Apps → find OAuth app with clientId `cb591c8e-2147-4ca2-88f0-89b7e0f2b25a`
2. Verify which site it's installed on
3. Install on carolinafutons.com if not already done
4. OR create new OAuth app on the live site → update `WIX_CLIENT_ID_HEADLESS` in Vercel (prod)

**env.ts trim fix** deployed (commit 99f71ef) — defensive improvement, does not resolve this root cause.

---

## 🔍 STILGAR SITE AUDIT — Vercel URL

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
| PLP filter labels | ✅ MERGED #361 |
| Dark mode CTA + sustainability | ✅ MERGED #362 |
| **Products loading (ALL PLPs)** | ❌ 0 products — Wix OAuth app not connected to site |
| Dark mode card wrappers (cf-xbj9) | ⛔ PR #363 — godfrey fixing 2 inputs |
| Dark mode homepage (cf-52gi) | ⏳ PR #364 UNSTABLE CI |
| CTA hover + /contact (cf-jcta+cf-32cy) | ⏳ PR #365 CLEAN — refinery running |
| Light mode charcoal/50 (cf-ighf) | ⏳ millicent in progress |
| Theme pick | ⏳ Stilgar to choose /theme-a–d |
| contactSubmissions live | ⚠️ Needs Wix site publish (Stilgar direct action) |

---

## Vercel Env

| Env Var | Status |
|---------|--------|
| WIX_CLIENT_ID_HEADLESS (prod) | ❌ `cb591c8e` — no Metasite Context. Stilgar must fix in Wix Dev Center |
| WIX_CLIENT_ID_HEADLESS (preview) | ⚠️ `6b4d4894` — same issue |
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
| #365 | fix(cf-jcta+cf-32cy): CTA hover + /contact dark | ✅ CLEAN | refinery running |
| #364 | fix(cf-52gi): dark mode homepage | ⚠️ UNSTABLE | radahn — CI running |
| #363 | fix(cf-xbj9): dark mode card bg WCAG AA | ✅ CLEAN | godfrey — fixing 2 inputs |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ✅ CLEAN | Needs Stilgar approach ok |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | draft |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | PR #364 cf-52gi dark mode homepage | ⏳ CI unstable |
| rennala | cf-9t70 /swatch-request | ⏳ blocked on Wix CMS (Stilgar) |
| blaidd | cf-32cy — in PR #365 | ✅ done, in refinery |
| godfrey | PR #363 cf-xbj9 — fixing 2 inputs | 🔧 rework |
| miquella | cf-0s4l BLOCKED — account mismatch | ⛔ Stilgar API key needed |
| morgott | cf-jcta — in PR #365 | ✅ done, in refinery |
| millicent | cf-ighf light mode charcoal/50 | 🔧 in progress |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **P0: 0 products** | Stilgar: fix OAuth app cb591c8e in Wix Dev Center (connect to site) |
| **cf-0s4l** | Stilgar: create WIX_API_KEY under account ed8a7220 in Wix Dashboard |
| **contactSubmissions** | Stilgar: publish live Wix site |
| **PR #356** | Stilgar: approve clipboard approach |
| **cf-9t70 CMS** | Stilgar: create SwatchRequests collection in Wix Dashboard |
| **SENTRY_AUTH_TOKEN** | Stilgar awaiting |
| **Theme pick** | /theme-a–d — Stilgar to choose |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending |

---

## In-Progress Beads

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-xbj9 | P1 | dark:bg-cf-cream card wrappers | godfrey PR #363 rework |
| cf-9t70 | P1 | /swatch-request Wix CMS | rennala (blocked) |
| cf-52gi | P2 | dark mode homepage cream/sand | radahn PR #364 |
| cf-ighf | P3 | light mode charcoal/50 (2 nodes) | millicent |
| cf-okwz | P3 | EasterEggBear clipboard | PR #356 pending Stilgar |
| cf-0s4l | P3 | /sustainability provision | miquella (blocked) |

---

## Shipping Test Report ✅ (delivered to mayor 00:34 MT)

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
| #355 | Blog OG + Twitter card | 06:23 UTC |
| #359 | Footer bear-breathe animation | 06:23 UTC |
| #361 | PLP filter labels | 06:25 UTC |
| #362 | Dark mode CTA + sustainability | 06:26 UTC |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
