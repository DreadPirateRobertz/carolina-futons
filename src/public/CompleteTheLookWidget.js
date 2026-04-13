/**
 * @module CompleteTheLookWidget
 * @description PDP "Complete the Look" room cross-sell widget.
 *
 * Elements (repeater pattern):
 *   #ctlContainer   — Outer section (collapsed when no look configured)
 *   #ctlHeroImage   — Hero room image
 *   #ctlItemsRepeater — Repeater for room items
 *     Inside each item: #itemImage, #itemName, #itemPrice, #itemAddToCart
 *   #ctlError       — Error state
 *
 * CF-cxe
 */
import { getCompleteTheLook as _defaultGetCompleteTheLook } from 'backend/completeTheLookService.web';

function formatPrice(price) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `$${n.toFixed(2)}`;
}

/**
 * Initialize the Complete the Look widget for a given product.
 * @param {Function} $w
 * @param {string} productId
 * @param {Object} [opts]
 * @param {Function} [opts.getCompleteTheLook] — override for testing
 */
export async function initCompleteTheLook($w, productId, opts = {}) {
  const getCompleteTheLook = opts.getCompleteTheLook ?? _defaultGetCompleteTheLook;

  const safeHide = (sel) => { try { $w(sel).collapse(); } catch {} };
  const safeShow = (sel) => { try { $w(sel).expand(); } catch {} };

  if (!productId) {
    safeHide('#ctlContainer');
    return;
  }

  let look;
  try {
    look = await getCompleteTheLook(productId);
  } catch (err) {
    console.error('[CompleteTheLookWidget] fetch failed', err);
    try { $w('#ctlError').show(); } catch {}
    safeHide('#ctlContainer');
    return;
  }

  if (!look || !Array.isArray(look.roomItems) || look.roomItems.length === 0) {
    safeHide('#ctlContainer');
    return;
  }

  try { $w('#ctlError').hide(); } catch {}
  safeShow('#ctlContainer');

  if (look.roomHeroImage) {
    try { $w('#ctlHeroImage').src = look.roomHeroImage; } catch {}
  }

  try {
    const repeater = $w('#ctlItemsRepeater');
    repeater.data = look.roomItems.map((item, i) => ({
      _id: item.productId || `ctl-${i}`,
      ...item,
    }));
    repeater.onItemReady(($item, itemData) => {
      try { $item('#itemImage').src = itemData.imageUrl || ''; } catch {}
      try { $item('#itemName').text = itemData.name || ''; } catch {}
      try { $item('#itemPrice').text = formatPrice(itemData.price); } catch {}
    });
  } catch (err) {
    console.error('[CompleteTheLookWidget] repeater render failed', err);
  }
}
