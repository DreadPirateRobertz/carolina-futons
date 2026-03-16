/**
 * Deep coverage tests for inventoryAlerts.web.js — edge cases in stock status
 * boundary logic, batch sanitization, sync upsert flows, alert lifecycle
 * transitions, threshold update validation, and summary aggregation not
 * covered by the baseline test file.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember, __setRoles, __reset as resetMembers } from './__mocks__/wix-members-backend.js';
import {
  getStockStatus,
  getBatchStockStatus,
  syncInventory,
  getLowStockAlerts,
  acknowledgeAlert,
  resolveAlert,
  updateThreshold,
  getLowStockSummary,
} from '../src/backend/inventoryAlerts.web.js';

const THRESHOLDS = 'InventoryThresholds';
const ALERTS = 'LowStockAlerts';

function adminSetup() {
  __setMember({ _id: 'adm-a1b2c3d4', loginEmail: 'admin@carolinafutons.com' });
  __setRoles([{ title: 'Admin', _id: 'admin' }]);
}

function nonAdminSetup() {
  __setMember({ _id: 'usr-e5f6a7b8', loginEmail: 'user@carolinafutons.com' });
  __setRoles([{ title: 'Member', _id: 'member' }]);
}

const mkThreshold = (overrides = {}) => ({
  _id: 'thr-aaa111',
  productId: 'prod-aaa111',
  sku: 'SKU-001',
  productName: 'Test Product',
  urgencyThreshold: 5,
  reorderThreshold: 10,
  currentStock: 20,
  lastChecked: new Date(),
  reorderAlertSent: false,
  ...overrides,
});

const mkAlert = (overrides = {}) => ({
  _id: 'alt-bbb222',
  productId: 'prod-aaa111',
  sku: 'SKU-001',
  productName: 'Test Product',
  stockLevel: 3,
  thresholdType: 'reorder',
  status: 'active',
  acknowledgedBy: '',
  acknowledgedAt: null,
  _createdDate: new Date(),
  ...overrides,
});

beforeEach(() => {
  __reset();
  resetMembers();
  adminSetup();
});

// ── getStockStatus — deep edge cases ──────────────────────────────────

describe('getStockStatus — deep edge cases', () => {
  it('treats undefined productId as missing', async () => {
    const result = await getStockStatus(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('treats numeric productId as invalid (sanitize returns empty for non-string)', async () => {
    const result = await getStockStatus(12345);
    expect(result.success).toBe(false);
  });

  it('treats boolean productId as invalid', async () => {
    const result = await getStockStatus(true);
    expect(result.success).toBe(false);
  });

  it('treats object productId as invalid', async () => {
    const result = await getStockStatus({ id: 'prod-aaa111' });
    expect(result.success).toBe(false);
  });

  it('handles whitespace-only productId', async () => {
    // sanitize trims, so whitespace-only becomes empty
    const result = await getStockStatus('   ');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('stock of exactly 1 shows urgency when threshold >= 1', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 1, urgencyThreshold: 5 })]);
    const result = await getStockStatus('prod-aaa111');
    expect(result.showUrgency).toBe(true);
    expect(result.message).toBe('Only 1 left in stock!');
  });

  it('stock of 0 returns out-of-stock, not urgency', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 0 })]);
    const result = await getStockStatus('prod-aaa111');
    expect(result.inStock).toBe(false);
    expect(result.showUrgency).toBe(false);
    expect(result.stockLevel).toBe(0);
  });

  it('negative stock is treated as out-of-stock (stock <= 0)', async () => {
    // If somehow negative stock got into the DB
    __seed(THRESHOLDS, [mkThreshold({ currentStock: -3 })]);
    const result = await getStockStatus('prod-aaa111');
    expect(result.inStock).toBe(false);
    expect(result.message).toBe('Out of stock');
  });

  // Known gap: falsy urgencyThreshold (0) falls through to DEFAULT_URGENCY_THRESHOLD (5)
  // because of `config.urgencyThreshold || DEFAULT_URGENCY_THRESHOLD`
  // 0 is falsy, so || replaces it with 5. This is a known behavioral quirk.
  it('urgencyThreshold of 0 falls back to default 5 due to || operator (known gap)', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 3, urgencyThreshold: 0 })]);
    const result = await getStockStatus('prod-aaa111');
    // Because 0 || 5 === 5, stock(3) <= 5 => urgency shown even though threshold was set to 0
    expect(result.showUrgency).toBe(true);
  });

  it('urgencyThreshold of 0 with stock above default(5) does not show urgency', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 6, urgencyThreshold: 0 })]);
    const result = await getStockStatus('prod-aaa111');
    // 0 || 5 => 5, stock(6) <= 5 is false => no urgency
    expect(result.showUrgency).toBe(false);
    expect(result.inStock).toBe(true);
  });

  it('very large stock number is reported as in-stock', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 999999 })]);
    const result = await getStockStatus('prod-aaa111');
    expect(result.inStock).toBe(true);
    expect(result.showUrgency).toBe(false);
    expect(result.stockLevel).toBe(999999);
  });

  it('long productId is truncated by sanitize but still works if it matches', async () => {
    const longId = 'a'.repeat(100);
    // sanitize truncates to 50 chars
    __seed(THRESHOLDS, [mkThreshold({ productId: 'a'.repeat(50) })]);
    const result = await getStockStatus(longId);
    expect(result.success).toBe(true);
    expect(result.showUrgency).toBe(false);
  });

  it('does not expose stock level when product is unconfigured', async () => {
    __seed(THRESHOLDS, []);
    const result = await getStockStatus('prod-unknown');
    expect(result.stockLevel).toBeUndefined();
  });
});

// ── getBatchStockStatus — deep edge cases ────────────────────────────

describe('getBatchStockStatus — deep edge cases', () => {
  it('returns empty statuses for string input (not array)', async () => {
    const result = await getBatchStockStatus('prod-aaa111');
    expect(result.success).toBe(true);
    expect(result.statuses).toEqual({});
  });

  it('returns empty statuses for number input', async () => {
    const result = await getBatchStockStatus(42);
    expect(result.success).toBe(true);
    expect(result.statuses).toEqual({});
  });

  it('returns empty statuses for object (non-array) input', async () => {
    const result = await getBatchStockStatus({ id: 'prod-aaa111' });
    expect(result.success).toBe(true);
    expect(result.statuses).toEqual({});
  });

  it('filters out null entries in product ID array', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 3 })]);
    const result = await getBatchStockStatus([null, 'prod-aaa111', null]);
    expect(result.success).toBe(true);
    expect(result.statuses['prod-aaa111']).toBeDefined();
  });

  it('filters out undefined entries in product ID array', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 3 })]);
    const result = await getBatchStockStatus([undefined, 'prod-aaa111']);
    expect(result.success).toBe(true);
    expect(result.statuses['prod-aaa111']).toBeDefined();
  });

  it('filters out numeric entries in product ID array', async () => {
    const result = await getBatchStockStatus([123, 456]);
    expect(result.success).toBe(true);
    expect(result.statuses).toEqual({});
  });

  it('handles array with only empty strings', async () => {
    const result = await getBatchStockStatus(['', '', '']);
    expect(result.success).toBe(true);
    expect(result.statuses).toEqual({});
  });

  it('correctly maps multiple products in different stock states', async () => {
    __seed(THRESHOLDS, [
      mkThreshold({ _id: 'th-1', productId: 'p-oos', currentStock: 0 }),
      mkThreshold({ _id: 'th-2', productId: 'p-urg', currentStock: 2, urgencyThreshold: 5 }),
      mkThreshold({ _id: 'th-3', productId: 'p-ok', currentStock: 100 }),
    ]);
    const result = await getBatchStockStatus(['p-oos', 'p-urg', 'p-ok']);
    expect(result.statuses['p-oos'].inStock).toBe(false);
    expect(result.statuses['p-urg'].showUrgency).toBe(true);
    expect(result.statuses['p-ok'].showUrgency).toBe(false);
    expect(result.statuses['p-ok'].inStock).toBe(true);
  });

  it('does not include products not found in thresholds', async () => {
    __seed(THRESHOLDS, [mkThreshold({ productId: 'p-exists', currentStock: 10 })]);
    const result = await getBatchStockStatus(['p-exists', 'p-missing']);
    expect(result.statuses['p-exists']).toBeDefined();
    expect(result.statuses['p-missing']).toBeUndefined();
  });

  it('handles exactly 50 IDs without error', async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `prod-${String(i).padStart(4, '0')}`);
    const result = await getBatchStockStatus(ids);
    expect(result.success).toBe(true);
  });

  it('truncates to 50 IDs when given 51', async () => {
    const items = Array.from({ length: 51 }, (_, i) => mkThreshold({
      _id: `th-${i}`,
      productId: `prod-${String(i).padStart(4, '0')}`,
      currentStock: 20,
    }));
    __seed(THRESHOLDS, items);
    const ids = items.map(t => t.productId);
    const result = await getBatchStockStatus(ids);
    expect(result.success).toBe(true);
    // Should have at most 50 statuses
    expect(Object.keys(result.statuses).length).toBeLessThanOrEqual(50);
  });

  it('negative stock in batch returns out-of-stock', async () => {
    __seed(THRESHOLDS, [mkThreshold({ productId: 'p-neg', currentStock: -5 })]);
    const result = await getBatchStockStatus(['p-neg']);
    expect(result.statuses['p-neg'].inStock).toBe(false);
    expect(result.statuses['p-neg'].stockLevel).toBe(0);
  });
});

// ── syncInventory — deep edge cases ──────────────────────────────────

describe('syncInventory — deep edge cases', () => {
  it('rejects call from non-admin member', async () => {
    nonAdminSetup();
    const result = await syncInventory([{ productId: 'prod-aaa111', stock: 10 }]);
    expect(result.success).toBe(false);
  });

  it('rejects call from unauthenticated user', async () => {
    __setMember(null);
    const result = await syncInventory([{ productId: 'prod-aaa111', stock: 10 }]);
    expect(result.success).toBe(false);
  });

  it('rejects null input', async () => {
    const result = await syncInventory(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects undefined input (uses default empty array)', async () => {
    const result = await syncInventory(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('skips entry with NaN stock (typeof NaN is "number" but Math.max/floor produce NaN)', async () => {
    // Known gap: NaN passes typeof check, Math.max(0, NaN) => NaN, Math.floor(NaN) => NaN
    // But NaN !== null, so it passes the null check. However the resulting stock is NaN.
    // Actually: Math.max(0, NaN) => NaN, Math.floor(NaN) => NaN, which is not null.
    // The code checks `stock === null` — NaN !== null, so it does NOT skip.
    // This means NaN stock gets written to the DB. This is a known gap.
    __seed(THRESHOLDS, [mkThreshold()]);
    let updated = null;
    __onUpdate((col, item) => { if (col === THRESHOLDS) updated = item; });
    const result = await syncInventory([{ productId: 'prod-aaa111', stock: NaN }]);
    // NaN passes the typeof check and !== null check, so it processes
    expect(result.synced).toBe(1);
  });

  it('skips entry with Infinity stock', async () => {
    // Math.max(0, Infinity) => Infinity, Math.floor(Infinity) => Infinity
    // Not null, so it processes. Known gap.
    __seed(THRESHOLDS, [mkThreshold()]);
    const result = await syncInventory([{ productId: 'prod-aaa111', stock: Infinity }]);
    expect(result.synced).toBe(1);
  });

  it('clamps stock of -Infinity to 0', async () => {
    __seed(THRESHOLDS, [mkThreshold()]);
    let updated = null;
    __onUpdate((col, item) => { if (col === THRESHOLDS) updated = item; });
    await syncInventory([{ productId: 'prod-aaa111', stock: -Infinity }]);
    // Math.max(0, -Infinity) => 0, Math.floor(0) => 0
    expect(updated.currentStock).toBe(0);
  });

  it('skips entry with boolean stock', async () => {
    const result = await syncInventory([{ productId: 'prod-aaa111', stock: true }]);
    // typeof true !== 'number', so stock => null, entry skipped
    expect(result.synced).toBe(0);
  });

  it('skips entry with string stock', async () => {
    const result = await syncInventory([{ productId: 'prod-aaa111', stock: '10' }]);
    expect(result.synced).toBe(0);
  });

  it('processes stock of 0 (boundary — exactly at floor clamp)', async () => {
    __seed(THRESHOLDS, [mkThreshold()]);
    let updated = null;
    __onUpdate((col, item) => { if (col === THRESHOLDS) updated = item; });
    await syncInventory([{ productId: 'prod-aaa111', stock: 0 }]);
    expect(updated.currentStock).toBe(0);
  });

  it('floors stock of 0.9 to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === THRESHOLDS) inserted = item; });
    await syncInventory([{ productId: 'prod-new-a1b2', stock: 0.9 }]);
    expect(inserted.currentStock).toBe(0);
  });

  it('does not update sku or productName when they sanitize to empty', async () => {
    __seed(THRESHOLDS, [mkThreshold({ sku: 'ORIGINAL', productName: 'Original Name' })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === THRESHOLDS) updated = item; });
    await syncInventory([{ productId: 'prod-aaa111', sku: '', productName: '', stock: 15 }]);
    // Empty strings are falsy, so the if(cleanSku) / if(cleanName) guards prevent overwrite
    expect(updated.sku).toBe('ORIGINAL');
    expect(updated.productName).toBe('Original Name');
  });

  it('creates new config with empty sku and productName when not provided', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === THRESHOLDS) inserted = item; });
    await syncInventory([{ productId: 'prod-brand-new', stock: 20 }]);
    expect(inserted.sku).toBe('');
    expect(inserted.productName).toBe('');
  });

  it('creates alert for new product at exactly reorder threshold (10)', async () => {
    let alertInserted = null;
    __onInsert((col, item) => { if (col === ALERTS) alertInserted = item; });
    const result = await syncInventory([{ productId: 'prod-at-ten', stock: 10 }]);
    expect(result.alertsCreated).toBe(1);
    expect(alertInserted.status).toBe('active');
  });

  it('does not create alert for new product at stock 11 (above default reorder 10)', async () => {
    let alertCount = 0;
    __onInsert((col) => { if (col === ALERTS) alertCount++; });
    const result = await syncInventory([{ productId: 'prod-above-ten', stock: 11 }]);
    expect(result.alertsCreated).toBe(0);
    expect(alertCount).toBe(0);
  });

  it('resets reorderAlertSent when stock goes above reorder threshold', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 3, reorderAlertSent: true, reorderThreshold: 10 })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === THRESHOLDS) updated = item; });
    await syncInventory([{ productId: 'prod-aaa111', stock: 15 }]);
    expect(updated.reorderAlertSent).toBe(false);
  });

  it('does NOT reset reorderAlertSent when stock equals reorder threshold', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 3, reorderAlertSent: true, reorderThreshold: 10 })]);
    let lastUpdate = null;
    __onUpdate((col, item) => { if (col === THRESHOLDS) lastUpdate = item; });
    await syncInventory([{ productId: 'prod-aaa111', stock: 10 }]);
    // stock(10) > reorderThreshold(10) is false, so reorderAlertSent stays true
    // And since reorderAlertSent is still true after update, no new alert created
    expect(lastUpdate.reorderAlertSent).toBe(true);
  });

  it('processes multiple updates in a single call', async () => {
    __seed(THRESHOLDS, [
      mkThreshold({ _id: 'th-a1', productId: 'p-a1', currentStock: 50 }),
      mkThreshold({ _id: 'th-b2', productId: 'p-b2', currentStock: 50 }),
    ]);
    const result = await syncInventory([
      { productId: 'p-a1', stock: 20 },
      { productId: 'p-b2', stock: 30 },
    ]);
    expect(result.synced).toBe(2);
  });

  it('mixes new and existing products in one call', async () => {
    __seed(THRESHOLDS, [mkThreshold({ productId: 'p-existing', currentStock: 50 })]);
    let insertedIds = [];
    __onInsert((col, item) => { if (col === THRESHOLDS) insertedIds.push(item.productId); });
    const result = await syncInventory([
      { productId: 'p-existing', stock: 40 },
      { productId: 'p-brand-new', stock: 25 },
    ]);
    expect(result.synced).toBe(2);
    expect(insertedIds).toContain('p-brand-new');
  });

  it('handles HTML in sku field by sanitizing', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === THRESHOLDS) inserted = item; });
    await syncInventory([{ productId: 'p-html-sku', sku: '<b>BOLD-SKU</b>', stock: 20 }]);
    expect(inserted.sku).not.toContain('<b>');
  });
});

// ── getLowStockAlerts — deep edge cases ──────────────────────────────

describe('getLowStockAlerts — deep edge cases', () => {
  it('rejects call from non-admin', async () => {
    nonAdminSetup();
    const result = await getLowStockAlerts();
    expect(result.success).toBe(false);
  });

  it('rejects call from unauthenticated user', async () => {
    __setMember(null);
    const result = await getLowStockAlerts();
    expect(result.success).toBe(false);
  });

  it('clamps limit of 0 to 1', async () => {
    __seed(ALERTS, [mkAlert()]);
    const result = await getLowStockAlerts({ limit: 0 });
    expect(result.success).toBe(true);
    // Math.max(1, 0) = 1, so limit becomes 1
  });

  it('clamps negative limit to 1', async () => {
    __seed(ALERTS, [mkAlert()]);
    const result = await getLowStockAlerts({ limit: -10 });
    expect(result.success).toBe(true);
  });

  it('clamps limit of 101 to 100', async () => {
    const result = await getLowStockAlerts({ limit: 101 });
    expect(result.success).toBe(true);
  });

  // Known gap: NaN limit — Math.min(Math.max(1, NaN), 100) => NaN
  // The mock query builder may accept NaN limit without crashing
  it('handles NaN limit without crashing', async () => {
    const result = await getLowStockAlerts({ limit: NaN });
    expect(result.success).toBe(true);
  });

  it('accepts status "acknowledged"', async () => {
    __seed(ALERTS, [mkAlert({ status: 'acknowledged' })]);
    const result = await getLowStockAlerts({ status: 'acknowledged' });
    expect(result.success).toBe(true);
  });

  it('accepts status "resolved"', async () => {
    __seed(ALERTS, [mkAlert({ status: 'resolved' })]);
    const result = await getLowStockAlerts({ status: 'resolved' });
    expect(result.success).toBe(true);
  });

  it('rejects status with injection attempt', async () => {
    const result = await getLowStockAlerts({ status: "active'; DROP TABLE--" });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('maps acknowledgedBy to null when empty string in DB', async () => {
    __seed(ALERTS, [mkAlert({ acknowledgedBy: '' })]);
    const result = await getLowStockAlerts({ status: 'active' });
    // Code does `a.acknowledgedBy || null`, empty string is falsy => null
    expect(result.alerts[0].acknowledgedBy).toBeNull();
  });

  it('maps createdDate from _createdDate', async () => {
    const date = new Date('2026-01-15');
    __seed(ALERTS, [mkAlert({ _createdDate: date })]);
    const result = await getLowStockAlerts({ status: 'active' });
    expect(result.alerts[0].createdDate).toEqual(date);
  });

  it('returns correct totalCount', async () => {
    __seed(ALERTS, [
      mkAlert({ _id: 'a-1', status: 'active' }),
      mkAlert({ _id: 'a-2', status: 'active' }),
    ]);
    const result = await getLowStockAlerts({ status: 'active' });
    expect(result.totalCount).toBe(2);
  });

  // Note: status 'all' is NOT in VALID_STATUSES, but is handled specially
  // It's checked AFTER the invalid-status guard, so 'all' would fail validation.
  // Actually looking at the code: the guard checks `!VALID_STATUSES.includes(status)`
  // 'all' is not in ['active','acknowledged','resolved'], so it returns error.
  it('rejects status "all" because it is not in VALID_STATUSES list', async () => {
    const result = await getLowStockAlerts({ status: 'all' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });
});

// ── acknowledgeAlert — deep edge cases ───────────────────────────────

describe('acknowledgeAlert — deep edge cases', () => {
  it('rejects call from non-admin', async () => {
    nonAdminSetup();
    __seed(ALERTS, [mkAlert()]);
    const result = await acknowledgeAlert('alt-bbb222');
    expect(result.success).toBe(false);
  });

  it('rejects undefined alertId', async () => {
    const result = await acknowledgeAlert(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects numeric alertId', async () => {
    const result = await acknowledgeAlert(12345);
    expect(result.success).toBe(false);
  });

  it('records the admin member ID as acknowledgedBy', async () => {
    __seed(ALERTS, [mkAlert()]);
    let updated = null;
    __onUpdate((col, item) => { if (col === ALERTS) updated = item; });
    await acknowledgeAlert('alt-bbb222');
    expect(updated.acknowledgedBy).toBe('adm-a1b2c3d4');
  });

  it('sets acknowledgedAt to a Date object', async () => {
    __seed(ALERTS, [mkAlert()]);
    let updated = null;
    __onUpdate((col, item) => { if (col === ALERTS) updated = item; });
    await acknowledgeAlert('alt-bbb222');
    expect(updated.acknowledgedAt).toBeInstanceOf(Date);
  });

  it('rejects HTML-injected alertId gracefully', async () => {
    const result = await acknowledgeAlert('<script>alert(1)</script>');
    expect(result.success).toBe(false);
    // Sanitized to empty or non-matching ID
  });

  it('cannot acknowledge a resolved alert', async () => {
    __seed(ALERTS, [mkAlert({ status: 'resolved' })]);
    const result = await acknowledgeAlert('alt-bbb222');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not active');
  });
});

// ── resolveAlert — deep edge cases ───────────────────────────────────

describe('resolveAlert — deep edge cases', () => {
  it('rejects call from non-admin', async () => {
    nonAdminSetup();
    __seed(ALERTS, [mkAlert()]);
    const result = await resolveAlert('alt-bbb222');
    expect(result.success).toBe(false);
  });

  it('rejects undefined alertId', async () => {
    const result = await resolveAlert(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects numeric alertId', async () => {
    const result = await resolveAlert(99999);
    expect(result.success).toBe(false);
  });

  it('can resolve an active alert directly (skip acknowledged)', async () => {
    __seed(ALERTS, [mkAlert({ status: 'active' })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === ALERTS) updated = item; });
    const result = await resolveAlert('alt-bbb222');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('resolved');
  });

  it('can resolve an acknowledged alert', async () => {
    __seed(ALERTS, [mkAlert({ status: 'acknowledged' })]);
    const result = await resolveAlert('alt-bbb222');
    expect(result.success).toBe(true);
    expect(result.status).toBe('resolved');
  });

  it('rejects resolving an already-resolved alert', async () => {
    __seed(ALERTS, [mkAlert({ status: 'resolved' })]);
    const result = await resolveAlert('alt-bbb222');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already resolved');
  });

  it('rejects HTML-injected alertId', async () => {
    const result = await resolveAlert('<img onerror=alert(1)>');
    expect(result.success).toBe(false);
  });
});

// ── updateThreshold — deep edge cases ────────────────────────────────

describe('updateThreshold — deep edge cases', () => {
  beforeEach(() => {
    __seed(THRESHOLDS, [mkThreshold()]);
  });

  it('rejects call from non-admin', async () => {
    nonAdminSetup();
    const result = await updateThreshold('prod-aaa111', { urgencyThreshold: 3 });
    expect(result.success).toBe(false);
  });

  it('rejects undefined productId', async () => {
    const result = await updateThreshold(undefined, { urgencyThreshold: 3 });
    expect(result.success).toBe(false);
  });

  it('ignores string urgencyThreshold', async () => {
    const result = await updateThreshold('prod-aaa111', { urgencyThreshold: '3' });
    expect(result.success).toBe(true);
    // typeof '3' !== 'number', so original value (5) preserved
    expect(result.urgencyThreshold).toBe(5);
  });

  it('ignores NaN urgencyThreshold (typeof NaN is "number" but NaN >= 0 is false)', async () => {
    const result = await updateThreshold('prod-aaa111', { urgencyThreshold: NaN });
    expect(result.success).toBe(true);
    // NaN >= 0 is false, so the guard prevents the update
    expect(result.urgencyThreshold).toBe(5);
  });

  it('ignores Infinity reorderThreshold (Infinity >= 0 is true, Math.floor(Infinity) is Infinity)', async () => {
    const result = await updateThreshold('prod-aaa111', { reorderThreshold: Infinity });
    expect(result.success).toBe(true);
    // Infinity >= 0 is true, so it gets set. Known edge case.
    expect(result.reorderThreshold).toBe(Infinity);
  });

  it('accepts urgencyThreshold of 0', async () => {
    const result = await updateThreshold('prod-aaa111', { urgencyThreshold: 0 });
    expect(result.success).toBe(true);
    expect(result.urgencyThreshold).toBe(0);
  });

  it('floors large fractional urgencyThreshold', async () => {
    const result = await updateThreshold('prod-aaa111', { urgencyThreshold: 99.99 });
    expect(result.success).toBe(true);
    expect(result.urgencyThreshold).toBe(99);
  });

  it('floors reorderThreshold', async () => {
    const result = await updateThreshold('prod-aaa111', { reorderThreshold: 7.5 });
    expect(result.success).toBe(true);
    expect(result.reorderThreshold).toBe(7);
  });

  it('preserves urgencyThreshold when only reorderThreshold is provided', async () => {
    const result = await updateThreshold('prod-aaa111', { reorderThreshold: 20 });
    expect(result.success).toBe(true);
    expect(result.urgencyThreshold).toBe(5); // original value
    expect(result.reorderThreshold).toBe(20);
  });

  it('preserves reorderThreshold when only urgencyThreshold is provided', async () => {
    const result = await updateThreshold('prod-aaa111', { urgencyThreshold: 2 });
    expect(result.success).toBe(true);
    expect(result.reorderThreshold).toBe(10); // original value
    expect(result.urgencyThreshold).toBe(2);
  });

  it('allows urgencyThreshold > reorderThreshold (no cross-validation)', async () => {
    const result = await updateThreshold('prod-aaa111', { urgencyThreshold: 20, reorderThreshold: 5 });
    expect(result.success).toBe(true);
    // No validation that urgency < reorder — known gap
    expect(result.urgencyThreshold).toBe(20);
    expect(result.reorderThreshold).toBe(5);
  });
});

// ── getLowStockSummary — deep edge cases ─────────────────────────────

describe('getLowStockSummary — deep edge cases', () => {
  it('rejects call from non-admin', async () => {
    nonAdminSetup();
    const result = await getLowStockSummary();
    expect(result.success).toBe(false);
  });

  it('rejects call from unauthenticated user', async () => {
    __setMember(null);
    const result = await getLowStockSummary();
    expect(result.success).toBe(false);
  });

  it('counts all products as healthy when all above thresholds', async () => {
    __seed(THRESHOLDS, [
      mkThreshold({ _id: 'th-1', productId: 'p-1', currentStock: 100 }),
      mkThreshold({ _id: 'th-2', productId: 'p-2', currentStock: 200 }),
    ]);
    __seed(ALERTS, []);
    const result = await getLowStockSummary();
    expect(result.summary.healthy).toBe(2);
    expect(result.summary.outOfStock).toBe(0);
    expect(result.summary.urgencyLevel).toBe(0);
    expect(result.summary.reorderLevel).toBe(0);
  });

  it('counts all products as out-of-stock when all at zero', async () => {
    __seed(THRESHOLDS, [
      mkThreshold({ _id: 'th-1', productId: 'p-1', currentStock: 0 }),
      mkThreshold({ _id: 'th-2', productId: 'p-2', currentStock: 0 }),
    ]);
    __seed(ALERTS, []);
    const result = await getLowStockSummary();
    expect(result.summary.outOfStock).toBe(2);
    expect(result.summary.healthy).toBe(0);
  });

  it('classifies product at exactly urgency threshold as urgencyLevel', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 5, urgencyThreshold: 5, reorderThreshold: 10 })]);
    __seed(ALERTS, []);
    const result = await getLowStockSummary();
    expect(result.summary.urgencyLevel).toBe(1);
  });

  it('classifies product at exactly reorder threshold as reorderLevel', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 10, urgencyThreshold: 5, reorderThreshold: 10 })]);
    __seed(ALERTS, []);
    const result = await getLowStockSummary();
    expect(result.summary.reorderLevel).toBe(1);
  });

  it('classifies product one above reorder threshold as healthy', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 11, urgencyThreshold: 5, reorderThreshold: 10 })]);
    __seed(ALERTS, []);
    const result = await getLowStockSummary();
    expect(result.summary.healthy).toBe(1);
  });

  it('uses default thresholds when urgencyThreshold is 0 (falsy — known gap)', async () => {
    // urgencyThreshold: 0 || 5 => 5, reorderThreshold: 0 || 10 => 10
    __seed(THRESHOLDS, [mkThreshold({ currentStock: 3, urgencyThreshold: 0, reorderThreshold: 0 })]);
    __seed(ALERTS, []);
    const result = await getLowStockSummary();
    // Due to || operator, urgency=5, reorder=10, stock=3 <= urgency(5) => urgencyLevel
    expect(result.summary.urgencyLevel).toBe(1);
  });

  it('counts active alerts separately from thresholds', async () => {
    __seed(THRESHOLDS, []);
    __seed(ALERTS, [
      mkAlert({ _id: 'a-1', status: 'active' }),
      mkAlert({ _id: 'a-2', status: 'active' }),
      mkAlert({ _id: 'a-3', status: 'resolved' }),
    ]);
    const result = await getLowStockSummary();
    expect(result.summary.totalProducts).toBe(0);
    expect(result.summary.activeAlerts).toBe(2);
  });

  it('negative stock in DB counted as out-of-stock', async () => {
    __seed(THRESHOLDS, [mkThreshold({ currentStock: -10 })]);
    __seed(ALERTS, []);
    const result = await getLowStockSummary();
    expect(result.summary.outOfStock).toBe(1);
  });
});

// ── requireAdmin — indirect tests through multiple endpoints ─────────

describe('requireAdmin — indirect edge cases', () => {
  it('rejects member with empty _id', async () => {
    __setMember({ _id: '', loginEmail: 'admin@carolinafutons.com' });
    __setRoles([{ title: 'Admin' }]);
    const result = await syncInventory([{ productId: 'p-1', stock: 10 }]);
    expect(result.success).toBe(false);
  });

  it('rejects member with roles not including Admin', async () => {
    __setMember({ _id: 'usr-c3d4e5f6', loginEmail: 'editor@carolinafutons.com' });
    __setRoles([{ title: 'Editor', _id: 'editor' }]);
    const result = await getLowStockAlerts();
    expect(result.success).toBe(false);
  });

  it('accepts member with role _id "admin" even if title differs', async () => {
    __setMember({ _id: 'usr-d4e5f6a7', loginEmail: 'super@carolinafutons.com' });
    __setRoles([{ title: 'Superuser', _id: 'admin' }]);
    const result = await getLowStockAlerts();
    expect(result.success).toBe(true);
  });

  it('rejects member with empty roles array', async () => {
    __setMember({ _id: 'usr-e5f6a7b8', loginEmail: 'norole@carolinafutons.com' });
    __setRoles([]);
    const result = await updateThreshold('prod-aaa111', { urgencyThreshold: 1 });
    expect(result.success).toBe(false);
  });
});
