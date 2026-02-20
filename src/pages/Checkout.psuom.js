// Checkout.psuom.js - Checkout Page
// Minimal custom code — Wix Stores handles checkout flow
// We add trust signals and order summary enhancements

$w.onReady(function () {
  initTrustSignals();
  initOrderNotes();
});

// ── Trust Signals ───────────────────────────────────────────────────
// Display trust badges and reassurance messaging during checkout

function initTrustSignals() {
  const trustMessages = [
    { icon: 'lock', text: 'Secure SSL Checkout' },
    { icon: 'shield', text: 'Your information is protected' },
    { icon: 'truck', text: 'Free shipping on orders over $999' },
    { icon: 'phone', text: 'Questions? Call (828) 252-9449' },
  ];

  try {
    const repeater = $w('#trustRepeater');
    if (!repeater) return;

    repeater.data = trustMessages.map((msg, i) => ({
      _id: String(i),
      ...msg,
    }));

    repeater.onItemReady(($item, itemData) => {
      $item('#trustText').text = itemData.text;
    });
  } catch (e) {}
}

// ── Order Notes ─────────────────────────────────────────────────────
// Allow customers to add special instructions

function initOrderNotes() {
  try {
    const notesToggle = $w('#orderNotesToggle');
    const notesField = $w('#orderNotesField');

    if (notesToggle && notesField) {
      notesField.collapse();
      notesToggle.onClick(() => {
        if (notesField.collapsed) {
          notesField.expand();
          notesToggle.text = 'Hide order notes';
        } else {
          notesField.collapse();
          notesToggle.text = 'Add order notes';
        }
      });
    }
  } catch (e) {}
}
