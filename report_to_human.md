# Q1 Backlog Review — Full Story Update

**Date:** 2026-02-20
**Reviewer:** melania (Story Manager / Crew Lead)
**Scope:** 18 stories across 4 rigs
**Test Suite:** cfutons 869/869 green | tradingbot 370/394 (24 failing) | cfutons_mobile TDD stubs only

---

## Executive Summary

18 stories reviewed. 15 have acceptance criteria approved. 3 need refinement before work begins. Priority order confirmed with 2 recommended adjustments. All stories mapped to existing codebase state and crew capacity.

**Key findings:**
- cfutons is code-complete for P0/P1 sprint work; these 6 stories are the NEXT wave
- cfutons_mobile is stalled — scaffold done but zero feature velocity
- tradingbot has strong momentum — 370 tests, 5 strategies live, ML pipeline running
- gastown features are largely already built; stories may be partially done or low-value

---

## CFUTONS (6 stories)

### cf-pzm (P1) Email Marketing Automation
**Maps to:** cf-d3u (existing bead — email automation)
**Current state:** Backend code EXISTS — `emailService.web.js`, `cartRecovery.web.js` already built. Welcome series logic, abandoned cart recovery, post-purchase care sequence all coded. Missing: Klaviyo/Wix Automations connection.

**Acceptance Criteria:**
1. Welcome email triggers within 5 minutes of account creation (Wix Automations rule)
2. Abandoned cart email fires 1 hour after cart abandonment with cart contents and recovery link
3. Post-purchase care sequence fires at Day 3 (care tips), Day 7 (review request), Day 30 (reorder prompt)
4. All emails use Carolina Futons design tokens (sand/espresso/coral palette)
5. Unsubscribe link works and updates `MemberPreferences` CMS collection
6. Email open/click rates tracked via Wix Analytics or Klaviyo dashboard
7. Edge case: cart recovery email does NOT fire if purchase completed before 1hr window

**Size:** M (2-4h) — backend done, this is Wix Dashboard config + Klaviyo connection
**Files:** Wix Automations Dashboard, `emailService.web.js`, `cartRecovery.web.js`
**Verdict:** APPROVED. Backend is ready. This is a config/integration task, not a code task. Needs Wix Dashboard access.
**Priority: P1 CONFIRMED** — highest ROI of any cfutons story. Email has 4,200% ROI. Backend already built.

---

### cf-pv1 (P1) SEO Content Hub with Buying Guides
**Maps to:** cf-uyc (existing bead — SEO content hub)
**Current state:** `Blog.js` page is CODED AND LIVE with JSON-LD, product sidebar, social share, newsletter signup. `seoHelpers.web.js` generates all schema (Product, LocalBusiness, FAQ, BreadcrumbList). Missing: actual blog CONTENT.

**Acceptance Criteria:**
1. 8 pillar buying guides published (one per product category: futon frames, mattresses, covers, pillows, outdoor, storage, accessories, bundles)
2. Each guide has JSON-LD Article schema with author, datePublished, dateModified
3. Each guide includes FAQ section with FAQPage schema (min 5 Q&As per guide)
4. Internal linking: each guide links to relevant category page and 3+ product pages
5. Each guide targets 2-3 long-tail keywords (e.g. "best futon for guest room 2026")
6. Blog index page shows all guides with featured images and excerpts
7. Sitemap includes all blog posts (verify via `/_functions/productSitemap`)
8. Edge case: guide renders correctly with no product images (placeholder fallback)

**Size:** L (6-16h) — 8 articles is substantial content work
**Files:** `Blog.js`, `seoHelpers.web.js`, Wix CMS (Blog collection)
**Verdict:** APPROVED. Code infrastructure is ready. This is a CONTENT task — needs a writer (human or AI) to produce the 8 guides.
**Priority: P1 CONFIRMED** — SEO compounds over time. The sooner content goes up, the sooner Google indexes it.

---

### cf-1sw (P2) Product Page Refactor (1640-line file)
**Maps to:** cf-tbf (existing bead — Product Page decomposition)
**Current state:** `Product Page.js` is 1640 lines. Working but monolithic. Sprint work added safeInit utility (caesar) and errorHandler (radahn) which are already extracted. Architect bead cf-tbf has AC I wrote last cycle.

**Acceptance Criteria:**
1. Product Page.js reduced to <400 lines (orchestrator only)
2. Minimum 5 extracted modules: gallery, variants, swatch visualizer, cross-sell, cart actions
3. Each extracted module independently testable with its own test file
4. Import direction: page imports modules, modules import shared utils, never circular
5. All 869 existing tests still pass after refactor (zero regressions)
6. No user-visible behavior changes (pure refactor)
7. Module boundaries follow existing `safeInit` pattern for element initialization
8. Edge case: extracted modules gracefully handle missing DOM elements (safeInit pattern)

**Size:** L (6-16h) — careful decomposition of a working page
**Files:** `src/pages/Product Page.js`, new files in `src/public/` or `src/pages/modules/`
**Verdict:** APPROVED. AC is solid. This is a code-quality investment — reduces future bug surface.
**Priority: P2 CONFIRMED** — important but not revenue-generating. Do after P1s.

---

### cf-e27 (P2) Product Comparison Tool
**Maps to:** cf-it6 (existing bead — side-by-side futon comparison)
**Current state:** Comparison bar UI already exists in `galleryHelpers.js` (added in Convoy 1 by polecat thunder). Users can add up to 3 products to compare bar. Missing: the actual comparison PAGE that shows side-by-side details.

**Acceptance Criteria:**
1. Comparison page shows 2-3 products side by side in a table layout
2. Comparison dimensions: price, dimensions (W x D x H), weight, materials, available fabrics, mattress compatibility, shipping weight, assembly required (yes/no)
3. Differences highlighted visually (bold or color) when values differ
4. "Add to Cart" button for each product in the comparison
5. Deep link: comparison page URL includes product IDs (shareable)
6. Comparison bar persists across page navigation (sessionStorage)
7. Mobile: comparison stacks vertically with swipe between products
8. Edge case: comparison with only 1 product shows "Add another product to compare" prompt

**Size:** M (2-6h) — comparison bar logic exists, need the page + data fetching
**Files:** New `Comparison.js` page, `galleryHelpers.js` (comparison bar), `dataService.web.js`
**Verdict:** APPROVED. Reduces decision paralysis for "Guest Room Upgrader" persona.
**Priority: P2 CONFIRMED** — good conversion tool but not urgent.

---

### cf-kpl (P2) Customer Photo Reviews
**Maps to:** cf-g94 (existing bead — customer photo reviews with verified purchase badges)
**Current state:** Review placeholder exists on Product Page but no review SYSTEM. No Wix Reviews app installed. No user-generated content pipeline.

**Acceptance Criteria:**
1. Customers can submit star rating (1-5) + text review + up to 3 photos
2. "Verified Purchase" badge shows when reviewer has matching order in Wix Stores
3. Reviews display on Product Page with average rating, rating distribution histogram, and sort (newest/highest/lowest/most helpful)
4. Photo reviews show thumbnails that open in lightbox (reuse existing lightbox from galleryHelpers)
5. Review moderation: new reviews require admin approval before display
6. Review request email sent 7 days post-purchase (integrate with email automation — cf-pzm dependency)
7. Aggregate rating appears in Product JSON-LD schema (AggregateRating)
8. Edge case: product with 0 reviews shows "Be the first to review" CTA, not empty state

**Size:** L (6-16h) — full review system: submission, moderation, display, schema
**Files:** `Product Page.js`, new `reviewService.web.js`, `seoHelpers.web.js`, Wix CMS (Reviews collection)
**Verdict:** APPROVED. Social proof is the #1 missing conversion element.
**Priority: P2 CONFIRMED** — but NOTE: depends on cf-pzm (email automation) for review request emails. Consider bumping to P1 given conversion impact.
**RECOMMENDATION: Consider P1** — reviews are the single biggest trust signal missing from the site.

---

### cf-3iy (P2) Pinterest Rich Pins
**Maps to:** cf-376 (existing bead — Pinterest discovery engine)
**Current state:** Pinterest product feed endpoint ALREADY LIVE at `/_functions/pinterestProductFeed`. Rich Pin meta generators ALREADY in `seoHelpers.web.js` (Open Graph + Pinterest-specific meta). Missing: Pinterest Business account validation + catalog sync setup.

**Acceptance Criteria:**
1. Pinterest Rich Pins validated (apply via Pinterest Business dashboard)
2. Product catalog synced via `/_functions/pinterestProductFeed` endpoint
3. All products in catalog show price, availability, and product URL
4. 5 Pinterest boards created: Room Ideas, Before & After, Color Inspiration, Outdoor Living, Dorm Room
5. Pin descriptions include relevant keywords + UTM parameters for tracking
6. Rich Pin rendering verified: price, title, description, availability badge all display
7. Edge case: products with no image show Carolina Futons placeholder, not broken pin

**Size:** S (1-2h) — code is DONE. This is entirely Pinterest Business dashboard config.
**Files:** Pinterest Business Dashboard (no code changes needed)
**Verdict:** APPROVED. Extremely low effort — all code already exists.
**Priority: P2 CONFIRMED** — but this is S-sized and could be done in an afternoon. Good quick win.

---

### CFUTONS Priority Order (Confirmed)

| Rank | Story | Priority | Size | Revenue Impact | Notes |
|------|-------|----------|------|----------------|-------|
| 1 | cf-pzm Email automation | P1 | M | HIGH (4200% ROI) | Backend done, config only |
| 2 | cf-pv1 SEO content hub | P1 | L | HIGH (compounds) | Code done, needs content |
| 3 | cf-3iy Pinterest Rich Pins | P2 | S | MEDIUM | Code done, quick win — do alongside P1s |
| 4 | cf-kpl Customer reviews | P2 | L | HIGH (trust/social proof) | **Consider P1** |
| 5 | cf-e27 Comparison tool | P2 | M | MEDIUM (conversion) | Comparison bar exists |
| 6 | cf-1sw Product Page refactor | P2 | L | LOW (code quality) | No user-visible change |

**Flag: cf-kpl should be P1.** Reviews are the #1 missing trust signal. Every competitor (Wayfair, Amazon, IKEA) has reviews. Without them, we lose the "Guest Room Upgrader" persona who needs social proof before spending $600+.

---

## CFUTONS MOBILE (4 stories)

**Rig health: RED.** Scaffold (cm-vx9) is merged. 76 TDD stub tests created. Zero implementations. Polecat furiosa timed out and was killed. Crew members artemis and tester have fresh workspaces with no commits. The mobile app has placeholder screens and design tokens but no actual features.

### cm-o2o (P0) AR Camera Overlay — See Futons in Your Room
**Current state:** Nothing built. This is the most ambitious story in the entire backlog. Requires camera access, 3D model rendering, plane detection, and real-time overlay. React Native AR libraries exist (ViroReact, expo-three) but this is a complex integration.

**Acceptance Criteria:**
1. Camera opens with AR plane detection (floor surface recognition)
2. User selects a futon product from catalog and places 3D model on detected surface
3. Model renders at correct physical dimensions (width, depth, height from product data)
4. User can rotate, move, and scale placed model with gestures
5. "Take Photo" captures AR scene and saves to camera roll
6. Share button sends captured photo via native share sheet
7. Minimum 3 futon models available at launch (most popular frames)
8. Fallback: if AR not supported (older devices), show "AR not available" with static room mockup
9. Performance: AR overlay runs at 30+ FPS on iPhone 12+ / Pixel 6+

**Size:** XL (>16h) — **MUST SPLIT.** This is too large for one story. Recommend:
- cm-o2o-a: Camera + plane detection (L)
- cm-o2o-b: 3D model loading + placement (L)
- cm-o2o-c: Gesture controls + photo capture + share (M)

**Files:** New AR module, camera permissions, 3D asset pipeline
**Verdict:** NEEDS REFINEMENT. Must be split into 3 sub-stories before work begins. Also: no foundation exists (navigation, components not built yet). This depends on cm-qtf and cm-4ee.
**Priority: P0 is WRONG.** This should be P2 or P3. AR is a "wow factor" feature but the app can't even browse products yet. You can't put AR on top of an app that has no navigation, no product screens, no cart. **RECOMMEND: Demote to P2.** Build the shopping fundamentals first.

---

### cm-qtf (P1) Product Browsing with Search/Filter
**Current state:** `ShopScreen.tsx` and `CategoryScreen.tsx` exist as stubs. Design tokens defined. No actual product data fetching, no search, no filters.

**Acceptance Criteria:**
1. Shop screen displays product grid (2 columns) with image, name, price
2. Category filter: tap category chip to filter products (8 categories from web)
3. Search bar with debounced text input filters products by name
4. Sort options: Price Low→High, Price High→Low, Newest, Name A-Z
5. Pull-to-refresh loads latest products from Wix Stores API
6. Product card tap navigates to Product Detail screen (cm-4ee)
7. Loading skeleton shows while fetching products
8. Empty state: "No products found" with illustration when search/filter returns 0 results
9. Pagination: infinite scroll loads 20 products per page
10. Edge case: network failure shows retry button with cached last-known products

**Size:** L (6-16h) — full shopping experience from scratch
**Files:** `ShopScreen.tsx`, `CategoryScreen.tsx`, new `ProductCard.tsx`, `SearchBar.tsx`, `api/products.ts`
**Verdict:** APPROVED. This is the foundational mobile feature — everything else depends on browsing.
**Priority: P1 CONFIRMED** — this is actually the real P0. Without browsing, there's no app.

---

### cm-4ee (P1) Product Detail Screen
**Current state:** `ProductDetailScreen.tsx` exists as stub. No implementation.

**Acceptance Criteria:**
1. Product detail screen shows: main image, image gallery (swipeable), name, price, description
2. Variant selector: fabric/color dropdown or chips (matches web swatch system)
3. "Add to Cart" button with quantity selector
4. Size/dimension info displayed clearly (frame W x D x H)
5. Cross-sell section: "Complete Your Futon" with frame+mattress pairing (reuse web logic)
6. Share button: native share sheet with product URL + image
7. Back navigation returns to exact scroll position in product grid
8. Loading state: skeleton matching final layout
9. Edge case: product with no variants shows single "Add to Cart" (no selector)
10. Edge case: out-of-stock product shows "Notify Me" instead of "Add to Cart"

**Size:** L (6-16h) — full PDP for mobile
**Files:** `ProductDetailScreen.tsx`, new `ImageGallery.tsx`, `VariantSelector.tsx`, `api/products.ts`
**Verdict:** APPROVED. Standard mobile PDP — well-scoped.
**Priority: P1 CONFIRMED** — required before cart can work.

---

### cm-66v (P1) Shopping Cart with BNPL
**Current state:** `CartScreen.tsx` exists as stub. No implementation. BNPL requires Affirm/Klarna SDK integration.

**Acceptance Criteria:**
1. Cart screen shows line items: image, name, variant, price, quantity controls
2. Remove item: swipe-to-delete with confirmation
3. Quantity update: +/- buttons, reflects in subtotal immediately
4. Cart summary: subtotal, estimated shipping, total
5. Free shipping progress bar at $999 threshold (matches web)
6. "Checkout" button navigates to Wix checkout webview
7. BNPL option: "Pay in 4" badge shows Affirm/Klarna monthly payment estimate
8. BNPL tap opens Affirm/Klarna pre-qualification flow (SDK integration)
9. Empty cart: "Your cart is empty" with "Start Shopping" CTA
10. Cart badge on tab bar shows item count
11. Edge case: cart persists across app restarts (AsyncStorage)
12. Edge case: BNPL not available for orders under $50 — hide badge

**Size:** L (6-16h) for cart, XL if including full BNPL integration
**Verdict:** NEEDS REFINEMENT. Split BNPL into separate story:
- cm-66v: Shopping cart (L) — core cart functionality
- cm-66v-b: BNPL integration (M) — Affirm/Klarna SDK, can be done after cart ships

**Priority: P1 CONFIRMED** — cart is essential. But BNPL portion should be P2 (separate story).

---

### CFUTONS MOBILE Priority Order (Revised)

| Rank | Story | Priority | Size | Notes |
|------|-------|----------|------|-------|
| 1 | cm-qtf Product browsing | P1 | L | Foundation — everything depends on this |
| 2 | cm-4ee Product detail | P1 | L | Depends on cm-qtf |
| 3 | cm-66v Shopping cart (without BNPL) | P1 | L | Depends on cm-4ee |
| 4 | cm-o2o AR overlay | **P2 (demoted from P0)** | XL (must split) | Depends on cm-qtf + cm-4ee. Split into 3 sub-stories. |

**FLAG: cm-o2o priority is wrong.** P0 means "blocks an epic" — but the app has no working features yet. AR on a non-functional app is useless. The browsing → detail → cart pipeline is the real critical path.

**FLAG: Zero velocity.** This rig needs active crew assignment or polecat dispatch. artemis and tester have done nothing. Consider reassigning radahn (who built the PWA-lite for web) to lead mobile implementation.

---

## TRADINGBOT (5 stories)

**Rig health: GREEN.** 370 tests passing. 5 strategies backtested. ML pipeline running. Twitter sentiment integration just landed. Active crew (quant, algo, tester) producing commits.

### tb-786 (P1) ML Neural Net Training
**Maps to:** tb-91k (existing bead — CLOSED)
**Current state:** DONE. `signal_predictor.json` model trained. ML feature pipeline in `src/ml/features.js`. Trainer in `src/ml/model.js`. Walk-forward evaluator being built (`src/ml/walk-forward-evaluator.js` — uncommitted).

**Acceptance Criteria:**
1. Neural network trained on backtested OHLCV data with technical features
2. Model achieves >55% directional accuracy on out-of-sample data
3. Walk-forward validation: train on N candles, predict on next M, slide window
4. Model persisted to `models/signal_predictor.json` with metadata (features, accuracy, date)
5. Feature importance ranking: top 5 features identified
6. Training reproducible: `npm run train` produces consistent results (seeded RNG)
7. Integration: signal engine can load and query model for predictions
8. Edge case: model gracefully handles missing features (NaN → default)

**Size:** L — but largely DONE
**Verdict:** APPROVED. **Story is 90%+ complete.** Walk-forward evaluator is the remaining piece (uncommitted). Quant needs to commit and push.
**Priority: P1 CONFIRMED** — but close to done. Commit the uncommitted files and close it.

---

### tb-bhm (P1) HMM Regime Detection
**Maps to:** tb-zfw (existing bead — HMM market state classifier)
**Current state:** `src/ml/hmm.js` exists but is UNCOMMITTED. Ensemble strategy in `src/strategies/` already has regime-adaptive weighting structure. 24 test failures in `mean-reversion-improved.test.js` are related to regime-dependent signal generation.

**Acceptance Criteria:**
1. Hidden Markov Model classifies market into 3 regimes: trending, mean-reverting, volatile
2. Regime detection uses rolling window of OHLCV data (configurable window size, default 100 candles)
3. Regime transition probabilities logged for each classification
4. Strategy selector: trending → momentum, mean-reverting → mean reversion, volatile → conservative/cash
5. Regime detection runs in <50ms per candle (real-time compatible)
6. Backtesting: regime-aware strategy switching outperforms best single strategy by >10% Sharpe
7. Visualization: regime timeline chart showing transitions over backtest period
8. Edge case: insufficient data (<100 candles) defaults to "unknown" regime with conservative allocation

**Size:** L (6-16h) — HMM module partially written, needs integration + testing
**Files:** `src/ml/hmm.js`, `src/strategies/ensemble.js`, new `tests/hmm.test.js`
**Verdict:** APPROVED. Partially built. Key risk: getting the 24 failing tests to pass.
**Priority: P1 CONFIRMED** — regime detection is the force multiplier for all other strategies.

---

### tb-1hy (P2) Statistical Arbitrage
**Maps to:** tb-1dt (existing bead — cointegrated pairs trading)
**Current state:** No implementation. Requires cointegration testing (Engle-Granger or Johansen) and pairs identification.

**Acceptance Criteria:**
1. Cointegration scanner: identify cointegrated pairs from universe of 20+ crypto assets
2. Cointegration test: Engle-Granger with p-value < 0.05 threshold
3. Spread calculation: z-score of price ratio with rolling mean/std (configurable window)
4. Entry: long spread when z-score < -2, short spread when z-score > 2
5. Exit: z-score reverts to [-0.5, 0.5] band
6. Position sizing: Kelly criterion applied to each leg independently
7. Risk: maximum spread divergence stop-loss at z-score = 4
8. Backtesting: Sharpe ratio > 1.0 on 6-month historical data
9. Edge case: cointegration breaks (half-life > 30 days) → close position and remove pair

**Size:** L (6-16h) — full new strategy module
**Files:** New `src/strategies/stat-arb.js`, `src/ml/cointegration.js`, `tests/stat-arb.test.js`
**Verdict:** APPROVED. Clean, well-understood strategy with clear math.
**Priority: P2 CONFIRMED** — good diversification play but regime detection (tb-bhm) should come first.

---

### tb-22u (P2) MCP Server
**Maps to:** tb-f2i (existing bead — MCP server for AI-driven trade management)
**Current state:** No implementation. Freqtrade already has a popular MCP server pattern to follow.

**Acceptance Criteria:**
1. MCP server exposes tools: `get_portfolio`, `get_positions`, `place_order`, `cancel_order`, `get_strategies`, `get_backtest_results`
2. `get_portfolio` returns current holdings, P&L, available balance
3. `place_order` accepts symbol, side (buy/sell), type (market/limit), quantity, and optional price
4. Paper trading mode: all orders execute against paper trader (no real money without explicit flag)
5. Authentication: API key required for all requests (generated on first run)
6. Rate limiting: max 10 requests/second per API key
7. Logging: all MCP tool invocations logged with timestamp, tool, params, result
8. Claude/Gas Town agents can manage trades via conversation through MCP protocol
9. Edge case: MCP server returns helpful error when trading bot is not running

**Size:** M (2-6h) — straightforward REST/MCP adapter over existing trading bot
**Files:** New `src/mcp/server.js`, `src/mcp/tools.js`, `tests/mcp.test.js`
**Verdict:** APPROVED. Force multiplier — enables Gas Town agents to manage trades.
**Priority: P2 CONFIRMED** — but high strategic value. Previously recommended for P1 promotion.
**RECOMMENDATION: Consider P1** — this bridges tradingbot into the Gas Town ecosystem.

---

### tb-yxy (P2) Kelly Criterion Sizing
**Maps to:** tb-sxl (existing bead — Kelly criterion with VaR constraints)
**Current state:** Position sizing already exists in `src/signals/` but uses simple volatility-based sizing, not Kelly.

**Acceptance Criteria:**
1. Kelly fraction calculated from win rate and average win/loss ratio per strategy
2. Half-Kelly applied by default (conservative: f/2) with full-Kelly option
3. VaR constraint: position size capped so 1-day 95% VaR never exceeds 2% of portfolio
4. Bankroll tracking: running P&L updates Kelly inputs in real-time
5. Per-strategy Kelly: each strategy gets independent Kelly calculation
6. Ensemble: total portfolio allocation across strategies sums to <= 100% (no leverage)
7. Backtesting: Kelly sizing outperforms fixed sizing by >15% total return over 6 months
8. Edge case: negative Kelly (losing strategy) → 0% allocation (no shorts)
9. Edge case: Kelly > 1.0 → cap at 1.0 (no leverage)

**Size:** M (2-6h) — math is well-defined, integration with existing position sizer
**Files:** `src/signals/position-sizer.js` (modify), new `src/ml/kelly.js`, `tests/kelly.test.js`
**Verdict:** APPROVED. Clean mathematical story with clear AC.
**Priority: P2 CONFIRMED** — good risk management upgrade.

---

### TRADINGBOT Priority Order (Confirmed)

| Rank | Story | Priority | Size | Notes |
|------|-------|----------|------|-------|
| 1 | tb-786 ML neural net | P1 | L (90% done) | Commit uncommitted files, close it |
| 2 | tb-bhm HMM regime detection | P1 | L (partially built) | Fix 24 failing tests, integrate |
| 3 | tb-22u MCP server | P2 | M | **Consider P1** — Gas Town integration |
| 4 | tb-yxy Kelly criterion | P2 | M | Clean math, independent work |
| 5 | tb-1hy Statistical arbitrage | P2 | L | New strategy, depends on regime detection |

---

## GASTOWN (3 stories)

**Rig health: YELLOW.** Mature codebase (v0.7.0, 167MB binary). But several of these stories describe features that ALREADY EXIST in varying degrees.

### gt-r8l (P3) Webhook Notifications
**Maps to:** gt-5kz (existing bead — Slack/Discord/email webhooks)
**Current state:** Notification system EXISTS: `internal/daemon/notification.go` has slot-based notification deduplication, session-aware dismissal, TTL cleanup. Toast notifications and escalation actions implemented. Mail auto-nudges idle agents. Slack webhook URL is a TODO in escalation code.

**Acceptance Criteria:**
1. Webhook endpoint configurable in `settings/config.json` (Slack, Discord, or generic HTTP POST)
2. Events that trigger webhook: convoy completion, agent failure, escalation, polecat timeout
3. Webhook payload includes: event type, timestamp, rig, agent, bead ID, summary message
4. Slack formatting: rich message with event type emoji, rig color, action buttons
5. Discord formatting: embed with fields matching Slack layout
6. Generic HTTP POST: JSON payload for custom integrations
7. Retry logic: 3 retries with exponential backoff on webhook failure
8. Rate limiting: max 1 webhook per event type per 5 minutes (dedup)
9. Edge case: webhook URL unreachable → log warning, do not block agent work

**Size:** M (2-6h) — notification infrastructure exists, need webhook HTTP dispatch
**Files:** `internal/daemon/notification.go` (extend), new `internal/daemon/webhook.go`
**Verdict:** APPROVED. Most of the plumbing exists. This is adding HTTP dispatch to the existing notification system.
**Priority: P3 CONFIRMED** — nice to have but not blocking any work.

---

### gt-jp9 (P2) Tmux Terminal Prettification
**Current state:** LARGELY DONE. `statusline.go` has dynamic status bars for all agent types. `theme.go` has 7+ themes (forest, desert, ocean, volcano). Agent switcher keybinding (`C-b g`). Per-rig theme assignment. Terminal preview in dashboard.

**Acceptance Criteria:**
1. Each rig has a distinct, visually identifiable tmux theme (unique status bar color)
2. Status line shows: rig name, role, worker name, active bead ID, hooked work status
3. Theme can be changed at runtime: `gt theme apply <theme-name>`
4. Agent switcher: `C-b g` opens tmux menu listing all active agents
5. Terminal title shows agent identity (visible in macOS Terminal/iTerm tab bar)
6. Pane border colors match rig theme
7. Clean theme reset: `gt theme reset` restores default tmux config
8. Edge case: theme applies correctly even with user's existing tmux.conf customizations

**Size:** S (1-2h) — most of this is ALREADY BUILT
**Verdict:** NEEDS REFINEMENT. What exactly is NOT done? Current implementation covers AC items 1-4 and 6. Need to clarify: is this about fixing gaps in the existing implementation, or adding new visual features?
**Priority: P2 seems HIGH for what's already built.** Recommend P3 unless there are specific gaps.
**RECOMMENDATION: Demote to P3** unless specific missing features are identified.

---

### gt-??? (P3) Smart Task Routing / Metrics Export
**Current state:** Task routing is SOPHISTICATED — `sling.go` (34KB) handles batch dispatch, auto-spawning, merge strategies, cross-rig routing. Metrics: Dolt health metrics, cost tracking, activity tracking all exist. Missing: Prometheus/OpenTelemetry export.

**Acceptance Criteria (Smart Task Routing):**
1. Skill-based routing: sling command considers agent specialization when dispatching
2. Agent capability registry: each agent declares skills (e.g., "go", "react", "testing")
3. Dispatch scoring: candidate agents scored by skill match + current load + recent success rate
4. Fallback: if no skilled agent available, dispatch to any available agent with warning
5. Routing decisions logged with scoring breakdown

**Acceptance Criteria (Metrics Export):**
6. Prometheus `/metrics` endpoint on daemon HTTP server
7. Metrics exported: active agents, convoy completion rate, bead velocity, agent cost, queue depth
8. OpenTelemetry traces for convoy lifecycle (create → dispatch → complete)
9. Grafana dashboard template (JSON) included in `docs/`
10. Edge case: metrics endpoint available even when Dolt is down (cached last-known values)

**Size:** L (6-16h) — two distinct features bundled
**Verdict:** NEEDS REFINEMENT. These are TWO separate stories:
- gt-???-a: Smart task routing with skill registry (L) — maps to gt-24y
- gt-???-b: Prometheus/OpenTelemetry metrics export (M) — maps to gt-3bz

Split before work begins. The routing and metrics are independent features.
**Priority: P3 CONFIRMED** — infrastructure polish, not blocking any user-facing work.

---

### GASTOWN Priority Order (Confirmed)

| Rank | Story | Priority | Size | Notes |
|------|-------|----------|------|-------|
| 1 | gt-jp9 Tmux prettification | **P3 (demoted from P2)** | S | Mostly done already |
| 2 | gt-r8l Webhook notifications | P3 | M | Notification infra exists |
| 3 | gt-??? Smart routing + Metrics | P3 | L (split into 2) | Must split |

**FLAG:** All gastown stories are P3. This rig is mature and functional. No urgency.

---

## Priority Adjustments Summary

| Story | Current | Recommended | Reason |
|-------|---------|-------------|--------|
| **cm-o2o** AR overlay | P0 | **P2** | Can't AR an app with no screens. Build browsing/cart first. |
| **cf-kpl** Customer reviews | P2 | **P1** | #1 missing trust signal. Every competitor has reviews. |
| **gt-jp9** Tmux prettification | P2 | **P3** | Feature is 80%+ built already. |
| **tb-22u** MCP server | P2 | Consider P1 | Gas Town integration force multiplier. |

---

## Cross-Rig Dependencies

```
cf-pzm (email automation) ← cf-kpl (reviews need review-request email)
cm-qtf (product browsing) ← cm-4ee (detail) ← cm-66v (cart) ← cm-o2o (AR)
tb-786 (ML training) ← tb-bhm (regime detection) ← tb-1hy (stat arb)
tb-bhm (regime detection) — independent of tb-22u (MCP) and tb-yxy (Kelly)
```

---

## Global Priority Order (All 18 Stories)

| # | Story | Rig | Priority | Size | Status |
|---|-------|-----|----------|------|--------|
| 1 | cf-pzm Email automation | cfutons | P1 | M | Backend done, config only |
| 2 | cf-pv1 SEO content hub | cfutons | P1 | L | Code done, needs content |
| 3 | tb-786 ML neural net | tradingbot | P1 | L | 90% done — commit & close |
| 4 | tb-bhm HMM regime detection | tradingbot | P1 | L | Partially built |
| 5 | cm-qtf Product browsing | cfutons_mobile | P1 | L | Nothing built — critical path |
| 6 | cm-4ee Product detail | cfutons_mobile | P1 | L | Nothing built |
| 7 | cm-66v Shopping cart | cfutons_mobile | P1 | L | Nothing built |
| 8 | cf-kpl Customer reviews | cfutons | **P1 (promoted)** | L | Social proof gap |
| 9 | cf-3iy Pinterest Rich Pins | cfutons | P2 | S | Quick win, code done |
| 10 | tb-22u MCP server | tradingbot | P2 | M | Consider P1 |
| 11 | cf-e27 Comparison tool | cfutons | P2 | M | Comparison bar exists |
| 12 | cf-1sw Product Page refactor | cfutons | P2 | L | Code quality |
| 13 | tb-yxy Kelly criterion | tradingbot | P2 | M | Independent math |
| 14 | tb-1hy Statistical arbitrage | tradingbot | P2 | L | New strategy |
| 15 | cm-o2o AR overlay | cfutons_mobile | **P2 (demoted)** | XL (split) | Depends on cm-qtf/4ee |
| 16 | gt-r8l Webhook notifications | gastown | P3 | M | Infra exists |
| 17 | gt-jp9 Tmux prettification | gastown | **P3 (demoted)** | S | Mostly done |
| 18 | gt-??? Routing + Metrics | gastown | P3 | L (split) | Must split into 2 |

---

## Recommended Immediate Actions

1. **tb-786**: Quant crew needs to commit uncommitted HMM + walk-forward files and push. Story is nearly closed.
2. **cm-o2o**: Demote to P2. Reassign polecat or crew to cm-qtf (product browsing) as the real critical path.
3. **cf-kpl**: Promote to P1. Reviews are table stakes for any e-commerce site.
4. **gt-???**: Split into two stories before any work begins (routing vs metrics).
5. **cm-66v**: Split BNPL into separate story. Cart is P1, BNPL is P2.
6. **cfutons_mobile velocity crisis**: This rig needs active workers NOW. Consider dispatching to radahn or spinning up fresh polecats.

---

*Review complete. 18 stories assessed. 15 approved, 3 need refinement (cm-o2o split, cm-66v split, gt-??? split). 3 priority adjustments recommended. All acceptance criteria written.*

*Story Manager: melania | Q1 Backlog Review | 2026-02-20*
