# CF-nqb5.2: BNPL Provider Evaluation — Affirm vs Klarna for Carolina Futons

**Date**: 2026-04-04
**AOV Range**: $600–$2,000 (furniture)
**Recommendation**: **Affirm** as primary long-term BNPL provider, **keep Klarna** for pay-in-4

---

## Current State

| Provider | Integration Level | Coverage |
|----------|------------------|----------|
| **Klarna** | Full (klarna-http.js: checkout + confirm API, secrets configured) | Pay-in-4 ($35–$1,000) |
| **Afterpay** | Display only (paymentOptions.web.js) via Wix Payments | Pay-in-4 ($35–$1,000) |
| **Affirm** | Display only (BNPLWidget.js shows "$X/mo" estimate) | None — no API integration |
| **In-house calc** | Full (financingCalc.web.js, financingService.web.js) | 6/12/18/24/36 month terms |

**Gap**: No BNPL provider covers the $1,000–$2,000 range with actual checkout integration. Klarna and Afterpay cap at $1,000 for pay-in-4. The in-house calculator shows estimates but doesn't process payments.

---

## Evaluation Criteria

### 1. Order Value Coverage

| Provider | Pay-in-4 | 6 months | 12 months | 24 months | 36 months |
|----------|----------|----------|-----------|-----------|-----------|
| **Affirm** | $50–$500 | $150–$30K | $150–$30K | $150–$30K | $150–$30K |
| **Klarna** | $35–$1,000 | $200–$10K (limited US availability) | Varies | — | — |

**Winner: Affirm.** Affirm's core product is long-term financing (3–36 months) which matches CF's $600–$2,000 AOV. Klarna's strength is pay-in-4 (short-term, lower AOV).

### 2. Merchant Fees

| Provider | Transaction Fee | Notes |
|----------|----------------|-------|
| **Affirm** | 5.99%–8.99% per transaction | Higher fee, but covers full purchase with 0% APR promos |
| **Klarna** | $0.30 + 3.29%–5.99% per transaction | Lower baseline, but long-term plans less available in US |

Affirm is more expensive per transaction, but the higher approval rates on $1K+ purchases and longer terms offset this for furniture retail.

### 3. Approval Rates (Furniture AOV $600–$2K)

| Provider | Estimated Approval Rate | Notes |
|----------|------------------------|-------|
| **Affirm** | 60–75% | Strong on $500+ purchases, uses soft credit check |
| **Klarna** | 70–85% for pay-in-4, 40–55% for long-term | Pay-in-4 approval is high but caps at $1K |

**Winner: Affirm** for the CF AOV range. Klarna's high approval rate drops significantly above $1K.

### 4. Wix Compatibility

| Provider | Wix Integration Path |
|----------|---------------------|
| **Affirm** | No native Wix plugin. Requires HTTP functions (like current klarna-http.js pattern) + Affirm.js client SDK for checkout widget |
| **Klarna** | Already integrated via klarna-http.js. Wix Payments has basic Klarna support for pay-in-4 |

Both require custom HTTP function integration for full-featured checkout. CF already has the pattern established with klarna-http.js — Affirm integration follows the same architecture.

### 5. Customer Experience

| Factor | Affirm | Klarna |
|--------|--------|--------|
| Checkout flow | Pre-qualification widget on PDP, full approval at checkout | Pay-in-4 widget, or redirect to Klarna checkout |
| Mobile | Good (Affirm.js responsive widget) | Good (Klarna Checkout widget) |
| Brand recognition (US furniture) | High — Affirm is the default BNPL for Wayfair, Pottery Barn, Crate & Barrel | Moderate — stronger in fashion/general retail |

**Winner: Affirm.** US furniture shoppers expect Affirm specifically. "0% APR for 12 months" is a standard furniture retail message that Affirm delivers.

---

## Recommendation

### Primary: Affirm for long-term financing ($200+)

1. **Integrate Affirm Checkout API** via HTTP functions (same pattern as klarna-http.js)
2. **Use Affirm.js** on PDP for real-time pre-qualification ("As low as $X/mo" with actual approval check)
3. **Target 0% APR promotional plans** for 6 and 12 months (merchant-subsidized, standard for furniture)
4. **Replace in-house calculator estimates** with live Affirm pre-qualification data

### Secondary: Keep Klarna pay-in-4 for sub-$1K purchases

1. **Retain klarna-http.js** for orders under $1,000 (accessories, mattress-only, etc.)
2. **Display both options** on PDP: Affirm for monthly financing, Klarna for pay-in-4

### Implementation Sequence

1. Sign Affirm merchant agreement (requires business application — Stilgar/Brenda action)
2. Obtain Affirm API keys (public + private) → Wix Secrets Manager
3. Create `affirm-http.js` mirroring klarna-http.js architecture (checkout + confirm + auth + SSRF guards)
4. Integrate Affirm.js client SDK on PDP for pre-qualification widget
5. Update BNPLWidget.js to show live Affirm pre-qual instead of static estimate
6. A/B test: Affirm-only vs Affirm+Klarna dual display

### Setup Requirements for Stilgar

- [ ] Apply for Affirm merchant account at https://www.affirm.com/business
- [ ] Business info: Carolina Futons LLC, Hendersonville NC, furniture retail
- [ ] Expected AOV: $600–$2,000
- [ ] Desired promotional terms: 0% APR for 6 and 12 months
- [ ] Once approved, add `AFFIRM_PUBLIC_KEY` and `AFFIRM_PRIVATE_KEY` to Wix Secrets Manager

---

## Decision Needed

Stilgar: approve Affirm merchant application before engineering can proceed with API integration. Klarna stays as-is — no action needed.
