/**
 * @module RewardsStoreWidget
 * @description Points redemption store — members spend points on discounts and perks.
 * CF-n932 (Part B — frontend)
 */

/**
 * @param {string} memberId
 * @param {{ getRewardsCatalog?: Function, redeemReward?: Function, getRedemptionHistory?: Function, $w?: Function }} [opts]
 */
export async function initRewardsStoreWidget(memberId, opts = {}) {
  const _getRewardsCatalog = opts.getRewardsCatalog;
  const _redeemReward = opts.redeemReward;
  const _getRedemptionHistory = opts.getRedemptionHistory;
  const _$w = opts.$w || $w;

  let currentBalance = opts.initialBalance ?? 0;

  try { _$w('#storeTitle').text = 'Rewards Store'; } catch (e) {}

  // ── Load catalog ────────────────────────────────────────────────────────────

  let catalog;
  try {
    catalog = await _getRewardsCatalog();
  } catch (e) {
    try { _$w('#storeStatus').text = 'Unable to load rewards. Please try again later.'; } catch (_) {}
    try { _$w('#storeStatus').show(); } catch (_) {}
    try { _$w('#storeRepeater').collapse(); } catch (_) {}
    return;
  }

  if (!catalog || catalog.length === 0) {
    try { _$w('#storeStatus').text = 'No rewards available right now.'; } catch (_) {}
    try { _$w('#storeStatus').show(); } catch (_) {}
    try { _$w('#storeRepeater').collapse(); } catch (_) {}
    return;
  }

  // ── Render balance ──────────────────────────────────────────────────────────

  function updateBalance(pts) {
    currentBalance = pts;
    try { _$w('#storeBalance').text = `Your balance: ${pts.toLocaleString()} pts`; } catch (e) {}
  }
  updateBalance(currentBalance);

  // ── Render catalog ──────────────────────────────────────────────────────────

  _$w('#storeRepeater').onItemReady(($item, itemData) => {
    try { $item('#rewardName').text = itemData.name; } catch (e) {}
    try { $item('#rewardDesc').text = itemData.description; } catch (e) {}
    try { $item('#rewardCost').text = `${itemData.pointsCost} pts`; } catch (e) {}
    try {
      if (itemData.imageUrl) $item('#rewardImage').src = itemData.imageUrl;
    } catch (e) {}
    try {
      $item('#rewardStock').text = itemData.stock == null ? 'Unlimited' : `${itemData.stock} left`;
    } catch (e) {}

    // Redeem button state
    const btn = $item('#rewardRedeemBtn');
    try {
      if (currentBalance < itemData.pointsCost) {
        btn.label = 'Not enough points';
        btn.disable();
      } else {
        btn.label = 'Redeem';
        btn.enable();
      }
    } catch (e) {}

    // Redeem click → modal confirm → call backend
    try {
      btn.onClick(async () => {
        // Show confirmation modal
        try {
          _$w('#storeRedeemModal').text = `Redeem "${itemData.name}" for ${itemData.pointsCost} pts?`;
          _$w('#storeRedeemModal').show();
        } catch (e) {}

        try {
          _$w('#modalConfirmBtn').onClick(async () => {
            try { _$w('#storeRedeemModal').hide(); } catch (_) {}
            try { btn.label = 'Redeeming...'; btn.disable(); } catch (_) {}

            try {
              const result = await _redeemReward(memberId, itemData.rewardId);
              if (result?.success) {
                try { _$w('#storeStatus').text = `Redeemed! Your coupon code: ${result.couponCode}`; } catch (_) {}
                try { _$w('#storeStatus').show(); } catch (_) {}
                updateBalance(result.newBalance);
              } else {
                try { _$w('#storeStatus').text = result?.error || 'Redemption failed.'; } catch (_) {}
                try { _$w('#storeStatus').show(); } catch (_) {}
              }
            } catch (err) {
              try { _$w('#storeStatus').text = 'Redemption failed. Please try again.'; } catch (_) {}
              try { _$w('#storeStatus').show(); } catch (_) {}
            }

            try { btn.label = 'Redeem'; btn.enable(); } catch (_) {}
          });
        } catch (e) {}

        try {
          _$w('#modalCancelBtn').onClick(() => {
            try { _$w('#storeRedeemModal').hide(); } catch (_) {}
          });
        } catch (e) {}
      });
    } catch (e) {}
  });

  _$w('#storeRepeater').data = catalog.map(r => ({ _id: r.rewardId, ...r }));

  // ── Redemption history ──────────────────────────────────────────────────────

  try {
    const history = await _getRedemptionHistory(memberId);
    if (history && history.length > 0) {
      _$w('#storeHistory').text = history.map(h =>
        `${h.couponCode} — ${h.status} (${new Date(h.redeemedAt).toLocaleDateString()})`
      ).join('\n');
      _$w('#storeHistory').show();
    } else {
      _$w('#storeHistory').collapse();
    }
  } catch (e) {
    try { _$w('#storeHistory').collapse(); } catch (_) {}
  }
}
