// Terms & Conditions.js - Terms of Service Page
// Standard legal page with table of contents navigation
import { initBackToTop, collapseOnMobile } from 'public/mobileHelpers';

$w.onReady(function () {
  initTermsNavigation();
  try { collapseOnMobile($w, ['#termsTocRepeater']); } catch (e) {}
  try { initBackToTop($w); } catch (e) {}
});

function initTermsNavigation() {
  const sections = [
    { label: 'Acceptance of Terms', anchor: '#termsAcceptance' },
    { label: 'Products & Pricing', anchor: '#termsProducts' },
    { label: 'Orders & Payment', anchor: '#termsOrders' },
    { label: 'Shipping & Delivery', anchor: '#termsShipping' },
    { label: 'Returns & Refunds', anchor: '#termsReturns' },
    { label: 'Warranties', anchor: '#termsWarranties' },
    { label: 'Limitation of Liability', anchor: '#termsLiability' },
    { label: 'Contact Information', anchor: '#termsContact' },
  ];

  try {
    const tocRepeater = $w('#termsTocRepeater');
    if (!tocRepeater) return;

    try { tocRepeater.accessibility.ariaLabel = 'Terms and conditions table of contents'; } catch (e) {}
    tocRepeater.onItemReady(($item, itemData) => {
      $item('#tocLink').text = itemData.label;
      try { $item('#tocLink').accessibility.ariaLabel = `Jump to ${itemData.label}`; } catch (e) {}
      $item('#tocLink').onClick(() => {
        try {
          $w(itemData.anchor).scrollTo();
        } catch (e) {}
      });
    });
    tocRepeater.data = sections.map((s, i) => ({ ...s, _id: String(i) }));
  } catch (e) {}
}
