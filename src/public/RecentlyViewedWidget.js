// RecentlyViewedWidget.js — Recently Viewed Products Widget
// localStorage-backed (persistent across sessions), max 8 IDs.
// Fetches fresh product data from Wix Stores on each render.
//
// Distinct from recentlyViewed.js (session storage, cross-sell carousel).
// This widget is for the Product Detail Page sidebar and Cart Page.
//
// Element nicknames:
//   recentlyViewedSection   — Box, hidden until ≥1 item
//   recentlyViewedRepeater  — Repeater, horizontal scroll, up to 8 items
//   recentlyViewedTitle     — Text — 'Recently Viewed'
//   recentlyViewedClear     — Button — clears history
//
//   Inside repeater:
//   recentItem              — Box — wraps each product card
//   recentItemImage         — Image — product thumbnail
//   recentItemName          — Text — product name
//   recentItemPrice         — Text — formatted price
//   recentItemLink          — Button — navigates to product page

import wixStoresFrontend from 'wix-stores-frontend';
import { to } from 'wix-location-frontend';

const LS_KEY = 'cf_recently_viewed';
const MAX_HISTORY = 8;

// ── localStorage helpers ──────────────────────────────────────────────

function _readHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _writeHistory(ids) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(ids)); } catch (e) { console.error('[RecentlyViewedWidget]', e); }
}

function _clearHistory() {
  try { localStorage.removeItem(LS_KEY); } catch (e) { console.error('[RecentlyViewedWidget]', e); }
}

// ── trackView ─────────────────────────────────────────────────────────

/**
 * Record a product view in localStorage.
 * Deduplicates (moves existing to front), caps at MAX_HISTORY.
 *
 * @param {string|null|undefined} productId
 */
export function trackView(productId) {
  if (!productId) return;
  try {
    let ids = _readHistory();
    ids = ids.filter(id => id !== productId);
    ids.unshift(productId);
    if (ids.length > MAX_HISTORY) ids = ids.slice(0, MAX_HISTORY);
    _writeHistory(ids);
  } catch (e) { console.warn('[RecentlyViewed] trackView failed', e); }
}

// ── renderWidget ──────────────────────────────────────────────────────

/**
 * Render the Recently Viewed widget.
 * Reads product IDs from localStorage, fetches fresh data from Wix Stores,
 * then populates the repeater. Registers onItemReady BEFORE assigning .data.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} [opts]
 * @param {string} [opts.excludeCurrentId] - Product ID to exclude (current product)
 */
export async function renderWidget($w, opts = {}) {
  const { excludeCurrentId } = opts ?? {};

  let ids;
  try { ids = _readHistory(); } catch { ids = []; }

  if (!ids.length) {
    try { $w('#recentlyViewedSection').collapse(); } catch { /* noop */ }
    return;
  }

  // Fetch product data for all IDs in parallel; skip nulls and errors
  const results = await Promise.allSettled(
    ids.map(id => wixStoresFrontend.products.getProduct(id))
  );

  let products = results
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter(Boolean);

  if (excludeCurrentId) {
    products = products.filter(p => p._id !== excludeCurrentId);
  }

  if (!products.length) {
    try { $w('#recentlyViewedSection').collapse(); } catch { /* noop */ }
    return;
  }

  // Ensure repeater items have _id for Wix repeater dedup
  const data = products.map(p => ({ ...p, _id: p._id || p.id }));

  try { $w('#recentlyViewedTitle').text = 'Recently Viewed'; } catch { /* noop */ }

  // onItemReady MUST be registered before .data assignment
  $w('#recentlyViewedRepeater').onItemReady(($item, itemData) => {
    try { $item('#recentItemImage').src = itemData.mainMedia || ''; } catch (e) { console.error('[RecentlyViewedWidget]', e); }
    try { $item('#recentItemImage').alt = itemData.name || ''; } catch (e) { console.error('[RecentlyViewedWidget]', e); }
    try { $item('#recentItemName').text = itemData.name || ''; } catch (e) { console.error('[RecentlyViewedWidget]', e); }
    try {
      const price = itemData.formattedPrice || (Number.isFinite(itemData.price) ? String(itemData.price) : '');
      $item('#recentItemPrice').text = price;
    } catch (e) { console.error('[RecentlyViewedWidget]', e); }
    try {
      $item('#recentItemLink').accessibility.ariaLabel = `View ${itemData.name}`;
      $item('#recentItemLink').onClick(() => {
        if (itemData.slug) to(`/product-page/${itemData.slug}`);
      });
    } catch (e) { console.error('[RecentlyViewedWidget]', e); }
  });

  $w('#recentlyViewedRepeater').data = data;

  try { $w('#recentlyViewedSection').expand(); } catch { /* noop */ }

  // Wire clear button
  try {
    $w('#recentlyViewedClear').onClick(() => clearHistory($w));
  } catch { /* noop */ }
}

// ── clearHistory ──────────────────────────────────────────────────────

/**
 * Clear localStorage history and collapse the widget section.
 *
 * @param {Function|null} $w
 */
export function clearHistory($w) {
  _clearHistory();
  try { $w('#recentlyViewedSection').collapse(); } catch { /* noop */ }
}

// ── destroy ───────────────────────────────────────────────────────────

/**
 * Cleanup for SPA navigation. Currently a no-op; reserved for future
 * event listener teardown.
 */
export function destroy() {
  // no-op — no persistent listeners to remove in this version
}
