// Privacy Policy.pcvmd.js - Privacy Policy Page
// Wix handles the privacy policy content via their legal pages system
// This adds table of contents navigation for long policy text

$w.onReady(function () {
  initPolicyNavigation();
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
