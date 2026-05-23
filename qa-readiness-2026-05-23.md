# Carolina Futons — QA Readiness Dashboard
## Stilgar morning brief · 2026-05-23

**Coordinator:** miquella (cfutons crew)
**Mandate doc:** `crew/melania/qa-mandate-2026-05-23.md`
**Target site:** https://carolina-futons-web.vercel.app/ (Vercel production target)

---

## ✅ INFRA FIX VERIFIED — nudge-linux.sh Fix B live

melania applied Fix B to `/Users/hal/gt/scripts/nudge-linux.sh` ~09:21 UTC; verified live ~09:32 UTC via a nudge containing the literal word "Enter" embedded in the message body. Pre-fix: the "Enter" substring would have been interpreted by tmux as a key press mid-message, corrupting delivery. Post-fix (`-l` literal mode + separate `C-m` send-keys): message arrived intact end-to-end. Mac→Linux nudge path now reliable across all 8 affected crew. Diagnosis credit: miquella.

**Next infra step:** gt nudge (Mac-internal Go path) audit — same shape may apply (per melania).

## SEO POLISH CONVOY ✅ EXPANDED to 7 beads — routed to onyx

Single Linux PR via **onyx** (per melania 2026-05-23):
- cf-9us5 P3 — STATIC_PATHS += '/compare' in `src/app/sitemap.ts`
- cf-l7iv P3 — 6 PLP+hub meta descriptions rewritten (147-160 chars, voice-matched)
- cf-xvif P3 — CollectionPage+ItemList JSON-LD via new `buildCollectionPageSchema`
- cf-ofiw P3 — sitemap dev-port fallback + not-found.tsx metadata (part (c) DEFERRED)
- **cf-djsh P1** (joined 17:13 UTC) — og:url missing on 6/8 audited routes; mirror /getting-it-home + /spring-sale pattern
- **cf-o6fr P1** (joined 17:13 UTC) — og:type missing on same 6 routes; same fix as cf-djsh (single openGraph patch)
- **cf-qv8v P1** (joined 17:13 UTC) — PDP Product JSON-LD missing sku + brand + aggregateRating; extend `buildProductSchema()` with manufacturer-as-brand (Stilgar canonical 2026-05-22: N&D / KD Frames / Otis Bed / Sealy / Log-Futon-Co)

---

## FORMS AUDIT (issued Stilgar 10:25 + Mayor 10:55, miquella exec 2026-05-23 16:30-16:52 UTC)

| Form | State | Verdict | Bead |
|---|---|---|---|
| /contact 'Send a message' | empty submit | ✅ HTML5 :invalid fires on 4 required fields | (note: no auto-focus to first invalid — a11y cleanup) |
| /contact 'Send a message' | valid submit | ❌ FAILS: "We couldn't send that — please try again in a moment." | **cf-ousj P1** (NEW) |
| /contact Turnstile banner | reading | ℹ️ "Security verification is temporarily unavailable" — matches melania's note that Turnstile lifts next deploy. Intent, not regression. | — |
| Newsletter footer (/) | valid submit | ❌ FAILS: "We couldn't save that right now — please try again shortly." | cf-zq3m P0 (evidence added) |
| /search | empty (no query) | ✅ Search input + "Try one of these: Futon frames / Mattresses / Murphy beds / Buying guides" — clean | — |
| /search?q=kingston | valid query | ✅ "1 result for 'kingston'", tab filters All/Products/Pages/Articles render | — |
| /search?q=zzzz... | no-results | ✅ "No results for 'zzzz...'. We couldn't find products, pages, or articles..." — clean | — |
| /search?q=mattress | result-card | ❌ Mesa 5000 in-store-only renders **'$0.00'** instead of 'Call for pricing' or omit-price | **cf-4dmb P2** (NEW) |
| /swatch-request | empty submit | ✅ Server-side validation: inline field-level errors per required field. Better UX than HTML5. | — |
| /swatch-request | valid submit | ❌ FAILS: "We couldn't submit that — please try again in a moment." | **cf-tusv P1** (NEW) |
| /contact mobile 390 | layout | ⚠️ Inputs 38px, Subscribe button 40px — fail WCAG 2.5.5 44x44 | cfw-433u P3 (scope expanded) |
| /warranty/register | auth-gate | ✅ Redirects to /account?next=/warranty/register — sign-in form renders cleanly | — (post-cfw-o45 working) |
| /warranty/claim | auth-gate | ✅ Redirects to /account?next=/warranty/claim — sign-in form renders cleanly | — (post-cfw-o45 working) |
| /track-order (bare) | no query | ℹ️ Instructional copy only, NO manual lookup form. Link-driven UX (auth via ?n=&e= compound) | side-note in cf-ac5d |
| /track-order ?n=&e= | with params | ❌ FAILS: "We couldn't reach the order-tracking service right now." | **cf-ac5d P1** (NEW) |
| /survey NPS | valid submit | ❌ FAILS: "couldn't save your response — please try again shortly." | **cf-y2wg P1** (NEW) |
| /survey mobile 390 | layout | ⚠️ NPS radios 40×40 — below WCAG 2.5.5 44×44 | cfw-433u P3 (scope expanded) |

| /signup empty submit | invalid | ✅ HTML5 :invalid on email + password + confirm-password | — |
| /signup password mismatch | inline | ✅ "Passwords do not match." — no submit attempt | — |
| /signup valid submit | unique-email | ✅ **SUCCESS** — H1 changes to "Check your email", canonical register-flow step matches melania spec exactly | — (Wix Headless identity SDK, NOT Velo) |
| /account/forgot-password | valid submit | ✅ **SUCCESS** — "If an account exists for <email>, a password reset link is on its way. The link is good for 3 hours." (good security copy, doesn't leak email-existence) | — (Wix Headless identity SDK) |
| PDP `/products/kingston-futon-frame` Q&A 'Ask a question' | valid submit | ❌ FAILS: "We couldn't save that — please try again." | **cf-118u P1** (NEW) |
| /spring-sale | 2 forms | ℹ️ Header + footer Newsletter signup (both same cf-zq3m surface) — no new form | — |

**SIX prod-form failures with identical 'try again' copy pattern** (cf-zq3m + cf-ousj + cf-tusv + cf-ac5d + cf-y2wg + cf-118u) → strong hypothesis of SAME Velo /_functions/* backend gate. melania confirmed 2026-05-23: her publish ran ✅ but /_functions/* still 404 site-wide. Stilgar / GitHub-integration check needed for the Velo-to-staging deploy step. Once cleared, ALL 6 forms should pass together. Coordinator test: pick ANY ONE of the 6 routes post-Velo-deploy → success on one = success on all.

**ORTHOGONAL** (not Velo-cluster, separate root cause):
- `cfw-fkoh` P1 — Style Quiz returns zero recommendations (CORS-blocked from cfw origin). Owned by morgott → jasper.

**HEALTHY** (Wix Headless identity SDK, separate from Velo): /signup register, /account/forgot-password reset-link.

**HEALTHY — Pass 4 additions (internal cfw API, not Velo):**
- PDP ZIP estimator: Kingston × NC(28792)→white-glove 1-2d, CA(90210)→LTL 5-7d, MA/CT/VT/NH/ME/NJ/RI leading-zero ZIPs all → LTL 3-5d (mid zone, CORRECT)
- /getting-it-home: ZIP 28792 → "Store Local · Curbside $39 · White-glove $99 · 2-4 business days"

**cf-wihs P1 status update (PDP path):** All 5 northeast leading-zero ZIPs route correctly via /api/delivery-zone (mid zone, 3-5 days). Bug either ALREADY FIXED or LIMITED TO checkout-side path (Wix `getShippingZone`, currently can't be exercised due to Velo-cluster gate). Recommended jasper verify and narrow/close bead.

**Pass 4 new bead (NOT Velo cluster):**
- **cf-kuc9 P2** — Cart drawer coupon entry leaks raw Wix SDK JSON error payload on invalid code (e.g. `{"applicationError":{"code":"ERROR_COUPON_..."}}`). UX + info-leak smell. Adjacent (P3 candidate, not filed): /cart PAGE has no coupon entry — only cart DRAWER does.

Screenshots: `crew/miquella/qa-forms-*.png` (12 PNGs at 1280 + 390 viewports).

---

## STILGAR FULL-SITE TOUR (issued 2026-05-23 evening)

Proactive exhaustive sweep before tomorrow's stress test. Every page, every button, mobile+desktop, screenshot every key state.

| Crew | Scope | Status |
|---|---|---|
| blaidd | /, /shop hub, 5 PLPs, /search empty+query, /compare 0/1/2/4-product states | DISPATCHED 2026-05-23 |
| godfrey | 8+ PDPs (Kingston/Albany/Sunrise/Mesa/Murphy/Solstice/Wilderness/Charleston) × Full/Queen × Cherry/Chocolate × mobile+desktop | DISPATCHED 2026-05-23 (parallel with cf-csxt spec) |
| morgott | /account anon, /signup, post-disposable-register flow, sign-in success+fail | DISPATCHED 2026-05-23 |
| rennala | (DEAD — residual scope reassigned) | ⚠️ DEAD; residual → millicent |
| millicent | /reviews (gated on radahn GBP creds), /sitemap.xml, /robots.txt + **rennala residual: /faq + /contact + footer** | DISPATCHED 2026-05-23 + residual added |

**Coordinator (miquella):** synthesize incoming findings into this dashboard. File every defect via bead pattern (route+viewport+repro+screenshot+priority). Screenshots required at `crew/<name>/qa-tour-<route>-<viewport>.png`.

**Viewport matrix:** mobile 390×844 (iPhone) + 360×800 (Android); desktop 1280×800 + 1920×1080.

---

## 🚦 STRESS-TEST READINESS CHECKLIST (Stilgar morning gate)

Go/no-go for tomorrow's e-commerce stress test. Updated as crew tour findings land.

### Must-pass (go/no-go blockers)

- [x] **cf-csxt P0** ✅ **CLOSED via PR #986**. quartz shipped. Follow-on: **cfw-j064 P1** (wix:image:// regression) is the actively-open child to track.
- [ ] **cf-zq3m P0** — /newsletter signup returns 2xx in prod. Still **Stilgar-Velo-publish-gated** (config-side blocker, not code).
- [ ] **cfw-j064 P1** — wix:image:// regression (cf-csxt follow-on child, actively-open).
- [ ] **cf-lsv4 P0** — overlay suppression on /compare + other pages. (Currently OPEN. obsidian.)
- [x] **cf-qyaf P0** ✅ CLOSED via **PR #980** (cf-x4j8 fallback UI: in-store-only PDP for Mesa 1000/3000/5000; `isInStoreOnly` predicate disjoint from cf-pdp-g4 call-for-price; PdpInStoreOnlyCta server component with tel link). blaidd pair-implemented after quartz offline. **Follow-on:** `cf-tat7` P3 — "Price locked 14 days" copy still renders in no-price state; should swap to "In-store only". Owner godfrey, cf-ukc6 batched.
- [x] **cfw-o45 P1** — /account ↔ /dashboard redirect loop ✅ MERGED via PR #968.
- [x] **cf-uwhv P0** ✅ **CLOSED 2026-05-23 15:09 UTC** — false-positive from miquella audit. Already fixed by **PR #988** (994d4bcb 'convoy-D dashboard polish bundle', SessionGate.tsx extraction). Root cause of false-positive: my audit ran against the deployment-pinned alias `carolina-futons-l3lga935d-...` which captured a pre-PR-#988 deployment. morgott independently verified at 15:03 UTC against the rolling `carolina-futons-web.vercel.app` alias = clean Sign In form. opal/quartz stood down. Lesson saved to memory (use rolling alias).
- [ ] **cfw-fpnu** — pre-verify sign-in 502 (opal **PR #976.2 pending**, edge-runtime fix). Stress-test criterion: pre-verify sign-in returns clean "verification required" state, not 502.
- [ ] **Wix verify-email config** — verify-link delivery to halworker85 inbox. BLOCKED on Stilgar config (escalated). Without this, post-verify sign-in step of canonical register flow can't be exercised.

### Should-pass (P1 fix or accept-and-document)

- [ ] **cf-1h68** — header scroll flash (jasper)
- [ ] **cf-8wkc** — SaleLightbox pointer-events blocking (obsidian)
- [ ] **cf-o0wt** — /compare table mobile clip (obsidian, Stilgar finding)
- [ ] **cf-3qt.8** — DNS cutover go-decision (Stilgar action queue, gates Vercel Pro + cutover window)
- [ ] **cf-3qt.8.31** — UptimeRobot API key (Stilgar action queue, post-cutover monitoring)

### Coverage (proactive tour)

- [x] blaidd: /, /shop hub, 5 PLPs, /search empty+query, /compare 0/1/2/4-prod ✅ — `crew/blaidd/qa-tour-expanded-2026-05-22.md` + 52 PNGs (commit `24ea91e` on cfutons_web/main)
- [ ] godfrey: 8 PDPs × Full/Queen × Cherry/Chocolate × mobile/desktop — screenshots in `crew/godfrey/`
- [x] morgott: /account anon + /signup + register flow + sign-in success/fail ✅ — `crew/morgott/auth-tour-2026-05-23.md` + 8 PNGs (`auth-tour-*.png` — naming-spec deviation acceptable, doc is canonical)
- [x] millicent: /reviews + /sitemap.xml + /robots.txt + /faq + /contact + footer + /asdf + /500 ✅ — `crew/millicent/qa-tour-full-2026-05-23.md` + 20 PNGs in canonical convention
- [ ] **Defect filing discipline:** every finding → bead with route+viewport+repro+screenshot+priority

### Stilgar morning decisions (7 items — full list in "Stilgar action queue" section below)

- [ ] 1. cf-g3z6 Sedona/Asheville price intent
- [ ] 2. cf-v275 /shop/sofa-beds path
- [ ] 3. cf-oi01 Wix-config vs Path B
- [x] 4. ✅ cf-qyaf Mesa 5000 intent — RESOLVED via PR #980 (in-store-only fallback UI; standing order confirmed)
- [ ] 5. cf-zq3m newsletter restart authorize
- [ ] 6. cf-3qt.8 DNS cutover go
- [ ] 7. cf-3qt.8.31 UptimeRobot API key

### Standing-order confirmations (intentional, do not regress)

- [x] CF Customer Warranty = 15 years universally (CANONICAL block in `manufacturer-mapping-2026-05-22.md`)
- [x] Mesa 1000/3000/5000 = in-store-only (no PDP price expected; "Call for current pricing" copy correct)
- [x] /products/pulsar displays "Moonshadow" (slug-name divergence intentional)
- [x] /shop/sale empty + Spring Sale modal hardcoded = redirect handed off (cf-b7mu → onyx)
- [x] cf-ukc6 conservation — NO QA-tour Vercel pushes, fix-PRs only

---

## Headline metrics

| Metric | Count |
|---|---|
| **PRs merged today** | **16** (per melania) — incl. PR #968 cfw-o45 admin-merge |
| **Beads filed today (cfutons)** | 11 (cf-b7mu, cf-ogzg, cf-swqw, cf-g3z6, cf-v275, cf-csxt, cf-qyaf, cf-5dph, cf-8wkc, cf-1h68, cf-t19r) |
| **Beads filed today (cfutons_web)** | 12 (cfw-o45, cfw-hl4, cfw-pe7, cfw-bgb, cfw-ob6a, cfw-w8ee, cfw-ytzx, cfw-87m, cfw-gpde, cfw-jo5q, cfw-2jm3, cfw-y17d) |
| **Beads closed today** | 6 (cf-tm1e, cf-wyc0, cf-r7gc, cfw-o45, cfw-hl4, cfw-jo5q, cfw-2jm3) |
| **Open P0** | 1 (cf-zq3m, Stilgar-Velo-publish-gated) — cf-qyaf/PR #980, cf-csxt/PR #986, cf-uwhv (false-positive)/PR #988 all ✅ closed. cfw-j064 P1 is the actively-open cart child. |
| **Open P1** | 5 (cf-1h68, cf-8wkc, cf-3qt.8, cf-3qt.8.31, **cf-o0wt** /compare mobile clip — Stilgar finding) |
| **Open P2** | 8 |
| **Open P3+** | 11 |

---

## Critical-path gates (must clear before broad QA can complete)

| Bead | Owner | State | Notes |
|---|---|---|---|
| **cfw-o45** | opal (Linux) | ✅ MERGED (PR #968) | account flow UNBLOCKED — blaidd live tour in progress |
| **cf-csxt** | quartz (Linux) — godfrey writing spec, miquella reviewing | OPEN P0 | spec-handoff pending godfrey delivery |
| **cf-lsv4** | obsidian (Linux) | OPEN P0 | overlay suppression — confirmed still live by morgott + blaidd |
| **cf-zq3m** | rennala (Mac) | ⚠️ OWNER DEAD per watchdog | mayor restart pending — Stilgar may need to reassign or authorize Velo-side fix |
| **cf-qyaf** | unassigned | OPEN P0 | Mesa 5000 PDP unbuyable — likely intentional in-store-only (Stilgar standing order); Stilgar to confirm |

---

## Incoming defect reports (synthesis-mode)

### miquella — a11y audit (self-executed 2026-05-23)

**Scope:** /, PDP Kingston, /cart populated, /compare 2-prod, /account anon, /signup
**Method:** Playwright MCP browser_evaluate — aria-label coverage, heading hierarchy, alt-text, landmarks, skip-link, table semantics

| Bead | Pri | Owner | Finding |
|---|---|---|---|
| **cf-uwhv** | **P0** | unassigned 🚨 | Anon /account → /dashboard crashes with React #310. Blocks ALL sign-in QA. Possible post-PR-#968 regression OR cfw-o45 fix removed loop but didn't add anon sign-in form. |
| cf-c6e3 | P3 | unassigned | 4-finding a11y cleanup (single PR ≤50 LOC): (F1) homepage 2 H1s, (F2) footer social anchors missing aria-label, (F3) newsletter email inputs use placeholder-as-label, (F4) /compare Remove buttons share generic "Remove" text |

**Routes verified CLEAN:**
- /signup — H1 + labeled email/password + accessible submit ✓
- /cart populated — H1 + 3 live regions + focusable proceed-checkout `<a>` ✓
- PDP Kingston — 1 H1 + all 24 images alt'd + 8/8 radios aria-labeled + ATC accessible ✓
- /compare table — caption + aria-label + 13/13 TH scope'd ✓
- Site-wide: skip link, main, nav, banner, contentinfo all present ✓

---

### blaidd — expanded full-site tour: /, /shop hub, 5 PLPs, /search, /compare (received 2026-05-23)

**Report:** `crew/blaidd/qa-tour-expanded-2026-05-22.md` (commit `24ea91e` on cfutons_web/main)
**Screenshots:** 52 PNGs at `crew/blaidd/qa-tour-{route}-{viewport}.png` (local only — cf-ukc6 conservation)
**Coverage matrix:** 13 routes × 4 viewports (360 / 390 / 1280 / 1920) ✅

| Bead | Pri | Owner | Finding |
|---|---|---|---|
| cfw-uavy | P3 | blaidd | /compare table cuts off columns on 360/390 — only 1 product column visible on first paint (4-prod case has Eureka + Albany + Autumn off-screen). `overflow-x-auto + min-w-[640px]` is scrollable but no swipe-right affordance. Three fix options in bead. Stacks with cf-o0wt (compare mobile clip P1, Stilgar finding) — same surface, different framing. |

**Reconfirmed existing beads (no new bead, evidence captured during tour):**
- `cfw-k83f` P1 — futon-frames 16-of-22 thumbnails blank, irrespective of viewport → confirms Wix-data hypothesis (not PLP-card responsive)
- `cfw-lygi` P2 — sofa-beds empty (cross-ref to cf-v275)
- `cfw-ntlh` P4 — /compare empty-state fictional slugs
- `cfw-gpde` P2 — homepage empty reviews (cross-ref to millicent's evidence)
- `cfw-54au` P3 — about ShopTheRoom missing portofino

**Verified live across all viewports (non-regression):**
- ✓ cf-moyb / cfw-2jm3 — 15-year warranty unified copy
- ✓ cf-lsv4 — no SaleLightbox overlay anywhere

**Did NOT find:**
- New layout breakage at 1920 vs 1280
- New copy defects
- Console-error regressions outside the pre-existing CSP report-only noise

---

### millicent — SEO + nav + footer + /reviews + rennala-residual (received 2026-05-23 evening)

**Doc:** `crew/millicent/qa-tour-full-2026-05-23.md` (+ 20 PNGs in canonical `qa-tour-<route>-<viewport>.png` convention) ✅
**Coverage:** /reviews, /sitemap.xml, /robots.txt, /asdf (404), /500 literal, /faq, /contact, footer × all entries

| Bead | Pri | Owner | Finding |
|---|---|---|---|
| cf-2539 | P3 | melania | /500 literal path returns HTTP 500 on prod (Next.js default global-error chrome, branded `error.tsx` never reached). Dev returns 404. Cross-linked to cf-ofiw + cfw-gpde. |

**Verified PASS (no defect):**
- /sitemap.xml + /robots.txt (structural + content)
- /asdf 404 (branded not-found.tsx reached correctly in prod)
- /faq + /contact (structural + SEO)
- footer 15/15 links return 200

**Cross-reference:** cfw-gpde evidence (/reviews empty placeholder, GBP creds not provisioned) was captured during this tour. radahn nudged for GBP creds (wait-idle).

**millicent standing-by for next or re-tour at higher fidelity (form submissions, filter interactions).**

### morgott — auth-flow tour (received 2026-05-23 evening)

**Doc:** `crew/morgott/auth-tour-2026-05-23.md` (+ 8 PNGs)
**Coverage:** /account anon + /signup + register flow + sign-in success/fail × mobile + desktop ✅

| Bead | Pri | Owner | Finding |
|---|---|---|---|
| cfw-7zoq | P3 | opal | sign-in error copy can't differentiate wrong-password from unverified-email — same copy "Sign-in failed. Please try again." for both 401-bad-creds AND 401-unverified. UX gap becomes dominant once cfw-fpnu unblocks. |
| cfw-433u | P3 | jasper | /account + /signup input fields render 38px tall on mobile 390 — below WCAG 2.5.5 44×44. Submit buttons pass at 48px. Likely shared input class; parallel to cfw-ytzx (/design-a-room). |

**Refinements to existing beads (no new bead filed; notes added to source doc for opal/jasper):**
- **cfw-fpnu** scope-refined: 502 fires ONLY on valid-but-unverified login. Register and wrong-creds bail before the SDK call. opal's failing-test should pin the unverified-login path specifically.
- **cfw-w8ee** root-cause-refined: /account at mobile 390 has same 431px body width as /design-a-room → H-overflow is **SITE-WIDE layout-shell**, NOT room-plan-canvas-specific (original bead blame was wrong). Fixer should debug from layout shell, not RoomPlannerCanvas.

**Clean paths (no defect):** /account anon, sign-in wrong-creds.

### ✅ CANONICAL REGISTER FLOW (melania 2026-05-23 — supersedes any prior framing)

**cf-3qt.3 cfw-side spec — this is the stress-test pass criterion:**

1. Register POST → **200 + "Check your email" UI** (verify-required state). **NOT** → /dashboard.
2. User clicks verify link in halworker85 inbox (or wherever delivery routes).
3. POST-verify sign-in → 200 + redirect /dashboard.
4. PRE-verify sign-in (current `cfw-fpnu` bug) → SHOULD return clean "verification required" state, currently returns **502**.

**Stress-test pass criteria:**
- ✓ `/api/auth/register` returns 200 + `email_verification_required` state shape
- ✓ UI shows "Check your email" screen + has "Back to sign in" option
- ✓ Verify-email arrives + link works (currently **BLOCKED on Stilgar config** — escalated)
- ✓ Post-verify sign-in completes + lands on /dashboard
- ✗ Pre-verify sign-in does NOT 502 (`cfw-fpnu`, opal **PR #976.2 pending** — opal's edge-runtime fix)

**My earlier dispatch wording ("register → /dashboard") was outdated framing — corrected here.** Stress-test now has unambiguous criterion. morgott's tour findings (cfw-7zoq + cfw-433u + refinements to cfw-fpnu) all align with this canonical spec.

---

## Stilgar action queue (7 decisions for tomorrow morning)

These items need Stilgar's call before the corresponding work can ship/close:

1. **cf-g3z6 P3** — Sedona + Asheville futon frames missing prices on PLP. Per Mesa precedent, likely intentional in-store-only — Stilgar canonical confirm (mayor relaying).
2. **cf-v275 P3** — /shop/sofa-beds renders 0 products + not on /shop hub. Three paths: intentional empty / Wix collection seed / SHOP_CATEGORIES entry removal. Stilgar picks.
3. **cf-oi01 P1 (BLOCKED)** — E2E real-shipping + payments. cfw `/checkout` correctly redirects, but Wix headless checkout has no payment provider + no UPS connector. Decision: configure Wix dashboard OR switch to Path B (wire UPS + Stripe directly in cfw, skip Wix redirect).
4. **cf-qyaf P0** — Mesa 5000 PDP unbuyable. Verify: covered by in-store-only standing order (then close as intentional) OR genuine bug (Brenda backfills price + size picker).
5. **cf-zq3m P0** — Newsletter prod 502 + rennala session DEAD. Authorize restart OR designate alternate owner.
6. **cf-3qt.8 P1** — DNS cutover go-decision: Vercel Pro upgrade timing + cutover-night window.
7. **cf-3qt.8.31 P1** — UptimeRobot API key to enable post-cutover monitoring.

---

## Blockers

| Blocker | Affected beads | Mitigation |
|---|---|---|
| rennala session DEAD | cf-zq3m (P0 newsletter prod 502) + rennala's mandate scope (Forms + /search) | Mayor restart pending; coordinator marked DEAD in mandate matrix |
| Wix-side checkout config | cf-oi01 (E2E real-shipping + payments) | Awaiting Stilgar Path A vs Path B decision |
| Stilgar canonical (in-store-only) intent | cf-g3z6 + cf-v275 + cf-qyaf | Awaiting mayor-relayed Stilgar confirms |
| godfrey cf-csxt failing-test spec | cf-csxt P0 implementation | godfrey writes → miquella reviews → quartz implements |

---

## Convoy candidates (cluster for batched merges)

**Compare-table mobile convoy** — 2 beads, same surface, different framings:
- `cf-o0wt` P1 — /compare table on mobile clips second product (Stilgar finding, obsidian-assigned)
- `cfw-uavy` P3 — /compare table cuts off columns on 360/390, no swipe affordance (blaidd, no owner yet)

**Sale source-of-truth convoy** — 4 beads, one theme: "what does 'sale' mean in cfw":
- `cf-b7mu` P2 — mega-menu `/shop/sale` → `/spring-sale` redirect (1-line nav fix, handed off to onyx)
- `cf-5dph` P3 — desktop mega-menu vs mobile drawer Sale-link route divergence (millicent)
- ~~`cfw-jo5q`~~ P2 ✅ **CLOSED** — SaleLightbox fires site-wide vs home-only (blaidd → resolved during session)
- `cf-ogzg` P3 — full unification refactor (SaleLightbox hardcode + isProductOnSale variant-priced exclusion + HomeSaleStrip + /spring-sale)

**Dashboard skeleton convoy** — 2 beads on dashboard polish:
- `cfw-pe7` P3 — /dashboard/* tabs render home-loading skeleton instead of dashboard skeleton
- `cfw-bgb` P3 — /dashboard/* anonymous SSR responses share generic site title

---

## Crew assignment + status snapshot (13 crew)

### Mac (8)
| Crew | Family | Status |
|---|---|---|
| godfrey | PDP × 10 products × Full/Queen × Finish × ATC | ✅ cf-flmv re-verify done; PR #971 in flight (cf-moyb 15yr fix); standby for cf-csxt review |
| blaidd | Account flow (post-cfw-o45) | ✅ /reviews+/press+/our-story 4 beads filed; account flow UNBLOCKED, live tour in progress |
| **miquella** | /shop indexes + 6 PLPs + **COORDINATOR** | ✅ Desktop sweep complete; mobile spot-check clean; coordinator doc current |
| morgott | /design-a-room → cfw-y17d | ✅ /design-a-room 4 beads filed; routed to cfw-y17d /our-story redirect cleanup |
| rennala | Forms (contact / newsletter / swatch) + /search | ❌ DEAD per watchdog; mayor restart pending |
| millicent | SEO + nav + footer | ⚠️ PARTIAL — cf-5dph P3 filed; rest unreported |
| radahn | Search/filter UX deep dive | ACTIVE — GBP work in progress (relates to cfw-gpde) |
| melania | SHIPPING API + ZIP validation E2E | unreported (own coordination work) |

### Linux (5)
| Crew | Family | Status |
|---|---|---|
| opal | cfw-o45 fix → /sale + /spring-sale tour | ✅ cfw-o45 MERGED; standby for next |
| onyx | cf-rqpb verify + cf-b7mu redirect → PDP variant verification | cf-b7mu redirect handed off; verification status unreported |
| jasper | cf-1h68 + cf-t19r header fix → mobile-only header tour | unreported |
| obsidian | cf-lsv4 → cf-th74 → cf-8wkc → /compare interactive | unreported |
| quartz | cf-csxt P0 → cart interactive verify | waiting on godfrey failing-test spec |

---

## Stilgar resolutions APPLIED today

1. **Warranty canonical**: CF Customer Warranty = 15 years universally. Manufacturer column = internal-only. Applied to `crew/melania/manufacturer-mapping-2026-05-22.md` (CANONICAL block + bucket counts + table). Awaiting godfrey PR #971 to land SiteContent + /about updates → cf-moyb closes.
2. **5 log-futon SKU manufacturer**: All → Log-Futon-Co (charleston-platform-bed, denali-log-futon, mountainaire-log-futon, northern-exposure-log-futon, wilderness-log-futon).
3. **Spring Sale modal redirect**: melania GO → cf-b7mu 1-line nav redirect handed off to onyx (file ships via Linux).
4. **Intentional catalog quirks confirmed in memory** (no-refile): /products/pulsar → "Moonshadow" slug-name divergence; Mesa 1000/3000/5000 no-price in-store-only.

---

## Conservation discipline (cf-ukc6 standing order)

- ✅ NO QA-tour Vercel preview pushes this session — all QA artifacts went to cfutons repo (Velo workspace, separate from Vercel target).
- ✅ Fix PRs (#968 cfw-o45) are batched not dripped.
- ✅ Read-only Vercel preview navigation across all crew tours.

---

## Coordinator artifacts (cfutons main)

- `qa-tour-shop-sale-mattresses-2026-05-22.md` (commit `dead4522`)
- `qa-coordinator-status-2026-05-23.md` (latest commit `2e6262c4`)
- `qa-readiness-2026-05-23.md` (this file)
- `cf-oi01-triage-report.md` + `cf-oi01-working-checkout.png` (commit `39c283c0`)

morgott + blaidd report docs live in their workspaces — paths listed in coordinator status doc.
