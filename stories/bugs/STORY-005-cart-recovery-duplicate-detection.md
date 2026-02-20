# STORY-005 Add Duplicate Detection to Cart Recovery

## Summary
The `cartRecovery.web.js` module's `recordAbandonedCart()` function inserts records without checking if the same `checkoutId` already exists. Webhook events commonly fire multiple times, leading to duplicate abandoned cart records that inflate recovery stats and could trigger multiple recovery emails.

## Acceptance Criteria
- [ ] `recordAbandonedCart()` checks for existing record before inserting
- [ ] Duplicate checkoutId with 'abandoned' status is silently skipped
- [ ] Line items validated before storage (name present, quantity > 0)
- [ ] Add test: duplicate cart event doesn't create second record
- [ ] Add test: invalid line items are filtered out
- [ ] All existing tests still pass

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|-------------|
| `src/backend/cartRecovery.web.js` | MODIFY | Add duplicate check in recordAbandonedCart(), validate line items |
| `tests/cartRecovery.test.js` | MODIFY | Add 2-3 tests for duplicate detection and validation |

## Technical Notes
- Use `wixData.query('AbandonedCarts').eq('checkoutId', id).eq('status', 'abandoned').find()` before insert
- This is a common webhook idempotency issue — standard fix is check-before-insert
- Don't reject carts with zero valid items — just log a warning
- Consider: should recovery stats (`getAbandonedCartStats`) filter duplicates? Currently not an issue if we prevent them at insert time

## Estimate
- Size: S (1-2 hours)
- Priority: P1
- Dependencies: none
