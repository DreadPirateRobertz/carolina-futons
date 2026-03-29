/**
 * @page Gift Registry
 * @url /gift-registry
 * @description Gift registry page serving three modes:
 *   - My Registries: authenticated member's registry list (no URL params)
 *   - Registry Detail: owner managing a registry (?id=<registryId>)
 *   - Public View: anyone viewing a shared registry (?registry=<slug>)
 *
 * Editor hookup required — see editor-hookup-guide.html for element IDs.
 *
 * CMS access is entirely via backend web methods.
 * Collections: GiftRegistries, GiftRegistryItems
 *
 * URL params:
 * - ?id=<registryId>  — owner detail/management view (must be authenticated)
 * - ?registry=<slug>  — public view (anyone with the link)
 * - (none)            — my registries dashboard (must be authenticated)
 *
 * Sections / scenarios:
 * S1: Loading state
 * S2: My Registries list + Create form
 * S3: Registry Detail (owner view — add/remove items, delete, share link)
 * S4: Public View (guest view — see items, mark purchased)
 * S5: Error / not-found states + noindex for invalid public links
 */

import {
  createRegistry,
  getMyRegistries,
  getRegistry,
  getPublicRegistry,
  addRegistryItem,
  removeRegistryItem,
  markItemPurchased,
  deleteRegistry,
} from 'backend/giftRegistry.web';
import { announce } from 'public/a11yHelpers';
import wixLocationFrontend from 'wix-location-frontend';

// ── Page entry point ──────────────────────────────────────────────────

$w.onReady(async function () {
  await _initPage();
});

// ── Main init (exported for testing) ─────────────────────────────────

/**
 * Determine mode from URL params, fetch data, and render appropriate section.
 * Exported so tests can invoke directly without triggering $w.onReady.
 */
export async function _initPage() {
  _showSection('loading');

  const query = wixLocationFrontend.query || {};

  try {
    if (query.registry) {
      // ── S4: Public view
      await _loadPublicView(query.registry);
    } else if (query.id) {
      // ── S3: Owner detail view
      await _loadDetailView(query.id);
    } else {
      // ── S2: My registries dashboard
      await _loadMyRegistries();
    }
  } catch (err) {
    console.error('[GiftRegistry] Unexpected error:', err);
    _showError('Something went wrong. Please try again.');
  }
}

// ── S2: My Registries ────────────────────────────────────────────────

async function _loadMyRegistries() {
  const result = await getMyRegistries();

  if (!result.success) {
    if (result.error === 'Not authenticated') {
      _showError('Please sign in to manage your gift registries.');
    } else {
      _showError(result.error || 'Could not load your registries.');
    }
    return;
  }

  _renderMyRegistries(result.data.registries);
}

/**
 * Render the My Registries list and wire the Create button.
 * Exported for testing.
 * @param {Array} registries
 */
export function _renderMyRegistries(registries) {
  _showSection('my');

  try { $w('#registryCount').text = `${registries.length} registr${registries.length !== 1 ? 'ies' : 'y'}`; } catch (e) {}

  if (registries.length === 0) {
    try { $w('#registryEmptyState').expand(); } catch (e) {}
    try { $w('#registryRepeater').collapse(); } catch (e) {}
  } else {
    try { $w('#registryEmptyState').collapse(); } catch (e) {}
    try { $w('#registryRepeater').expand(); } catch (e) {}
    _populateMyRepeater(registries);
  }

  // Wire create button
  try {
    $w('#registryCreateBtn').onClick(() => {
      try { $w('#registryCreateForm').expand(); } catch (e) {}
      try { $w('#registryCreateBtn').disable(); } catch (e) {}
    });
  } catch (e) {}

  // Wire create form submission
  try {
    $w('#registrySubmitBtn').onClick(async () => {
      await _handleCreateSubmit();
    });
  } catch (e) {}

  // Wire cancel button
  try {
    $w('#registryCancelBtn').onClick(() => {
      _resetCreateForm();
      try { $w('#registryCreateForm').collapse(); } catch (e) {}
      try { $w('#registryCreateBtn').enable(); } catch (e) {}
    });
  } catch (e) {}
}

function _populateMyRepeater(registries) {
  const repeater = $w('#registryRepeater');
  repeater.data = registries.map(r => ({ ...r }));

  repeater.onItemReady(($item, itemData) => {
    try { $item('#registryItemTitle').text = itemData.title || ''; } catch (e) {}
    try { $item('#registryItemOccasion').text = _formatOccasion(itemData.occasion); } catch (e) {}
    try {
      $item('#registryItemDate').text = itemData.eventDate
        ? new Date(itemData.eventDate).toLocaleDateString()
        : '';
    } catch (e) {}
    try { $item('#registryItemCount').text = `${itemData.itemCount || 0} item${itemData.itemCount !== 1 ? 's' : ''}`; } catch (e) {}

    // Manage button → navigate to detail view
    try {
      $item('#registryManageBtn').onClick(() => {
        try {
          wixLocationFrontend.to(`/gift-registry?id=${itemData._id}`);
        } catch (e) {}
      });
    } catch (e) {}
  });
}

async function _handleCreateSubmit() {
  let title = '';
  let occasion = 'other';
  let eventDate = null;
  let message = '';
  let isPublic = false;

  try { title = $w('#registryTitleInput').value || ''; } catch (e) {}
  try { occasion = $w('#registryOccasionDropdown').value || 'other'; } catch (e) {}
  try { eventDate = $w('#registryDatePicker').value || null; } catch (e) {}
  try { message = $w('#registryMessageInput').value || ''; } catch (e) {}
  try { isPublic = $w('#registryPublicToggle').checked || false; } catch (e) {}

  if (!title.trim()) {
    try { $w('#registryFormError').text = 'Please enter a registry name.'; } catch (e) {}
    try { $w('#registryFormError').expand(); } catch (e) {}
    return;
  }

  try { $w('#registrySubmitBtn').disable(); } catch (e) {}
  try { $w('#registrySubmitBtn').label = 'Creating...'; } catch (e) {}
  try { $w('#registryFormError').collapse(); } catch (e) {}

  const result = await createRegistry({ title, occasion, eventDate, message, isPublic });

  if (!result.success) {
    try { $w('#registryFormError').text = result.error || 'Failed to create registry.'; } catch (e) {}
    try { $w('#registryFormError').expand(); } catch (e) {}
    try { $w('#registrySubmitBtn').enable(); } catch (e) {}
    try { $w('#registrySubmitBtn').label = 'Create Registry'; } catch (e) {}
    return;
  }

  announce($w, `Registry "${result.data.title}" created.`);

  // Navigate to new registry detail view
  try {
    wixLocationFrontend.to(`/gift-registry?id=${result.data._id}`);
  } catch (e) {
    // Fallback: reload my registries
    try { $w('#registrySubmitBtn').label = 'Create Registry'; } catch (e2) {}
    try { $w('#registrySubmitBtn').enable(); } catch (e2) {}
    await _loadMyRegistries();
  }
}

function _resetCreateForm() {
  try { $w('#registryTitleInput').value = ''; } catch (e) {}
  try { $w('#registryOccasionDropdown').value = 'other'; } catch (e) {}
  try { $w('#registryDatePicker').value = null; } catch (e) {}
  try { $w('#registryMessageInput').value = ''; } catch (e) {}
  try { $w('#registryPublicToggle').checked = false; } catch (e) {}
  try { $w('#registryFormError').collapse(); } catch (e) {}
  try { $w('#registrySubmitBtn').label = 'Create Registry'; } catch (e) {}
  try { $w('#registrySubmitBtn').enable(); } catch (e) {}
}

// ── S3: Registry Detail (owner) ───────────────────────────────────────

async function _loadDetailView(registryId) {
  const result = await getRegistry(registryId);

  if (!result.success) {
    _showError(result.error || 'Registry not found.');
    return;
  }

  _renderRegistryDetail(result.data);
}

/**
 * Render the owner registry detail view with items + management controls.
 * Exported for testing.
 * @param {Object} registry - registry with items array
 */
export function _renderRegistryDetail(registry) {
  _showSection('detail');

  try { $w('#registryDetailTitle').text = registry.title || ''; } catch (e) {}
  try { $w('#registryDetailOccasion').text = _formatOccasion(registry.occasion); } catch (e) {}
  try {
    $w('#registryDetailDate').text = registry.eventDate
      ? new Date(registry.eventDate).toLocaleDateString()
      : '';
  } catch (e) {}
  try { $w('#registryDetailMessage').text = registry.message || ''; } catch (e) {}

  // Share link
  const shareUrl = `${_getBaseUrl()}/gift-registry?registry=${registry.slug}`;
  try { $w('#registryShareLink').text = shareUrl; } catch (e) {}
  try {
    $w('#registryCopyBtn').onClick(() => {
      try {
        navigator.clipboard.writeText(shareUrl);
        $w('#registryCopyBtn').label = 'Copied!';
        announce($w, 'Share link copied to clipboard.');
        setTimeout(() => {
          try { $w('#registryCopyBtn').label = 'Copy Link'; } catch (e) {}
        }, 2000);
      } catch (e) {}
    });
  } catch (e) {}

  // Items
  const items = registry.items || [];

  if (items.length === 0) {
    try { $w('#registryDetailEmpty').expand(); } catch (e) {}
    try { $w('#registryDetailItemsRepeater').collapse(); } catch (e) {}
  } else {
    try { $w('#registryDetailEmpty').collapse(); } catch (e) {}
    try { $w('#registryDetailItemsRepeater').expand(); } catch (e) {}
    _populateDetailItemsRepeater(items, registry._id);
  }

  // Add item form submission
  try {
    $w('#registryAddItemBtn').onClick(async () => {
      await _handleAddItem(registry._id);
    });
  } catch (e) {}

  // Delete registry button
  try {
    $w('#registryDeleteBtn').onClick(async () => {
      await _handleDeleteRegistry(registry._id);
    });
  } catch (e) {}

  // Back button
  try {
    $w('#registryBackBtn').onClick(() => {
      try { wixLocationFrontend.to('/gift-registry'); } catch (e) {}
    });
  } catch (e) {}
}

function _populateDetailItemsRepeater(items, registryId) {
  const repeater = $w('#registryDetailItemsRepeater');
  repeater.data = items.map(i => ({ ...i }));

  repeater.onItemReady(($item, itemData) => {
    try { $item('#detailItemName').text = itemData.productName || ''; } catch (e) {}
    try {
      $item('#detailItemPrice').text = itemData.productPrice != null
        ? `$${itemData.productPrice.toFixed(2)}`
        : '';
    } catch (e) {}
    try { $item('#detailItemPriority').text = _formatPriority(itemData.priority); } catch (e) {}
    try {
      $item('#detailItemProgress').text =
        `${itemData.purchasedQuantity || 0} / ${itemData.quantity || 1} purchased`;
    } catch (e) {}
    try {
      if (itemData.imageUrl) $item('#detailItemImage').src = itemData.imageUrl;
    } catch (e) {}
    try { $item('#detailItemNotes').text = itemData.notes || ''; } catch (e) {}

    // Remove item button
    try {
      $item('#detailItemRemoveBtn').onClick(async () => {
        try { $item('#detailItemRemoveBtn').disable(); } catch (e2) {}
        const result = await removeRegistryItem(registryId, itemData._id);
        if (result.success) {
          // Reload detail view
          await _loadDetailView(registryId);
        } else {
          try { $item('#detailItemRemoveBtn').enable(); } catch (e2) {}
          announce($w, result.error || 'Could not remove item.');
        }
      });
    } catch (e) {}
  });
}

/**
 * Handle add-item form submission in the owner detail view.
 * Exported for testing.
 * @param {string} registryId
 */
export async function _handleAddItem(registryId) {
  let productName = '';
  let productPrice = 0;
  let productId = '';
  let imageUrl = '';
  let quantity = 1;
  let priority = 2;
  let notes = '';

  try { productName = $w('#addItemName').value || ''; } catch (e) {}
  try { productPrice = parseFloat($w('#addItemPrice').value) || 0; } catch (e) {}
  try { productId = $w('#addItemProductId').value || ''; } catch (e) {}
  try { imageUrl = $w('#addItemImageUrl').value || ''; } catch (e) {}
  try { quantity = parseInt($w('#addItemQuantity').value, 10) || 1; } catch (e) {}
  try { priority = parseInt($w('#addItemPriority').value, 10) || 2; } catch (e) {}
  try { notes = $w('#addItemNotes').value || ''; } catch (e) {}

  if (!productName.trim()) {
    try { $w('#addItemError').text = 'Product name is required.'; } catch (e) {}
    try { $w('#addItemError').expand(); } catch (e) {}
    return;
  }

  try { $w('#registryAddItemBtn').disable(); } catch (e) {}
  try { $w('#registryAddItemBtn').label = 'Adding...'; } catch (e) {}
  try { $w('#addItemError').collapse(); } catch (e) {}

  const result = await addRegistryItem(registryId, {
    productName,
    productPrice,
    productId,
    imageUrl,
    quantity,
    priority,
    notes,
  });

  if (!result.success) {
    try { $w('#addItemError').text = result.error || 'Failed to add item.'; } catch (e) {}
    try { $w('#addItemError').expand(); } catch (e) {}
    try { $w('#registryAddItemBtn').enable(); } catch (e) {}
    try { $w('#registryAddItemBtn').label = 'Add Item'; } catch (e) {}
    return;
  }

  announce($w, `"${result.data.productName}" added to registry.`);
  try { $w('#registryAddItemBtn').label = 'Add Item'; } catch (e) {}
  try { $w('#registryAddItemBtn').enable(); } catch (e) {}

  // Reload detail view to show new item
  await _loadDetailView(registryId);
}

async function _handleDeleteRegistry(registryId) {
  try { $w('#registryDeleteBtn').disable(); } catch (e) {}
  try { $w('#registryDeleteBtn').label = 'Deleting...'; } catch (e) {}

  const result = await deleteRegistry(registryId);

  if (!result.success) {
    try { $w('#registryDeleteBtn').enable(); } catch (e) {}
    try { $w('#registryDeleteBtn').label = 'Delete Registry'; } catch (e) {}
    announce($w, result.error || 'Could not delete registry.');
    return;
  }

  announce($w, 'Registry deleted.');
  try { wixLocationFrontend.to('/gift-registry'); } catch (e) {}
}

// ── S4: Public View ───────────────────────────────────────────────────

async function _loadPublicView(slug) {
  const result = await getPublicRegistry(slug);

  if (!result.success) {
    _showError('This registry was not found or is no longer public.');
    try { $w('#registryNoIndex').expand(); } catch (e) {}
    return;
  }

  _renderPublicRegistry(result.data);
}

/**
 * Render the public registry view for guests.
 * Exported for testing.
 * @param {Object} data - { title, occasion, eventDate, message, items }
 */
export function _renderPublicRegistry(data) {
  _showSection('public');

  try { $w('#registryPublicTitle').text = data.title || ''; } catch (e) {}
  try { $w('#registryPublicOccasion').text = _formatOccasion(data.occasion); } catch (e) {}
  try {
    $w('#registryPublicDate').text = data.eventDate
      ? new Date(data.eventDate).toLocaleDateString()
      : '';
  } catch (e) {}
  try { $w('#registryPublicMessage').text = data.message || ''; } catch (e) {}

  // SEO title
  try { $w('#registryPublicMetaTitle').text = `${data.title} — Gift Registry | Carolina Futons`; } catch (e) {}

  const items = data.items || [];

  if (items.length === 0) {
    try { $w('#registryPublicEmpty').expand(); } catch (e) {}
    try { $w('#registryPublicItemsRepeater').collapse(); } catch (e) {}
    return;
  }

  try { $w('#registryPublicEmpty').collapse(); } catch (e) {}
  try { $w('#registryPublicItemsRepeater').expand(); } catch (e) {}

  const repeater = $w('#registryPublicItemsRepeater');
  repeater.data = items.map(i => ({ ...i }));

  repeater.onItemReady(($item, itemData) => {
    try { $item('#publicItemName').text = itemData.productName || ''; } catch (e) {}
    try {
      $item('#publicItemPrice').text = itemData.productPrice != null
        ? `$${itemData.productPrice.toFixed(2)}`
        : '';
    } catch (e) {}
    try { $item('#publicItemPriority').text = _formatPriority(itemData.priority); } catch (e) {}
    try { $item('#publicItemRemaining').text = `${itemData.remaining ?? 0} still needed`; } catch (e) {}
    try {
      if (itemData.imageUrl) $item('#publicItemImage').src = itemData.imageUrl;
    } catch (e) {}
    try {
      $item('#publicItemImage').accessibility = {
        ariaLabel: itemData.productName || 'Product image',
      };
    } catch (e) {}

    // Purchase button (only if remaining > 0)
    try {
      const purchaseBtn = $item('#publicItemPurchaseBtn');
      if ((itemData.remaining ?? 0) <= 0) {
        try { purchaseBtn.label = 'Purchased'; } catch (e) {}
        try { purchaseBtn.disable(); } catch (e) {}
      } else {
        try {
          purchaseBtn.accessibility = { ariaLabel: `Mark "${itemData.productName || 'item'}" as purchased` };
        } catch (e) {}
        purchaseBtn.onClick(async () => {
          try { purchaseBtn.disable(); } catch (e2) {}
          try { purchaseBtn.label = 'Marking...'; } catch (e2) {}

          const result = await markItemPurchased(itemData._id, { buyerName: '', quantity: 1 });

          if (result.success) {
            try { purchaseBtn.label = 'Thank you!'; } catch (e2) {}
            try {
              $item('#publicItemRemaining').text = `${result.data.remaining} still needed`;
            } catch (e2) {}
            announce($w, `Marked "${itemData.productName || 'item'}" as purchased. Thank you!`);
          } else {
            try { purchaseBtn.enable(); } catch (e2) {}
            try { purchaseBtn.label = "I'm buying this!"; } catch (e2) {}
            announce($w, result.error || 'Could not mark item. Please try again.');
          }
        });
      }
    } catch (e) {}
  });
}

// ── Section helpers ───────────────────────────────────────────────────

/**
 * Collapse all sections and expand only the named one.
 * Exported for testing.
 * @param {'loading'|'my'|'detail'|'public'|'error'} name
 */
export function _showSection(name) {
  const sectionIds = {
    loading: '#registryLoadingSection',
    my:      '#registryMySection',
    detail:  '#registryDetailSection',
    public:  '#registryPublicSection',
    error:   '#registryErrorSection',
  };

  for (const [key, sel] of Object.entries(sectionIds)) {
    try {
      if (key === name) {
        $w(sel).expand();
      } else {
        $w(sel).collapse();
      }
    } catch (e) {}
  }
}

function _showError(message) {
  _showSection('error');
  try { $w('#registryErrorText').text = message; } catch (e) {}
}

// ── Format helpers ────────────────────────────────────────────────────

const OCCASION_LABELS = {
  wedding:     'Wedding',
  housewarming:'Housewarming',
  dorm:        'Dorm Room',
  baby:        'Baby Shower',
  holiday:     'Holiday',
  other:       'Gift Registry',
};

/**
 * Format an occasion key to a human-readable label.
 * @param {string} occasion
 * @returns {string}
 */
export function _formatOccasion(occasion) {
  return OCCASION_LABELS[occasion] || 'Gift Registry';
}

/**
 * Format a priority number to a human-readable label.
 * @param {number} priority
 * @returns {string}
 */
export function _formatPriority(priority) {
  if (priority === 1) return 'Must Have';
  if (priority === 3) return 'Dream Item';
  return 'Nice to Have';
}

function _getBaseUrl() {
  try {
    return wixLocationFrontend.baseUrl || '';
  } catch (e) {
    return '';
  }
}
