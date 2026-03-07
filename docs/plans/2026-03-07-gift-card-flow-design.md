# CF-ic6o: Gift Card Flow — Design

## Status: Approved (autonomous)

## Context

Gift card purchase, balance check, and redemption backend/frontend already exist:
- `src/backend/giftCards.web.js` — purchaseGiftCard, checkBalance, redeemGiftCard, getGiftCardOptions
- `src/public/giftCardHelpers.js` — validation, formatting, display helpers
- `src/pages/Gift Cards.js` — denomination picker, purchase form, balance checker
- `tests/giftCards.test.js` + `tests/giftCardHelpers.test.js` — comprehensive tests

## Missing Pieces

### 1. Email Delivery on Purchase

**Problem:** Purchase success message says "confirmation email sent" but no email is triggered.

**Solution:** Add `sendGiftCardEmails()` to `giftCards.web.js`, called after successful purchase.

- Two emails via `triggeredEmails.emailContact`:
  - `gift_card_purchase_confirmation` to purchaser (confirmation + code)
  - `gift_card_received` to recipient (code + personal message + balance)
- Use `contacts.appendOrCreateContact` to get/create contact IDs for both emails
- Template variables: recipientName, purchaserEmail, code, amount, message, expirationDate

### 2. Checkout Gift Card Application

**Problem:** `redeemGiftCard` backend exists but Checkout page has no gift card UI.

**Solution:** Add gift card code entry section to Checkout, following store credit pattern.

- Manual code entry (not auto-apply — gift cards are code-based, not account-based)
- UI flow: code input + "Apply" button -> validate via `checkBalance` -> show applied amount
- On order completion: call `redeemGiftCard` to deduct balance
- New frontend helpers in `giftCardHelpers.js`: `initCheckoutGiftCard($w, subtotal)`
- Order summary row: `-$XX.XX Gift Card` (mirrors store credit row)

### 3. Member Page Gift Card Dashboard

**Problem:** No gift card visibility on Member Page.

**Solution:** Add gift card section following `initStoreCreditDashboard` pattern.

- New backend method: `getMyGiftCards(email)` returns purchased + received cards
- Display: masked code (last 4 visible), balance, status badge, expiration
- New helper: `initGiftCardDashboard($w)` + `maskGiftCardCode(code)`
- Add to Member Page sections array

## File Changes

| File | Change |
|------|--------|
| `src/backend/giftCards.web.js` | Add `sendGiftCardEmails()`, `getMyGiftCards()` |
| `src/public/giftCardHelpers.js` | Add `initGiftCardDashboard()`, `initCheckoutGiftCard()`, `maskGiftCardCode()` |
| `src/pages/Checkout.js` | Add gift card section to sections array + `initGiftCardSection()` |
| `src/pages/Member Page.js` | Add gift card dashboard to sections array |
| `tests/giftCards.test.js` | Add email + getMyGiftCards tests |
| `tests/giftCardHelpers.test.js` | Add dashboard/checkout/mask helper tests |

## Out of Scope (YAGNI)

- Custom amount gift cards
- Gift card transfer between members
- Physical gift card support
- Gift card analytics dashboard
- Bulk gift card purchase
