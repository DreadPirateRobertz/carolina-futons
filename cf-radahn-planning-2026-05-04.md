# radahn — Planning Reply 2026-05-04

**Requested by:** Stilgar (via melania)
**SLA:** 30 min

---

## 1. Current bead + ETA

**Active:** **cf-l6aj.3** — Home Featured cards: color count + swatch dots + quick view.

**State:** Code complete (12 files), pushed to `feat/cf-l6aj3-richer-product-cards` (PR not yet open).
- `tsc --noEmit` clean on Linux.
- 24/31 unit tests pass.
- 7 failing tests are all in `QuickViewModal.test.tsx` — the modal stays in `loading…` in jsdom. The injected `fetchProduct` stub is being passed but the component's `useEffect` is not transitioning out of the `setLoadState("loading")` branch in the test runtime. Looks like a `useEffect` re-entry / dependency-array bug specific to the test (not the prod path).

**ETA to PR open:** ~30–60 min (debug the effect's loadState gating; likely a one-line fix).
**ETA to PR merged:** depends on review/CI; assume +1–2h after PR opens.

---

## 2. Blockers to site launch / DNS cutover (cf-3qt.8)

**Items requiring Stilgar action (runbooks delivered, awaiting execution):**
- **cf-3qt.8.19** — `SwatchRequests` Wix CMS collection. Runbook at `crew/melania/swatch-requests-cms-runbook.md`. **10 fields**, not the 6 the bead originally specified — production Velo writes more than the bead anticipated. Without this, every `/swatch-request` form submission silently fails.
- **cf-3qt.8.25** — Vercel account transfer/upgrade. Runbook at `crew/melania/vercel-account-transfer-runbook.md`. Recommendation: Option A (create `carolinafutons` team, transfer, upgrade to Pro). Hobby's 10s function timeout will start 504-ing on `force-dynamic` PLP/PDP routes under real traffic; Pro raises to 300s. **Should happen BEFORE DNS cutover.**

**Items requiring code completion before cutover (radahn-side):**
- **cf-l6aj.13.1** — PWA install banner is wired, but the manifest only has a 256x256 icon. Chrome wants 192+512 PNGs for full install eligibility. Banner gracefully no-ops without them — not strictly launch-blocking, but the PWA story is degraded until icons land.
- **cf-q90y / cf-q90y.1** — closed; orphan-illustration cleanup merged (PRs #406, #414, #428).

**Robots/noindex toggle:** `src/app/layout.tsx:64` still has `robots: { index: false, follow: false }` per the comment "Pre-launch: keep noindex until canonical domain + redirects are wired up." That flip is part of cf-3qt.8 itself and should be the very last change before announcing the cutover.

**No code-side launch blockers I'm aware of from radahn's lane.**

---

## 3. Cross-crew dependencies

**Active right now (per branch list on origin):**
- **blaidd** — `feat/cf-l6aj7-continue-shopping` (P2 from my triage)
- **godfrey** — `feat/cf-l6aj17-bundle-builder` PR #440, `feat/cf-l6aj-12-promo-lightbox` (Wix Velo + Bundle Builder tracks)
- **miquella** — `feat/cf-l6aj-8-home-recently-viewed` PR #436, `feat/cf-l6aj4-blog-teasers` PR #435 (P3 home strips)
- **rennala** — `feat/cf-l6aj11-mega-menu` PR #441, `feat/cf-l6aj9-home-newsletter` PR #434, `feat/cf-l6aj22-survey-nps` PR #438, `feat/cf-l6aj21-near-city-sitemap` PR #437, `feat/cf-l6aj19-futon-sommelier` PR #439, `feat/cf-l6aj1-fbt-repeater`, `feat/cf-l6aj5-social-feeds` (heavy fanout — 7+ branches)
- **millicent** — `feat/cf-footer-anim`, MascotFooterDivider layout wiring (per design-migration-plan)
- **dallas** (mobile rig) — `cfutons_mobile` native app (out-of-scope here; PWA is the secondary mobile channel)

**Hard cross-crew dependencies on my work:**
- **None.** cf-l6aj.3 ships alone — `ProductCard` already handles the optional `colorChoices` prop; FilterFirst rebases cleanly.

**Soft conflicts I might need to rebase around:**
- **rennala's #441 MegaMenu** touches `Header.tsx`. cf-l6aj.3 doesn't touch Header — no conflict.
- **miquella's #436 RecentlyViewed** touches `app/page.tsx` (home). cf-l6aj.3 also touches `app/page.tsx`. **Likely rebase conflict** — I added a new server-side enrichment block + new prop on `<FilterFirst />`. Whoever lands second rebases; both diffs are small and auto-mergeable in most cases.
- **blaidd's cf-l6aj.7 Continue Shopping** also touches `app/page.tsx` (already merged based on the import I see). My branch is rebased on `dbaa61e` which has it; should be fine.

**Outbound deps (others waiting on me):**
- None I'm aware of. cf-l6aj.3 is a leaf in the parity-gap tree.

**Inbound deps that could pin me:**
- If Stilgar provides higher-resolution logo assets, I can wrap up cf-l6aj.13.1 quickly (≤30 min: drop the 192/512 PNGs into `public/brand/`, append two icon entries in `manifest.ts`, ship).
- If melania reassigns me from cf-l6aj.3 to a launch-blocking cleanup, I can drop the modal debug and pick up.

---

## Summary

- 1 in-flight bead (cf-l6aj.3), close to PR
- 0 launch-blockers in my lane on the code side
- 2 launch-blockers globally are Stilgar-action items with runbooks already delivered (cf-3qt.8.19 CMS, cf-3qt.8.25 Vercel)
- 1 cosmetic launch nice-to-have on me (cf-l6aj.13.1 PWA icons; banner already ships)
- No hard cross-crew blocks
