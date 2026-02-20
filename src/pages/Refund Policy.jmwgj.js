// Refund Policy.jmwgj.js - Return & Refund Policy Page
// Clean display with accordion sections for easy scanning

$w.onReady(function () {
  initPolicyAccordion();
});

function initPolicyAccordion() {
  const sections = [
    {
      _id: '1',
      title: 'Return Eligibility',
      content: 'Items may be returned within 30 days of delivery in their original, unused condition with all original packaging. Custom-ordered items (including custom fabric covers) are final sale and cannot be returned. Please contact us before returning any item to receive a Return Authorization number.',
    },
    {
      _id: '2',
      title: 'How to Initiate a Return',
      content: 'Contact us at (828) 252-9449 or through our website contact form to request a Return Authorization. Please include your order number and reason for return. We will provide return shipping instructions and an RA number within 2 business days.',
    },
    {
      _id: '3',
      title: 'Refund Processing',
      content: 'Refunds are processed within 5-7 business days of receiving the returned item in acceptable condition. Refunds will be issued to the original payment method. Shipping costs are non-refundable unless the return is due to a defect or our error.',
    },
    {
      _id: '4',
      title: 'Damaged or Defective Items',
      content: 'If your item arrives damaged or defective, please contact us immediately with photos of the damage. We will arrange for a replacement or full refund including shipping costs. All Night & Day products carry a limited 3-year warranty, and KD Frames products carry a 5-year warranty against manufacturing defects.',
    },
    {
      _id: '5',
      title: 'Exchange Policy',
      content: 'We are happy to facilitate exchanges for different sizes, finishes, or models subject to availability. Contact us to arrange an exchange. Price differences will be charged or refunded accordingly.',
    },
  ];

  try {
    const repeater = $w('#policyRepeater');
    if (!repeater) return;

    repeater.data = sections;
    repeater.onItemReady(($item, itemData) => {
      $item('#policyTitle').text = itemData.title;
      $item('#policyContent').text = itemData.content;

      // Start collapsed
      $item('#policyContent').collapse();
      $item('#policyToggle').text = '+';

      $item('#policyTitle').onClick(() => {
        if ($item('#policyContent').collapsed) {
          $item('#policyContent').expand();
          $item('#policyToggle').text = '\u2212';
        } else {
          $item('#policyContent').collapse();
          $item('#policyToggle').text = '+';
        }
      });
    });
  } catch (e) {}
}
