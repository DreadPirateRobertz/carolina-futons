# CF-bpvo: Member Page Order History & Tracking

**Bead:** CF-bpvo (P2, task)
**Date:** 2026-03-07
**Branch:** cf-bpvo-order-history

## Problem

`initOrderHistory()` in `Member Page.js` configures repeater item rendering but never loads data from the backend. The `#ordersRepeater` remains empty. No pagination, loading states, empty states, delivery status integration, or status filtering exist.

## Backend (Already Built)

All needed backend methods exist in `accountDashboard.web.js`:
- `getOrderHistory({ page, pageSize, sortField, sortDir })` — paginated orders with lineItems, trackingNumber, status
- `getActiveDeliveries()` — in-flight deliveries with estimatedDelivery, status, trackingNumber
- `getAccountSummary()` — memberEmail (needed for tracking page link)
- `getReorderItems(orderId)` — line items for re-ordering

`orderTracking.web.js` has `lookupOrder` and `getTrackingTimeline` — used by the standalone Order Tracking page. Not needed here; we link to that page instead.

## Data Flow

```
initOrderHistory()
  ├── getOrderHistory({ page: 1 })  →  orders[]
  ├── getActiveDeliveries()          →  deliveries[]
  └── merge: match deliveries to orders by orderId
        → enriched orders with estimatedDelivery + live status
        → set #ordersRepeater.data
```

Load More: `getOrderHistory({ page: N+1 })` → append to existing repeater data.
Filter: `getOrderHistory({ page: 1 })` with client-side status filter on results.

Note: `getOrderHistory` doesn't support server-side status filtering, so we filter client-side from the full page of results. This is acceptable since page size is 10.

## Order Card Elements

**Existing** (already wired in `onItemReady`):
- `#orderNumber` — "Order #1234"
- `#orderDate` — formatted date
- `#orderTotal` — "$1,299.00"
- `#orderStatusBadge` — color-coded fulfillment status
- `#orderTrackBtn` — navigate to tracking page
- `#orderReorderBtn` — add all line items to cart
- `#orderStartReturnBtn` — scroll to returns section
- `#orderItemsGallery` — thumbnail strip

**New elements to populate** (must exist in Wix Studio editor):
- `#orderDeliveryEta` — "Est. delivery: Thursday, March 12" or "Delivered March 5"
- `#orderItemCount` — "3 items"

## New UI States

| Element | Purpose |
|---------|---------|
| `#ordersLoader` | Loading skeleton shown during fetch |
| `#ordersEmpty` | "No orders yet" with shop CTA |
| `#ordersError` | Error message with retry button |
| `#ordersLoadMoreBtn` | Pagination — "Load More Orders" |
| `#orderFilterDropdown` | Status filter: All / Processing / Shipped / Delivered / Cancelled |

## Changes to initOrderHistory()

1. Show `#ordersLoader`, collapse repeater
2. Call `getOrderHistory({ page: 1 })` + `getActiveDeliveries()` in parallel
3. Merge delivery data into orders via `mergeDeliveryStatus()`
4. If no orders → show `#ordersEmpty`, hide loader, return
5. Set `ordersRepeater.data`, hide loader, expand repeater
6. If `hasNext` → show `#ordersLoadMoreBtn`
7. Wire filter dropdown → re-fetch page 1, apply client-side filter
8. Wire Load More → fetch next page, append

### Track button enhancement
Currently hides if no `shippingInfo.trackingNumber`. Will also check merged delivery data for trackingNumber. Link format: `/tracking?order=ORDER_NUM&email=MEMBER_EMAIL` (email from `currentMember.loginEmail`).

### Reorder button enhancement
Use `getReorderItems(orderId)` via `accountDashboard.web.js` instead of reading `itemData.lineItems` directly — ensures backend ownership verification.

## MemberPageHelpers — New Functions

```js
// Merge active delivery status into order list
mergeDeliveryStatus(orders, deliveries)
// Returns orders[] with added: deliveryEta, deliveryTier, liveStatus

// Format estimated delivery date
formatDeliveryEstimate(dateValue)
// → "Thursday, March 12" | ""

// Format item count
formatItemCount(count)
// → "1 item" | "3 items"

// Status filter dropdown options
getOrderFilterOptions()
// → [{ label: 'All Orders', value: 'all' }, ...]

// Client-side status filter
filterOrdersByStatus(orders, statusFilter)
// → filtered orders[] (passthrough if 'all')

// Build tracking page URL
buildTrackingUrl(orderNumber, email)
// → "/tracking?order=XXX&email=YYY"
```

## Error Handling

- Backend fetch fails → show `#ordersError` with message + retry button, hide loader
- Load More fails → re-enable button with "Retry" label, keep existing data visible
- Individual card render → existing try/catch pattern (skip broken card)
- No delivery match for an order → order keeps its static `fulfillmentStatus`, no ETA shown

## Test Plan

**MemberPageHelpers.test.js** (new helper tests):
- `mergeDeliveryStatus`: matching, no match, empty arrays, duplicate orderId
- `formatDeliveryEstimate`: valid date, null, invalid, past dates
- `formatItemCount`: 0, 1, 5, negative
- `getOrderFilterOptions`: returns expected options array
- `filterOrdersByStatus`: each status, 'all' passthrough, empty array, unknown status
- `buildTrackingUrl`: normal, missing email, missing order number, XSS in inputs

**MemberPage.orderHistory.test.js** (integration):
- Loads orders on init, populates repeater
- Shows empty state when no orders
- Shows error state on backend failure
- Pagination: Load More appends, hides when no more pages
- Filter: changes repeater data, resets pagination
- Track button: visible/hidden based on tracking info, correct URL
- Reorder button: calls backend, shows feedback
- Return button: hidden for Cancelled orders
- Delivery ETA: shown when delivery data exists, hidden otherwise
- Loading state: shown during fetch, hidden after

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Member Page.js` | Rewrite `initOrderHistory()` — load data, pagination, filter, states |
| `src/public/MemberPageHelpers.js` | Add 6 new pure functions |
| `tests/MemberPageHelpers.test.js` | Add tests for new helpers |
| `tests/MemberPage.orderHistory.test.js` | New file — integration tests |
