// Member Page.f00pg.js - Customer Account Page
// Order history, saved items (wishlist), and account settings

$w.onReady(function () {
  initMemberPage();
});

function initMemberPage() {
  initOrderHistory();
  initWishlist();
  initAccountSettings();
}

// ── Order History ───────────────────────────────────────────────────

function initOrderHistory() {
  try {
    const ordersRepeater = $w('#ordersRepeater');
    if (!ordersRepeater) return;

    ordersRepeater.onItemReady(($item, itemData) => {
      $item('#orderNumber').text = `Order #${itemData.number}`;
      $item('#orderDate').text = new Date(itemData._createdDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      $item('#orderTotal').text = `$${Number(itemData.totals?.total || 0).toFixed(2)}`;
      $item('#orderStatus').text = itemData.fulfillmentStatus || 'Processing';
    });
  } catch (e) {}
}

// ── Wishlist / Saved Items ──────────────────────────────────────────

function initWishlist() {
  try {
    const wishlistRepeater = $w('#wishlistRepeater');
    if (!wishlistRepeater) return;

    wishlistRepeater.onItemReady(($item, itemData) => {
      $item('#wishImage').src = itemData.mainMedia;
      $item('#wishImage').alt = `${itemData.name} - saved item`;
      $item('#wishName').text = itemData.name;
      $item('#wishPrice').text = itemData.formattedPrice;

      $item('#wishViewBtn').onClick(() => {
        import('wix-location').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });

      $item('#wishRemoveBtn').onClick(() => {
        // Remove from wishlist via CMS
        import('wix-data').then(async (mod) => {
          try {
            await mod.default.remove('Wishlist', itemData._id);
            $item('#wishCard').collapse();
          } catch (e) {}
        });
      });
    });
  } catch (e) {}
}

// ── Account Settings ────────────────────────────────────────────────

function initAccountSettings() {
  try {
    $w('#logoutBtn').onClick(() => {
      import('wix-members-frontend').then(({ authentication }) => {
        authentication.logout();
      });
    });
  } catch (e) {}
}
