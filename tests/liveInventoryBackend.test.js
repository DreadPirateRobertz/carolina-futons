/**
 * @file liveInventoryBackend.test.js
 * @description Direct tests for the liveInventory.web.js backend web methods.
 * (Distinct from liveInventory.test.js which tests the frontend LiveInventory.js module.)
 *
 * Covers: getProductInventory, registerStockNotification — all branches + catch paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/inventoryService.web', () => ({
  getStockStatus: vi.fn(),
  signUpBackInStock: vi.fn(),
}));

const { getStockStatus, signUpBackInStock } = await import('backend/inventoryService.web');
const { getProductInventory, registerStockNotification } = await import('../src/backend/liveInventory.web.js');

beforeEach(() => { vi.clearAllMocks(); });

// ── getProductInventory ────────────────────────────────────────────────

describe('getProductInventory', () => {
  it('returns error when productId is missing', async () => {
    const result = await getProductInventory(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID required');
    expect(getStockStatus).not.toHaveBeenCalled();
  });

  it('returns status and quantity for in-stock product with variants', async () => {
    getStockStatus.mockResolvedValue({
      status: 'in_stock',
      variants: [{ quantity: 12 }, { quantity: 5 }, { quantity: 20 }],
    });
    const result = await getProductInventory('prod-1');
    expect(result.success).toBe(true);
    expect(result.status).toBe('in_stock');
    expect(result.quantity).toBe(5); // lowest variant quantity
  });

  it('uses sentinel 999 when out of variants and status is in_stock', async () => {
    getStockStatus.mockResolvedValue({ status: 'in_stock', variants: [] });
    const result = await getProductInventory('prod-1');
    expect(result.success).toBe(true);
    expect(result.quantity).toBe(999);
  });

  it('uses 0 when out of variants and status is out_of_stock', async () => {
    getStockStatus.mockResolvedValue({ status: 'out_of_stock', variants: [] });
    const result = await getProductInventory('prod-1');
    expect(result.success).toBe(true);
    expect(result.quantity).toBe(0);
  });

  it('handles variant with Infinity quantity (falls back to 999)', async () => {
    getStockStatus.mockResolvedValue({
      status: 'in_stock',
      variants: [{ quantity: Infinity }],
    });
    const result = await getProductInventory('prod-1');
    expect(result.success).toBe(true);
    expect(result.quantity).toBe(999);
  });

  it('returns error on service failure', async () => {
    getStockStatus.mockRejectedValue(new Error('network error'));
    const result = await getProductInventory('prod-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch');
  });
});

// ── registerStockNotification ──────────────────────────────────────────

describe('registerStockNotification', () => {
  it('returns error when productId is missing', async () => {
    const result = await registerStockNotification(null, 'a@b.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product ID required');
  });

  it('returns error when email is missing', async () => {
    const result = await registerStockNotification('prod-1', null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid email required');
  });

  it('returns error when email is invalid', async () => {
    const result = await registerStockNotification('prod-1', 'not-an-email');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid email required');
  });

  it('delegates to signUpBackInStock on valid input', async () => {
    signUpBackInStock.mockResolvedValue({ success: true });
    const result = await registerStockNotification('prod-1', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(signUpBackInStock).toHaveBeenCalledWith({ productId: 'prod-1', email: 'jane@example.com' });
  });

  it('returns error on service failure', async () => {
    signUpBackInStock.mockRejectedValue(new Error('timeout'));
    const result = await registerStockNotification('prod-1', 'jane@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to register');
  });
});
