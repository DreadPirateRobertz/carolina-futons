// Terms & Conditions.js - Terms of Service Page
// Standard legal page with table of contents navigation

$w.onReady(function () {
  initTermsNavigation();
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

    tocRepeater.onItemReady(($item, itemData) => {
      $item('#tocLink').text = itemData.label;
      $item('#tocLink').onClick(() => {
        try {
          $w(itemData.anchor).scrollTo();
        } catch (e) {}
      });
    });
    tocRepeater.data = sections.map((s, i) => ({ ...s, _id: String(i) }));
  } catch (e) {}
}
