# cf-q9zi QA Pass — carolina-futons-web.vercel.app — 2026-04-27

Comprehensive E2E sweep per Stilgar request. Every navigable page tested. Forms submitted. Results below.

---

## FORMS

| Form | Result | Notes |
|---|---|---|
| /contact | ✅ PASS | Renders, client validation fires (min 10 chars message), previous session confirmed delivery |
| /signup | ✅ PASS | PR #241 (cf-nl0k) merged — CF-branded "Create an account" form renders, client validation fires |
| Newsletter footer | ❌ FAIL | "We couldn't save that right now" — persists post-PR-#242. Re-tested 2026-04-27. Bead: cf-5pf8 |

---

## SHOP / COLLECTION PAGES

| Page | Result | Notes |
|---|---|---|
| /shop/futon-frames | ✅ PASS | 17 products |
| /shop/murphy-cabinet-beds | ✅ PASS | 9 products |
| /shop/platform-beds | ✅ PASS | Loads |
| /shop/mattresses | ✅ PASS | 7 products |
| /shop/mattresses-sale | ✅ PASS | Loads |
| /collections/futon-frames | ❌ FAIL | 404 — no redirect to /shop/*. Bead: cf-1te7 |

---

## PRODUCT DETAIL PAGES

| Page | Result | Notes |
|---|---|---|
| /products/kingston-futon-frame | ✅ PASS | Images, Add to cart, ZIP estimator |
| /products/solstice-futon-frame | ✅ PASS | Loads |
| /products/wilderness-log-futon | ✅ PASS | Correct slug (NOT wilderness-log-futon-frame which 404s) |
| /products/orion-murphy-cabinet-bed | ✅ PASS | Loads |
| /products/mesa-1000-mattress | ✅ PASS | Correct slug (NOT mesa-1000-futon-mattress which 404s) |
| /products/canby-mattress | ✅ PASS | Loads (note: Canby is a futon-frame — cf-m80l) |
| PDP variant pickers | ⏳ BLOCKED | cf-44mq in progress — all STAGING_SITE products have empty productOptions |

---

## INFO / STATIC PAGES

| Page | Result | Notes |
|---|---|---|
| /about | ✅ PASS | |
| /faq | ✅ PASS | 18 entries |
| /warranty | ✅ PASS | |
| /shipping | ✅ PASS | |
| /returns | ✅ PASS | |
| /guides | ✅ PASS | |
| /visit | ✅ PASS | |
| /press | ✅ PASS | |
| /reviews | ✅ PASS | |
| /design-a-room | ✅ PASS | |
| /blog | ✅ PASS | 8 articles; titled "Journal — Notes from the Showroom" |
| /blog/[slug] | ✅ PASS | e.g. /blog/small-space-furniture-solutions-best-beds-for-apartments-studios |
| /account | ✅ PASS | Sign In page renders |
| /privacy | ✅ PASS | |
| /terms | ✅ PASS | |
| /accessibility | ✅ PASS | |
| /our-story | ✅ PASS | Redirects → /about |
| /winback | ✅ PASS | |
| /spring-sale | ✅ PASS | |
| /care | ❌ FAIL | 404 — no route, no redirect to /warranty. Bead: cf-e92v |
| /care-warranty | ❌ FAIL | 404 — same. Bead: cf-e92v |
| /style-quiz | ❌ FAIL | "The quiz is temporarily unavailable." Ongoing since Phase 1. Bead: cf-sg12 |

---

## CART / CHECKOUT

| Page | Result | Notes |
|---|---|---|
| /cart | ✅ NEW PASS | Renders empty cart page with Continue shopping CTA (was 404 in cf-wx0g) |
| /checkout | ✅ PASS | PR #249 merged — Go to checkout → Wix STAGING_SITE `/__ecom/checkout` with checkoutId + headlessExternalUrls. "Can't accept online payments" = STAGING_SITE payment config, not cfw bug |
| Cart drawer (add item) | ✅ PASS | Kingston $619 adds, qty stepper, Remove, Go to checkout render |
| Cart full pipeline | ✅ PASS | PR #249 merged — full add-to-cart → drawer → checkout pipeline working |

---

## SEARCH

| Test | Result | Notes |
|---|---|---|
| /search (empty) | ✅ PASS | 4 suggestion chips |
| /search?q=futon | ✅ PASS | 12 products + 2 articles (GAP-2 closed) |

---

## NEW BEADS FILED

| Bead | Priority | Title |
|---|---|---|
| cf-1te7 | P1 | /collections/* → 404, no redirect to /shop/* |
| cf-e92v | P2 | /care and /care-warranty → 404 |
| cf-5pf8 | P1 | Newsletter footer still fails post-PR-#242 merge |
| cf-sg12 | P1 | /style-quiz permanently broken |

---

## POST-MERGE SWEEP — 7 PRs (2026-04-27 Wave 2)

Retested all features from PRs merged since first-wave QA pass.

| PR | Feature | Result | Notes |
|---|---|---|---|
| #241 (cf-nl0k) | /signup page | ✅ PASS | "Create an account" form renders; email + password + confirm fields; client validation fires |
| #242 | Newsletter → Velo | ❌ FAIL | Still "We couldn't save that right now" — retested post-merge. Velo endpoint may not be published. Bead: cf-5pf8 |
| #243 + #248 | Dark mode toggle | ✅ PASS | Sun/moon button in header; toggle → dark background, light text on /account; localStorage persisted |
| #239 | CartIllustration drawer | ✅ PASS | Mountains/futon illustration renders at top of cart drawer when item added |
| #229 | /privacy consent prefs | ✅ PASS | "Cookie preferences" section with Analytics, Advertising, Ad personalization toggles |
| #247 | Announcement rotation | ✅ PASS | 5 messages rotate every 5s; cart-aware override fires ("You're $881.00 away from free white-glove delivery") |
| #244 (cf-h1i4) | PdpMattressBundle | ✅ PASS | "Add a mattress" cross-sell on Kingston PDP — Mesa 1000/3000/5000 with individual Add to cart buttons |
| #249 | Cart full pipeline | ✅ PASS | See CART/CHECKOUT table above — full checkout flow confirmed |
| #254 | /swatch-request | ✅ PASS | "Request fabric swatches" page renders — swatch picker (up to 5), shipping address fields, Request swatches CTA |

---

## cf-c77s UPDATE — Welcome Email Re-test (2026-04-27 Wave 3)

**cfw /signup now triggers member creation.** PR #241 merged — signup via Wix Headless auth, no reCAPTCHA.

### Wave-3 Re-test Result

| Step | Action | Result |
|---|---|---|
| 1 | Navigate to `carolina-futons-web.vercel.app/signup` | ✅ Form renders |
| 2 | Fill email `halworker85+welcome-cfw-20260427@gmail.com` + password | ✅ Form accepts input |
| 3 | Click "Create account" | ✅ **"Account created"** — "Your account is ready. Sign in to continue." |
| 4 | `wixMembers_onMemberCreated` fires on STAGING_SITE | ⏳ **UNVERIFIED** — event should fire, email queue pending |
| 5 | welcome-01-hello.html arrives at inbox within 5 min | ⏳ **PENDING** — check `halworker85+welcome-cfw-20260427@gmail.com` |

**Timestamp:** ~03:45 UTC 2026-04-27. Email should arrive by ~03:50 UTC.

### Registry Status (B1/B2)
- PR #256 = cf-7hfz: `/contact` bed-size radio + Turnstile CAPTCHA. **NOT the email registry fix.**
- `welcome_series_4`, `welcome_series_5` still missing from `emailTemplates.web.js` — steps 4-5 of welcome series will fail at send time.
- `reengagement_2`, `reengagement_3` still missing — B2 still open.

**Net:** Steps 1-3 of welcome series should now queue. Steps 4-5 will fail until registry is patched.

**Cart abandonment email**: Automation ACTIVE (`eedfb2db`). Real test requires email-associated cart session + 30 min wait. Cannot automate.

Full email + challenge test matrix: `parity/reports/2026-04-26-e2e-emails-challenges.md`

### PR #256 Feature — /contact CAPTCHA (cf-7hfz)
New: bed-size radio (Twin/Full/Queen/King) + Cloudflare Turnstile CAPTCHA on `/contact`. Include in wave-3 QA sweep.

---

## cf-wmha / cf-aslp / cf-vbsd — LivingHero Code Review (2026-04-27)

Playwright MCP disconnected — runtime visual verification unavailable. Code-level audit performed against `origin/main`.

| Check | Method | Result | Evidence |
|---|---|---|---|
| LivingHero on home page `/` | Code: `src/app/page.tsx:61` | ✅ CONFIRMED | `import { LivingHero }` + `<LivingHero />` at line 61 |
| Time-of-day cycles (4 phases) | Code: `LivingHero.tsx:23-26` | ✅ CONFIRMED | night (h<5\|h≥20), dawn (5-7), day (7-17), dusk (17-20); setInterval every 60s |
| Sub-heroes wired per phase | Code: `LivingHero.tsx` | ✅ CONFIRMED | night→StargazingHero, dawn/dusk→VintageSunRays, day→MascotWorldHero |
| cf-vbsd: no day-flash on night load | Code: commit `94f045b` | ✅ CONFIRMED | `mounted` state false until useEffect; transition is `"none"` until mounted — first frame always correct phase |
| cf-aslp: toast position fixed | Code: commit `94f045b` EasterEggBear.tsx | ✅ CONFIRMED | `position:"fixed"`, `bottom:120`, `width:"min(320px,90vw)"`, `zIndex:9999` — viewport-safe on all sizes |
| prefers-reduced-motion | Code: `LivingHero.tsx` | ✅ CONFIRMED | `reduceMotion` state from matchMedia; passed to sub-heroes |
| Visual runtime verification | Playwright | ❌ BLOCKED | Playwright MCP disconnected — cannot confirm time-of-day renders visually |

**Wave-4 visual QA: BLOCKED — Playwright MCP disconnected this session.**

Expected phase at time of wave-4 request (~03:50 UTC / 21:50 MDT = h=21): **night** → should show StargazingHero (bear lying under stars, fireflies, shooting star). Manual verification: load `carolina-futons-web.vercel.app` and confirm correct phase renders with no day-bear flash. Trigger bear Easter egg and confirm toast is centered/inset-safe.

---

## WAVE-3 SWEEP — Theme C Deploy + Fresh Deploy Verification (2026-04-27)

| Feature | Page/Route | Result | Notes |
|---|---|---|---|
| Theme C hero | /theme-c | ✅ PASS | Night sky, moon, rolling hills, bear silhouette, stars — all render |
| Theme C — firefly animation | /theme-c | ✅ PASS | 14 firefly elements (`stargaze-firefly`) present in DOM |
| Theme C — shooting star | /theme-c | ✅ PASS | 1 `stargaze-shoot` element; fires every 8s per preview description |
| Theme C — milky way | /theme-c | ✅ PASS | `stargaze-milkyway` present; drifts over 1 min |
| Theme C — prefers-reduced-motion | /theme-c | ✅ PASS | 4 CSS `prefers-reduced-motion` rules present; page explicitly documents compliance |
| Theme C — console errors | /theme-c | ✅ PASS | 0 errors on load |
| Theme C — mobile 390×844 | /theme-c | ✅ PASS | Hero scales, hamburger nav present, no overflow |
| Theme A | /theme-a | ✅ PASS | Bear mascot, day scene, category cards, Easter egg "Find the bear — 10% off" section |
| /signup fresh deploy | /signup | ✅ PASS | Account created (cf-c77s wave-3 test) — see cf-c77s section |
| /contact PR #256 | /contact | ✅ PASS | Bed-size radio (Twin/Full/Queen/King) renders; Turnstile dev bypass (no visible widget) |
| Dark mode toggle | site-wide | ✅ PASS | Moon icon when active; confirmed persistent via localStorage |

**No regressions from Theme C deploy. 0 new beads.**

---

## OPEN BEADS TRACKER

All beads still requiring action as of 2026-04-27 wave-2.

| Bead | Priority | Status | Title | Blocker |
|---|---|---|---|---|
| cf-1te7 | P1 | OPEN | /collections/* → 404, no redirect to /shop/* | — |
| cf-e92v | P2 | OPEN | /care and /care-warranty → 404, no redirect to /warranty | — |
| cf-5pf8 | P1 | OPEN | Newsletter footer fails post-PR-#242 | Velo endpoint not published or deploy lag |
| cf-sg12 | P1 | OPEN | /style-quiz permanently broken | Ongoing since Phase 1 |
| cf-44mq | P1 | IN_PROGRESS | PDP variant pickers broken | STAGING_SITE products have empty productOptions |
| cf-c77s | P1 | IN_PROGRESS | E2E email + challenge tests | Welcome email: reCAPTCHA blocker (manual Hal action needed) |
| B1 (new) | HIGH | OPEN | welcome_series_4, welcome_series_5 missing from emailTemplates.web.js | Will fail at send time — registry gap |
| B2 (new) | HIGH | OPEN | reengagement_2, reengagement_3 missing from emailTemplates.web.js | Will fail at send time — registry gap |

---

*millicent — 2026-04-27 — cf-q9zi QA pass (updated with post-merge wave 2 + open beads tracker)*
