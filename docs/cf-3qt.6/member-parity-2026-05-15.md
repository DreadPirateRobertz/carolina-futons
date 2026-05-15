# Member-account parity — Wix Studio vs cfw — 2026-05-15

**Bead:** cf-zn5b (cf-mbrflow-1; parent cf-3qt.6 — Phase 6 parity testing)
**Auditor:** rennala
**Method:** Static read of both implementations side-by-side.
- **Wix (current production):** `src/pages/Member Page.js` (1588-line orchestrator) + supporting `public/*` helpers (Returns, ZipLeaderboard, SpinWheel, StreakDisplay, ChallengesDisplay, loyalty/storeCredit/giftCard helpers).
- **cfw (cutover target):** `src/app/(member)/dashboard/` route group + `src/components/member/*`. Five routes: `/dashboard`, `/dashboard/orders`, `/dashboard/wishlist`, `/dashboard/preferences`, `/dashboard/profile`.

**Scope:** functional parity of member-account flows for the cf-3qt.8 DNS-cutover gate. Out-of-scope for this audit: visual diff (sibling cf-3qt.6.1 screenshot matrix), auth login flow itself (cf-3qt.3 already shipped), mobile-app member feed (cf-xe2 epic).

**Go/no-go input:** critical regression → abort. Missing-feature with separate launch plan → file follow-up.

## TL;DR

cfw covers the **transactional core** of member self-service (orders, wishlist, preferences, profile) competently. Wix Studio carries a **much larger gamification + loyalty + warranty** footprint that cfw does not yet expose.

**Verdict for cutover:** the transactional core is parity-acceptable. The gamification/loyalty/warranty footprint is *intentionally* out-of-scope for V1 cfw per cf-3qt.3 acceptance criteria — those features are **deferred, not regressed**. That's a PM decision Stilgar already made; this audit confirms cfw matches the planned scope, not the full Wix surface.

**Critical regressions (P1 cutover blockers):** **0**.
**Missing-feature gaps relative to Wix (P2/P3):** 12, summarized below + filed for tracking.
**Two implementation gaps inside the cfw-shipped scope** (cf-zn5b G-7, G-9 below) need fixing before cutover.

## Wix → cfw map

| Wix `Member Page.js` section | cfw equivalent | Verdict |
|---|---|---|
| Dashboard overview | `/dashboard/page.tsx` | ✅ functional parity (greeting + nav to sub-pages) |
| Loyalty dashboard (tier, points, rewards) | — | ⚠ **G-1** deferred |
| Streak display | — | ⚠ **G-2** deferred |
| Challenges Section | — | ⚠ **G-3** deferred |
| Daily Quests | — | ⚠ **G-4** deferred |
| Achievements | — | ⚠ **G-5** deferred |
| Spin-the-Wheel | — | ⚠ **G-6** deferred |
| Zip Leaderboard | — | ⚠ deferred (lumped into G-3/G-5 cluster) |
| Order History | `/dashboard/orders/page.tsx` + `OrderHistoryList` | ⚠ **G-7** missing tracking link |
| Wishlist | `/dashboard/wishlist/page.tsx` + `WishlistList` + `WishlistShareButton` | ✅ functional parity (read + remove + share). Add-from-PDP separate path. |
| Wishlist Alert History | — | ⚠ **G-8** deferred |
| Account Settings | folded into `/dashboard/profile/page.tsx` | ✅ basic parity |
| Address Book | — (profile shows the order-history shipping address only) | ⚠ **G-9** missing |
| Communication Prefs | `/dashboard/preferences/page.tsx` + `PreferencesForm` | ✅ structurally parity; cfw covers challenges/streak/marketing/tier/badges — same 5 categories Wix tracks |
| Returns | — (returns flow lives elsewhere — guest-return path on `/account` per cf-3ldu.1 retooling) | ⚠ **G-10** member-side returns dashboard absent |
| Store Credit Dashboard | — | ⚠ **G-11** deferred |
| Gift Card Dashboard | — (gift cards purchased; redemption is on checkout, not on member page) | ⚠ **G-12** deferred |
| Warranty Section | — | ⚠ deferred (lumped) |

## Findings — implementation gaps inside cfw-shipped scope

### G-7 (P1) — Order history is missing per-order tracking deep-link
**Where:** `src/components/member/OrderHistoryList.tsx` and `src/lib/wix/orders.ts#MemberOrderSummary`.

**Wix behavior:** Member Page.js `initOrderHistory` (line 828) renders a per-order row with a "Track shipment" link that points at `/track-order?n=<orderNumber>&e=<email>` or similar. cfw `OrderHistoryList` renders order date, total, status pills, item count — but no link to the tracking page or guest-return entry.

**Impact:** customer can see "Shipped" status but can't click through to UPS tracking from the member-account page. They have to dig up the shipping-confirmation email. Wix had a one-click path.

**Fix:** add a `Link href={\`/track-order?n=\${order.orderNumber}&e=\${memberEmail}\`}` per row when `status === "shipped"` (or any post-ship status). cfw already has the `/track-order` route per cf-3qt.4 — just wire the link. ~10 LOC + a test asserting the link renders for shipped orders.

**Why P1:** customer-visible regression from Wix behavior. Tracking is the #1 reason customers visit their order history.

### G-9 (P1) — No Address Book page on cfw
**Where:** cfw has no `/dashboard/addresses` route. `/dashboard/profile/page.tsx` shows `member.contact` but doesn't manage shipping-address records.

**Wix behavior:** `initAddressBook` (Member Page.js line 1464) renders a list of saved shipping addresses with add/edit/delete, plus a "default address" selector that pre-fills checkout. Sits in the Wix Members shared addresses bucket.

**Impact:** customer can't save / view / remove shipping addresses on cfw. Checkout will still let them enter one ad-hoc, but they lose the "ship to my office vs ship to my house" toggle they had on Wix.

**Fix options:**
1. Add `/dashboard/addresses/page.tsx` using Wix Headless members.contact.addresses CRUD. ~80-100 LOC + tests.
2. Defer to post-cutover; warn in cf-3qt.8 acceptance that customers will need to re-enter addresses for the first cfw checkout. Less work, worse UX.

**Recommendation:** option 1 before cutover. Member-account dashboards without address management feel half-built.

**Why P1:** transactional-core feature; not gamification/loyalty extra. Customers expect to manage saved addresses where they manage orders.

## Findings — deferred Wix features (P2/P3 follow-up scope)

The 12 gamification / loyalty / warranty / returns-dashboard / store-credit / gift-card-dashboard / wishlist-alert / spin-wheel / leaderboard / challenges / daily-quests / achievements / address-book gaps are documented above as **G-1 through G-12** (excluding the two P1s G-7 + G-9 above). All are *missing-feature gaps* relative to Wix, not regressions of cfw-shipped behavior. cf-3qt.3 acceptance scoped V1 cfw to the transactional core, so these are launch-plan deferrals — not cutover blockers.

**Recommended sequencing:**
- **Pre-cutover:** ship G-7 + G-9 fixes (tracking link + address book).
- **Post-cutover Week 1:** ship G-2 (streak display) + G-1 (loyalty tier display) — high-engagement features whose absence will be noticed first by repeat Wix customers.
- **Post-cutover Month 1:** ship G-3/G-4/G-5 (challenges / daily quests / achievements as one cohesive gamification surface).
- **Post-cutover Month 3:** ship G-10 (returns dashboard) + G-11/G-12 (store credit + gift card dashboards) — lower traffic, more catalog work behind them.
- **Defer indefinitely:** G-6 (spin-the-wheel) — fun mechanic, but cf-3qt cutover doesn't need it day-one.

## Recommended fix beads

- **cf-zn5b.1 (P1)** — Order history tracking link (G-7). ~10 LOC + 1 test. Pre-cutover.
- **cf-zn5b.2 (P1)** — Address book page (G-9). 80-100 LOC + tests. Pre-cutover.
- **cf-zn5b.fu1..fu5 (P2/P3)** — Post-cutover gamification + loyalty + warranty restores per the sequencing above. Stilgar/melania to pick the cadence.

## Pre-cutover acceptance (cf-3qt.8)

- [ ] **G-7** — tracking link wired on `/dashboard/orders` for shipped/post-shipped statuses
- [ ] **G-9** — `/dashboard/addresses` route with add/edit/delete/default
- [ ] Spot-check `/dashboard/preferences` end-to-end against a real loginEmail (cf-w1u1 E2E plan if staging unblocks)

## Out of scope (sibling beads expected)

- **Visual diff** of the dashboard pages — cf-3qt.6.1 screenshot matrix
- **Auth login flow + OAuth round-trip** — cf-3qt.3 already shipped
- **Wishlist add-from-PDP** — separate path, covered by cf-rs9k
- **Order tracking page internals** — covered by `/track-order` route (cf-3qt.4 work)
- **Static pages parity** — cf-7pk0 (miquella)
- **PDP parity** — cf-lc1c (rennala, partly fixed by cf-pdp-g1 #588 + cf-8yt6 #600)

## References

- Wix source: `src/pages/Member Page.js` (1588 LOC) + `src/public/ReturnsPortal.js`, `src/public/SpinWheel.js`, `src/public/StreakDisplay.js`, `src/public/ChallengesDisplay.js`, `src/public/ZipLeaderboardDisplay.js`, `src/public/loyaltyHelpers.js`, `src/public/storeCreditHelpers.js`, `src/public/giftCardHelpers.js`
- cfw source: `src/app/(member)/dashboard/{page,orders,wishlist,preferences,profile}/page.tsx` + `src/components/member/{DashboardShell,OrderHistoryList,WishlistList,WishlistShareButton,PreferencesForm,LogoutButton}.tsx`
- Parent: cf-3qt.6 (Phase 6 parity testing) + sibling cf-lc1c (PDP) + cf-7pk0 (static)
- Cutover gate: cf-3qt.8
