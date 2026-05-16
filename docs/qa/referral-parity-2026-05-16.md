# /referral parity — cfw vs Wix Studio (2026-05-16)

**Bead:** cf-tm1e (P3) — cf-yu2l.referral.fu1
**Parent:** cf-yu2l promo-pages parity audit (2026-05-15)
**Target Wix:** https://www.carolinafutons.com/account/my-account/referral-page
**Target cfw:** `/referral` (component: `src/components/referral/ReferralDashboard.tsx`)

## Public-surface probe

`GET https://www.carolinafutons.com/account/my-account/referral-page` returns 200 with the standard Wix-shell HTML. The actual referral UI is **auth-gated** — visible content from an unauthenticated probe yields only Wix framework strings (`mobileFriendly`, `UsePreferred`) and the global nav (`order-history` as a URL slug elsewhere on the site, not a referral surface).

**Implication:** the 3 parity questions below require a **logged-in visual check by Stilgar / Brenda / millicent** against a Wix member account that has prior referral activity (otherwise even the logged-in view shows empty states that don't reveal whether a surface exists).

## cfw `ReferralDashboard.tsx` contract (verbatim from source)

Three numeric tiles surfaced at lines 106 / 110 / 114:

| Tile | Source field | Display |
|---|---|---|
| Total referrals | `stats.totalReferrals` | integer count |
| Pending rewards | `stats.pendingRewards` | `$N` |
| Earned rewards | `stats.earnedRewards` | `$N` |

No history list. No per-referral attribution. No loyalty-tier surface.

## 3-row parity matrix

| # | Surface | In cfw today? | In Wix? | Action |
|---|---|---|---|---|
| 1 | Redemption history (past rewards earned/spent per referral) | ❌ aggregates only | ❓ DEFERRED — Stilgar visual check required | If Wix has it → file impl bead `cf-tm1e.fu1` per "Redemption history impl" below. If absent → close cf-tm1e as parity OK, note in cf-3qt.6 checklist. |
| 2 | Referred friends list (names / dates of referrals) | ❌ aggregate count only | ❓ DEFERRED — Stilgar visual check required | If Wix has it → file impl bead `cf-tm1e.fu2` per "Friends list impl" below. If absent → close cf-tm1e as parity OK. |
| 3 | Loyalty-tier surface (Bronze/Silver/Gold) | ❌ /loyalty + /rewards are separate routes; /referral has no tier surface | ❓ DEFERRED — Stilgar visual check required; @wix/loyalty SDK does expose tiers | If Wix has it → file impl bead `cf-tm1e.fu3` per "Loyalty tier impl" below. If absent → close cf-tm1e as parity OK. |

## Implementation outlines (only ship if Stilgar confirms presence)

### Redemption history impl (if needed)

`@wix/loyalty.checkoutOptions.listLoyaltyTransactions` (or `listLoyaltyAccounts`) exposes per-account transaction history. Server-render a table in `ReferralDashboard.tsx` below the 3 stat tiles:

| Date | Referral source | Reward | Status |
|---|---|---|---|
| 2026-04-15 | john@example.com | $20 | redeemed |

3 columns minimum. Pagination at 10/page once history exceeds it.

### Friends list impl (if needed)

`@wix/loyalty.referrals` (if exposed) or the underlying Wix Referrals API. Surface a list:

| Friend name | Joined | Reward earned |

Privacy: show first name + last initial only ("John S.") to match Wix's standard referral-list display per their privacy template. NEVER full email or phone.

### Loyalty tier impl (if needed)

`@wix/loyalty.tiers.listTiers` returns the configured Bronze/Silver/Gold tiers. Add a tier badge above the 3 stat tiles:

```
[ Silver tier — 2 more referrals to Gold ]
```

Single-line summary; deeper tier UI lives on `/loyalty` if it exists separately.

## Why P3

No live impact today — cfw `/referral` works for the 3 surfaces it ships. Risk is silent feature regression at the cf-3qt.6 Wix-retirement cutover: if Stilgar's email campaigns deep-link to "View your referral history" and that surface only exists on Wix, the post-cutover experience loses the link target.

15-min Stilgar visual check + this matrix = either a closed bead (parity OK) or a precisely-scoped impl bead per row.

## What this DOES NOT cover

- **Authenticated probe** — I'd need a Wix member-account credential to inspect the real referral surface. Out of scope for autonomous audit.
- **Wix API call shape** — implementation outlines are based on `@wix/loyalty` SDK structure; actual field names should be verified against the SDK before impl ships.
- **Mobile referral surface** — the existing audit assumed desktop parity; if Wix has a different mobile referral UX, that's a separate row.

## Refs

- Bead: cf-tm1e
- Parent audit: `docs/qa/promo-pages-parity-2026-05-15.md` (cf-yu2l)
- Component: `src/components/referral/ReferralDashboard.tsx`
- Wix SDK: `@wix/loyalty`
- Standing order: cf-ukc6 (doc-only deliverable, no cfw build cost)
