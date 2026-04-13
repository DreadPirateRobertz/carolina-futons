/**
 * SommelierWidget.js — Inline "Find Your Perfect Futon" quiz on the PDP.
 * Asks three quick questions (comfort, size, budget), scores the catalog,
 * and displays up to 3 personalised product recommendations.
 * Members have their preferences saved for future visits.
 *
 * Required Wix Studio elements:
 *   #sommelierSection     Box     — outer wrapper (starts collapsed)
 *   #sommelierTitle       Text    — section heading
 *   #sommelierComfort     Dropdown — plush / medium / firm
 *   #sommelierSize        Dropdown — twin / full / queen / king
 *   #sommelierBudget      Dropdown — under-500 / 500-1000 / 1000-2000 / over-2000
 *   #sommelierFindBtn     Button  — "Find My Futon" submit
 *   #sommelierError       Text    — inline error / empty-state message
 *   #sommelierRepeater    Repeater — one card per recommendation (max 3)
 *     #smProductImage     Image   — product main media
 *     #smProductName      Text    — product name
 *     #smMatchScore       Text    — e.g. "95% match"
 *     #smCTA              Button  — "View Product" links to /product/<slug>
 *   #sommelierGuestPrompt Text    — shown to guests after results ("Sign in to save…")
 *
 * CF-d9s
 */
import { getRecommendations, savePreferences, getMyPreferences } from 'backend/sommelierService.web';
import { currentMember } from 'wix-members-frontend';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safely read the selected value from a Wix Dropdown element.
 * @param {Function} $w   Wix selector
 * @param {string}   id   Element id including '#'
 * @returns {string|null}
 */
function getDropdownValue($w, id) {
  try { return $w(id).value || null; } catch (_) { return null; }
}

/**
 * Collect the three quiz param values from the form dropdowns.
 * Returns null if any required field is blank.
 * @param {Function} $w
 * @returns {{ comfort: string, size: string, budget: string }|null}
 */
function collectParams($w) {
  const comfort = getDropdownValue($w, '#sommelierComfort');
  const size    = getDropdownValue($w, '#sommelierSize');
  const budget  = getDropdownValue($w, '#sommelierBudget');
  if (!comfort || !size || !budget) return null;
  return { comfort, size, budget };
}

// ── Module init ───────────────────────────────────────────────────────────────

/**
 * Initialize the SommelierWidget for the current PDP.
 * Hydrates dropdowns with any saved member preferences, then wires the
 * "Find My Futon" button to fetch and render personalised recommendations.
 *
 * @param {Function} $w   Wix selector
 * @param {Object}  state Product page state (not used directly; provided for
 *                        consistency with other PDP widget signatures)
 * @returns {Promise<{destroy: Function}>}
 */
export async function initSommelierWidget($w, state) {
  let mounted = true;

  // Expand section — Sommelier is always shown on PDP (no data dependency)
  try { $w('#sommelierSection').expand(); } catch (_) {}
  try { $w('#sommelierTitle').text = 'Find Your Perfect Futon'; } catch (_) {}
  try { $w('#sommelierSection').accessibility.role = 'region'; } catch (_) {}
  try { $w('#sommelierSection').accessibility.ariaLabel = 'Futon finder quiz'; } catch (_) {}

  // ── Hydrate saved preferences for authenticated members ────────────────────

  let isMember = false;
  try {
    const member = await currentMember.getMember();
    isMember = Boolean(member?._id);
  } catch (_) {}

  if (isMember) {
    // Pre-fill dropdowns with saved preferences so the quiz feels personalized.
    // Why: members who took the quiz before shouldn't have to answer it again — we
    // surface their last-used answers as a starting point. (CF-d9s)
    try {
      const prefsResult = await getMyPreferences();
      if (prefsResult.success && prefsResult.prefs) {
        const { comfort, size, budget } = prefsResult.prefs;
        try { $w('#sommelierComfort').value = comfort; } catch (_) {}
        try { $w('#sommelierSize').value    = size;    } catch (_) {}
        try { $w('#sommelierBudget').value  = budget;  } catch (_) {}
      }
    } catch (_) {}

    try { $w('#sommelierGuestPrompt').hide(); } catch (_) {}
  } else {
    try { $w('#sommelierGuestPrompt').hide(); } catch (_) {} // hidden until results show
  }

  // ── Wire submit button ─────────────────────────────────────────────────────

  try {
    $w('#sommelierFindBtn').onClick(async () => {
      if (!mounted) return;

      const params = collectParams($w);
      if (!params) {
        try { $w('#sommelierError').text = 'Please select all three options.'; } catch (_) {}
        return;
      }
      try { $w('#sommelierError').text = ''; } catch (_) {}

      let result;
      try {
        result = await getRecommendations(params);
      } catch (err) {
        try { $w('#sommelierError').text = 'Unable to load recommendations. Please try again.'; } catch (_) {}
        return;
      }

      if (!result.success) {
        try { $w('#sommelierError').text = 'Unable to load recommendations. Please try again.'; } catch (_) {}
        return;
      }

      if (!result.recommendations.length) {
        try { $w('#sommelierError').text = 'No matches found for your criteria. Try adjusting your budget.'; } catch (_) {}
        return;
      }

      // Render recommendation cards
      try {
        $w('#sommelierRepeater').onItemReady(($item, itemData) => {
          try { $item('#smProductName').text  = itemData.product.name || ''; } catch (_) {}
          try { $item('#smMatchScore').text   = itemData.matchScore || ''; } catch (_) {}
          try {
            if (itemData.product.mainMedia) {
              $item('#smProductImage').src = itemData.product.mainMedia;
            }
          } catch (_) {}
          try {
            $item('#smCTA').label = 'View Product';
            $item('#smCTA').link  = `/product-page/${itemData.product.slug}`;
          } catch (_) {}
        });

        $w('#sommelierRepeater').data = result.recommendations.map((r, i) => ({
          ...r,
          _id: r.product._id || `sm-${i}`,
        }));
      } catch (_) {}

      // For members: persist preferences; for guests: invite them to sign in
      if (isMember) {
        try { await savePreferences(params); } catch (_) {}
      } else {
        try {
          $w('#sommelierGuestPrompt').text = 'Sign in to save your preferences for next time.';
          $w('#sommelierGuestPrompt').show();
        } catch (_) {}
      }
    });
  } catch (_) {}

  return {
    destroy() {
      mounted = false;
    },
  };
}
