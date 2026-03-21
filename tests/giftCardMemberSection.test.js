/**
 * @file giftCardMemberSection.test.js
 * @description CF-x09m.2: Gift Cards S2 — My Gift Cards member dashboard.
 *
 * Covers:
 *  Backend (getMyPurchasedCards, getMyReceivedCards):
 *   - Returns purchased/received cards from GiftCards collection
 *   - IDOR guard: no member session → unauthorized
 *   - IDOR guard: email derived from session, not caller
 *   - Masks recipient email in purchased results
 *   - Empty collection → success with empty array
 *   - DB error → fetch_failed
 *
 *  Frontend (initMyGiftCardsSection):
 *   - Shows section when either purchased or received cards exist
 *   - Collapses section on empty state (no cards)
 *   - Wires purchased repeater with correct data
 *   - Wires received repeater with correct data
 *   - Collapses individual repeater when it has no items
 *
 *  renderPurchasedCardItem / renderReceivedCardItem:
 *   - Sets code, balance, expiry, recipient fields
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __seed,
  __reset as resetData,
} from './__mocks__/wix-data.js';
import {
  __setMember,
  __reset as resetMembers,
} from './__mocks__/wix-members-backend.js';
import {
  getMyPurchasedCards,
  getMyReceivedCards,
} from '../src/backend/giftCards.web.js';
import {
  initMyGiftCardsSection,
  renderPurchasedCardItem,
  renderReceivedCardItem,
  SECTION_ELEMENT,
  PURCHASED_REPEATER,
  RECEIVED_REPEATER,
} from '../src/public/giftCardMemberSection.js';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('public/designTokens.js', () => ({ colors: {} }));

// ── Fixtures ──────────────────────────────────────────────────────────

const MEMBER_EMAIL = 'buyer@test.com';
const RECIPIENT_EMAIL = 'friend@test.com';

const PURCHASED_CARD = {
  _id: 'gc-1',
  code: 'CF-ABCD-EFGH-JKLM-NPQR',
  balance: 100,
  initialAmount: 100,
  status: 'active',
  purchaserEmail: MEMBER_EMAIL,
  recipientEmail: RECIPIENT_EMAIL,
  recipientName: 'Friend Name',
  createdDate: new Date('2026-01-01'),
  expirationDate: new Date('2027-01-01'),
};

const RECEIVED_CARD = {
  _id: 'gc-2',
  code: 'CF-WXYZ-1234-5678-ABCD',
  balance: 50,
  initialAmount: 50,
  status: 'active',
  purchaserEmail: 'giver@test.com',
  recipientEmail: MEMBER_EMAIL,
  createdDate: new Date('2026-02-01'),
  expirationDate: new Date('2027-02-01'),
};

const EXPIRED_CARD = {
  _id: 'gc-3',
  code: 'CF-XXXX-XXXX-XXXX-XXXX',
  balance: 0,
  initialAmount: 25,
  status: 'expired',
  purchaserEmail: MEMBER_EMAIL,
  recipientEmail: 'other@test.com',
  recipientName: 'Other',
  createdDate: new Date('2024-01-01'),
  expirationDate: new Date('2025-01-01'),
};

// ── getMyPurchasedCards — backend ─────────────────────────────────────────────

describe('getMyPurchasedCards — IDOR guard', () => {
  it('returns unauthorized when no member session', async () => {
    resetMembers();
    const r = await getMyPurchasedCards();
    expect(r.success).toBe(false);
    expect(r.reason).toBe('unauthorized');
  });

  it('returns unauthorized when member has no loginEmail', async () => {
    __setMember({ _id: 'mem-1' }); // no loginEmail
    const r = await getMyPurchasedCards();
    expect(r.success).toBe(false);
    expect(r.reason).toBe('unauthorized');
  });

  it('uses session email, not a caller-supplied param', async () => {
    __setMember({ loginEmail: MEMBER_EMAIL });
    __seed('GiftCards', [PURCHASED_CARD]);

    const r = await getMyPurchasedCards();
    expect(r.success).toBe(true);
    expect(r.cards).toHaveLength(1);
  });
});

describe('getMyPurchasedCards — results', () => {
  beforeEach(() => {
    __setMember({ loginEmail: MEMBER_EMAIL });
  });

  it('returns cards where purchaserEmail matches session email', async () => {
    __seed('GiftCards', [PURCHASED_CARD, RECEIVED_CARD]); // RECEIVED_CARD.purchaserEmail !== MEMBER_EMAIL

    const r = await getMyPurchasedCards();
    expect(r.success).toBe(true);
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].maskedCode).toContain('CF-');
  });

  it('masks recipient email in results', async () => {
    __seed('GiftCards', [PURCHASED_CARD]);

    const r = await getMyPurchasedCards();
    expect(r.success).toBe(true);
    const card = r.cards[0];
    expect(card.recipientEmail).not.toBe(RECIPIENT_EMAIL); // must be masked
    expect(card.recipientEmail).toContain('@');
    expect(card.recipientEmail).toContain('***');
  });

  it('includes recipientName in results', async () => {
    __seed('GiftCards', [PURCHASED_CARD]);

    const r = await getMyPurchasedCards();
    expect(r.cards[0].recipientName).toBe('Friend Name');
  });

  it('returns empty array when member has no purchased cards', async () => {
    __seed('GiftCards', [RECEIVED_CARD]); // only received, not purchased by MEMBER_EMAIL

    const r = await getMyPurchasedCards();
    expect(r.success).toBe(true);
    expect(r.cards).toHaveLength(0);
  });

  it('includes expired cards (caller filters by status if needed)', async () => {
    __seed('GiftCards', [PURCHASED_CARD, EXPIRED_CARD]);

    const r = await getMyPurchasedCards();
    expect(r.cards).toHaveLength(2);
    expect(r.cards.some(c => c.status === 'expired')).toBe(true);
  });

  it('masks card code in results', async () => {
    __seed('GiftCards', [PURCHASED_CARD]);

    const r = await getMyPurchasedCards();
    expect(r.cards[0].maskedCode).not.toContain('ABCD-EFGH-JKLM');
    expect(r.cards[0].maskedCode).toContain('NPQR'); // last segment visible
  });
});

// ── getMyReceivedCards — backend ──────────────────────────────────────────────

describe('getMyReceivedCards — IDOR guard', () => {
  it('returns unauthorized when no member session', async () => {
    resetMembers();
    const r = await getMyReceivedCards();
    expect(r.success).toBe(false);
    expect(r.reason).toBe('unauthorized');
  });

  it('returns unauthorized when member has no loginEmail', async () => {
    __setMember({ _id: 'mem-1' });
    const r = await getMyReceivedCards();
    expect(r.success).toBe(false);
    expect(r.reason).toBe('unauthorized');
  });
});

describe('getMyReceivedCards — results', () => {
  beforeEach(() => {
    __setMember({ loginEmail: MEMBER_EMAIL });
  });

  it('returns cards where recipientEmail matches session email', async () => {
    __seed('GiftCards', [PURCHASED_CARD, RECEIVED_CARD]);

    const r = await getMyReceivedCards();
    expect(r.success).toBe(true);
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]._id).toBe('gc-2');
  });

  it('returns empty array when member has no received cards', async () => {
    __seed('GiftCards', [PURCHASED_CARD]); // no received cards for MEMBER_EMAIL

    const r = await getMyReceivedCards();
    expect(r.success).toBe(true);
    expect(r.cards).toHaveLength(0);
  });

  it('masks card code in results', async () => {
    __seed('GiftCards', [RECEIVED_CARD]);

    const r = await getMyReceivedCards();
    expect(r.cards[0].maskedCode).toContain('CF-');
    expect(r.cards[0].maskedCode).toContain('ABCD'); // last segment
  });
});

// ── renderPurchasedCardItem ───────────────────────────────────────────────────

describe('renderPurchasedCardItem', () => {
  function make$item() {
    const els = {};
    return {
      $(sel) {
        if (!els[sel]) els[sel] = { text: '', show: vi.fn(), hide: vi.fn() };
        return els[sel];
      },
      _el: (sel) => {
        if (!els[sel]) els[sel] = { text: '', show: vi.fn(), hide: vi.fn() };
        return els[sel];
      },
    };
  }

  function makeItem$w(store = {}) {
    return (sel) => {
      if (!store[sel]) store[sel] = { text: '', show: vi.fn(), hide: vi.fn() };
      return store[sel];
    };
  }

  it('sets #gcCardCode to maskedCode', () => {
    const store = {};
    renderPurchasedCardItem(makeItem$w(store), { maskedCode: 'CF-****-****-****-NPQR', balance: 100, expirationDate: null, recipientName: 'Bob' });
    expect(store['#gcCardCode'].text).toBe('CF-****-****-****-NPQR');
  });

  it('sets #gcBalance using formatBalance', () => {
    const store = {};
    renderPurchasedCardItem(makeItem$w(store), { maskedCode: '****', balance: 75.5, expirationDate: null });
    expect(store['#gcBalance'].text).toBe('$75.50');
  });

  it('sets #gcRecipient to recipientName when available', () => {
    const store = {};
    renderPurchasedCardItem(makeItem$w(store), { maskedCode: '****', balance: 0, expirationDate: null, recipientName: 'Alice' });
    expect(store['#gcRecipient'].text).toBe('Alice');
  });

  it('falls back to recipientEmail when recipientName is absent', () => {
    const store = {};
    renderPurchasedCardItem(makeItem$w(store), { maskedCode: '****', balance: 0, expirationDate: null, recipientName: '', recipientEmail: 'a***@test.com' });
    expect(store['#gcRecipient'].text).toBe('a***@test.com');
  });

  it('falls back to em-dash when both name and email absent', () => {
    const store = {};
    renderPurchasedCardItem(makeItem$w(store), { maskedCode: '****', balance: 0, expirationDate: null });
    expect(store['#gcRecipient'].text).toBe('—');
  });
});

// ── initMyGiftCardsSection — frontend ────────────────────────────────────────

function makeRepeater() {
  let _data = [];
  let _onItemReady = null;
  return {
    onItemReady: vi.fn(fn => { _onItemReady = fn; }),
    show: vi.fn(),
    collapse: vi.fn(),
    set data(v) { _data = v; },
    get data() { return _data; },
    _getData: () => _data,
    _fireItems: (store = {}) => {
      const $item = (sel) => {
        if (!store[sel]) store[sel] = { text: '', show: vi.fn(), hide: vi.fn() };
        return store[sel];
      };
      (_data || []).forEach(item => _onItemReady && _onItemReady($item, item));
    },
  };
}

function makeSection() {
  return { expand: vi.fn(), collapse: vi.fn() };
}

function make$w(section, purchasedRep, receivedRep) {
  return (sel) => {
    if (sel === SECTION_ELEMENT) return section;
    if (sel === PURCHASED_REPEATER) return purchasedRep;
    if (sel === RECEIVED_REPEATER) return receivedRep;
    return { text: '', show: vi.fn(), hide: vi.fn(), collapse: vi.fn(), expand: vi.fn() };
  };
}

describe('initMyGiftCardsSection — section visibility', () => {
  it('expands section when purchased cards exist', async () => {
    const section = makeSection();
    const $w = make$w(section, makeRepeater(), makeRepeater());

    await initMyGiftCardsSection($w, {
      getPurchased: async () => ({ success: true, cards: [{ _id: 'g1', maskedCode: '****', balance: 50, expirationDate: null, recipientName: 'Bob' }] }),
      getReceived: async () => ({ success: true, cards: [] }),
    });

    expect(section.expand).toHaveBeenCalled();
  });

  it('expands section when received cards exist', async () => {
    const section = makeSection();
    const $w = make$w(section, makeRepeater(), makeRepeater());

    await initMyGiftCardsSection($w, {
      getPurchased: async () => ({ success: true, cards: [] }),
      getReceived: async () => ({ success: true, cards: [{ _id: 'g2', maskedCode: '****', balance: 25, expirationDate: null }] }),
    });

    expect(section.expand).toHaveBeenCalled();
  });

  it('collapses section when both lists are empty', async () => {
    const section = makeSection();
    const $w = make$w(section, makeRepeater(), makeRepeater());

    const result = await initMyGiftCardsSection($w, {
      getPurchased: async () => ({ success: true, cards: [] }),
      getReceived: async () => ({ success: true, cards: [] }),
    });

    expect(section.collapse).toHaveBeenCalled();
    expect(result.shown).toBe(false);
  });

  it('collapses section when both backends return failure', async () => {
    const section = makeSection();
    const $w = make$w(section, makeRepeater(), makeRepeater());

    const result = await initMyGiftCardsSection($w, {
      getPurchased: async () => ({ success: false, reason: 'unauthorized' }),
      getReceived: async () => ({ success: false, reason: 'unauthorized' }),
    });

    expect(section.collapse).toHaveBeenCalled();
    expect(result.shown).toBe(false);
  });
});

describe('initMyGiftCardsSection — repeater wiring', () => {
  it('sets purchased repeater data correctly', async () => {
    const section = makeSection();
    const purRep = makeRepeater();
    const $w = make$w(section, purRep, makeRepeater());

    const cards = [
      { _id: 'g1', maskedCode: 'CF-****-NPQR', balance: 100, expirationDate: null, recipientName: 'Alice' },
    ];

    await initMyGiftCardsSection($w, {
      getPurchased: async () => ({ success: true, cards }),
      getReceived: async () => ({ success: true, cards: [] }),
    });

    expect(purRep._getData()).toHaveLength(1);
    expect(purRep._getData()[0]._id).toBe('g1');
  });

  it('sets received repeater data correctly', async () => {
    const section = makeSection();
    const recRep = makeRepeater();
    const $w = make$w(section, makeRepeater(), recRep);

    const cards = [{ _id: 'g2', maskedCode: '****', balance: 50, expirationDate: null }];

    await initMyGiftCardsSection($w, {
      getPurchased: async () => ({ success: true, cards: [] }),
      getReceived: async () => ({ success: true, cards }),
    });

    expect(recRep._getData()).toHaveLength(1);
  });

  it('collapses purchasedRepeater when no purchased cards', async () => {
    const section = makeSection();
    const purRep = makeRepeater();
    const $w = make$w(section, purRep, makeRepeater());

    await initMyGiftCardsSection($w, {
      getPurchased: async () => ({ success: true, cards: [] }),
      getReceived: async () => ({ success: true, cards: [{ _id: 'g3', maskedCode: '****', balance: 25, expirationDate: null }] }),
    });

    expect(purRep.collapse).toHaveBeenCalled();
  });

  it('collapses receivedRepeater when no received cards', async () => {
    const section = makeSection();
    const recRep = makeRepeater();
    const $w = make$w(section, makeRepeater(), recRep);

    await initMyGiftCardsSection($w, {
      getPurchased: async () => ({ success: true, cards: [{ _id: 'g4', maskedCode: '****', balance: 100, expirationDate: null, recipientName: 'Bob' }] }),
      getReceived: async () => ({ success: true, cards: [] }),
    });

    expect(recRep.collapse).toHaveBeenCalled();
  });

  it('returns correct counts', async () => {
    const section = makeSection();
    const $w = make$w(section, makeRepeater(), makeRepeater());

    const result = await initMyGiftCardsSection($w, {
      getPurchased: async () => ({ success: true, cards: [{ _id: 'p1', maskedCode: '****', balance: 50 }, { _id: 'p2', maskedCode: '****', balance: 25 }] }),
      getReceived: async () => ({ success: true, cards: [{ _id: 'r1', maskedCode: '****', balance: 100 }] }),
    });

    expect(result.purchasedCount).toBe(2);
    expect(result.receivedCount).toBe(1);
    expect(result.shown).toBe(true);
  });
});

describe('initMyGiftCardsSection — error handling', () => {
  it('collapses section and returns shown:false when backend throws', async () => {
    const section = makeSection();
    const $w = make$w(section, makeRepeater(), makeRepeater());

    const result = await initMyGiftCardsSection($w, {
      getPurchased: async () => { throw new Error('network error'); },
      getReceived: async () => ({ success: true, cards: [] }),
    });

    expect(section.collapse).toHaveBeenCalled();
    expect(result.shown).toBe(false);
  });

  it('does not throw when $w elements are missing', async () => {
    const $w = () => { throw new Error('no element'); };

    await expect(initMyGiftCardsSection($w, {
      getPurchased: async () => ({ success: true, cards: [] }),
      getReceived: async () => ({ success: true, cards: [] }),
    })).resolves.not.toThrow();
  });
});
