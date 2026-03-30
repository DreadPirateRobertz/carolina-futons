// Admin A-B Tests.js — A/B Experiment Results Dashboard (Admin Only)
// View running experiments, variant performance, traffic splits, and significance.
// Auto-stop fires via daily cron or the Run Auto-Stop Check button (on-demand);
// manual conclude button available per experiment to declare a winner immediately.
import {
  listExperiments,
  getExperimentDetail,
  getDashboardSummary,
  autoStopSignificantExperiments,
} from 'backend/abTestDashboard.web';
import { concludeTest } from 'backend/abTesting.web';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';

// ── State ────────────────────────────────────────────────────────

let _experiments = [];
let _filter = 'all';
let _currentPage = 0;
let _total = 0;
let _selectedExperiment = null;
const PAGE_SIZE = 20;

// ── Init ─────────────────────────────────────────────────────────

$w.onReady(async function () {
  try {
    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember();
    if (!member?._id) { await redirectHome(); return; }

    const roles = await currentMember.getRoles();
    const isAdmin = roles.some(r => r.title === 'Admin' || r._id === 'admin');
    if (!isAdmin) { await redirectHome(); return; }
  } catch (e) {
    console.error('[AdminAbTests] Auth check failed:', e);
    await redirectHome();
    return;
  }

  initFilterButtons();
  initRepeater();
  initDetailPanel();
  initPagination();

  await Promise.all([loadSummary(), loadExperiments()]);
  trackEvent('page_view', { page: 'admin_ab_tests' });
});

async function redirectHome() {
  const loc = await import('wix-location-frontend');
  loc.to('/');
}

// ── Summary Cards ────────────────────────────────────────────────

async function loadSummary() {
  try {
    const result = await getDashboardSummary();
    if (!result.success || !result.summary) {
      console.error('[AdminAbTests] loadSummary: backend returned failure');
      return;
    }

    const s = result.summary;
    $w('#txtActiveCount').text = String(s.activeExperiments);
    $w('#txtConcludedCount').text = String(s.concludedExperiments);
    $w('#txtTotalEvents').text = formatNumber(s.totalEvents);
    $w('#txtReadyToConclude').text = String(s.readyToConclude);

    if (s.readyToConclude > 0) {
      $w('#badgeReadyToConclude').show();
      $w('#badgeReadyToConclude').label = `${s.readyToConclude} ready`;
    } else {
      $w('#badgeReadyToConclude').hide();
    }
  } catch (err) {
    console.error('[AdminAbTests] loadSummary threw:', err);
  }
}

// ── Experiments List ─────────────────────────────────────────────

async function loadExperiments() {
  showLoading(true);

  const result = await listExperiments({
    filter: _filter,
    page: _currentPage,
    pageSize: PAGE_SIZE,
  });

  if (!result.success) {
    showError('Failed to load experiments. Please refresh.');
    showLoading(false);
    return;
  }

  _experiments = result.tests || [];
  _total = result.total || 0;

  if (_experiments.length === 0) {
    $w('#txtEmpty').text = _filter === 'active'
      ? 'No active experiments running.'
      : _filter === 'concluded'
        ? 'No concluded experiments.'
        : 'No experiments found.';
    $w('#txtEmpty').show();
    $w('#repeaterExperiments').hide();
  } else {
    $w('#txtEmpty').hide();
    $w('#repeaterExperiments').show();
    renderExperiments();
  }

  updatePagination();
  showLoading(false);
}

function renderExperiments() {
  $w('#repeaterExperiments').data = _experiments.map(exp => ({
    _id: exp.testName,
    ...exp,
  }));
}

function renderVariantBars($item, variants) {
  if (!variants || variants.length === 0) return;

  // Show up to 3 variants in summary bars
  const shown = variants.slice(0, 3);
  shown.forEach((v, i) => {
    const idx = i + 1;
    const barEl = `#barVariant${idx}`;
    const lblEl = `#lblVariant${idx}`;
    // bar/label elements only exist for up to 3 variant slots in the repeater template
    try { $item(barEl).value = v.splitPercent || 0; $item(barEl).show(); } catch (_) {}
    try { $item(lblEl).text = `${v.name}: ${v.conversionRate}%`; $item(lblEl).show(); } catch (_) {}
  });
}

function getVariantName(exp, variantId) {
  const v = (exp.variants || []).find(v => v.id === variantId);
  return v ? v.name : variantId;
}

// ── Detail Panel ─────────────────────────────────────────────────

function initDetailPanel() {
  $w('#panelDetail').hide();

  $w('#btnCloseDetail').onClick(() => {
    $w('#panelDetail').hide();
    _selectedExperiment = null;
  });

  $w('#btnConclude').onClick(handleConclude);
  $w('#btnRunAutoStop').onClick(handleAutoStop);

  // Register once — avoids stacking duplicate handlers on each panel open
  $w('#repeaterDetailVariants').onItemReady(($item, v) => {
    const exp = _selectedExperiment;
    $item('#txtVarName').text = v.name;
    $item('#txtVarImpressions').text = formatNumber(v.impressions);
    $item('#txtVarConversions').text = formatNumber(v.conversions);
    $item('#txtVarRate').text = `${v.conversionRate}%`;
    $item('#txtVarSplit').text = `${v.splitPercent || 0}% traffic`;

    const isWinner = exp && (exp.winnerVariant === v.id ||
      (exp.winner === v.id && exp.significance?.significant));
    if (isWinner) {
      $item('#badgeVariantWinner').show();
    } else {
      $item('#badgeVariantWinner').hide();
    }
  });
}

async function openDetail(testName) {
  $w('#panelDetail').show();
  $w('#txtDetailLoading').show();
  $w('#containerDetailContent').hide();

  const result = await getExperimentDetail(testName);

  $w('#txtDetailLoading').hide();

  if (!result.success || !result.experiment) {
    $w('#txtDetailError').text = `Failed to load experiment "${testName}". Please try again.`;
    $w('#txtDetailError').show();
    return;
  }

  _selectedExperiment = result.experiment;
  renderDetail(result.experiment);
  $w('#containerDetailContent').show();
}

function renderDetail(exp) {
  $w('#txtDetailName').text = exp.testName;
  $w('#txtDetailStatus').text = exp.active ? 'Active' : 'Concluded';
  $w('#txtDetailImpressions').text = formatNumber(exp.totalImpressions);
  $w('#txtDetailCreated').text = formatDate(exp.createdAt);
  $w('#txtDetailRecommendation').text = exp.recommendation || '';

  // Conclude button — only show for active experiments
  if (exp.active && exp.winner) {
    $w('#btnConclude').label = `Conclude — declare ${getVariantName(exp, exp.winner)} winner`;
    $w('#btnConclude').show();
  } else if (exp.active) {
    $w('#btnConclude').label = 'Conclude test (no winner yet)';
    $w('#btnConclude').show();
  } else {
    $w('#btnConclude').hide();
  }

  const sig = exp.significance;
  if (sig) {
    $w('#txtSigConfidence').text = sig.significant
      ? `${sig.confidence}% confidence (p=${sig.pValue})`
      : `Not significant (z=${sig.zScore}, p=${sig.pValue})`;
    $w('#iconSigStatus').src = sig.significant
      ? 'wix:vector://v1/significant-icon'
      : 'wix:vector://v1/pending-icon';
  }

  $w('#repeaterDetailVariants').data = (exp.variants || []).map(v => ({
    _id: v.id,
    ...v,
  }));
}

async function handleConclude() {
  if (!_selectedExperiment) return;

  const exp = _selectedExperiment;
  const winner = exp.winner || (exp.variants?.[0]?.id);
  if (!winner) {
    announce('No winner variant available to conclude.');
    return;
  }

  $w('#btnConclude').disable();
  try {
    const result = await concludeTest(exp.testName, winner);

    if (result.success) {
      announce(`Experiment "${exp.testName}" concluded. Winner: ${getVariantName(exp, winner)}`);
      $w('#panelDetail').hide();
      await Promise.all([loadSummary(), loadExperiments()]);
    } else {
      console.error('[AdminAbTests] concludeTest failed:', exp.testName, result);
      showError(`Failed to conclude "${exp.testName}". Please try again.`);
    }
  } catch (err) {
    console.error('[AdminAbTests] concludeTest threw:', err);
    showError('An unexpected error occurred. Please refresh and try again.');
  } finally {
    $w('#btnConclude').enable();
  }
}

// ── Auto-Stop ─────────────────────────────────────────────────────

async function handleAutoStop() {
  $w('#btnRunAutoStop').disable();
  $w('#btnRunAutoStop').label = 'Checking...';

  const result = await autoStopSignificantExperiments();

  if (result.success) {
    const count = result.stopped?.length || 0;
    const msg = count > 0
      ? `Auto-stopped ${count} experiment${count > 1 ? 's' : ''}.`
      : 'No experiments ready to stop yet.';
    announce(msg);
    $w('#txtAutoStopResult').text = msg;
    $w('#txtAutoStopResult').show();

    if (count > 0) {
      await Promise.all([loadSummary(), loadExperiments()]);
    }
  } else {
    $w('#txtAutoStopResult').text = 'Auto-stop check failed.';
    $w('#txtAutoStopResult').show();
  }

  $w('#btnRunAutoStop').label = 'Run Auto-Stop Check';
  $w('#btnRunAutoStop').enable();
}

// ── Filter Buttons ───────────────────────────────────────────────

function initFilterButtons() {
  $w('#btnFilterAll').onClick(() => setFilter('all'));
  $w('#btnFilterActive').onClick(() => setFilter('active'));
  $w('#btnFilterConcluded').onClick(() => setFilter('concluded'));
  updateFilterButtons();
}

function setFilter(filter) {
  _filter = filter;
  _currentPage = 0;
  updateFilterButtons();
  loadExperiments();
}

function updateFilterButtons() {
  const active = 'brand';
  const inactive = 'secondary';
  $w('#btnFilterAll').buttonStyle = _filter === 'all' ? active : inactive;
  $w('#btnFilterActive').buttonStyle = _filter === 'active' ? active : inactive;
  $w('#btnFilterConcluded').buttonStyle = _filter === 'concluded' ? active : inactive;
}

// ── Pagination ───────────────────────────────────────────────────

function initPagination() {
  $w('#btnPrevPage').onClick(() => {
    if (_currentPage > 0) { _currentPage--; loadExperiments(); }
  });
  $w('#btnNextPage').onClick(() => {
    if ((_currentPage + 1) * PAGE_SIZE < _total) { _currentPage++; loadExperiments(); }
  });
}

function updatePagination() {
  const totalPages = Math.ceil(_total / PAGE_SIZE);
  $w('#txtPageInfo').text = `Page ${_currentPage + 1} of ${Math.max(1, totalPages)}`;
  $w('#btnPrevPage').disable();
  $w('#btnNextPage').disable();
  if (_currentPage > 0) $w('#btnPrevPage').enable();
  if ((_currentPage + 1) * PAGE_SIZE < _total) $w('#btnNextPage').enable();
}

// ── Repeater ─────────────────────────────────────────────────────
// onItemReady must be registered once at init before any .data assignment.

function initRepeater() {
  $w('#repeaterExperiments').onItemReady(($item, itemData) => {
    $item('#txtExpName').text = itemData.testName;
    $item('#txtExpStatus').text = itemData.active ? 'Active' : 'Concluded';
    $item('#txtExpImpressions').text = formatNumber(itemData.totalImpressions);
    $item('#txtExpVariants').text = `${itemData.variantCount} variants`;

    renderVariantBars($item, itemData.variants);

    const sig = itemData.significance;
    if (sig && sig.significant) {
      $item('#badgeSig').label = `${sig.confidence}% confidence`;
      $item('#badgeSig').show();
    } else {
      $item('#badgeSig').hide();
    }

    if (itemData.winnerVariant) {
      $item('#txtWinner').text = `Winner: ${getVariantName(itemData, itemData.winnerVariant)}`;
      $item('#txtWinner').show();
    } else {
      $item('#txtWinner').hide();
    }

    $item('#btnViewDetail').onClick(() => openDetail(itemData.testName));
  });
}

// ── Utilities ─────────────────────────────────────────────────────

function showLoading(show) {
  $w('#loadingSpinner')[show ? 'show' : 'hide']();
}

function showError(msg) {
  $w('#txtError').text = msg;
  $w('#txtError').show();
  setTimeout(() => $w('#txtError').hide(), 5000);
}

function formatNumber(n) {
  if (!n && n !== 0) return '—';
  return n.toLocaleString();
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
