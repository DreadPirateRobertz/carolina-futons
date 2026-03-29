/**
 * Tests for lifecycleCron.js — scanLifecycleMilestones
 * (CF-3izl.1)
 *
 * Covers:
 * - No orders → returns empty results
 * - Day 7 detection: exact day 7, day 6 (edge), day 8 (edge), day 5 (miss), day 9 (miss)
 * - Month 1 detection: exact day 30, day 29 (edge), day 31 (edge), day 28 (miss), day 32 (miss)
 * - Year 1 detection: exact day 365, day 364 (edge), day 366 (edge), day 363 (miss), day 367 (miss)
 * - Multiple milestones same day: multiple orders each hitting different milestones
 * - Single order at Day 7: correct shape {orderId, memberId, email, milestone, orderDate}
 * - Orders missing memberId still included (memberId may be empty for guests)
 * - Orders missing email skipped (can't send lifecycle without contact)
 * - Duplicate prevention: same orderId+milestone not returned twice
 * - ordersScanned count matches total orders fetched
 * - milestonesFound count matches results.length
 * - Pagination: processes more than 100 orders
 * - Error resilience: wixData failure returns success:false
 * - Exported constants: DAY7_WINDOW, MONTH1_WINDOW, YEAR1_WINDOW
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  __reset,
  __seed,
  __setQueryError,
} from 'wix-data';

import {
  scanLifecycleMilestones,
  _DAY7_WINDOW,
  _MONTH1_WINDOW,
  _YEAR1_WINDOW,
} from '../src/backend/lifecycleCron.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build an order placed exactly `daysAgo` days in the past. */
function orderAt(daysAgo, overrides = {}) {
  const orderDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    _id: `order-${daysAgo}-${Math.random().toString(36).slice(2, 6)}`,
    _createdDate: orderDate,
    buyerInfo: {
      email: `buyer${daysAgo}@example.com`,
      memberId: `mem-${daysAgo}`,
    },
    ...overrides,
  };
}

/** Override _id for deterministic dedup tests. */
function namedOrder(id, daysAgo, overrides = {}) {
  return {
    ...orderAt(daysAgo),
    _id: id,
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  __reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// Exported constants
// ═════════════════════════════════════════════════════════════════════════════

describe('module constants', () => {
  it('DAY7_WINDOW covers [6, 8] inclusive', () => {
    expect(_DAY7_WINDOW).toEqual({ minDays: 6, maxDays: 8 });
  });

  it('MONTH1_WINDOW covers [29, 31] inclusive', () => {
    expect(_MONTH1_WINDOW).toEqual({ minDays: 29, maxDays: 31 });
  });

  it('YEAR1_WINDOW covers [364, 366] inclusive', () => {
    expect(_YEAR1_WINDOW).toEqual({ minDays: 364, maxDays: 366 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Empty orders
// ═════════════════════════════════════════════════════════════════════════════

describe('scanLifecycleMilestones — no orders', () => {
  it('returns success with zero counts', async () => {
    __seed('Stores/Orders', []);
    const result = await scanLifecycleMilestones();
    expect(result.success).toBe(true);
    expect(result.ordersScanned).toBe(0);
    expect(result.milestonesFound).toBe(0);
    expect(result.results).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Day 7 milestone
// ═════════════════════════════════════════════════════════════════════════════

describe('Day 7 detection', () => {
  it('detects order placed exactly 7 days ago', async () => {
    __seed('Stores/Orders', [orderAt(7)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].milestone).toBe('day_7');
  });

  it('detects order at day 6 (lower edge)', async () => {
    __seed('Stores/Orders', [orderAt(6)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].milestone).toBe('day_7');
  });

  it('detects order at day 8 (upper edge)', async () => {
    __seed('Stores/Orders', [orderAt(8)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].milestone).toBe('day_7');
  });

  it('misses order at day 5 (before window)', async () => {
    __seed('Stores/Orders', [orderAt(5)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(0);
  });

  it('misses order at day 9 (after window)', async () => {
    __seed('Stores/Orders', [orderAt(9)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(0);
  });

  it('result has correct shape', async () => {
    const order = namedOrder('ord-day7', 7, {
      buyerInfo: { email: 'test@example.com', memberId: 'mem-abc' },
    });
    __seed('Stores/Orders', [order]);
    const result = await scanLifecycleMilestones();
    const hit = result.results[0];
    expect(hit.orderId).toBe('ord-day7');
    expect(hit.memberId).toBe('mem-abc');
    expect(hit.email).toBe('test@example.com');
    expect(hit.milestone).toBe('day_7');
    expect(hit.orderDate).toBeInstanceOf(Date);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Month 1 milestone
// ═════════════════════════════════════════════════════════════════════════════

describe('Month 1 detection', () => {
  it('detects order placed exactly 30 days ago', async () => {
    __seed('Stores/Orders', [orderAt(30)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].milestone).toBe('month_1');
  });

  it('detects order at day 29 (lower edge)', async () => {
    __seed('Stores/Orders', [orderAt(29)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].milestone).toBe('month_1');
  });

  it('detects order at day 31 (upper edge)', async () => {
    __seed('Stores/Orders', [orderAt(31)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].milestone).toBe('month_1');
  });

  it('misses order at day 28 (before window)', async () => {
    __seed('Stores/Orders', [orderAt(28)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(0);
  });

  it('misses order at day 32 (after window)', async () => {
    __seed('Stores/Orders', [orderAt(32)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(0);
  });

  it('result has correct milestone label', async () => {
    __seed('Stores/Orders', [orderAt(30)]);
    const result = await scanLifecycleMilestones();
    expect(result.results[0].milestone).toBe('month_1');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Year 1 milestone
// ═════════════════════════════════════════════════════════════════════════════

describe('Year 1 detection', () => {
  it('detects order placed exactly 365 days ago', async () => {
    __seed('Stores/Orders', [orderAt(365)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].milestone).toBe('year_1');
  });

  it('detects order at day 364 (lower edge)', async () => {
    __seed('Stores/Orders', [orderAt(364)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].milestone).toBe('year_1');
  });

  it('detects order at day 366 (upper edge)', async () => {
    __seed('Stores/Orders', [orderAt(366)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].milestone).toBe('year_1');
  });

  it('misses order at day 363 (before window)', async () => {
    __seed('Stores/Orders', [orderAt(363)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(0);
  });

  it('misses order at day 367 (after window)', async () => {
    __seed('Stores/Orders', [orderAt(367)]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(0);
  });

  it('result has correct milestone label', async () => {
    __seed('Stores/Orders', [orderAt(365)]);
    const result = await scanLifecycleMilestones();
    expect(result.results[0].milestone).toBe('year_1');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Multiple milestones same day
// ═════════════════════════════════════════════════════════════════════════════

describe('multiple milestones same day', () => {
  it('detects all three milestones when each has a qualifying order', async () => {
    __seed('Stores/Orders', [
      namedOrder('ord-a', 7),
      namedOrder('ord-b', 30),
      namedOrder('ord-c', 365),
    ]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(3);
    const milestones = result.results.map(r => r.milestone).sort();
    expect(milestones).toEqual(['day_7', 'month_1', 'year_1']);
  });

  it('counts all qualifying orders toward milestonesFound', async () => {
    __seed('Stores/Orders', [
      namedOrder('ord-1', 7),
      namedOrder('ord-2', 7),
      namedOrder('ord-3', 30),
    ]);
    const result = await scanLifecycleMilestones();
    expect(result.milestonesFound).toBe(3);
    expect(result.results).toHaveLength(3);
  });

  it('returns correct orderId for each milestone hit', async () => {
    __seed('Stores/Orders', [
      namedOrder('ord-day7', 7),
      namedOrder('ord-month1', 30),
      namedOrder('ord-year1', 365),
    ]);
    const result = await scanLifecycleMilestones();
    const byMilestone = Object.fromEntries(result.results.map(r => [r.milestone, r.orderId]));
    expect(byMilestone.day_7).toBe('ord-day7');
    expect(byMilestone.month_1).toBe('ord-month1');
    expect(byMilestone.year_1).toBe('ord-year1');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Nothing due
// ═════════════════════════════════════════════════════════════════════════════

describe('nothing due', () => {
  it('returns empty results when all orders are outside all windows', async () => {
    __seed('Stores/Orders', [
      orderAt(1),   // today-ish
      orderAt(15),  // between Day 7 and Month 1
      orderAt(60),  // between Month 1 and Year 1
      orderAt(200), // past Month 1, before Year 1
      orderAt(400), // past Year 1
    ]);
    const result = await scanLifecycleMilestones();
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
    expect(result.milestonesFound).toBe(0);
    expect(result.ordersScanned).toBe(5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Duplicate prevention
// ═════════════════════════════════════════════════════════════════════════════

describe('duplicate prevention', () => {
  it('does not return the same orderId+milestone combo twice', async () => {
    // The query mock could theoretically return the same item twice (e.g. pagination overlap).
    // The implementation should dedup on orderId+milestone.
    const order = namedOrder('ord-dup', 7);
    // Seed with the same logical order twice to simulate a dedup scenario
    __seed('Stores/Orders', [
      { ...order, _id: 'ord-dup' },
      { ...order, _id: 'ord-dup' }, // same _id
    ]);
    const result = await scanLifecycleMilestones();
    const day7Hits = result.results.filter(r => r.orderId === 'ord-dup' && r.milestone === 'day_7');
    expect(day7Hits).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Guest orders (no memberId)
// ═════════════════════════════════════════════════════════════════════════════

describe('guest orders (no memberId)', () => {
  it('includes order with empty memberId if email is present', async () => {
    const order = namedOrder('ord-guest', 7, {
      buyerInfo: { email: 'guest@example.com', memberId: '' },
    });
    __seed('Stores/Orders', [order]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].memberId).toBe('');
    expect(result.results[0].email).toBe('guest@example.com');
  });

  it('includes order with null memberId if email is present', async () => {
    const order = namedOrder('ord-nullmem', 7, {
      buyerInfo: { email: 'guest2@example.com', memberId: null },
    });
    __seed('Stores/Orders', [order]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].memberId).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Orders without email skipped
// ═════════════════════════════════════════════════════════════════════════════

describe('orders without email', () => {
  it('skips orders with no email even if milestone qualifies', async () => {
    const order = namedOrder('ord-noemail', 7, {
      buyerInfo: { email: '', memberId: 'mem-x' },
    });
    __seed('Stores/Orders', [order]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(0);
  });

  it('skips orders with null buyerInfo', async () => {
    const order = namedOrder('ord-nobuyerinfo', 7, { buyerInfo: null });
    __seed('Stores/Orders', [order]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(0);
  });

  it('skips orders with null _createdDate', async () => {
    const order = namedOrder('ord-nodate', 7, { _createdDate: null });
    __seed('Stores/Orders', [order]);
    const result = await scanLifecycleMilestones();
    expect(result.results).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ordersScanned count
// ═════════════════════════════════════════════════════════════════════════════

describe('ordersScanned count', () => {
  it('counts all orders fetched regardless of milestone hits', async () => {
    __seed('Stores/Orders', [
      orderAt(1),
      orderAt(7),
      orderAt(50),
      orderAt(365),
    ]);
    const result = await scanLifecycleMilestones();
    expect(result.ordersScanned).toBe(4);
    expect(result.milestonesFound).toBe(2); // day_7 and year_1
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Pagination
// ═════════════════════════════════════════════════════════════════════════════

describe('pagination', () => {
  it('processes more than 100 orders', async () => {
    // Build 150 orders — 100 in day-1 (no milestone), 1 at day 7, 49 at day-50 (no milestone)
    const orders = [];
    for (let i = 0; i < 100; i++) orders.push(orderAt(1));
    orders.push(namedOrder('ord-paginated-day7', 7));
    for (let i = 0; i < 49; i++) orders.push(orderAt(50));
    __seed('Stores/Orders', orders);

    const result = await scanLifecycleMilestones();
    expect(result.ordersScanned).toBe(150);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].orderId).toBe('ord-paginated-day7');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Error resilience
// ═════════════════════════════════════════════════════════════════════════════

describe('error resilience', () => {
  it('returns success:false when wixData query throws', async () => {
    __setQueryError('Stores/Orders', new Error('DB unavailable'));
    const result = await scanLifecycleMilestones();
    expect(result.success).toBe(false);
    expect(result.results).toEqual([]);
  });

  it('logs the error', async () => {
    __setQueryError('Stores/Orders', new Error('timeout'));
    await scanLifecycleMilestones();
    expect(console.error).toHaveBeenCalled();
  });
});
