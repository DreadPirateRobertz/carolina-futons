// Admin Review Moderation.js — Review Moderation Queue (Admin Only)
// Displays pending reviews from ProductReviews collection (incl. Stamped.io ingests).
// Supports individual approve/reject, bulk actions, auto-approve eligible, and stats.
import { getModerationQueue, getModerationStats, bulkModerate, autoApproveEligible, autoRejectSpam } from 'backend/reviewModeration.web';
import { moderateReview } from 'backend/reviewsService.web';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';

let _reviews = [];
let _selectedIds = new Set();
let _currentFilter = 'pending';
let _currentPage = 0;
const PAGE_SIZE = 20;

$w.onReady(async function () {
  // ── Admin access guard ────────────────────────────────────────
  try {
    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember();
    if (!member?._id) {
      const loc = await import('wix-location-frontend');
      loc.to('/');
      return;
    }
    const roles = await currentMember.getRoles();
    const isAdmin = roles.some(r => r.title === 'Admin' || r._id === 'admin');
    if (!isAdmin) {
      const loc = await import('wix-location-frontend');
      loc.to('/');
      return;
    }
  } catch (_) {
    const loc = await import('wix-location-frontend');
    loc.to('/');
    return;
  }

  initFilterButtons();
  initBulkActions();
  await Promise.all([loadStats(), loadQueue()]);
  trackEvent('page_view', { page: 'admin_review_moderation' });
});

// ── Stats ──────────────────────────────────────────────────────

async function loadStats() {
  const result = await getModerationStats();
  if (!result.success) return;
  const s = result.stats;
  $w('#txtPendingCount').text = String(s.pending);
  $w('#txtApprovedCount').text = String(s.approved);
  $w('#txtRejectedCount').text = String(s.rejected);
  $w('#txtFlaggedCount').text = String(s.flagged);
}

// ── Queue ──────────────────────────────────────────────────────

async function loadQueue() {
  showLoading(true);
  _selectedIds = new Set();
  updateBulkBar();

  const result = await getModerationQueue({
    status: _currentFilter,
    page: _currentPage,
    pageSize: PAGE_SIZE,
  });

  if (!result.success) {
    $w('#txtQueueEmpty').text = 'Failed to load reviews. Please refresh.';
    $w('#txtQueueEmpty').show();
    showLoading(false);
    return;
  }

  _reviews = result.reviews;

  if (_reviews.length === 0) {
    $w('#txtQueueEmpty').text = _currentFilter === 'pending'
      ? 'No pending reviews — all caught up!'
      : 'No reviews found.';
    $w('#txtQueueEmpty').show();
    $w('#repeaterReviews').hide();
  } else {
    $w('#txtQueueEmpty').hide();
    $w('#repeaterReviews').show();
    renderQueue();
  }

  updatePagination(result.total);
  showLoading(false);
}

function renderQueue() {
  $w('#repeaterReviews').data = _reviews.map(r => ({ _id: r.reviewId, ...r }));

  $w('#repeaterReviews').onItemReady(($item, itemData) => {
    $item('#txtReviewAuthor').text = itemData.author;
    $item('#txtReviewProduct').text = itemData.productName || itemData.productId;
    $item('#txtReviewRating').text = '★'.repeat(itemData.rating) + '☆'.repeat(5 - itemData.rating);
    $item('#txtReviewTitle').text = itemData.title || '';
    $item('#txtReviewBody').text = itemData.body;
    $item('#txtReviewDate').text = itemData.createdAt
      ? new Date(itemData.createdAt).toLocaleDateString()
      : '';
    $item('#txtReviewStatus').text = itemData.status;
    $item('#txtSpamScore').text = `Spam: ${itemData.spamScore}${itemData.isLikelySpam ? ' ⚠' : ''}`;
    $item('#txtSource').text = itemData.source === 'stamped' ? 'Stamped.io' : 'Site';

    // Selection checkbox
    $item('#checkboxSelect').checked = _selectedIds.has(itemData.reviewId);
    $item('#checkboxSelect').onChange(() => {
      if ($item('#checkboxSelect').checked) {
        _selectedIds.add(itemData.reviewId);
      } else {
        _selectedIds.delete(itemData.reviewId);
      }
      updateBulkBar();
    });

    // Individual approve/reject
    $item('#btnApprove').onClick(() => moderateOne(itemData.reviewId, 'approve', $item));
    $item('#btnReject').onClick(() => moderateOne(itemData.reviewId, 'reject', $item));

    // Hide approve/reject based on current status
    if (itemData.status === 'approved') $item('#btnApprove').disable();
    if (itemData.status === 'rejected') $item('#btnReject').disable();
  });
}

async function moderateOne(reviewId, action, $item) {
  $item('#btnApprove').disable();
  $item('#btnReject').disable();

  const result = await moderateReview(reviewId, action);

  if (result.success) {
    announce(`Review ${action}d`);
    await Promise.all([loadStats(), loadQueue()]);
  } else {
    announce(`Failed to ${action} review: ${result.error || 'unknown error'}`);
    $item('#btnApprove').enable();
    $item('#btnReject').enable();
  }
}

// ── Filter buttons ─────────────────────────────────────────────

function initFilterButtons() {
  $w('#btnFilterPending').onClick(() => setFilter('pending'));
  $w('#btnFilterApproved').onClick(() => setFilter('approved'));
  $w('#btnFilterRejected').onClick(() => setFilter('rejected'));
  $w('#btnFilterAll').onClick(() => setFilter('all'));
}

function setFilter(status) {
  _currentFilter = status;
  _currentPage = 0;
  loadQueue();
}

// ── Bulk actions ───────────────────────────────────────────────

function initBulkActions() {
  $w('#btnBulkApprove').onClick(() => runBulkAction('approve'));
  $w('#btnBulkReject').onClick(() => runBulkAction('reject'));
  $w('#btnAutoApprove').onClick(runAutoApprove);
  $w('#btnAutoRejectSpam').onClick(runAutoRejectSpam);
  $w('#btnSelectAll').onClick(selectAll);
  $w('#btnClearSelection').onClick(clearSelection);
}

async function runBulkAction(action) {
  if (_selectedIds.size === 0) return;
  const ids = Array.from(_selectedIds);
  const result = await bulkModerate(ids, action);

  if (result.success) {
    announce(`${result.processed} review(s) ${action}d. ${result.failed} failed.`);
    await Promise.all([loadStats(), loadQueue()]);
  } else {
    announce(`Bulk ${action} failed: ${result.error || 'unknown error'}`);
  }
}

async function runAutoApprove() {
  $w('#btnAutoApprove').disable();
  const result = await autoApproveEligible();
  $w('#btnAutoApprove').enable();

  if (result.success) {
    announce(`Auto-approved ${result.approved} of ${result.scanned} pending reviews.`);
    await Promise.all([loadStats(), loadQueue()]);
  } else {
    announce('Auto-approve failed. Please try again.');
  }
}

async function runAutoRejectSpam() {
  $w('#btnAutoRejectSpam').disable();
  const result = await autoRejectSpam();
  $w('#btnAutoRejectSpam').enable();

  if (result.success) {
    announce(`Auto-rejected ${result.rejected} spam reviews (scanned ${result.scanned}).`);
    await Promise.all([loadStats(), loadQueue()]);
  } else {
    announce('Auto-reject spam failed. Please try again.');
  }
}

function selectAll() {
  _reviews.forEach(r => _selectedIds.add(r.reviewId));
  $w('#repeaterReviews').forEachItem(($item) => {
    $item('#checkboxSelect').checked = true;
  });
  updateBulkBar();
}

function clearSelection() {
  _selectedIds.clear();
  $w('#repeaterReviews').forEachItem(($item) => {
    $item('#checkboxSelect').checked = false;
  });
  updateBulkBar();
}

function updateBulkBar() {
  const count = _selectedIds.size;
  $w('#txtSelectionCount').text = count > 0 ? `${count} selected` : '';
  if (count > 0) {
    $w('#containerBulkBar').show();
  } else {
    $w('#containerBulkBar').hide();
  }
}

// ── Pagination ─────────────────────────────────────────────────

function updatePagination(total) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  $w('#txtPageInfo').text = `Page ${_currentPage + 1} of ${Math.max(1, totalPages)} (${total} total)`;
  $w('#btnPrevPage').isDisabled = _currentPage === 0;
  $w('#btnNextPage').isDisabled = (_currentPage + 1) * PAGE_SIZE >= total;

  $w('#btnPrevPage').onClick(() => {
    if (_currentPage > 0) { _currentPage--; loadQueue(); }
  });
  $w('#btnNextPage').onClick(() => {
    if ((_currentPage + 1) * PAGE_SIZE < total) { _currentPage++; loadQueue(); }
  });
}

// ── Loading state ──────────────────────────────────────────────

function showLoading(on) {
  if (on) {
    $w('#loadingSpinner').show();
    $w('#repeaterReviews').hide();
  } else {
    $w('#loadingSpinner').hide();
  }
}
