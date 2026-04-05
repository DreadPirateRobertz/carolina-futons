/**
 * @module funnelTracker
 * @description Client-side funnel event emitter — session-aware and debounced.
 *
 * Tracks the 5-stage purchase pipeline (page_view → product_view →
 * add_to_cart → checkout_start → purchase) by forwarding events to the
 * conversionFunnel.web.js backend.
 *
 * Design:
 *  - Session-aware: each stage is emitted at most once per tracker instance.
 *    Prevents double-counting from re-renders or repeated component mounts.
 *  - Debounced: rapid calls to the same stage collapse to one backend call
 *    (300 ms window).
 *  - Error-resilient: backend failures are logged and never thrown to callers.
 *  - Lazy-loaded backend: import('backend/conversionFunnel.web') is deferred
 *    until first use; LOAD_FAILED sentinel avoids repeated broken imports.
 *
 * Usage:
 *   const tracker = initFunnelTracker(sessionId);
 *   tracker.identify(memberId);          // optional — set after member login
 *   tracker.track('product_view', { productId });
 *   tracker.track('add_to_cart',  { productId });
 *
 * CF-wave32 (Wave 32 — blaidd)
 */

import { logError } from 'backend/errorMonitoring.web';

const DEBOUNCE_MS = 300;

const LOAD_FAILED = Symbol('LOAD_FAILED');
let _backend = null;

async function getBackend() {
  if (_backend === LOAD_FAILED) return null;
  if (!_backend) {
    try {
      _backend = await import('backend/conversionFunnel.web');
    } catch (e) {
      logError({ context: 'funnelTracker.getBackend', message: e?.message ?? String(e) });
      _backend = LOAD_FAILED;
      return null;
    }
  }
  return _backend;
}

/**
 * Create a stateful funnel tracker bound to a single browser session.
 *
 * @param {string} sessionId - Unique session token (e.g. from wix-storage or crypto.randomUUID)
 * @returns {{ track: Function, identify: Function }}
 */
export function initFunnelTracker(sessionId) {
  const _emittedStages = new Set();
  const _pendingTimers  = {};
  let _memberId = undefined;

  /**
   * Set the authenticated member ID. Applied to all subsequent track() calls.
   * @param {string} memberId
   */
  function identify(memberId) {
    _memberId = memberId;
  }

  /**
   * Emit a funnel stage event. Debounced 300 ms; each stage fires at most once
   * per tracker instance (session-scoped dedup).
   *
   * @param {string} stage - One of FUNNEL_STAGES
   * @param {Object} [opts]
   * @param {string} [opts.productId]
   * @param {number} [opts.revenue]     - Purchase stage only
   * @param {string} [opts.experimentId]
   * @param {string} [opts.variantId]
   */
  function track(stage, opts = {}) {
    // Clear any pending debounce for this stage
    if (_pendingTimers[stage]) {
      clearTimeout(_pendingTimers[stage]);
    }

    _pendingTimers[stage] = setTimeout(async () => {
      delete _pendingTimers[stage];

      // Session-level dedup: skip if this stage was already successfully emitted
      if (_emittedStages.has(stage)) return;

      try {
        const backend = await getBackend();
        if (!backend?.trackFunnelEvent) return;

        const payload = {
          sessionId,
          ...(opts.productId    != null && { productId: opts.productId }),
          ...(opts.revenue      != null && { revenue:   opts.revenue }),
          ...(opts.experimentId != null && { experimentId: opts.experimentId }),
          ...(opts.variantId    != null && { variantId:    opts.variantId }),
          ...(_memberId         != null && { memberId: _memberId }),
        };

        const result = await backend.trackFunnelEvent(stage, payload);

        if (result?.success && !result?.duplicate) {
          _emittedStages.add(stage);
        } else if (result?.duplicate) {
          // Backend already has this event — mark as done locally too
          _emittedStages.add(stage);
        }
      } catch (e) {
        logError({ context: `funnelTracker.track(${stage})`, message: e?.message ?? String(e) });
      }
    }, DEBOUNCE_MS);
  }

  return { track, identify };
}
