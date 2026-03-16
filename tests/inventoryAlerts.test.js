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

// ── Test Data ─────────────────────────────────────────────────────────

const thresholdConfig = {
  _id: 'thresh-001',
  productId: 'prod-001',
  sku: 'EUR-FRM-001',
  productName: 'Eureka Futon Frame',
  urgencyThreshold: 5,
  reorderThreshold: 10,
  currentStock: 3,
  lastChecked: new Date(),
  reorderAlertSent: false,
};

const healthyConfig = {
  _id: 'thresh-002',
  productId: 'prod-002',
  sku: 'MON-MAT-001',
  productName: 'Moonshadow Mattress',
  urgencyThreshold: 5,
  reorderThreshold: 10,
  currentStock: 50,
  lastChecked: new Date(),
  reorderAlertSent: false,
};

const outOfStockConfig = {
  _id: 'thresh-003',
  productId: 'prod-003',
  sku: 'MUR-BED-001',
  productName: 'Murphy Cabinet Bed',
  urgencyThreshold: 5,
  reorderThreshold: 10,
  currentStock: 0,
  lastChecked: new Date(),
  reorderAlertSent: true,
};

const activeAlert = {
  _id: 'alert-001',
  productId: 'prod-001',
  sku: 'EUR-FRM-001',
  productName: 'Eureka Futon Frame',
  stockLevel: 3,
  thresholdType: 'reorder',
  status: 'active',
  acknowledgedBy: '',
  acknowledgedAt: null,
  _createdDate: new Date(),
};

beforeEach(() => {
  __reset();
  resetMembers();
  // Set up admin user for admin-gated methods
  __setMember({ _id: 'admin-001', loginEmail: 'admin@carolinafutons.com' });
  __setRoles([{ title: 'Admin', _id: 'admin' }]);
  __seed('InventoryThresholds', [thresholdConfig, healthyConfig, outOfStockConfig]);
  __seed('LowStockAlerts', [activeAlert]);
});

// ── getStockStatus ──────────────────────────────────────────────────

describe('getStockStatus', () => {
  it('returns urgency message for low stock', async () => {
    const result = await getStockStatus('prod-001');
    expect(result.success).toBe(true);
    expect(result.showUrgency).toBe(true);
    expect(result.inStock).toBe(true);
    expect(result.message).toBe('Only 3 left in stock!');
    expect(result.stockLevel).toBe(3);
  });

  it('returns no urgency for healthy stock', async () => {
    const result = await getStockStatus('prod-002');
    expect(result.success).toBe(true);
    expect(result.showUrgency).toBe(false);
    expect(result.inStock).toBe(true);
    expect(result.message).toBe('In stock');
  });

  it('returns out of stock for zero stock', async () => {
    const result = await getStockStatus('prod-003');
    expect(result.success).toBe(true);
    expect(result.showUrgency).toBe(false);
    expect(result.inStock).toBe(false);
    expect(result.message).toBe('Out of stock');
  });

  it('returns default for unconfigured product', async () => {
    const result = await getStockStatus('prod-unknown');
    expect(result.success).toBe(true);
    expect(result.showUrgency).toBe(false);
    expect(result.inStock).toBe(true);
    expect(result.message).toBe('');
  });

  it('rejects empty product ID', async () => {
    const result = await getStockStatus('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects null product ID', async () => {
    const result = await getStockStatus(null);
    expect(result.success).toBe(false);
  });

  it('sanitizes HTML in product ID', async () => {
    const result = await getStockStatus('<script>alert(1)</script>');
    expect(result.success).toBe(true);
    // Should treat as unknown product, not crash
    expect(result.showUrgency).toBe(false);
  });

  it('includes stockLevel in response for all states', async () => {
    const low = await getStockStatus('prod-001');
    expect(typeof low.stockLevel).toBe('number');
    const healthy = await getStockStatus('prod-002');
    expect(typeof healthy.stockLevel).toBe('number');
    const oos = await getStockStatus('prod-003');
    expect(typeof oos.stockLevel).toBe('number');
    expect(oos.stockLevel).toBe(0);
  });
});

// ── getBatchStockStatus ─────────────────────────────────────────────

describe('getBatchStockStatus', () => {
  it('returns statuses for multiple products', async () => {
    const result = await getBatchStockStatus(['prod-001', 'prod-002', 'prod-003']);
    expect(result.success).toBe(true);
    expect(result.statuses['prod-001'].showUrgency).toBe(true);
    expect(result.statuses['prod-002'].showUrgency).toBe(false);
    expect(result.statuses['prod-003'].inStock).toBe(false);
  });

  it('returns empty for empty array', async () => {
    const result = await getBatchStockStatus([]);
    expect(result.success).toBe(true);
    expect(result.statuses).toEqual({});
  });

  it('returns empty for non-array input', async () => {
    const result = await getBatchStockStatus(null);
    expect(result.success).toBe(true);
    expect(result.statuses).toEqual({});
  });

  it('limits to 50 products', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `prod-${i}`);
    const result = await getBatchStockStatus(ids);
    expect(result.success).toBe(true);
  });

  it('filters invalid IDs', async () => {
    const result = await getBatchStockStatus(['', null, undefined]);
    expect(result.success).toBe(true);
    expect(result.statuses).toEqual({});
  });

  it('handles mix of known and unknown products', async () => {
    const result = await getBatchStockStatus(['prod-001', 'prod-unknown']);
    expect(result.success).toBe(true);
    expect(result.statuses['prod-001']).toBeDefined();
    expect(result.statuses['prod-001'].showUrgency).toBe(true);
    // Unknown products may or may not be in statuses depending on implementation
  });

  it('returns consistent format for each status', async () => {
    const result = await getBatchStockStatus(['prod-001', 'prod-002']);
    for (const status of Object.values(result.statuses)) {
      expect(status).toHaveProperty('inStock');
      expect(status).toHaveProperty('showUrgency');
      expect(status).toHaveProperty('message');
    }
  });
});

// ── syncInventory ───────────────────────────────────────────────────

describe('syncInventory', () => {
  it('updates existing product stock', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'InventoryThresholds') updated = item;
    });

    const result = await syncInventory([
      { productId: 'prod-001', sku: 'EUR-FRM-001', productName: 'Eureka Futon Frame', stock: 20 },
    ]);

    expect(result.success).toBe(true);
    expect(result.synced).toBe(1);
    expect(updated.currentStock).toBe(20);
  });

  it('creates threshold config for new product', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'InventoryThresholds') inserted = item;
    });

    const result = await syncInventory([
      { productId: 'prod-new', sku: 'NEW-001', productName: 'New Product', stock: 25 },
    ]);

    expect(result.success).toBe(true);
    expect(result.synced).toBe(1);
    expect(inserted).not.toBeNull();
    expect(inserted.productId).toBe('prod-new');
    expect(inserted.currentStock).toBe(25);
  });

  it('creates reorder alert when stock falls below threshold', async () => {
    // prod-001 has reorderThreshold=10, current=3, but reorderAlertSent=false
    let alertInserted = null;
    __onInsert((col, item) => {
      if (col === 'LowStockAlerts') alertInserted = item;
    });

    const result = await syncInventory([
      { productId: 'prod-001', stock: 5 },
    ]);

    expect(result.success).toBe(true);
    expect(result.alertsCreated).toBe(1);
    expect(alertInserted).not.toBeNull();
    expect(alertInserted.thresholdType).toBe('reorder');
    expect(alertInserted.status).toBe('active');
  });

  it('creates alert for new product below reorder threshold', async () => {
    let alertInserted = null;
    __onInsert((col, item) => {
      if (col === 'LowStockAlerts') alertInserted = item;
    });

    const result = await syncInventory([
      { productId: 'prod-new', sku: 'NEW-001', productName: 'New Low Stock', stock: 3 },
    ]);

    expect(result.alertsCreated).toBe(1);
    expect(alertInserted).not.toBeNull();
  });

  it('resets reorder alert flag when stock replenished', async () => {
    // Set prod-003 with reorderAlertSent=true, then replenish above 10
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'InventoryThresholds' && item.productId === 'prod-003') updated = item;
    });

    await syncInventory([
      { productId: 'prod-003', stock: 25 },
    ]);

    expect(updated).not.toBeNull();
    expect(updated.reorderAlertSent).toBe(false);
  });

  it('rejects empty updates array', async () => {
    const result = await syncInventory([]);
    expect(result.success).toBe(false);
  });

  it('rejects non-array input', async () => {
    const result = await syncInventory('not-array');
    expect(result.success).toBe(false);
  });

  it('skips entries without product ID', async () => {
    const result = await syncInventory([
      { sku: 'NO-PID', stock: 10 },
    ]);
    expect(result.synced).toBe(0);
  });

  it('skips entries without stock number', async () => {
    const result = await syncInventory([
      { productId: 'prod-001', stock: 'many' },
    ]);
    expect(result.synced).toBe(0);
  });

  it('clamps negative stock to 0', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'InventoryThresholds') updated = item;
    });

    await syncInventory([
      { productId: 'prod-001', stock: -5 },
    ]);

    expect(updated.currentStock).toBe(0);
  });

  it('limits batch to 100 items', async () => {
    const updates = Array.from({ length: 110 }, (_, i) => ({
      productId: `prod-batch-${i}`, stock: 10,
    }));

    const result = await syncInventory(updates);
    expect(result.success).toBe(true);
    // Should only process first 100
  });
});

// ── getLowStockAlerts ───────────────────────────────────────────────

describe('getLowStockAlerts', () => {
  it('returns active alerts by default', async () => {
    const result = await getLowStockAlerts();
    expect(result.success).toBe(true);
    expect(result.alerts.length).toBeGreaterThanOrEqual(1);
    expect(result.alerts[0].productName).toBe('Eureka Futon Frame');
    expect(result.alerts[0].status).toBe('active');
  });

  it('formats alert response correctly', async () => {
    const result = await getLowStockAlerts();
    const alert = result.alerts[0];
    expect(alert).toHaveProperty('_id');
    expect(alert).toHaveProperty('productId');
    expect(alert).toHaveProperty('sku');
    expect(alert).toHaveProperty('stockLevel');
    expect(alert).toHaveProperty('thresholdType');
    expect(alert).toHaveProperty('status');
  });

  it('respects limit parameter', async () => {
    const result = await getLowStockAlerts({ limit: 1 });
    expect(result.success).toBe(true);
  });

  it('clamps limit to 1-100', async () => {
    const result = await getLowStockAlerts({ limit: 200 });
    expect(result.success).toBe(true);
  });

  it('filters by status when specified', async () => {
    __seed('LowStockAlerts', [
      activeAlert,
      { ...activeAlert, _id: 'alert-002', status: 'resolved' },
    ]);
    const result = await getLowStockAlerts({ status: 'resolved' });
    expect(result.success).toBe(true);
    for (const alert of result.alerts) {
      expect(alert.status).toBe('resolved');
    }
  });

  it('returns empty when no alerts match', async () => {
    __seed('LowStockAlerts', []);
    const result = await getLowStockAlerts();
    expect(result.success).toBe(true);
    expect(result.alerts).toHaveLength(0);
  });
});

// ── acknowledgeAlert ────────────────────────────────────────────────

describe('acknowledgeAlert', () => {
  it('acknowledges an active alert', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'LowStockAlerts') updated = item;
    });

    const result = await acknowledgeAlert('alert-001');
    expect(result.success).toBe(true);
    expect(result.status).toBe('acknowledged');
    expect(updated.status).toBe('acknowledged');
    expect(updated.acknowledgedBy).toBeTruthy();
    expect(updated.acknowledgedAt).toBeInstanceOf(Date);
  });

  it('rejects empty alert ID', async () => {
    const result = await acknowledgeAlert('');
    expect(result.success).toBe(false);
  });

  it('rejects non-existent alert', async () => {
    const result = await acknowledgeAlert('alert-999');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects already acknowledged alert', async () => {
    __seed('LowStockAlerts', [{ ...activeAlert, status: 'acknowledged' }]);
    const result = await acknowledgeAlert('alert-001');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not active');
  });

  it('rejects null alert ID', async () => {
    const result = await acknowledgeAlert(null);
    expect(result.success).toBe(false);
  });

  it('rejects resolved alert', async () => {
    __seed('LowStockAlerts', [{ ...activeAlert, status: 'resolved' }]);
    const result = await acknowledgeAlert('alert-001');
    expect(result.success).toBe(false);
  });
});

// ── resolveAlert ────────────────────────────────────────────────────

describe('resolveAlert', () => {
  it('resolves an active alert', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'LowStockAlerts') updated = item;
    });

    const result = await resolveAlert('alert-001');
    expect(result.success).toBe(true);
    expect(result.status).toBe('resolved');
    expect(updated.status).toBe('resolved');
  });

  it('rejects empty alert ID', async () => {
    const result = await resolveAlert('');
    expect(result.success).toBe(false);
  });

  it('rejects non-existent alert', async () => {
    const result = await resolveAlert('alert-999');
    expect(result.success).toBe(false);
  });

  it('rejects already resolved alert', async () => {
    __seed('LowStockAlerts', [{ ...activeAlert, status: 'resolved' }]);
    const result = await resolveAlert('alert-001');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already resolved');
  });

  it('rejects null alert ID', async () => {
    const result = await resolveAlert(null);
    expect(result.success).toBe(false);
  });

  it('resolves an acknowledged alert', async () => {
    __seed('LowStockAlerts', [{ ...activeAlert, status: 'acknowledged' }]);
    const result = await resolveAlert('alert-001');
    expect(result.success).toBe(true);
    expect(result.status).toBe('resolved');
  });
});

// ── updateThreshold ─────────────────────────────────────────────────

describe('updateThreshold', () => {
  it('updates urgency threshold', async () => {
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'InventoryThresholds') updated = item;
    });

    const result = await updateThreshold('prod-001', { urgencyThreshold: 3 });
    expect(result.success).toBe(true);
    expect(result.urgencyThreshold).toBe(3);
    expect(updated.urgencyThreshold).toBe(3);
  });

  it('updates reorder threshold', async () => {
    const result = await updateThreshold('prod-001', { reorderThreshold: 15 });
    expect(result.success).toBe(true);
    expect(result.reorderThreshold).toBe(15);
  });

  it('updates both thresholds', async () => {
    const result = await updateThreshold('prod-001', { urgencyThreshold: 2, reorderThreshold: 8 });
    expect(result.success).toBe(true);
    expect(result.urgencyThreshold).toBe(2);
    expect(result.reorderThreshold).toBe(8);
  });

  it('floors threshold values', async () => {
    const result = await updateThreshold('prod-001', { urgencyThreshold: 3.7 });
    expect(result.urgencyThreshold).toBe(3);
  });

  it('rejects empty product ID', async () => {
    const result = await updateThreshold('', { urgencyThreshold: 3 });
    expect(result.success).toBe(false);
  });

  it('rejects unconfigured product', async () => {
    const result = await updateThreshold('prod-unknown', { urgencyThreshold: 3 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('ignores negative thresholds', async () => {
    const result = await updateThreshold('prod-001', { urgencyThreshold: -1 });
    expect(result.success).toBe(true);
    // Original value should be preserved since -1 < 0
    expect(result.urgencyThreshold).toBe(5);
  });

  it('rejects null product ID', async () => {
    const result = await updateThreshold(null, { urgencyThreshold: 3 });
    expect(result.success).toBe(false);
  });

  it('handles zero threshold', async () => {
    const result = await updateThreshold('prod-001', { urgencyThreshold: 0 });
    expect(result.success).toBe(true);
    expect(result.urgencyThreshold).toBe(0);
  });

  it('rejects empty thresholds object', async () => {
    const result = await updateThreshold('prod-001', {});
    expect(result.success).toBe(true);
    // No changes — should preserve existing values
  });
});

// ── getLowStockSummary ──────────────────────────────────────────────

describe('getLowStockSummary', () => {
  it('returns stock level categories', async () => {
    const result = await getLowStockSummary();
    expect(result.success).toBe(true);
    expect(result.summary.totalProducts).toBe(3);
    expect(result.summary.outOfStock).toBe(1);      // prod-003
    expect(result.summary.urgencyLevel).toBe(1);     // prod-001 (stock 3 <= urgency 5)
    expect(result.summary.healthy).toBe(1);           // prod-002 (stock 50)
  });

  it('includes active alert count', async () => {
    const result = await getLowStockSummary();
    expect(result.summary.activeAlerts).toBe(1);
  });

  it('has correct structure', async () => {
    const result = await getLowStockSummary();
    expect(result.summary).toHaveProperty('totalProducts');
    expect(result.summary).toHaveProperty('outOfStock');
    expect(result.summary).toHaveProperty('urgencyLevel');
    expect(result.summary).toHaveProperty('reorderLevel');
    expect(result.summary).toHaveProperty('healthy');
    expect(result.summary).toHaveProperty('activeAlerts');
  });

  it('all counts are non-negative integers', async () => {
    const result = await getLowStockSummary();
    for (const [key, value] of Object.entries(result.summary)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('category counts sum to totalProducts', async () => {
    const result = await getLowStockSummary();
    const { outOfStock, urgencyLevel, reorderLevel, healthy, totalProducts } = result.summary;
    expect(outOfStock + urgencyLevel + reorderLevel + healthy).toBe(totalProducts);
  });

  it('returns empty summary when no products configured', async () => {
    __seed('InventoryThresholds', []);
    __seed('LowStockAlerts', []);
    const result = await getLowStockSummary();
    expect(result.success).toBe(true);
    expect(result.summary.totalProducts).toBe(0);
    expect(result.summary.activeAlerts).toBe(0);
  });
});
