# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 17:23 MT**

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
Channel A dual-write active: mobile fires both cfW `/api/cross-rig` + Wix concurrently. DNS cutover pending §1-§3 manual checks.

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | State |
|----|-------|-------|
| #1120 | cf-3qt.4.4 delivery zone | CONFLICTING — needs rebase |
| #1125 | cf-9t70 sampleRequests | CONFLICTING — rebased, re-running CI |
| #1126 | cf-3qt.5.3 trackCustomEvent | CONFLICTING — needs rebase |
| #1128 | postcss bump hookup-assistant | MERGEABLE (deps) |
| #1130 | dev-deps bump | HOLD (CI regression risk) |

**Merged this session:** 5 CF PRs (#1123 #1124 #1125 #1127 #1129)

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | State |
|----|-------|-------|
| #275-#277 | cart o3bv fixes | CI ✅, mergeable UNKNOWN |
| #281 | Add-to-Compare PDP/PLP | UNKNOWN |
| #282 | PDP Size Guide v2 | UNKNOWN |
| #289 | doubled footer fix | CONFLICTING |
| #290 | back-in-stock notify me | CONFLICTING |
| #291 | PdpSizeGuide | CONFLICTING |
| #293 | HomeSaleStrip | CONFLICTING |
| #296 | HomeQuizCta+SwatchPromo | CONFLICTING |
| #299 | dark mode | CONFLICTING |
| #303 | gift cards | CONFLICTING |
| #315 | AR model-viewer (cm-002) | CONFLICTING — miquella rebasing |

**Merged this session (19 cfw PRs):** #279(BNPL) #280 #283(inline-video) #294(LivingFooter) #295(slug-fix) #297(swatch-promo) #298(dark-mode-contrast) #299(dark-mode) #301(sustainability) #303(gift-cards) #304(newsletter) #305(video-cleanup) #307-#309 #311(sentry) #312 #313(nightly-CI) #314(shipping-tiers) #315 #316(wix-sdk)

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| godfrey | BNPL financing UI | cf-7dfv |
| radahn | City SEO pages — done cf-j6ub improvements pending bead | cf-kjpy |
| rennala | Spin Wheel modal UI | cf-coor |
| blaidd | cf-eihx COMPLETE ✓ → reassign | cf-zwo0 next |
| millicent | Gamification badges overlay | cf-oht1 |
| morgott | Room Planner 2D drag-drop | cf-3i8j |
| miquella | Sustainability page + PR #303/#315 rebases | cf-0s4l |

**New bead created:** cf-r9tf (P1) — Email unsubscribe one-click link in all outgoing emails

---

## Open Issues / Blockers

| Issue | Status |
|-------|--------|
| **P0 cart regression** (cf-cfol/cf-p7la) | PRs #275-#277 ready, mergeable UNKNOWN |
| **contactSubmissions 404** | Velo endpoint exists; stage3-velo sync pending |
| **DNS flip** (cf-cb9s) | §1-§3 Stilgar manual; §5 order-lookup 501; §7 SENTRY_DSN |
| **cf-lxbe image audit** | millicent: 84/88 done; 4 unresolvable; browser verify pending |
| **CF PRs conflicting** | #1120 #1126 need rebase (http-functions.js) |
| **CFW PRs conflicting** | 8 PRs need rebase after 19 merges |
| **Email unsubscribe** | cf-r9tf created, needs dispatch |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` (PR #313 merged ✓) | ✅ Now active |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
