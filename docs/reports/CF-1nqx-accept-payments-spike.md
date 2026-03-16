# CF-1nqx SPIKE: Wire Accept Payments

**Date**: 2026-03-16
**Author**: godfrey
**Status**: Complete

## Executive Summary

Carolina Futons' payment infrastructure is **largely already wired** in Velo code.
The remaining work is **dashboard configuration** (connecting Wix Payments / Stripe / PayPal)
and **verification testing** — not code changes.

## What Already Exists in Code

### Backend Payment Services

| File | Functions | Purpose |
|------|-----------|---------|
| `src/backend/paymentOptions.web.js` | `getPaymentOptions`, `getAfterpayMessage`, `getBatchPaymentBadges`, `getCheckoutPaymentSummary`, `getInstallmentCalculation` | Payment method display, BNPL messaging, financing calculations |
| `src/backend/financingService.web.js` | `calculateMonthlyPayment`, `getFinancingOptions` | Pay-in-4 and 6/12/24/36-month plan calculator |
| `src/backend/checkoutOptimization.web.js` | `calculateOrderSummary`, `validateShippingAddress`, `getShippingOptions` | Order math (tax by state, shipping tiers) |

### Frontend Integration

| File | Purpose |
|------|---------|
| `src/pages/Checkout.js` | Payment method repeater, Afterpay/financing sections, trust signals |
| `src/pages/Thank You Page.js` | Order confirmation, GA4 purchase tracking, gift card finalization |
| `src/public/checkoutValidation.js` | Real-time address field validation |

### Payment Methods Configured in Code

From `paymentOptions.web.js`:
- Credit/Debit cards (Visa, Mastercard, Amex, Discover)
- Apple Pay
- Google Pay
- Afterpay (BNPL: 4 installments, $35-$1,000 range)
- Wix POS / Tap to Pay (in-store)

### Financing Tiers (separate from Afterpay)

| Range | Term | APR |
|-------|------|-----|
| $300-$999 | 6 months | 0% |
| $1,000-$1,999 | 12 months | 0% |
| $2,000-$4,999 | 24 months | 9.99% |
| $5,000-$10,000 | 36 months | 9.99% |

### Test Coverage

- `tests/paymentOptions.test.js` — 150+ tests for payment options, Afterpay/financing boundaries
- `tests/checkoutOptimization.test.js` — Order summary calculations
- `tests/checkout.test.js` — Full checkout flow
- `tests/checkoutValidation.test.js` — Address validation

## What Wix Handles Natively (No Code Needed)

1. **Payment processing**: Wix Payments handles charge/capture/refund — no custom payment API code
2. **PCI compliance**: Wix manages credit card tokenization and PCI DSS compliance
3. **Payment gateway routing**: Wix routes to appropriate PSP based on dashboard config
4. **3D Secure**: Handled automatically by Wix Payments for eligible cards
5. **Order creation**: Payment success triggers order creation in `Stores/Orders` collection

## What Needs Dashboard Configuration

### Priority 1: Connect Payment Provider

**Option A: Wix Payments (Recommended)**
- Dashboard → Settings → Accept Payments → Wix Payments
- Wix Payments is Wix's native PSP, supports all methods listed in code
- Supports Stripe under the hood for card processing
- No separate Stripe account needed

**Option B: Connect Stripe Directly**
- Dashboard → Settings → Accept Payments → Other Payment Providers → Stripe
- Requires existing Stripe account
- More control over payouts/reporting but less integrated

**Option C: PayPal**
- Dashboard → Settings → Accept Payments → PayPal
- Can run alongside Wix Payments as an additional option
- Enables PayPal checkout button

### Priority 2: Enable Payment Methods

After connecting a provider, enable methods in dashboard:
- [ ] Credit/Debit cards (Visa, MC, Amex, Discover)
- [ ] Apple Pay (requires Wix Payments or Stripe)
- [ ] Google Pay (requires Wix Payments or Stripe)
- [ ] PayPal (connect PayPal account separately)
- [ ] Afterpay/Clearpay (enable in Wix Payments settings, US only)
- [ ] Klarna (enable in Wix Payments, limited regions)

### Priority 3: Configure Currencies & Regions

- Dashboard → Settings → Accept Payments → Currency Settings
- Primary: USD
- Regions: US (expand later as needed)

## API Capabilities (Read-Only)

The **Site Payment Method Types API** provides metadata about configured payment methods:

```
POST https://www.wixapis.com/payment-services/v1/payment-method-types/list
```

Returns: method names, icons, descriptions, limits. Useful for verification but not configuration.

**Cashier Pay webhooks** fire on all payment events:
- `payment.event` — triggered for any payment state change
- Can be used to build custom analytics, fraud detection, or accounting integrations

## Plan/Pricing Requirements

| Feature | Free | Business Basic | Business Unlimited | Business VIP |
|---------|------|----------------|-------------------|--------------|
| Accept online payments | No | Yes | Yes | Yes |
| Wix Payments | No | Yes | Yes | Yes |
| Recurring payments | No | No | Yes | Yes |
| Multiple currencies | No | No | Yes | Yes |
| Transaction fee | N/A | 0% | 0% | 0% |

**Requirement**: Site must be on **Business Basic** or higher to accept payments.

## Verification Test Plan

Once dashboard is configured, verify:

1. **Test Purchase Flow**
   - Add product to cart → Checkout → Enter test card → Complete purchase
   - Wix test cards: `4111 1111 1111 1111` (Visa), `5500 0000 0000 0004` (MC)
   - Verify order appears in Dashboard → Orders

2. **Payment Method Rendering**
   - Visit checkout page → Verify all enabled methods show in payment method repeater
   - Test Apple Pay button appears on Safari/iOS
   - Test Google Pay button appears on Chrome

3. **Afterpay Eligibility**
   - Add $50 item → Verify "4 payments of $12.50" messaging
   - Add $25 item → Verify Afterpay section hidden (below $35 min)
   - Add $1,500 item → Verify Afterpay section hidden (above $1,000 max)

4. **Financing Display**
   - Add $500 item → Verify 6-month 0% APR option shown
   - Add $2,000 item → Verify 24-month 9.99% APR option shown

5. **Order Confirmation**
   - Complete test purchase → Verify Thank You Page shows order details
   - Verify GA4 `purchase` event fires with correct values

6. **Refund Flow**
   - Dashboard → Orders → Select test order → Issue refund
   - Verify refund processes through payment provider

## Gaps & Recommendations

### No Code Changes Needed
The codebase is fully wired for payment display and checkout flow. All payment acceptance is handled by Wix's native payment processing.

### Dashboard Actions Required (Melania/Editor Work)
1. Connect Wix Payments (or Stripe) in dashboard
2. Enable desired payment methods
3. Configure Afterpay settings (min/max amounts match code: $35-$1,000)
4. Run verification test plan above

### Future Considerations
- **Sezzle/Affirm**: `financingService.web.js` has placeholder hooks for future BNPL providers
- **International expansion**: Would require enabling multi-currency in Wix Payments
- **Subscription/recurring**: Requires Business Unlimited plan tier
- **Manual payments**: Wire transfer / check options available in dashboard for B2B orders

## Conclusion

CF-1nqx is a **dashboard configuration task**, not a code task. The Velo code for payment display, BNPL messaging, financing calculations, and checkout flow is complete and tested. The blocking action is connecting a payment provider in the Wix dashboard and enabling payment methods.

**Recommendation**: Assign dashboard configuration to an editor-capable agent (melania/miq) and close the code side of this bead.
