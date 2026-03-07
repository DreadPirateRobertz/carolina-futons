// Privacy Policy.js - Privacy Policy Page
// Wix handles the privacy policy content via their legal pages system
// This adds table of contents navigation for long policy text
import { initBackToTop, collapseOnMobile } from 'public/mobileHelpers';

$w.onReady(function () {
  initPolicyNavigation();
  try { collapseOnMobile($w, ['#policyTocRepeater']); } catch (e) {}
  try { initBackToTop($w); } catch (e) {}
});

function initPolicyNavigation() {
  // Quick-jump links for policy sections
  const sections = [
    { label: 'Information We Collect', anchor: '#policyCollect' },
    { label: 'How We Use Information', anchor: '#policyUse' },
    { label: 'Information Sharing', anchor: '#policySharing' },
    { label: 'Your Rights', anchor: '#policyRights' },
    { label: 'Contact Us', anchor: '#policyContact' },
  ];

  try {
    const tocRepeater = $w('#policyTocRepeater');
    if (!tocRepeater) return;

    try { tocRepeater.accessibility.ariaLabel = 'Privacy policy table of contents'; } catch (e) {}
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
