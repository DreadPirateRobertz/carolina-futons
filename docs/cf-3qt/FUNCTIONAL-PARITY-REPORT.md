# cf-3qt.6.1 Functional Parity Report

Rendered by `npm run parity:functional` once `LEGACY_BASE` and `NEXT_BASE`
are both set. Until the Next.js preview URL exists, this file is a
placeholder with the contract the report will follow.

## Runs

Each daily Phase-6 run writes one row.

| Date | Commerce | Account | Content | Critical regressions |
|------|----------|---------|---------|----------------------|
| _pending_ | — | — | — | — |

## Suite: commerce

Scenarios: search → PLP → PDP, add-to-cart → cart total, order confirmation
shape parity. Assertions are in `parity/functional/commerce.spec.js`.

Failure modes worth blocking cutover:
- Cart total missing or zero after add-to-cart
- PDP heading does not include the product name
- Order confirmation page returns 404

## Suite: account

Scenarios: login lands on dashboard, order history renders, wishlist
renders. Assertions in `parity/functional/account.spec.js`.

Uses a dedicated `PARITY_TEST_EMAIL` member. Do not run against real
customer accounts.

Failure modes worth blocking cutover:
- Login succeeds on Wix but not on Next (or vice versa)
- Orders table empty on Next when Wix has rows for the same member
- Wishlist count diverges

## Suite: content

Scenarios: blog index → blog post, FAQ expand, contact form submit (with
the `PARITY_CONTACT_BYPASS` flag so submissions never reach the real
inbox). Assertions in `parity/functional/content.spec.js`.

Failure modes worth blocking cutover:
- Blog post 404s on Next when Wix serves it
- Contact form silently fails on Next
- FAQ expand non-functional

## How failures route

1. Any red test files a sub-bead under cf-3qt.6.1 within the same run.
2. radahn nudges the responsible rig (godfrey for commerce, blaidd for
   content, rennala for account) via the usual tmux/nudge path.
3. PR fix re-runs the suite before merge; green run is required to close
   the sub-bead.
