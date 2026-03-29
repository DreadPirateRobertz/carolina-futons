/**
 * @file Swatch Kit.js
 * @description Page controller for the /swatch-kit product page.
 *
 * Members can select 1–5 fabric swatches and purchase the $5 Swatch Kit.
 * After purchase, a $5 store credit is issued, refundable on any $200+ order.
 *
 * Elements:
 *   #swatchGrid             — repeater showing available fabrics
 *   #selectedCount          — "X of 5 swatches selected" text
 *   #addToCartBtn           — add kit to cart (disabled until selection valid)
 *   #creditBanner           — "$5 refundable on $200+ orders"
 *   #creditStatusBanner     — shown to members with pending swatch credit
 *   #selectionError         — validation error text
 */

import {
  isSelectionValid,
  toggleSwatch,
  formatSelectionCount,
  buildAddToCartState,
  buildCreditBannerText,
  buildSelectionError,
  buildCreditStatusText,
} from 'public/SwatchKitWidget.js';

let _selectedIds = [];
let _allSwatches = [];

export async function initPage($w) {
  $w('#creditBanner').text = buildCreditBannerText();

  // Load member credit status if signed in
  try {
    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember().catch(() => null);
    if (member?._id) {
      const { getSwatchKitCreditStatus } = await import('backend/swatchKitService.web');
      const creditStatus = await getSwatchKitCreditStatus(member._id);
      const statusText = buildCreditStatusText(creditStatus);
      if (statusText) {
        $w('#creditStatusBanner').text = statusText;
        $w('#creditStatusBanner').show();
      } else {
        $w('#creditStatusBanner').hide();
      }
    } else {
      $w('#creditStatusBanner').hide();
    }
  } catch (err) {
    console.error('[swatchKit] Failed to load member credit status:', err);
    $w('#creditStatusBanner').hide();
  }

  _updateUI($w);
}

export async function initSwatchGrid($w, swatches) {
  _allSwatches = Array.isArray(swatches) ? swatches : [];
  if ($w('#swatchGrid').setData) {
    $w('#swatchGrid').setData(_allSwatches);
  }
  $w('#swatchGrid').onItemReady(($item, itemData) => {
    $item('#swatchImage').src = itemData.imageUrl || '';
    $item('#swatchName').text = itemData.name || '';
    $item('#swatchSelectBtn').onClick(() => {
      _selectedIds = toggleSwatch(_selectedIds, itemData._id);
      _updateUI($w);
    });
  });
}

export function handleAddToCart($w) {
  if (!isSelectionValid(_selectedIds)) {
    $w('#selectionError').text = buildSelectionError(_selectedIds);
    $w('#selectionError').show();
    return { proceed: false };
  }
  $w('#selectionError').hide();
  return { proceed: true, selectedIds: _selectedIds };
}

function _updateUI($w) {
  $w('#selectedCount').text = formatSelectionCount(_selectedIds);
  const cartState = buildAddToCartState(_selectedIds);
  $w('#addToCartBtn').label = cartState.label;
  if (cartState.disabled) {
    $w('#addToCartBtn').disable();
  } else {
    $w('#addToCartBtn').enable();
  }
  const err = buildSelectionError(_selectedIds);
  if (err && _selectedIds.length > 0) {
    $w('#selectionError').text = err;
    $w('#selectionError').show();
  } else {
    $w('#selectionError').hide();
  }
}

$w.onReady(async () => {
  await initPage($w);
});
