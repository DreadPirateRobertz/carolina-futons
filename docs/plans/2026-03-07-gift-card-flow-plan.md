# CF-ic6o: Gift Card Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the gift card flow by adding email delivery on purchase, checkout integration, and Member Page dashboard.

**Architecture:** Three independent features built on the existing `giftCards.web.js` backend and `giftCardHelpers.js` frontend. Each follows established patterns (store credit for checkout/member page, triggered emails for notifications). TDD throughout.

**Tech Stack:** Wix Velo (JavaScript), wix-crm-backend (triggeredEmails, contacts), wix-data, vitest

---

## Task 1: Update wix-crm-backend Mock — Add contacts Support

**Files:**
- Modify: `tests/__mocks__/wix-crm-backend.js`

**Step 1: Read the current mock**

Already read — it has `triggeredEmails` but no `contacts` export. Need to add `contacts.queryContacts()` chain and `contacts.appendOrCreateContact()`.

**Step 2: Add contacts mock to wix-crm-backend.js**

Add after the `triggeredEmails` export:

```javascript
let _contacts = [];

// Add to __reset():
_contacts = [];

export function __seedContacts(items) {
  _contacts = [...items];
}

export const contacts = {
  queryContacts() {
    let _filters = {};
    const builder = {
      eq(field, value) { _filters[field] = value; return builder; },
      limit() { return builder; },
      find: async () => {
        const items = _contacts.filter(c => {
          for (const [field, val] of Object.entries(_filters)) {
            const parts = field.split('.');
            let obj = c;
            for (const p of parts) { obj = obj?.[p]; }
            if (obj !== val) return false;
          }
          return true;
        });
        return { items };
      },
    };
    return builder;
  },
  async appendOrCreateContact(info) {
    const existing = _contacts.find(c =>
      c.primaryInfo?.email === info?.emails?.[0]?.email
    );
    if (existing) return { contactId: existing._id };
    const newContact = {
      _id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      primaryInfo: { email: info?.emails?.[0]?.email || '' },
    };
    _contacts.push(newContact);
    return { contactId: newContact._id };
  },
};
```

**Step 3: Verify mock works**

Run: `npx vitest run tests/giftCards.test.js`
Expected: All existing tests still PASS (no regression).

**Step 4: Commit**

```bash
git add tests/__mocks__/wix-crm-backend.js
git commit -m "test: add contacts mock to wix-crm-backend for gift card email tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Backend — sendGiftCardEmails()

**Files:**
- Modify: `src/backend/giftCards.web.js`
- Modify: `tests/giftCards.test.js`

**Step 1: Write failing tests for sendGiftCardEmails**

Add to `tests/giftCards.test.js`:

```javascript
import { __getEmailLog, __reset as __resetCrm, __failNextEmail } from './__mocks__/wix-crm-backend.js';

// Add beforeEach to reset CRM mock in relevant describe blocks

describe('sendGiftCardEmails', () => {
  beforeEach(() => {
    __resetCrm();
  });

  it('sends confirmation to purchaser and notification to recipient', async () => {
    const { sendGiftCardEmails } = await import('../src/backend/giftCards.web.js');
    const result = await sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 100,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'friend@test.com',
      recipientName: 'Friend',
      message: 'Happy birthday!',
      expirationDate: '2027-03-07T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
    const log = __getEmailLog();
    expect(log).toHaveLength(2);
    expect(log[0].templateId).toBe('gift_card_purchase_confirmation');
    expect(log[1].templateId).toBe('gift_card_received');
  });

  it('includes correct template variables for recipient', async () => {
    const { sendGiftCardEmails } = await import('../src/backend/giftCards.web.js');
    await sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 50,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'friend@test.com',
      recipientName: 'Jane',
      message: 'Enjoy!',
      expirationDate: '2027-06-01T00:00:00.000Z',
    });
    const log = __getEmailLog();
    const recipientEmail = log[1];
    expect(recipientEmail.options.variables.code).toBe('CF-AAAA-BBBB-CCCC-DDDD');
    expect(recipientEmail.options.variables.amount).toBe('$50.00');
    expect(recipientEmail.options.variables.recipientName).toBe('Jane');
    expect(recipientEmail.options.variables.message).toBe('Enjoy!');
  });

  it('handles missing optional fields gracefully', async () => {
    const { sendGiftCardEmails } = await import('../src/backend/giftCards.web.js');
    const result = await sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 25,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'friend@test.com',
    });
    expect(result.success).toBe(true);
    const log = __getEmailLog();
    expect(log).toHaveLength(2);
  });

  it('returns success false on email failure', async () => {
    const { sendGiftCardEmails } = await import('../src/backend/giftCards.web.js');
    __failNextEmail();
    const result = await sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 100,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'friend@test.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', async () => {
    const { sendGiftCardEmails } = await import('../src/backend/giftCards.web.js');
    const result = await sendGiftCardEmails({});
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/giftCards.test.js`
Expected: FAIL — `sendGiftCardEmails` is not exported.

**Step 3: Implement sendGiftCardEmails in giftCards.web.js**

Add imports at top of `giftCards.web.js`:
```javascript
import { triggeredEmails, contacts } from 'wix-crm-backend';
```

Add the function:
```javascript
/**
 * Send gift card confirmation emails to purchaser and recipient.
 * Called internally after successful purchase. Best-effort — purchase
 * succeeds even if emails fail.
 *
 * @function sendGiftCardEmails
 * @param {Object} data
 * @param {string} data.code - Gift card code
 * @param {number} data.amount - Gift card amount
 * @param {string} data.purchaserEmail - Buyer's email
 * @param {string} data.recipientEmail - Recipient's email
 * @param {string} [data.recipientName] - Recipient name
 * @param {string} [data.message] - Personal message
 * @param {string} [data.expirationDate] - ISO expiration date
 * @returns {Promise<{success: boolean}>}
 * @permission SiteMember
 */
export const sendGiftCardEmails = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      if (!data || !data.code || !data.purchaserEmail || !data.recipientEmail || !data.amount) {
        return { success: false, message: 'Missing required email data' };
      }

      const formattedAmount = `$${Number(data.amount).toFixed(2)}`;

      // Get or create contacts for both purchaser and recipient
      const [purchaserContact, recipientContact] = await Promise.all([
        contacts.appendOrCreateContact({ emails: [{ email: data.purchaserEmail }] }),
        contacts.appendOrCreateContact({ emails: [{ email: data.recipientEmail }] }),
      ]);

      // Send purchaser confirmation
      await triggeredEmails.emailContact(
        'gift_card_purchase_confirmation',
        purchaserContact.contactId,
        {
          variables: {
            code: data.code,
            amount: formattedAmount,
            recipientEmail: data.recipientEmail,
            recipientName: data.recipientName || 'your recipient',
            expirationDate: data.expirationDate || '',
          },
        }
      );

      // Send recipient notification
      await triggeredEmails.emailContact(
        'gift_card_received',
        recipientContact.contactId,
        {
          variables: {
            code: data.code,
            amount: formattedAmount,
            recipientName: data.recipientName || '',
            message: data.message || '',
            purchaserEmail: data.purchaserEmail,
            expirationDate: data.expirationDate || '',
          },
        }
      );

      return { success: true };
    } catch (err) {
      console.error('Error sending gift card emails:', err);
      return { success: false, message: 'Failed to send emails' };
    }
  }
);
```

**Step 4: Wire email sending into purchaseGiftCard**

In `purchaseGiftCard`, after the successful insert block (after line 79), add:
```javascript
// Fire-and-forget email delivery — don't block purchase on email
sendGiftCardEmails({
  code,
  amount,
  purchaserEmail,
  recipientEmail,
  recipientName: sanitize(data.recipientName || '', 200),
  message: sanitize(data.message || '', 500),
  expirationDate: expirationDate.toISOString(),
}).catch(err => console.error('Gift card email delivery failed:', err));
```

**Step 5: Run tests**

Run: `npx vitest run tests/giftCards.test.js`
Expected: All PASS.

**Step 6: Commit**

```bash
git add src/backend/giftCards.web.js tests/giftCards.test.js
git commit -m "feat(CF-ic6o): add gift card email delivery on purchase

Sends confirmation to purchaser and code notification to recipient
via Wix Triggered Emails after successful gift card purchase.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Backend — getMyGiftCards()

**Files:**
- Modify: `src/backend/giftCards.web.js`
- Modify: `tests/giftCards.test.js`

**Step 1: Write failing tests**

```javascript
describe('getMyGiftCards', () => {
  beforeEach(() => {
    __seed('GiftCards', [
      {
        _id: 'gc-bought',
        code: 'CF-AAAA-BBBB-CCCC-DDDD',
        balance: 75,
        initialAmount: 100,
        purchaserEmail: 'me@test.com',
        recipientEmail: 'friend@test.com',
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      },
      {
        _id: 'gc-received',
        code: 'CF-XXXX-YYYY-ZZZZ-WWWW',
        balance: 50,
        initialAmount: 50,
        purchaserEmail: 'someone@test.com',
        recipientEmail: 'me@test.com',
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 60).toISOString(),
      },
      {
        _id: 'gc-other',
        code: 'CF-NOPE-NOPE-NOPE-NOPE',
        balance: 200,
        initialAmount: 200,
        purchaserEmail: 'other@test.com',
        recipientEmail: 'other2@test.com',
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 90).toISOString(),
      },
    ]);
  });

  it('returns purchased and received cards for email', async () => {
    const result = await getMyGiftCards('me@test.com');
    expect(result.success).toBe(true);
    expect(result.purchased).toHaveLength(1);
    expect(result.received).toHaveLength(1);
    expect(result.purchased[0].code).toBe('CF-AAAA-BBBB-CCCC-DDDD');
    expect(result.received[0].code).toBe('CF-XXXX-YYYY-ZZZZ-WWWW');
  });

  it('returns empty arrays when no cards found', async () => {
    const result = await getMyGiftCards('nobody@test.com');
    expect(result.success).toBe(true);
    expect(result.purchased).toHaveLength(0);
    expect(result.received).toHaveLength(0);
  });

  it('rejects missing email', async () => {
    const result = await getMyGiftCards(null);
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', async () => {
    const result = await getMyGiftCards('not-an-email');
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run tests to verify fail**

Run: `npx vitest run tests/giftCards.test.js`
Expected: FAIL — `getMyGiftCards` not defined.

**Step 3: Implement getMyGiftCards**

```javascript
/**
 * Get gift cards associated with a member's email.
 * Returns both purchased and received cards.
 *
 * @function getMyGiftCards
 * @param {string} email - Member's email address
 * @returns {Promise<{success: boolean, purchased: Array, received: Array}>}
 * @permission SiteMember
 */
export const getMyGiftCards = webMethod(
  Permissions.SiteMember,
  async (email) => {
    try {
      if (!email) return { success: false, message: 'Email required' };
      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) {
        return { success: false, message: 'Invalid email' };
      }

      const [purchasedResult, receivedResult] = await Promise.all([
        wixData.query('GiftCards')
          .eq('purchaserEmail', cleanEmail)
          .descending('createdDate')
          .find(),
        wixData.query('GiftCards')
          .eq('recipientEmail', cleanEmail)
          .descending('createdDate')
          .find(),
      ]);

      return {
        success: true,
        purchased: purchasedResult.items,
        received: receivedResult.items,
      };
    } catch (err) {
      console.error('Error fetching gift cards:', err);
      return { success: false, message: 'Failed to fetch gift cards' };
    }
  }
);
```

**Step 4: Update test imports**

Add `getMyGiftCards` to the import at top of `tests/giftCards.test.js`.

**Step 5: Run tests**

Run: `npx vitest run tests/giftCards.test.js`
Expected: All PASS.

**Step 6: Commit**

```bash
git add src/backend/giftCards.web.js tests/giftCards.test.js
git commit -m "feat(CF-ic6o): add getMyGiftCards backend for member dashboard

Returns purchased and received gift cards by email for Member Page display.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Frontend Helpers — maskGiftCardCode + Checkout Helpers

**Files:**
- Modify: `src/public/giftCardHelpers.js`
- Modify: `tests/giftCardHelpers.test.js`

**Step 1: Write failing tests for maskGiftCardCode**

```javascript
describe('maskGiftCardCode', () => {
  it('masks middle segments', () => {
    expect(maskGiftCardCode('CF-ABCD-EFGH-JKLM-NPQR')).toBe('CF-****-****-****-NPQR');
  });

  it('handles lowercase input', () => {
    expect(maskGiftCardCode('cf-abcd-efgh-jklm-npqr')).toBe('CF-****-****-****-NPQR');
  });

  it('returns empty for null', () => {
    expect(maskGiftCardCode(null)).toBe('');
  });

  it('returns empty for invalid format', () => {
    expect(maskGiftCardCode('not-a-code')).toBe('');
  });
});
```

**Step 2: Write failing tests for initCheckoutGiftCard (pure logic parts)**

```javascript
describe('buildGiftCardAppliedText', () => {
  it('formats applied amount', () => {
    expect(buildGiftCardAppliedText(50)).toBe('-$50.00 Gift Card');
  });

  it('handles zero', () => {
    expect(buildGiftCardAppliedText(0)).toBe('-$0.00 Gift Card');
  });

  it('handles null', () => {
    expect(buildGiftCardAppliedText(null)).toBe('-$0.00 Gift Card');
  });
});

describe('calculateGiftCardDiscount', () => {
  it('applies full card when balance < subtotal', () => {
    const result = calculateGiftCardDiscount(50, 100);
    expect(result.amountToApply).toBe(50);
    expect(result.remainingSubtotal).toBe(50);
  });

  it('caps at subtotal when balance > subtotal', () => {
    const result = calculateGiftCardDiscount(200, 100);
    expect(result.amountToApply).toBe(100);
    expect(result.remainingSubtotal).toBe(0);
  });

  it('handles zero balance', () => {
    const result = calculateGiftCardDiscount(0, 100);
    expect(result.amountToApply).toBe(0);
    expect(result.remainingSubtotal).toBe(100);
  });

  it('handles null inputs', () => {
    const result = calculateGiftCardDiscount(null, null);
    expect(result.amountToApply).toBe(0);
    expect(result.remainingSubtotal).toBe(0);
  });
});
```

**Step 3: Run tests to verify fail**

Run: `npx vitest run tests/giftCardHelpers.test.js`
Expected: FAIL — functions not exported.

**Step 4: Implement in giftCardHelpers.js**

```javascript
/**
 * Mask a gift card code for display (show only last segment).
 * @param {string|null|undefined} code
 * @returns {string} Masked code e.g. "CF-****-****-****-NPQR"
 */
export function maskGiftCardCode(code) {
  if (!code || typeof code !== 'string') return '';
  const upper = code.trim().toUpperCase();
  if (!validateGiftCardCode(upper)) return '';
  const parts = upper.split('-');
  return `${parts[0]}-****-****-****-${parts[4]}`;
}

/**
 * Build the display text for an applied gift card discount.
 * @param {number|null} amount - Amount applied
 * @returns {string}
 */
export function buildGiftCardAppliedText(amount) {
  return `-${formatBalance(amount)} Gift Card`;
}

/**
 * Calculate how much gift card balance to apply to a subtotal.
 * @param {number|null} balance - Gift card balance
 * @param {number|null} subtotal - Order subtotal
 * @returns {{ amountToApply: number, remainingSubtotal: number }}
 */
export function calculateGiftCardDiscount(balance, subtotal) {
  const bal = Number(balance) || 0;
  const sub = Number(subtotal) || 0;
  const amountToApply = Math.min(bal, sub);
  return {
    amountToApply,
    remainingSubtotal: Math.max(0, sub - amountToApply),
  };
}
```

**Step 5: Run tests**

Run: `npx vitest run tests/giftCardHelpers.test.js`
Expected: All PASS.

**Step 6: Commit**

```bash
git add src/public/giftCardHelpers.js tests/giftCardHelpers.test.js
git commit -m "feat(CF-ic6o): add maskGiftCardCode and checkout discount helpers

Pure functions for masking codes in dashboard display and calculating
gift card discount amounts at checkout.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Frontend — initCheckoutGiftCard (Checkout Page Integration)

**Files:**
- Modify: `src/public/giftCardHelpers.js`
- Modify: `src/pages/Checkout.js`

**Step 1: Add initCheckoutGiftCard to giftCardHelpers.js**

```javascript
/**
 * Initialize gift card code entry at checkout.
 * Provides UI for entering a gift card code and applying it to the order.
 *
 * @param {Function} $w - Wix Velo selector
 * @param {number} subtotal - Current order subtotal
 * @returns {Promise<{applied: boolean, amountApplied: number, code: string}>}
 */
export async function initCheckoutGiftCard($w, subtotal) {
  try {
    const applyBtn = $w('#giftCardApplyBtn');
    if (!applyBtn) return { applied: false, amountApplied: 0, code: '' };

    try { $w('#giftCardCodeInput').accessibility.ariaLabel = 'Enter gift card code'; } catch (_) {}
    try { applyBtn.accessibility.ariaLabel = 'Apply gift card to order'; } catch (_) {}

    let appliedResult = { applied: false, amountApplied: 0, code: '' };

    applyBtn.onClick(async () => {
      try { $w('#giftCardCheckoutError').hide(); } catch (_) {}
      try { $w('#giftCardAppliedSection').hide(); } catch (_) {}

      const rawCode = ($w('#giftCardCodeInput').value || '').trim();
      const code = formatGiftCardCode(rawCode);

      if (!validateGiftCardCode(code)) {
        try {
          $w('#giftCardCheckoutError').text = 'Please enter a valid gift card code (CF-XXXX-XXXX-XXXX-XXXX).';
          $w('#giftCardCheckoutError').show();
        } catch (_) {}
        return;
      }

      applyBtn.disable();
      applyBtn.label = 'Checking...';

      try {
        const { checkBalance } = await import('backend/giftCards.web');
        const balanceResult = await checkBalance(code);

        if (!balanceResult.found || balanceResult.status !== 'active' || balanceResult.balance <= 0) {
          try {
            $w('#giftCardCheckoutError').text = !balanceResult.found
              ? 'Gift card not found.'
              : balanceResult.status === 'expired'
                ? 'This gift card has expired.'
                : 'This gift card has no remaining balance.';
            $w('#giftCardCheckoutError').show();
          } catch (_) {}
          return;
        }

        const { amountToApply } = calculateGiftCardDiscount(balanceResult.balance, subtotal);

        try {
          $w('#giftCardAppliedAmount').text = buildGiftCardAppliedText(amountToApply);
          $w('#giftCardAppliedSection').show('fade', { duration: 250 });
          try { $w('#orderSummaryGiftCard').text = `-${formatBalance(amountToApply)}`; } catch (_) {}
          try { $w('#orderSummaryGiftCardRow').show(); } catch (_) {}
        } catch (_) {}

        appliedResult = { applied: true, amountApplied: amountToApply, code };

        const { announce } = await import('public/a11yHelpers');
        announce($w, `${formatBalance(amountToApply)} gift card applied to your order`);
      } catch (err) {
        console.error('[Checkout] Error applying gift card:', err);
        try {
          $w('#giftCardCheckoutError').text = 'Unable to apply gift card. Please try again.';
          $w('#giftCardCheckoutError').show();
        } catch (_) {}
      } finally {
        applyBtn.enable();
        applyBtn.label = 'Apply';
      }
    });

    try { $w('#giftCardCheckoutSection').show('fade', { duration: 250 }); } catch (_) {}

    return appliedResult;
  } catch (err) {
    console.error('[giftCardHelpers] Error initializing checkout gift card:', err);
    return { applied: false, amountApplied: 0, code: '' };
  }
}
```

**Step 2: Add gift card section to Checkout.js**

Add import at top:
```javascript
import { initCheckoutGiftCard } from 'public/giftCardHelpers.js';
```

Add to sections array (after storeCredit):
```javascript
{ name: 'giftCard', init: initGiftCardSection },
```

Add the init function:
```javascript
// ── Gift Card Application ────────────────────────────────────────────
async function initGiftCardSection() {
  try {
    const subtotal = _currentCart?.subtotal?.amount || 0;
    await initCheckoutGiftCard($w, subtotal);
  } catch (e) {
    console.error('[Checkout] Error initializing gift card section:', e);
  }
}
```

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All PASS (page files are untestable but helpers pass).

**Step 4: Commit**

```bash
git add src/public/giftCardHelpers.js src/pages/Checkout.js
git commit -m "feat(CF-ic6o): integrate gift card code entry at checkout

Adds manual gift card code input section to Checkout page.
Validates code, checks balance, and shows applied discount in order summary.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Frontend — initGiftCardDashboard (Member Page Integration)

**Files:**
- Modify: `src/public/giftCardHelpers.js`
- Modify: `src/pages/Member Page.js`

**Step 1: Add initGiftCardDashboard to giftCardHelpers.js**

```javascript
/**
 * Initialize the gift card dashboard on Member Page.
 * Shows purchased and received gift cards with balances.
 *
 * @param {Function} $w - Wix Velo selector
 * @returns {Promise<void>}
 */
export async function initGiftCardDashboard($w) {
  try {
    const { getMyGiftCards } = await import('backend/giftCards.web');
    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember();

    if (!member || !member.loginEmail) {
      try { $w('#giftCardDashboardSection').hide(); } catch (_) {}
      return;
    }

    const result = await getMyGiftCards(member.loginEmail);

    if (!result.success) {
      try { $w('#giftCardDashboardSection').hide(); } catch (_) {}
      return;
    }

    const allCards = [...(result.purchased || []), ...(result.received || [])];

    if (allCards.length === 0) {
      try { $w('#giftCardDashboardSection').hide(); } catch (_) {}
      return;
    }

    // Count active cards and total balance
    const activeCards = allCards.filter(c => c.status === 'active' && c.balance > 0);
    const totalBalance = activeCards.reduce((sum, c) => sum + (c.balance || 0), 0);

    try { $w('#giftCardTotalBalance').text = formatBalance(totalBalance); } catch (_) {}
    try { $w('#giftCardCount').text = `${activeCards.length} active card${activeCards.length !== 1 ? 's' : ''}`; } catch (_) {}

    // Populate repeater with cards
    try {
      const repeater = $w('#giftCardRepeater');
      if (repeater) {
        repeater.onItemReady(($item, itemData) => {
          try { $item('#gcDashCode').text = maskGiftCardCode(itemData.code); } catch (_) {}
          try { $item('#gcDashBalance').text = formatBalance(itemData.balance); } catch (_) {}
          try {
            const statusDisplay = getBalanceStatusDisplay({ found: true, ...itemData });
            $item('#gcDashStatus').text = statusDisplay.label;
          } catch (_) {}
          try { $item('#gcDashExpiry').text = formatExpirationDate(itemData.expirationDate); } catch (_) {}
        });

        repeater.data = allCards.map((card, i) => ({
          ...card,
          _id: card._id || `gc-dash-${i}`,
        }));
      }
    } catch (_) {}

    try { $w('#giftCardDashboardSection').show('fade', { duration: 250 }); } catch (_) {}
  } catch (err) {
    console.error('[giftCardHelpers] Error initializing gift card dashboard:', err);
    try { $w('#giftCardDashboardSection').hide(); } catch (_) {}
  }
}
```

**Step 2: Add to Member Page.js**

Add import:
```javascript
import { initGiftCardDashboard } from 'public/giftCardHelpers.js';
```

Add to sections array (after storeCredit):
```javascript
{ name: 'giftCards', init: () => initGiftCardDashboard($w) },
```

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All PASS.

**Step 4: Commit**

```bash
git add src/public/giftCardHelpers.js "src/pages/Member Page.js"
git commit -m "feat(CF-ic6o): add gift card dashboard to Member Page

Shows purchased and received gift cards with masked codes, balances,
status badges, and expiration dates. Follows storeCreditDashboard pattern.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Final Integration Test + Branch + PR

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS, no regressions.

**Step 2: Create feature branch and push**

```bash
git checkout -b cf-ic6o-gift-card-flow
git push -u origin cf-ic6o-gift-card-flow
```

**Step 3: Create PR**

```bash
gh pr create --title "feat(CF-ic6o): gift card email delivery, checkout integration, member dashboard" --body "$(cat <<'EOF'
## Summary
- Adds email delivery on gift card purchase (purchaser confirmation + recipient notification)
- Integrates gift card code entry at checkout (manual code input, balance check, apply discount)
- Adds gift card dashboard to Member Page (purchased + received cards, masked codes, balances)

## Files Changed
- `src/backend/giftCards.web.js` — sendGiftCardEmails(), getMyGiftCards()
- `src/public/giftCardHelpers.js` — maskGiftCardCode(), checkout/dashboard helpers
- `src/pages/Checkout.js` — gift card section in checkout flow
- `src/pages/Member Page.js` — gift card dashboard section
- `tests/giftCards.test.js` — email + getMyGiftCards tests
- `tests/giftCardHelpers.test.js` — mask, discount, text helper tests
- `tests/__mocks__/wix-crm-backend.js` — contacts mock

## CMS Setup Required
- Create triggered email template `gift_card_purchase_confirmation` with variables:
  code, amount, recipientEmail, recipientName, expirationDate
- Create triggered email template `gift_card_received` with variables:
  code, amount, recipientName, message, purchaserEmail, expirationDate

## Wix Studio Elements Required
### Checkout Page
- `#giftCardCheckoutSection`, `#giftCardCodeInput`, `#giftCardApplyBtn`
- `#giftCardCheckoutError`, `#giftCardAppliedSection`, `#giftCardAppliedAmount`
- `#orderSummaryGiftCard`, `#orderSummaryGiftCardRow`

### Member Page
- `#giftCardDashboardSection`, `#giftCardTotalBalance`, `#giftCardCount`
- `#giftCardRepeater` with items: `#gcDashCode`, `#gcDashBalance`, `#gcDashStatus`, `#gcDashExpiry`

## Test plan
- [ ] All vitest tests pass (`npx vitest run`)
- [ ] Gift card purchase triggers email delivery (verify via email log in tests)
- [ ] Balance check, redemption, and edge cases covered
- [ ] Checkout gift card code entry validates, checks balance, applies discount
- [ ] Member Page shows purchased and received cards
- [ ] No regressions in existing gift card, store credit, or checkout tests

Closes CF-ic6o

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

**Step 4: Notify melania**

```bash
gt mail send cfutons/crew/melania -s "PR ready: CF-ic6o gift card flow" -m "PR opened for CF-ic6o. Ready for review."
```
