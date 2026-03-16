# Feature Roadmap — Tier 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all 8 Tier 1 features to the Wix Studio staging site, completing the purchase decision funnel before go-live.

**Architecture:** All backend modules, page controllers, and public helpers already exist and are tested (16,658+ tests). The work is hookup — verifying existing code, filling test gaps, and wiring page elements to backend functions via Velo. Editor-dependent tasks are marked `[EDITOR]` and blocked until login is restored.

**Tech Stack:** Wix Studio + Wix Velo (JavaScript), UPS REST API, Vitest, GitHub CI/CD

**Spec:** `docs/superpowers/specs/2026-03-16-feature-roadmap-design.md`

**Split** (per radahn feedback): Tier 1A = minimum viable (Search, Delivery Estimator, Assembly Guide). Tier 1B = before public launch (Delivery Scheduling, Cart Recovery, Order Tracking, Returns, Reviews).

---

## Chunk 1: Quick Win + Search Foundation

### Task 1: Assembly Guide on PDP (Quick Win — Tier 1A)

**Files:**
- Verify: `src/backend/assemblyGuides.web.js`
- Verify: `src/pages/Assembly Guides.js`
- Test: `tests/assemblyGuides.test.js`, `tests/assemblyGuidesHandlers.test.js`, `tests/assemblyGuidesPage.test.js`
- Create: `tests/assemblyGuidesPDP.integration.test.js`

All paths relative to `/Users/hal/gt/cfutons/refinery/rig/`

- [ ] **Step 1: Run existing assembly guide tests**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/assemblyGuides.test.js tests/assemblyGuidesHandlers.test.js tests/assemblyGuidesPage.test.js`
Expected: All PASS

- [ ] **Step 2: Write PDP integration test — guide lookup by SKU**

```javascript
// tests/assemblyGuidesPDP.integration.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Wix modules
vi.mock('wix-data', () => ({
  default: { query: vi.fn() }
}));

import { getAssemblyGuide, getCareTips } from '../src/backend/assemblyGuides.web.js';

describe('Assembly Guide on PDP', () => {
  describe('getAssemblyGuide', () => {
    it('returns guide for valid SKU', async () => {
      const guide = await getAssemblyGuide('MURPHY-CUBE-001');
      expect(guide).toHaveProperty('difficulty');
      expect(guide).toHaveProperty('estimatedTime');
      expect(guide).toHaveProperty('steps');
      expect(['Easy', 'Medium', 'Hard']).toContain(guide.difficulty);
    });

    it('returns null for unknown SKU', async () => {
      const guide = await getAssemblyGuide('NONEXISTENT-SKU');
      expect(guide).toBeNull();
    });

    it('returns guide with valid estimated time', async () => {
      const guide = await getAssemblyGuide('MURPHY-CUBE-001');
      if (guide) {
        expect(guide.estimatedTime).toBeGreaterThan(0);
        expect(guide.estimatedTime).toBeLessThanOrEqual(180); // max 3 hours
      }
    });
  });

  describe('getCareTips', () => {
    it('returns care tips for product category', async () => {
      const tips = await getCareTips('futon-frames');
      expect(Array.isArray(tips)).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Run PDP integration test to verify it fails**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/assemblyGuidesPDP.integration.test.js`
Expected: FAIL (mock setup may need adjustment based on existing patterns)

- [ ] **Step 4: Fix test mocks to match existing patterns**

Read `tests/assemblyGuides.test.js` to understand the mock setup pattern, then update the integration test to match.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/assemblyGuidesPDP.integration.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add tests/assemblyGuidesPDP.integration.test.js
git commit -m "test: add assembly guide PDP integration tests"
```

- [ ] **Step 7: [EDITOR] Wire assembly badge to Product Page**

When editor access is restored:
1. Add text element to Product Page below product description
2. Set nickname: `assemblyBadge`
3. Add link element: `assemblyGuideLink`
4. In `Product Page.js`, add:

```javascript
import { getAssemblyGuide } from 'backend/assemblyGuides.web.js';

// In $w.onReady():
const sku = $w('#productPage1').getProduct().sku;
const guide = await getAssemblyGuide(sku);
if (guide) {
  $w('#assemblyBadge').text = `Assembly: ${guide.difficulty} | ~${guide.estimatedTime} min`;
  $w('#assemblyGuideLink').link = `/assembly-guides?sku=${sku}`;
  $w('#assemblyBadge').show();
  $w('#assemblyGuideLink').show();
} else {
  $w('#assemblyBadge').hide();
  $w('#assemblyGuideLink').hide();
}
```

**Acceptance Criteria:**
- Product Page shows "Assembly: Easy/Medium | ~30 min" badge
- Link to full assembly guide page
- Guide loads correct instructions by product SKU

---

### Task 2: Search — Backend Verification (Tier 1A)

**Files:**
- Verify: `src/backend/searchService.web.js`
- Verify: `src/backend/categorySearch.web.js`
- Verify: `src/public/categoryFilterHelpers.js`
- Verify: `src/pages/Search Results.js`
- Verify: `src/pages/Category Page.js`
- Test: `tests/searchService.test.js`, `tests/categorySearch.test.js`, `tests/categoryFilterHelpers.test.js`
- Create: `tests/searchIntegration.test.js`

- [ ] **Step 1: Run all existing search tests**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/searchService.test.js tests/categorySearch.test.js tests/categoryFilterHelpers.test.js`
Expected: All PASS

- [ ] **Step 2: Read search page controllers to understand wiring needs**

Read: `src/pages/Search Results.js` and `src/pages/Category Page.js`
Document: Which `$w` elements are referenced (IDs/nicknames needed in editor)

- [ ] **Step 3: Write search integration test — full-text + autocomplete + zero results**

```javascript
// tests/searchIntegration.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-data', () => ({
  default: { query: vi.fn() }
}));

import { searchProducts, fullTextSearch, getAutocompleteSuggestions, getPopularSearches } from '../src/backend/searchService.web.js';
import { getFilterValues } from '../src/backend/searchService.web.js';

describe('Search Integration', () => {
  describe('fullTextSearch', () => {
    it('returns results for matching query', async () => {
      const results = await fullTextSearch('futon');
      expect(results).toHaveProperty('items');
      expect(results).toHaveProperty('totalCount');
    });

    it('returns empty results for nonsense query', async () => {
      const results = await fullTextSearch('xyznonexistent123');
      expect(results.items).toHaveLength(0);
      expect(results.totalCount).toBe(0);
    });
  });

  describe('getAutocompleteSuggestions', () => {
    it('returns suggestions after 2+ characters', async () => {
      const suggestions = await getAutocompleteSuggestions('fu');
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('returns empty for 1 character', async () => {
      const suggestions = await getAutocompleteSuggestions('f');
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('getFilterValues', () => {
    it('returns available filter options', async () => {
      const filters = await getFilterValues();
      expect(filters).toHaveProperty('categories');
      expect(filters).toHaveProperty('priceRanges');
    });
  });

  describe('pagination', () => {
    it('returns paginated results with limit', async () => {
      const results = await searchProducts({ query: 'bed', limit: 10, offset: 0 });
      expect(results.items.length).toBeLessThanOrEqual(10);
    });
  });
});
```

- [ ] **Step 4: Run integration test**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/searchIntegration.test.js`
Expected: FAIL initially, fix mocks to match existing patterns

- [ ] **Step 5: Fix mocks and verify pass**

Read existing `tests/searchService.test.js` for mock patterns. Update integration test accordingly.

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/searchIntegration.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add tests/searchIntegration.test.js
git commit -m "test: add search integration tests (full-text, autocomplete, pagination)"
```

- [ ] **Step 7: Document element IDs needed for editor hookup**

Create a hookup checklist documenting which `$w` elements the Search Results and Category Page controllers reference. This feeds the editor wiring task.

- [ ] **Step 8: [EDITOR] Wire search elements**

When editor access is restored:
1. Header search input: nickname `searchInput`
2. Search Results page: wire `repeater1` to display results
3. Category Page: wire filter sidebar elements
4. See page controller source for exact element IDs

**Acceptance Criteria:**
- Full-text search returns relevant products ranked by relevance
- Autocomplete shows suggestions after 2+ characters typed
- Zero results page shows "No products found" + suggested categories
- Category Page filters work (price range, material, size)
- 10 results per page with pagination

---

## Chunk 2: Delivery Features

### Task 3: Delivery Estimator (Tier 1A)

**Files:**
- Verify: `src/backend/deliveryExperience.web.js`
- Verify: `src/backend/deliveryScheduling.web.js`
- Verify: `src/public/cartDeliveryEstimate.js`
- Test: `tests/deliveryExperience.test.js`, `tests/deliveryScheduling.test.js`, `tests/cartDeliveryEstimate.test.js`
- Create: `tests/deliveryEstimator.integration.test.js`

- [ ] **Step 1: Run existing delivery tests**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/deliveryExperience.test.js tests/deliveryScheduling.test.js tests/cartDeliveryEstimate.test.js`
Expected: All PASS

- [ ] **Step 2: Read delivery modules to understand zip-to-zone mapping**

Read: `src/backend/deliveryExperience.web.js` — find `getDeliveryStatus` and any zip code validation
Read: `src/public/cartDeliveryEstimate.js` — find `initCartDeliveryEstimate`

- [ ] **Step 3: Write delivery estimator integration test**

```javascript
// tests/deliveryEstimator.integration.test.js
import { describe, it, expect, vi } from 'vitest';

vi.mock('wix-data', () => ({ default: { query: vi.fn() } }));
vi.mock('wix-fetch', () => ({ default: { fetch: vi.fn() } }));

import { getDeliveryStatus } from '../src/backend/deliveryExperience.web.js';
import { getAvailableDeliverySlots } from '../src/backend/deliveryScheduling.web.js';
import { formatDeliveryLabel } from '../src/public/cartDeliveryEstimate.js';

describe('Delivery Estimator Integration', () => {
  describe('formatDeliveryLabel', () => {
    it('formats delivery date range', () => {
      const label = formatDeliveryLabel({
        minDays: 5,
        maxDays: 10,
        method: 'standard'
      });
      expect(label).toContain('business days');
    });

    it('handles express delivery', () => {
      const label = formatDeliveryLabel({
        minDays: 2,
        maxDays: 3,
        method: 'express'
      });
      expect(label).toBeTruthy();
    });
  });

  describe('zip code validation', () => {
    it('handles valid US zip code', async () => {
      const slots = await getAvailableDeliverySlots({ zipCode: '28792' });
      expect(slots).toBeDefined();
    });

    it('handles invalid zip code gracefully', async () => {
      const slots = await getAvailableDeliverySlots({ zipCode: '00000' });
      // Should not throw, should return empty or error object
      expect(slots).toBeDefined();
    });
  });
});
```

- [ ] **Step 4: Run and fix integration test**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/deliveryEstimator.integration.test.js`
Fix mocks based on existing test patterns.

- [ ] **Step 5: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add tests/deliveryEstimator.integration.test.js
git commit -m "test: add delivery estimator integration tests"
```

- [ ] **Step 6: [EDITOR] Wire zip code input on Product Page**

When editor access is restored:
1. Add text input element below price on Product Page: nickname `zipCodeInput`
2. Add text element: nickname `deliveryEstimateText`
3. Add button: nickname `estimateDeliveryBtn`
4. Wire to `getAvailableDeliverySlots({ zipCode })` on button click
5. Display formatted result via `formatDeliveryLabel()`

- [ ] **Step 7: [EDITOR] Wire delivery estimate in Cart**

1. Add zip code input to Cart page: nickname `cartZipInput`
2. Add delivery estimate display: nickname `cartDeliveryEstimate`
3. Wire `initCartDeliveryEstimate()` in Cart page controller

**Acceptance Criteria:**
- Zip code input on Product Page shows estimated delivery date
- Cart page shows delivery estimate for all items
- Estimates reflect real UPS zone data + processing time
- "Delivery estimate unavailable" fallback for invalid/unsupported zips

---

### Task 4: Delivery Scheduling (Tier 1B)

**Files:**
- Verify: `src/backend/deliveryScheduling.web.js`
- Test: `tests/deliveryScheduling.test.js`
- Create: `tests/deliveryScheduling.integration.test.js`

- [ ] **Step 1: Verify existing scheduling tests pass**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/deliveryScheduling.test.js`
Expected: PASS

- [ ] **Step 2: Read scheduling module for slot booking logic**

Read: `src/backend/deliveryScheduling.web.js` — understand `bookDeliverySlot`, `cancelDeliverySlot`, appointment slots, liftgate/white-glove options

- [ ] **Step 3: Write scheduling integration test**

```javascript
// tests/deliveryScheduling.integration.test.js
import { describe, it, expect, vi } from 'vitest';

vi.mock('wix-data', () => ({ default: { query: vi.fn(), insert: vi.fn(), update: vi.fn() } }));

import { getAvailableDeliverySlots, bookDeliverySlot, cancelDeliverySlot } from '../src/backend/deliveryScheduling.web.js';

describe('Delivery Scheduling Integration', () => {
  describe('slot availability', () => {
    it('returns available slots for valid zip', async () => {
      const slots = await getAvailableDeliverySlots({
        zipCode: '28792',
        productIds: ['product-1']
      });
      expect(Array.isArray(slots)).toBe(true);
    });

    it('includes AM/PM windows', async () => {
      const slots = await getAvailableDeliverySlots({
        zipCode: '28792',
        productIds: ['product-1']
      });
      if (slots.length > 0) {
        expect(slots[0]).toHaveProperty('date');
        expect(slots[0]).toHaveProperty('window');
      }
    });
  });

  describe('booking', () => {
    it('books a slot and returns confirmation', async () => {
      const booking = await bookDeliverySlot({
        slotId: 'slot-1',
        orderId: 'order-1',
        options: { liftgate: false, whiteGlove: false }
      });
      expect(booking).toHaveProperty('confirmationId');
    });

    it('rejects double-booking same slot', async () => {
      await bookDeliverySlot({ slotId: 'slot-1', orderId: 'order-1' });
      await expect(
        bookDeliverySlot({ slotId: 'slot-1', orderId: 'order-2' })
      ).rejects.toThrow();
    });
  });

  describe('cancellation', () => {
    it('cancels a booked slot', async () => {
      const result = await cancelDeliverySlot({ bookingId: 'booking-1' });
      expect(result).toHaveProperty('cancelled', true);
    });
  });
});
```

- [ ] **Step 4: Run and fix integration test**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/deliveryScheduling.integration.test.js`

- [ ] **Step 5: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add tests/deliveryScheduling.integration.test.js
git commit -m "test: add delivery scheduling integration tests (slots, booking, cancellation)"
```

- [ ] **Step 6: [EDITOR] Add scheduling widget to Checkout**

When editor access is restored:
1. Add date picker to Checkout page: nickname `deliveryDatePicker`
2. Add AM/PM radio buttons: nickname `deliveryWindowSelector`
3. Add liftgate checkbox: nickname `liftgateCheckbox`
4. Add white glove checkbox: nickname `whiteGloveCheckbox`
5. Wire to `getAvailableDeliverySlots()` + `bookDeliverySlot()` in Checkout controller

**Acceptance Criteria:**
- Checkout shows available delivery windows (date + AM/PM)
- Liftgate and white glove options displayed with pricing
- Customer receives confirmation email with scheduled window
- Admin can view/modify scheduled deliveries

---

## Chunk 3: Email + Order Management

### Task 5: Cart Recovery + Email Automation (Tier 1B)

**Files:**
- Verify: `src/backend/cartRecovery.web.js`
- Verify: `src/backend/browseAbandonment.web.js`
- Verify: `src/backend/emailAutomation.web.js`
- Verify: `src/backend/emailTemplates.web.js`
- Verify: `src/backend/emailService.web.js`
- Test: `tests/cartRecovery.test.js`, `tests/browseAbandonment.test.js`, `tests/emailAutomation.test.js`, `tests/emailAutomation.integration.test.js`, `tests/emailService.test.js`
- Create: `tests/cartRecoveryFlow.integration.test.js`

- [ ] **Step 1: Run all existing email/cart recovery tests**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/cartRecovery.test.js tests/browseAbandonment.test.js tests/emailAutomation.test.js tests/emailAutomation.integration.test.js tests/emailService.test.js`
Expected: All PASS

- [ ] **Step 2: Write cart recovery flow integration test**

```javascript
// tests/cartRecoveryFlow.integration.test.js
import { describe, it, expect, vi } from 'vitest';

vi.mock('wix-data', () => ({ default: { query: vi.fn(), insert: vi.fn(), update: vi.fn() } }));
vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailMember: vi.fn().mockResolvedValue({ accepted: true }) }
}));

import { wixEcom_onAbandonedCheckoutCreated, getAbandonedCartStats } from '../src/backend/cartRecovery.web.js';
import { triggerCartRecoverySequence, getUnsubscribeStatus } from '../src/backend/emailAutomation.web.js';
import { renderTemplate } from '../src/backend/emailTemplates.web.js';

describe('Cart Recovery Flow', () => {
  describe('abandoned checkout event', () => {
    it('creates recovery record on checkout abandonment', async () => {
      const event = {
        abandonedCheckoutId: 'checkout-1',
        buyerInfo: { email: 'test@example.com' },
        lineItems: [{ name: 'Murphy Cube', price: 1898 }]
      };
      const result = await wixEcom_onAbandonedCheckoutCreated(event);
      expect(result).toBeDefined();
    });
  });

  describe('recovery email', () => {
    it('sends recovery email with cart contents', async () => {
      const result = await triggerCartRecoverySequence({
        email: 'test@example.com',
        cartItems: [{ name: 'Murphy Cube', price: 1898, imageUrl: 'https://example.com/img.jpg' }],
        discountCode: 'COMEBACK15'
      });
      expect(result).toBeDefined();
    });

    it('respects unsubscribe status', async () => {
      const status = await getUnsubscribeStatus('test@example.com');
      expect(status).toHaveProperty('unsubscribed');
    });
  });

  describe('email template rendering', () => {
    it('renders cart recovery template with product data', () => {
      const html = renderTemplate('cart-recovery', {
        customerName: 'Test User',
        cartItems: [{ name: 'Murphy Cube', price: '$1,898.00' }],
        discountCode: 'COMEBACK15'
      });
      expect(html).toContain('Murphy Cube');
      expect(html).toContain('COMEBACK15');
    });
  });

  describe('stats', () => {
    it('returns abandonment statistics', async () => {
      const stats = await getAbandonedCartStats();
      expect(stats).toHaveProperty('totalAbandoned');
      expect(stats).toHaveProperty('recovered');
      expect(stats).toHaveProperty('recoveryRate');
    });
  });
});
```

- [ ] **Step 3: Run and fix integration test**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/cartRecoveryFlow.integration.test.js`

- [ ] **Step 4: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add tests/cartRecoveryFlow.integration.test.js
git commit -m "test: add cart recovery flow integration tests"
```

- [ ] **Step 5: [EDITOR/CONFIG] Enable Wix Triggered Emails**

Prerequisite configuration (needs site owner access):
1. Install Wix Triggered Emails app on staging site
2. Configure SPF/DKIM on carolinafutons.com domain
3. Create email templates in Wix dashboard:
   - Cart Recovery (1 hour delay)
   - Welcome Series (immediate)
   - Post-Purchase Care (3 days after delivery)
4. Wire `wixEcom_onAbandonedCheckoutCreated` event handler in backend

**Acceptance Criteria:**
- Abandoned cart email sends 1 hour after checkout abandonment
- Email includes cart contents, images, and "Complete Purchase" CTA
- Welcome email sends within 5 minutes of member signup
- Unsubscribe link works in all automated emails
- Email stats dashboard shows send/open/click rates

---

### Task 6: Order Tracking (Tier 1B)

**Files:**
- Verify: `src/backend/orderTracking.web.js`
- Verify: `src/pages/Order Tracking.js`
- Test: `tests/orderTracking.test.js`
- Create: `tests/orderTrackingFlow.integration.test.js`

- [ ] **Step 1: Run existing order tracking tests**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/orderTracking.test.js`
Expected: PASS

- [ ] **Step 2: Read page controller for element ID requirements**

Read: `src/pages/Order Tracking.js` — document all `$w` element references

- [ ] **Step 3: Write order tracking flow test**

```javascript
// tests/orderTrackingFlow.integration.test.js
import { describe, it, expect, vi } from 'vitest';

vi.mock('wix-data', () => ({ default: { query: vi.fn(), insert: vi.fn() } }));
vi.mock('wix-fetch', () => ({ default: { fetch: vi.fn() } }));

import { lookupOrder, getTrackingTimeline, subscribeToNotifications } from '../src/backend/orderTracking.web.js';

describe('Order Tracking Flow', () => {
  describe('order lookup', () => {
    it('finds order by number + email', async () => {
      const order = await lookupOrder({
        orderNumber: '10001',
        email: 'customer@example.com'
      });
      expect(order).toBeDefined();
    });

    it('returns null for wrong email', async () => {
      const order = await lookupOrder({
        orderNumber: '10001',
        email: 'wrong@example.com'
      });
      expect(order).toBeNull();
    });

    it('does not require login', async () => {
      // lookupOrder uses order number + email, not session auth
      const order = await lookupOrder({
        orderNumber: '10001',
        email: 'customer@example.com'
      });
      // Should work without member context
      expect(order).toBeDefined();
    });
  });

  describe('tracking timeline', () => {
    it('returns ordered timeline events', async () => {
      const timeline = await getTrackingTimeline('order-1');
      expect(Array.isArray(timeline)).toBe(true);
      if (timeline.length > 0) {
        expect(timeline[0]).toHaveProperty('status');
        expect(timeline[0]).toHaveProperty('timestamp');
      }
    });
  });

  describe('notifications', () => {
    it('subscribes to tracking updates', async () => {
      const result = await subscribeToNotifications({
        orderId: 'order-1',
        email: 'customer@example.com'
      });
      expect(result).toHaveProperty('subscribed', true);
    });
  });
});
```

- [ ] **Step 4: Run and fix test**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/orderTrackingFlow.integration.test.js`

- [ ] **Step 5: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add tests/orderTrackingFlow.integration.test.js
git commit -m "test: add order tracking flow integration tests"
```

- [ ] **Step 6: [EDITOR] Create Order Tracking page**

When editor access is restored:
1. Create new page: "Order Tracking" (slug: `/order-tracking`)
2. Add elements per `src/pages/Order Tracking.js` controller requirements:
   - Order number input: `orderNumberInput`
   - Email input: `emailInput`
   - Lookup button: `trackOrderBtn`
   - Timeline container: `trackingTimeline`
   - Status text: `orderStatusText`
   - UPS tracking link: `upsTrackingLink`
   - Notification opt-in checkbox: `notifyCheckbox`
3. Connect page controller via Velo

**Acceptance Criteria:**
- Lookup by order number + email (no login required)
- Visual timeline: Ordered → Processing → Shipped → Delivered
- UPS tracking number linked to UPS tracking page
- Email notification opt-in for status changes

---

## Chunk 4: Returns + Reviews

### Task 7: Returns Portal (Tier 1B)

**Files:**
- Verify: `src/backend/returnsService.web.js`
- Verify: `src/pages/Returns.js`
- Verify: `src/pages/Admin Returns.js`
- Test: `tests/returnsService.test.js`, `tests/returnsServiceExtended.test.js`
- Create: `tests/returnsFlow.integration.test.js`

- [ ] **Step 1: Run existing returns tests**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/returnsService.test.js tests/returnsServiceExtended.test.js`
Expected: All PASS

- [ ] **Step 2: Read returns page controllers**

Read: `src/pages/Returns.js` and `src/pages/Admin Returns.js`
Document all `$w` element references and admin role-check pattern.

- [ ] **Step 3: Write returns flow integration test**

```javascript
// tests/returnsFlow.integration.test.js
import { describe, it, expect, vi } from 'vitest';

vi.mock('wix-data', () => ({ default: { query: vi.fn(), insert: vi.fn(), update: vi.fn() } }));

import {
  getReturnEligibleOrders,
  submitReturnRequest,
  getReturnStatus,
  lookupReturn,
  submitGuestReturn,
  getReturnReasons,
  generateReturnLabel,
  getAdminReturns,
  updateReturnStatus,
  processRefund
} from '../src/backend/returnsService.web.js';

describe('Returns Flow', () => {
  describe('customer return initiation', () => {
    it('lists eligible orders within 30-day window', async () => {
      const orders = await getReturnEligibleOrders('member-1');
      expect(Array.isArray(orders)).toBe(true);
    });

    it('submits return request with reason', async () => {
      const result = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'item-1', quantity: 1, reason: 'not-as-described' }]
      });
      expect(result).toHaveProperty('rmaNumber');
    });

    it('shows 10% restocking fee', async () => {
      const result = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'item-1', quantity: 1, reason: 'changed-mind' }]
      });
      expect(result).toHaveProperty('restockingFee');
      expect(result.restockingFee).toBeGreaterThan(0);
    });
  });

  describe('guest returns', () => {
    it('allows return without login via order number + email', async () => {
      const result = await submitGuestReturn({
        orderNumber: '10001',
        email: 'guest@example.com',
        items: [{ lineItemId: 'item-1', quantity: 1, reason: 'defective' }]
      });
      expect(result).toHaveProperty('rmaNumber');
    });
  });

  describe('return label', () => {
    it('generates downloadable return label', async () => {
      const label = await generateReturnLabel('rma-001');
      expect(label).toHaveProperty('labelUrl');
    });
  });

  describe('admin dashboard', () => {
    it('lists all returns with status filters', async () => {
      const returns = await getAdminReturns({ status: 'pending' });
      expect(returns).toHaveProperty('items');
      expect(returns).toHaveProperty('totalCount');
    });

    it('updates return status', async () => {
      const result = await updateReturnStatus('return-1', 'approved');
      expect(result).toHaveProperty('status', 'approved');
    });

    it('processes refund', async () => {
      const result = await processRefund('return-1');
      expect(result).toHaveProperty('refundId');
    });
  });
});
```

- [ ] **Step 4: Run and fix test**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/returnsFlow.integration.test.js`

- [ ] **Step 5: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add tests/returnsFlow.integration.test.js
git commit -m "test: add returns flow integration tests (customer, guest, admin)"
```

- [ ] **Step 6: [EDITOR] Create Returns + Admin Returns pages**

When editor access is restored:
1. Create "Returns" page (slug: `/returns`) — public access
   - RMA lookup form: `rmaLookupInput`, `lookupBtn`
   - Guest return form: `orderNumberInput`, `guestEmailInput`, `guestReturnBtn`
   - Return submission: reason dropdown, item selector, submit button
   - Restocking fee display: `restockingFeeText`
   - Return label download: `downloadLabelBtn`
2. Create "Admin Returns" page (slug: `/admin-returns`) — admin-only
   - Dashboard: returns list with status filter
   - Detail panel: individual return view
   - Refund modal: process refund button
3. Connect both page controllers via Velo

**Acceptance Criteria:**
- Customer can initiate return within 30 days of delivery
- RMA number generated and emailed
- Return label downloadable (if applicable)
- 10% restocking fee displayed before submission
- Admin dashboard shows all returns with status filters

---

### Task 8: Reviews & Ratings (Tier 1B)

**Files:**
- Verify: `src/backend/productReviews.web.js`
- Verify: `src/backend/reviewsService.web.js`
- Verify: `src/backend/photoReviews.web.js`
- Test: `tests/productReviews.test.js`, `tests/productReviewsBackend.test.js`, `tests/reviewsService.test.js`, `tests/photoReviews.test.js`
- Create: `tests/reviewsFlow.integration.test.js`

- [ ] **Step 1: Run all existing review tests**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/productReviews.test.js tests/productReviewsBackend.test.js tests/reviewsService.test.js tests/photoReviews.test.js`
Expected: All PASS

- [ ] **Step 2: Write reviews flow integration test**

```javascript
// tests/reviewsFlow.integration.test.js
import { describe, it, expect, vi } from 'vitest';

vi.mock('wix-data', () => ({ default: { query: vi.fn(), insert: vi.fn(), update: vi.fn() } }));

import { getReviewSummary, getUnifiedReviews, submitReview, getReviewHighlights } from '../src/backend/productReviews.web.js';
import { getReviewModerationQueue, updateReviewStatus } from '../src/backend/reviewsService.web.js';
import { submitPhotoReview, getPhotoReviews, flagPhotoReview } from '../src/backend/photoReviews.web.js';

describe('Reviews Flow', () => {
  describe('review display', () => {
    it('returns review summary with average rating', async () => {
      const summary = await getReviewSummary('product-1');
      expect(summary).toHaveProperty('averageRating');
      expect(summary).toHaveProperty('totalCount');
      expect(summary).toHaveProperty('ratingDistribution');
    });

    it('returns unified reviews feed', async () => {
      const reviews = await getUnifiedReviews({
        productId: 'product-1',
        limit: 10,
        offset: 0
      });
      expect(reviews).toHaveProperty('items');
      expect(reviews).toHaveProperty('totalCount');
    });

    it('returns review highlights (pros/cons)', async () => {
      const highlights = await getReviewHighlights('product-1');
      expect(highlights).toBeDefined();
    });
  });

  describe('review submission', () => {
    it('submits text review with rating', async () => {
      const result = await submitReview({
        productId: 'product-1',
        rating: 5,
        title: 'Great futon frame',
        body: 'Very sturdy and easy to assemble.'
      });
      expect(result).toHaveProperty('reviewId');
      expect(result).toHaveProperty('status', 'pending'); // needs moderation
    });

    it('rejects review without rating', async () => {
      await expect(
        submitReview({
          productId: 'product-1',
          title: 'No rating',
          body: 'Forgot to rate'
        })
      ).rejects.toThrow();
    });
  });

  describe('photo reviews', () => {
    it('submits photo review', async () => {
      const result = await submitPhotoReview({
        productId: 'product-1',
        rating: 4,
        body: 'Looks great in my living room',
        photoUrls: ['https://example.com/photo1.jpg']
      });
      expect(result).toHaveProperty('reviewId');
    });

    it('flags inappropriate photo', async () => {
      const result = await flagPhotoReview('review-1', 'inappropriate');
      expect(result).toHaveProperty('flagged', true);
    });
  });

  describe('moderation', () => {
    it('returns pending reviews queue', async () => {
      const queue = await getReviewModerationQueue({ status: 'pending' });
      expect(queue).toHaveProperty('items');
    });

    it('approves review', async () => {
      const result = await updateReviewStatus('review-1', 'approved');
      expect(result).toHaveProperty('status', 'approved');
    });

    it('rejects review', async () => {
      const result = await updateReviewStatus('review-1', 'rejected');
      expect(result).toHaveProperty('status', 'rejected');
    });
  });
});
```

- [ ] **Step 3: Run and fix test**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/reviewsFlow.integration.test.js`

- [ ] **Step 4: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add tests/reviewsFlow.integration.test.js
git commit -m "test: add reviews flow integration tests (display, submission, moderation)"
```

- [ ] **Step 5: Seed review import strategy**

Create a one-time import script for seed reviews:

```javascript
// scripts/importSeedReviews.js
// One-time script to import starter reviews from CSV
// Format: productId, rating, title, body, author, date
// Run via: node scripts/importSeedReviews.js reviews.csv

// Target: 5+ reviews per top-selling product
// Products: Murphy Cube, Studio, Monterey, Lambton, Nomad
```

- [ ] **Step 6: [EDITOR] Wire review widget to Product Page**

When editor access is restored:
1. Add review summary section below product description:
   - Average rating display: `reviewAvgRating`
   - Star display: `reviewStars`
   - Review count: `reviewCount`
   - "Write a Review" button: `writeReviewBtn`
2. Add reviews list repeater: `reviewsRepeater`
3. Add review submission form (modal or inline):
   - Rating selector: `ratingSelector`
   - Title input: `reviewTitleInput`
   - Body textarea: `reviewBodyInput`
   - Photo upload: `reviewPhotoUpload`
   - Submit button: `submitReviewBtn`
4. Wire to backend functions in Product Page controller

**Acceptance Criteria:**
- Star rating (1-5) + text review submission on Product Page
- Photo upload with review (optional)
- Average rating + review count displayed on product cards
- Moderation queue — reviews require approval before display
- Minimum 5 seed reviews imported before launch

---

## Chunk 5: Cross-Cutting + Beads

### Task 9: Cross-Cutting Infrastructure Verification

**Files:**
- Verify: `src/backend/accessibility.web.js`, `src/public/a11yHelpers.js`
- Verify: `src/backend/coreWebVitals.web.js`
- Verify: `src/backend/errorMonitoring.web.js`
- Test: `tests/accessibility.test.js`, `tests/accessibility.web.test.js`, `tests/a11yHelpers.test.js`, `tests/coreWebVitals.test.js`, `tests/errorMonitoring.test.js`

- [ ] **Step 1: Run all cross-cutting tests**

Run: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/accessibility.test.js tests/accessibility.web.test.js tests/a11yHelpers.test.js tests/coreWebVitals.test.js tests/errorMonitoring.test.js`
Expected: All PASS

- [ ] **Step 2: Verify masterPage wires cross-cutting modules**

Read: `src/pages/masterPage.js` — confirm that `errorMonitoring`, `coreWebVitals`, and `a11yHelpers` are imported and initialized in `$w.onReady()`.

If not wired, add the initialization calls.

- [ ] **Step 3: Commit any masterPage changes**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add src/pages/masterPage.js
git commit -m "feat: wire cross-cutting modules (error monitoring, web vitals, a11y) to masterPage"
```

---

### Task 10: Create Beads for All Tier 1 Work

- [ ] **Step 1: Create Tier 1A beads**

```bash
cd ~/gt/cfutons

# Assembly Guide PDP hookup (quick win)
bd create --title "Wire assembly guide badge to Product Page" \
  --desc "Add assemblyBadge + assemblyGuideLink elements to PDP. Wire to getAssemblyGuide() by SKU. Show difficulty + estimated time. See plan Task 1 Step 7." \
  --type task --priority P1 --owner cfutons/crew/melania --label "tier-1a,editor-blocked,quick-win"

# Search hookup
bd create --title "Wire search to header + Search Results + Category Page" \
  --desc "Wire searchInput in header to searchProducts(). Connect filter sidebar on Category Page to getFilterValues(). Wire Search Results page to fullTextSearch() + autocomplete. See plan Task 2 Steps 7-8." \
  --type task --priority P0 --owner cfutons/crew/melania --label "tier-1a,editor-blocked"

# Delivery Estimator hookup
bd create --title "Wire delivery estimator to Product Page + Cart" \
  --desc "Add zipCodeInput + deliveryEstimateText to PDP. Add cartZipInput to Cart. Wire to getAvailableDeliverySlots() + formatDeliveryLabel(). See plan Task 3 Steps 6-7." \
  --type task --priority P0 --owner cfutons/crew/melania --label "tier-1a,editor-blocked"
```

- [ ] **Step 2: Create Tier 1B beads**

```bash
# Delivery Scheduling
bd create --title "Wire delivery scheduling widget to Checkout" \
  --desc "Add date picker, AM/PM selector, liftgate/white-glove checkboxes to Checkout. Wire to getAvailableDeliverySlots() + bookDeliverySlot(). See plan Task 4 Step 6." \
  --type task --priority P1 --owner cfutons/crew/melania --label "tier-1b,editor-blocked"

# Cart Recovery + Email
bd create --title "Enable cart recovery + email automation" \
  --desc "Install Wix Triggered Emails. Configure SPF/DKIM. Create email templates (cart recovery, welcome, post-purchase). Wire event handlers. See plan Task 5 Step 5." \
  --type task --priority P1 --owner cfutons/crew/melania --label "tier-1b,config-needed"

# Order Tracking page
bd create --title "Create Order Tracking page + wire controller" \
  --desc "Create /order-tracking page in editor. Add lookup form (orderNumberInput, emailInput, trackOrderBtn). Add timeline display. Connect orderTracking.web.js. See plan Task 6 Step 6." \
  --type task --priority P1 --owner cfutons/crew/melania --label "tier-1b,editor-blocked,new-page"

# Returns Portal pages
bd create --title "Create Returns + Admin Returns pages" \
  --desc "Create /returns (public) and /admin-returns (admin-only) pages. Wire RMA lookup, guest returns, return label download, admin dashboard. See plan Task 7 Step 6." \
  --type task --priority P1 --owner cfutons/crew/melania --label "tier-1b,editor-blocked,new-page"

# Reviews widget
bd create --title "Wire reviews widget to Product Page + seed import" \
  --desc "Add review summary (avg rating, stars, count) below PDP description. Add review submission form. Wire to productReviews.web.js. Import 5+ seed reviews per top product. See plan Task 8 Steps 5-6." \
  --type task --priority P1 --owner cfutons/crew/melania --label "tier-1b,editor-blocked"
```

- [ ] **Step 3: Verify all beads created**

Run: `cd ~/gt/cfutons && bd list --label tier-1a && bd list --label tier-1b`

---

## Implementation Summary

| Task | Feature | Type | Blocked? | Est. |
|------|---------|------|----------|------|
| 1 | Assembly Guide on PDP | Quick win | EDITOR | 1d |
| 2 | Search | Tier 1A | EDITOR | 3d |
| 3 | Delivery Estimator | Tier 1A | EDITOR | 2d |
| 4 | Delivery Scheduling | Tier 1B | EDITOR | 3d |
| 5 | Cart Recovery + Email | Tier 1B | CONFIG | 3d |
| 6 | Order Tracking | Tier 1B | EDITOR (new page) | 1.5d |
| 7 | Returns Portal | Tier 1B | EDITOR (new pages) | 3d |
| 8 | Reviews/Ratings | Tier 1B | EDITOR | 3d |
| 9 | Cross-cutting infra | Always | Maybe | 0.5d |
| 10 | Bead creation | PM | No | — |
| **Total** | | | | **20d** |

**What can be done NOW (no editor):**
- All integration test writing (Tasks 1-8, test steps)
- Cross-cutting verification (Task 9)
- Bead creation (Task 10)
- Seed review import script (Task 8 Step 5)

**What needs EDITOR access:**
- All `[EDITOR]` steps — page creation, element wiring, nickname assignment
- Email template configuration (Task 5)

**Parallel execution:** Tasks 1-8 test-writing can be distributed across crew members. Suggested assignment:
- **miquella**: Tasks 2 (Search) + 3 (Delivery Estimator) — strongest on backend integration
- **radahn**: Tasks 4 (Delivery Scheduling) + 6 (Order Tracking) — delivery domain expertise
- **godfrey**: Tasks 7 (Returns) + 8 (Reviews) — thorough test writer
- **rennala**: Task 5 (Cart Recovery/Email) + 9 (Cross-cutting) — email/infrastructure focus
- **melania**: Task 1 (Assembly Guide, quick win) + Task 10 (beads) + editor hookup when access restored
