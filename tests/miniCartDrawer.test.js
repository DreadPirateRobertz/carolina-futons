/**
 * Tests for public/miniCartDrawer.js
 * Covers: open/close, repeater rendering, qty update, remove, empty state,
 * subtotal, cart count badge, checkout/view-cart navigation, a11y.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockElement, createItemScope } from './helpers/wixMocks.js';

// ── $w Mock ──────────────────────────────────────────────────────────

let elements;
let $w;

function resetElements() {
  elements = new Map();
  $w = (sel) => {
    if (!elements.has(sel)) elements.set(sel, createMockElement());
    return elements.get(sel);
  };
}

// ── Module Mocks ─────────────────────────────────────────────────────

const mockGetCurrentCart = vi.fn();
const mockUpdateCartItemQuantity = vi.fn();
const mockRemoveCartItem = vi.fn();
const mockOnCartChanged = vi.fn();
const mockAnnounce = vi.fn();
const mockIsMobile = vi.fn(() => false);
const mockWixTo = vi.fn();

// Mock trap returned by createFocusTrap
const mockTrapRelease = vi.fn();
const mockTrapIsActive = vi.fn(() => true);
const mockCreateFocusTrap = vi.fn(() => ({ release: mockTrapRelease, isActive: mockTrapIsActive }));

vi.mock('public/cartService', () => ({
  getCurrentCart: (...args) => mockGetCurrentCart(...args),
  updateCartItemQuantity: (...args) => mockUpdateCartItemQuantity(...args),
  removeCartItem: (...args) => mockRemoveCartItem(...args),
  onCartChanged: (...args) => mockOnCartChanged(...args),
  safeMultiply: (price, qty) => Math.round(price * qty * 100) / 100,
  clampQuantity: (qty) => Math.max(1, Math.min(99, parseInt(qty, 10) || 1)),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: (...args) => mockAnnounce(...args),
  makeClickable: vi.fn((el, fn) => { el.onClick(fn); }),
  createFocusTrap: (...args) => mockCreateFocusTrap(...args),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: (...args) => mockIsMobile(...args),
}));

vi.mock('wix-location-frontend', () => ({
  default: { to: (...args) => mockWixTo(...args) },
}));

// ── Import Module ────────────────────────────────────────────────────
// Import once at module level per page-test pattern (feedback_page_test_pattern)

import {
  initMiniCartDrawer,
  openMiniCart,
  closeMiniCart,
  renderCartItems,
  updateCartCount,
  clearAll,
  isMiniCartOpen,
} from '../src/public/miniCartDrawer.js';

// ── Fixtures ─────────────────────────────────────────────────────────

function makeCart(overrides = {}) {
  return {
    lineItems: [
      {
        _id: 'item-1',
        quantity: 2,
        product: {
          name: 'Futon Frame',
          mediaItems: [{ src: 'wix:image://v1/abc.jpg' }],
        },
        priceData: { price: 199.99 },
      },
      {
        _id: 'item-2',
        quantity: 1,
        product: {
          name: 'Futon Mattress',
          mediaItems: [{ src: 'wix:image://v1/def.jpg' }],
        },
        priceData: { price: 149.5 },
      },
    ],
    ...overrides,
  };
}

function emptyCart() {
  return { lineItems: [] };
}

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  resetElements();
  clearAll();
  mockGetCurrentCart.mockReset();
  mockUpdateCartItemQuantity.mockReset();
  mockRemoveCartItem.mockReset();
  mockOnCartChanged.mockReset();
  mockAnnounce.mockReset();
  mockWixTo.mockReset();
  mockIsMobile.mockReturnValue(false);
  mockCreateFocusTrap.mockReset();
  mockCreateFocusTrap.mockReturnValue({ release: mockTrapRelease, isActive: mockTrapIsActive });
  mockTrapRelease.mockReset();
  mockTrapIsActive.mockReset();
});

// ── initMiniCartDrawer ───────────────────────────────────────────────

describe('initMiniCartDrawer', () => {
  it('hides drawer and overlay on init', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartDrawer').hide).toHaveBeenCalled();
    expect($w('#miniCartOverlay').hide).toHaveBeenCalled();
  });

  it('sets ARIA dialog attributes on drawer', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartDrawer').accessibility.role).toBe('dialog');
    expect($w('#miniCartDrawer').accessibility.ariaModal).toBe(true);
    expect($w('#miniCartDrawer').accessibility.ariaLabel).toBe('Shopping cart');
  });

  it('sets ARIA live region on subtotal', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartSubtotal').accessibility.ariaLive).toBe('polite');
  });

  it('wires close button onClick', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartClose').onClick).toHaveBeenCalled();
  });

  it('wires overlay onClick to close', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartOverlay').onClick).toHaveBeenCalled();
  });

  it('wires checkout button onClick', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartCheckoutBtn').onClick).toHaveBeenCalled();
  });

  it('wires view-cart button onClick', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartViewBtn').onClick).toHaveBeenCalled();
  });

  it('close button sets ariaLabel', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartClose').accessibility.ariaLabel).toBe('Close cart');
  });

  it('checkout button sets ariaLabel', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartCheckoutBtn').accessibility.ariaLabel).toBe('Proceed to checkout');
  });

  it('registers onItemReady on the repeater exactly once', () => {
    initMiniCartDrawer($w);
    expect($w('#miniCartRepeater').onItemReady).toHaveBeenCalledTimes(1);
  });

  it('does not create a focus trap on init (trap is created on open)', () => {
    initMiniCartDrawer($w);
    expect(mockCreateFocusTrap).not.toHaveBeenCalled();
  });

  // Close handler behavior
  it('close button handler invokes closeMiniCart (hides drawer)', () => {
    initMiniCartDrawer($w);
    openMiniCart($w, makeCart()); // set _isOpen so closeMiniCart runs
    const handler = $w('#miniCartClose').onClick.mock.calls[0][0];
    handler();
    expect($w('#miniCartDrawer').hide).toHaveBeenCalled();
  });

  it('overlay click handler invokes closeMiniCart (hides overlay)', () => {
    initMiniCartDrawer($w);
    openMiniCart($w, makeCart()); // set _isOpen so closeMiniCart runs
    const handler = $w('#miniCartOverlay').onClick.mock.calls[0][0];
    handler();
    expect($w('#miniCartOverlay').hide).toHaveBeenCalled();
  });
});

// ── openMiniCart ─────────────────────────────────────────────────────

describe('openMiniCart', () => {
  it('shows drawer and overlay', () => {
    const cart = makeCart();
    openMiniCart($w, cart);
    expect($w('#miniCartDrawer').show).toHaveBeenCalled();
    expect($w('#miniCartOverlay').show).toHaveBeenCalled();
  });

  it('shows drawer with slide animation on desktop', () => {
    mockIsMobile.mockReturnValue(false);
    const cart = makeCart();
    openMiniCart($w, cart);
    const [effect] = $w('#miniCartDrawer').show.mock.calls[0];
    expect(effect).toBe('slide');
  });

  it('shows drawer with slide from bottom on mobile', () => {
    mockIsMobile.mockReturnValue(true);
    const cart = makeCart();
    openMiniCart($w, cart);
    const [effect, opts] = $w('#miniCartDrawer').show.mock.calls[0];
    expect(effect).toBe('slide');
    expect(opts?.direction).toBe('bottom');
  });

  it('updates subtotal text from cart line items', () => {
    const cart = makeCart();
    openMiniCart($w, cart);
    // 199.99 * 2 + 149.50 * 1 = 549.48
    expect($w('#miniCartSubtotal').text).toContain('549.48');
  });

  it('updates cart count element', () => {
    const cart = makeCart(); // 2+1=3 items
    openMiniCart($w, cart);
    expect($w('#cartItemCount').text).toBe('3');
  });

  it('announces plural items to screen readers', () => {
    const cart = makeCart();
    openMiniCart($w, cart);
    expect(mockAnnounce).toHaveBeenCalledWith($w, 'Cart opened with 3 items');
  });

  it('announces singular item when count is 1', () => {
    const cart = { lineItems: [{ _id: 'x', quantity: 1, product: { name: 'X', mediaItems: [{ src: '' }] }, priceData: { price: 10 } }] };
    openMiniCart($w, cart);
    expect(mockAnnounce).toHaveBeenCalledWith($w, 'Cart opened with 1 item');
  });

  it('focuses close button after opening', () => {
    const cart = makeCart();
    openMiniCart($w, cart);
    expect($w('#miniCartClose').focus).toHaveBeenCalled();
  });

  it('handles null cart gracefully', () => {
    expect(() => openMiniCart($w, null)).not.toThrow();
    expect($w('#miniCartSubtotal').text).toContain('0.00');
  });

  it('handles undefined cart gracefully', () => {
    expect(() => openMiniCart($w, undefined)).not.toThrow();
  });

  it('creates a focus trap with WCAG-required focusable elements on open', () => {
    openMiniCart($w, makeCart());
    expect(mockCreateFocusTrap).toHaveBeenCalledWith(
      $w,
      '#miniCartDrawer',
      expect.arrayContaining(['#miniCartClose', '#miniCartCheckoutBtn', '#miniCartViewBtn']),
    );
  });

  it('isMiniCartOpen returns true after open', () => {
    openMiniCart($w, makeCart());
    expect(isMiniCartOpen()).toBe(true);
  });
});

// ── closeMiniCart ────────────────────────────────────────────────────

describe('closeMiniCart', () => {
  it('is a no-op when drawer is not open (prevents spurious announcements)', () => {
    closeMiniCart($w); // cold close — _isOpen is false
    expect($w('#miniCartDrawer').hide).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(mockTrapRelease).not.toHaveBeenCalled();
  });

  it('hides drawer and overlay after open', () => {
    openMiniCart($w, makeCart());
    closeMiniCart($w);
    expect($w('#miniCartDrawer').hide).toHaveBeenCalled();
    expect($w('#miniCartOverlay').hide).toHaveBeenCalled();
  });

  it('announces close to screen readers', () => {
    openMiniCart($w, makeCart());
    mockAnnounce.mockClear();
    closeMiniCart($w);
    expect(mockAnnounce).toHaveBeenCalledWith($w, 'Cart closed');
  });

  it('uses slide animation to close on desktop', () => {
    mockIsMobile.mockReturnValue(false);
    openMiniCart($w, makeCart());
    closeMiniCart($w);
    const calls = $w('#miniCartDrawer').hide.mock.calls;
    const [effect] = calls[calls.length - 1]; // last hide call is the close
    expect(effect).toBe('slide');
  });

  it('uses slide from bottom animation on mobile', () => {
    mockIsMobile.mockReturnValue(true);
    openMiniCart($w, makeCart());
    closeMiniCart($w);
    const calls = $w('#miniCartDrawer').hide.mock.calls;
    const [effect, opts] = calls[calls.length - 1];
    expect(effect).toBe('slide');
    expect(opts?.direction).toBe('bottom');
  });

  it('releases focus trap on close (WCAG focus management)', () => {
    openMiniCart($w, makeCart()); // creates the trap
    mockTrapRelease.mockClear();
    closeMiniCart($w);
    expect(mockTrapRelease).toHaveBeenCalled();
  });

  it('restores focus to previously-focused element on close', () => {
    const mockEl = { focus: vi.fn() };
    const origDoc = globalThis.document;
    globalThis.document = { activeElement: mockEl };
    openMiniCart($w, makeCart()); // saves document.activeElement
    globalThis.document = origDoc;
    closeMiniCart($w);
    expect(mockEl.focus).toHaveBeenCalled();
  });
});

// ── isMiniCartOpen ───────────────────────────────────────────────────

describe('isMiniCartOpen', () => {
  it('returns false before any open', () => {
    expect(isMiniCartOpen()).toBe(false);
  });

  it('returns false after close', () => {
    openMiniCart($w, makeCart());
    closeMiniCart($w);
    expect(isMiniCartOpen()).toBe(false);
  });
});

// ── openMiniCart — focus trap edge cases ─────────────────────────────

describe('openMiniCart — focus trap edge cases', () => {
  it('releases the prior trap when opened a second time (rapid re-open guard)', () => {
    openMiniCart($w, makeCart()); // creates first trap
    mockTrapRelease.mockClear();
    openMiniCart($w, makeCart()); // should release first, create second
    expect(mockTrapRelease).toHaveBeenCalledTimes(1);
    expect(mockCreateFocusTrap).toHaveBeenCalledTimes(2);
  });
});

// ── renderCartItems ──────────────────────────────────────────────────

describe('renderCartItems — with items', () => {
  it('sets repeater data from line items', () => {
    const cart = makeCart();
    renderCartItems($w, cart.lineItems);
    const repeater = $w('#miniCartRepeater');
    expect(repeater.data).toHaveLength(2);
    expect(repeater.data[0]._id).toBe('item-1');
    expect(repeater.data[1]._id).toBe('item-2');
  });

  it('shows repeater and hides empty state', () => {
    renderCartItems($w, makeCart().lineItems);
    expect($w('#miniCartRepeater').show).toHaveBeenCalled();
    expect($w('#miniCartEmpty').hide).toHaveBeenCalled();
  });

  it('does NOT re-register onItemReady (handler registered in init only)', () => {
    renderCartItems($w, makeCart().lineItems);
    // onItemReady should not have been called by renderCartItems
    expect($w('#miniCartRepeater').onItemReady).not.toHaveBeenCalled();
  });

  it('falls back to cartItemId when _id is missing', () => {
    const items = [{
      cartItemId: 'legacy-id',
      quantity: 1,
      product: { name: 'F', mediaItems: [{ src: '' }] },
      priceData: { price: 10 },
    }];
    renderCartItems($w, items);
    expect($w('#miniCartRepeater').data[0]._id).toBe('legacy-id');
  });
});

describe('renderCartItems — onItemReady binding (via init)', () => {
  function getItemReadyHandler() {
    initMiniCartDrawer($w);
    return $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
  }

  it('onItemReady sets image src and alt', () => {
    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'Futon Frame', mediaItems: [{ src: 'wix:image://v1/abc.jpg' }] }, priceData: { price: 199.99 } };
    handler($item, itemData);
    expect($item('#cartItemImage').src).toBe('wix:image://v1/abc.jpg');
    expect($item('#cartItemImage').alt).toBe('Futon Frame');
  });

  it('onItemReady sets name text', () => {
    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'Futon Frame', mediaItems: [{ src: 'img.jpg' }] }, priceData: { price: 199.99 } };
    handler($item, itemData);
    expect($item('#cartItemName').text).toBe('Futon Frame');
  });

  it('onItemReady sets price × quantity', () => {
    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'Futon Frame', mediaItems: [{ src: 'img.jpg' }] }, priceData: { price: 199.99 } };
    handler($item, itemData);
    // 199.99 * 2 = 399.98
    expect($item('#cartItemPrice').text).toContain('399.98');
  });

  it('onItemReady sets qty input value', () => {
    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 3, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);
    expect($item('#cartItemQty').value).toBe(3);
  });

  it('onItemReady wires qty onChange', () => {
    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);
    expect($item('#cartItemQty').onChange).toHaveBeenCalled();
  });

  it('onItemReady wires remove button onClick', () => {
    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-2', quantity: 1, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);
    expect($item('#cartItemRemove').onClick).toHaveBeenCalled();
  });

  it('onItemReady sets remove ariaLabel with product name', () => {
    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 1, product: { name: 'Futon Frame', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);
    expect($item('#cartItemRemove').accessibility.ariaLabel).toBe('Remove Futon Frame from cart');
  });
});

describe('renderCartItems — empty cart', () => {
  it('hides repeater and shows empty state', () => {
    renderCartItems($w, []);
    expect($w('#miniCartRepeater').hide).toHaveBeenCalled();
    expect($w('#miniCartEmpty').show).toHaveBeenCalled();
  });

  it('hides checkout and view-cart buttons when empty', () => {
    renderCartItems($w, []);
    expect($w('#miniCartCheckoutBtn').hide).toHaveBeenCalled();
    expect($w('#miniCartViewBtn').hide).toHaveBeenCalled();
  });

  it('shows checkout and view-cart buttons with items', () => {
    renderCartItems($w, makeCart().lineItems);
    expect($w('#miniCartCheckoutBtn').show).toHaveBeenCalled();
    expect($w('#miniCartViewBtn').show).toHaveBeenCalled();
  });
});

// ── qty update via onChange ───────────────────────────────────────────

describe('qty update via onChange', () => {
  function getItemReadyHandler() {
    initMiniCartDrawer($w);
    return $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
  }

  it('calls updateCartItemQuantity with clamped value', async () => {
    mockUpdateCartItemQuantity.mockResolvedValue({});
    mockGetCurrentCart.mockResolvedValue(emptyCart());

    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);

    const qtyChangeHandler = $item('#cartItemQty').onChange.mock.calls[0][0];
    $item('#cartItemQty').value = 5;
    await qtyChangeHandler({ target: { value: 5 } });

    expect(mockUpdateCartItemQuantity).toHaveBeenCalledWith('item-1', 5);
  });

  it('ignores qty change if same as current', async () => {
    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);

    const qtyChangeHandler = $item('#cartItemQty').onChange.mock.calls[0][0];
    $item('#cartItemQty').value = 2; // same as initial
    await qtyChangeHandler({ target: { value: 2 } });

    expect(mockUpdateCartItemQuantity).not.toHaveBeenCalled();
  });

  it('handles updateCartItemQuantity rejection gracefully', async () => {
    mockUpdateCartItemQuantity.mockRejectedValue(new Error('API down'));

    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);

    const qtyChangeHandler = $item('#cartItemQty').onChange.mock.calls[0][0];
    $item('#cartItemQty').value = 5;
    // Should not throw even when API fails
    await expect(qtyChangeHandler({ target: { value: 5 } })).resolves.not.toThrow();
  });
});

// ── remove item ───────────────────────────────────────────────────────

describe('remove item', () => {
  function getItemReadyHandler() {
    initMiniCartDrawer($w);
    return $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
  }

  it('calls removeCartItem with the correct item id', async () => {
    mockRemoveCartItem.mockResolvedValue({});
    mockGetCurrentCart.mockResolvedValue(emptyCart());

    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);

    const removeHandler = $item('#cartItemRemove').onClick.mock.calls[0][0];
    await removeHandler();

    expect(mockRemoveCartItem).toHaveBeenCalledWith('item-1');
  });

  it('announces removal to screen readers', async () => {
    mockRemoveCartItem.mockResolvedValue({});
    mockGetCurrentCart.mockResolvedValue(emptyCart());

    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'Futon Frame', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);

    const removeHandler = $item('#cartItemRemove').onClick.mock.calls[0][0];
    await removeHandler();

    expect(mockAnnounce).toHaveBeenCalledWith(expect.anything(), 'Futon Frame removed from cart');
  });

  it('handles removeCartItem rejection gracefully', async () => {
    mockRemoveCartItem.mockRejectedValue(new Error('Network error'));

    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 1, product: { name: 'F', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);

    const removeHandler = $item('#cartItemRemove').onClick.mock.calls[0][0];
    await expect(removeHandler()).resolves.not.toThrow();
  });
});

// ── updateCartCount ───────────────────────────────────────────────────

describe('updateCartCount', () => {
  it('sets cartItemCount text to item total', () => {
    updateCartCount($w, 5);
    expect($w('#cartItemCount').text).toBe('5');
  });

  it('shows cartItemCount when count > 0', () => {
    updateCartCount($w, 1);
    expect($w('#cartItemCount').show).toHaveBeenCalled();
  });

  it('hides cartItemCount when count is 0', () => {
    updateCartCount($w, 0);
    expect($w('#cartItemCount').hide).toHaveBeenCalled();
  });

  it('sets cartItemCount text to 0 when count is 0', () => {
    updateCartCount($w, 0);
    expect($w('#cartItemCount').text).toBe('0');
  });
});

// ── checkout/view-cart navigation ────────────────────────────────────

describe('checkout navigation', () => {
  it('checkout button closes drawer then navigates to /checkout', () => {
    initMiniCartDrawer($w);
    openMiniCart($w, makeCart());
    expect(isMiniCartOpen()).toBe(true);

    const checkoutHandler = $w('#miniCartCheckoutBtn').onClick.mock.calls[0][0];
    checkoutHandler();

    expect(isMiniCartOpen()).toBe(false);
    expect(mockWixTo).toHaveBeenCalledWith('/checkout');
  });

  it('view-cart button closes drawer then navigates to /cart', () => {
    initMiniCartDrawer($w);
    openMiniCart($w, makeCart());
    expect(isMiniCartOpen()).toBe(true);

    const viewHandler = $w('#miniCartViewBtn').onClick.mock.calls[0][0];
    viewHandler();

    expect(isMiniCartOpen()).toBe(false);
    expect(mockWixTo).toHaveBeenCalledWith('/cart-page');
  });
});

// ── subtotal calculation ──────────────────────────────────────────────

describe('subtotal calculation', () => {
  it('calculates subtotal as sum of price×qty for all items', () => {
    const lineItems = [
      { _id: 'a', quantity: 3, product: { name: 'A', mediaItems: [{ src: '' }] }, priceData: { price: 10.00 } },
      { _id: 'b', quantity: 2, product: { name: 'B', mediaItems: [{ src: '' }] }, priceData: { price: 25.50 } },
    ];
    openMiniCart($w, { lineItems });
    // 30.00 + 51.00 = 81.00
    expect($w('#miniCartSubtotal').text).toContain('81.00');
  });

  it('shows $0.00 subtotal for empty cart', () => {
    openMiniCart($w, emptyCart());
    expect($w('#miniCartSubtotal').text).toContain('0.00');
  });

  it('guards against missing priceData', () => {
    const lineItems = [
      { _id: 'x', quantity: 1, product: { name: 'X', mediaItems: [{ src: '' }] } }, // no priceData
    ];
    expect(() => openMiniCart($w, { lineItems })).not.toThrow();
    expect($w('#miniCartSubtotal').text).toContain('0.00');
  });
});

// ── _refreshDrawer post-action verification (pr-test-analyzer critical gap) ──

describe('qty update refreshes drawer with updated cart data', () => {
  function getItemReadyHandler() {
    initMiniCartDrawer($w);
    return $w('#miniCartRepeater').onItemReady.mock.calls[0][0];
  }

  it('re-renders drawer with fresh cart data after qty change', async () => {
    const updatedCart = makeCart({ lineItems: [
      { _id: 'item-1', quantity: 5, product: { name: 'Futon Frame', mediaItems: [{ src: '' }] }, priceData: { price: 199.99 } },
    ]});
    mockUpdateCartItemQuantity.mockResolvedValue({});
    mockGetCurrentCart.mockResolvedValue(updatedCart);

    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 2, product: { name: 'Futon Frame', mediaItems: [{ src: '' }] }, priceData: { price: 199.99 } };
    handler($item, itemData);

    const qtyChangeHandler = $item('#cartItemQty').onChange.mock.calls[0][0];
    $item('#cartItemQty').value = 5;
    await qtyChangeHandler({ target: { value: 5 } });

    // _refreshDrawer should call getCurrentCart to get fresh data
    expect(mockGetCurrentCart).toHaveBeenCalled();
  });

  it('re-renders drawer with fresh cart data after item removal', async () => {
    mockRemoveCartItem.mockResolvedValue({});
    mockGetCurrentCart.mockResolvedValue(emptyCart());

    const handler = getItemReadyHandler();
    const { $item } = createItemScope();
    const itemData = { _id: 'item-1', quantity: 1, product: { name: 'Futon Frame', mediaItems: [{ src: '' }] }, priceData: { price: 10 } };
    handler($item, itemData);

    const removeHandler = $item('#cartItemRemove').onClick.mock.calls[0][0];
    await removeHandler();

    // After removal, _refreshDrawer fetches fresh cart and re-renders
    expect(mockGetCurrentCart).toHaveBeenCalled();
    // Empty cart should trigger empty state
    expect($w('#miniCartEmpty').show).toHaveBeenCalled();
  });
});

// ── createFocusTrap failure graceful degradation (pr-test-analyzer critical gap) ──

describe('createFocusTrap failure graceful degradation', () => {
  it('drawer still opens when createFocusTrap throws', () => {
    mockCreateFocusTrap.mockImplementation(() => { throw new Error('trap init failed'); });

    initMiniCartDrawer($w);
    openMiniCart($w, makeCart());

    // Drawer should still be visible and open despite trap failure
    expect($w('#miniCartDrawer').show).toHaveBeenCalled();
    expect(isMiniCartOpen()).toBe(true);
  });

  it('close still works when no trap was created', () => {
    mockCreateFocusTrap.mockImplementation(() => { throw new Error('trap init failed'); });

    initMiniCartDrawer($w);
    openMiniCart($w, makeCart());
    closeMiniCart($w);

    // Should close cleanly without error from missing trap
    expect($w('#miniCartDrawer').hide).toHaveBeenCalled();
    expect(isMiniCartOpen()).toBe(false);
  });
});
