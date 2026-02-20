# STORY-001 Fix Gift Card Code Sanitization Truncation

## Summary
The `sanitize(code, 20)` call in `checkBalance` and `redeemGiftCard` truncates gift card codes to 20 characters, but `generateGiftCardCode()` produces 22-character codes (`CF-XXXX-XXXX-XXXX-XXXX`). This means balance checks and redemptions will never match a card created by `purchaseGiftCard`. The sanitize limit needs to be at least 22.

## Acceptance Criteria
- [ ] `checkBalance` uses `sanitize(code, 30)` instead of `sanitize(code, 20)`
- [ ] `redeemGiftCard` uses `sanitize(code, 30)` instead of `sanitize(code, 20)`
- [ ] Add test: purchase a card, then check its balance using the returned code
- [ ] All existing tests still pass
- [ ] No existing tests broken

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|-------------|
| `src/backend/giftCards.web.js` | MODIFY | Change sanitize limit from 20 to 30 on lines 100 and 151 |
| `tests/giftCards.test.js` | MODIFY | Add round-trip test: purchase then check balance |

## Technical Notes
- The code format is `CF-` + 4 groups of 4 chars separated by `-` = 22 chars total
- `sanitize(str, maxLen)` strips HTML and truncates to maxLen
- This is a data integrity bug — no card created through the API can ever be looked up

## Estimate
- Size: S (1 hour)
- Priority: P0
- Dependencies: none
