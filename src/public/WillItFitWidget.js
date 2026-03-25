/**
 * @module WillItFitWidget
 * @description Will-It-Fit dimension checker for the Product Page.
 * User enters room dimensions + doorway width, tool shows fit/no-fit verdict.
 * No login required (cold-start acquisition tool).
 *
 * Elements:
 *   #willItFitSection     — Container (expand/collapse)
 *   #fitRoomWidth         — Input: room width (inches)
 *   #fitRoomDepth         — Input: room depth (inches)
 *   #fitDoorwayWidth      — Input: doorway width (inches)
 *   #fitCheckBtn          — "Check Fit" button
 *   #fitResultSection     — Result container (show/hide)
 *   #fitVerdict           — "It fits!" / "Too large" / "Tight fit"
 *   #fitDetails           — Clearance details text
 *   #fitNoData            — Shown when product has no dimension data
 *
 * CF-oo4b
 */

import { checkRoomFit as _defaultCheckRoomFit } from 'backend/sizeGuide.web';

/**
 * Parse a numeric input value, returning null if invalid.
 * @param {*} val
 * @returns {number|null}
 */
function parseInput(val) {
  const num = Number(val);
  return (isNaN(num) || num <= 0) ? null : num;
}

/**
 * Build a human-readable verdict from fit check results.
 * @param {{ allFit: boolean, anyTight: boolean, checks: Array }} result
 * @returns {{ verdict: string, details: string }}
 */
export function buildVerdict(result) {
  if (!result.success) {
    return { verdict: '', details: result.error || 'Unable to check fit' };
  }

  if (result.checks.length === 0) {
    return { verdict: '', details: 'Enter dimensions above to check fit.' };
  }

  const doorCheck = result.checks.find(c => c.check === 'doorway');
  const roomCheck = result.checks.find(c => c.check === 'room');

  const detailParts = [];

  if (doorCheck) {
    if (doorCheck.fits) {
      const clearance = Math.min(doorCheck.clearanceWidth ?? Infinity, doorCheck.clearanceHeight ?? Infinity);
      detailParts.push(doorCheck.tight
        ? `Doorway: fits with ${clearance.toFixed(1)}" clearance (tight!)`
        : `Doorway: fits with ${clearance.toFixed(1)}" clearance`);
    } else {
      detailParts.push('Doorway: won\'t fit through your doorway');
    }
  }

  if (roomCheck) {
    if (roomCheck.fits) {
      const clearance = Math.min(roomCheck.clearanceWidth ?? Infinity, roomCheck.clearanceDepth ?? Infinity);
      detailParts.push(roomCheck.tight
        ? `Room: fits with ${clearance.toFixed(1)}" to spare (tight!)`
        : `Room: fits with ${clearance.toFixed(1)}" to spare`);
    } else {
      detailParts.push('Room: too large for this space');
    }
  }

  let verdict;
  if (result.allFit && !result.anyTight) {
    verdict = 'It fits!';
  } else if (result.allFit && result.anyTight) {
    verdict = 'Tight fit — measure carefully';
  } else {
    verdict = 'Too large for this space';
  }

  return { verdict, details: detailParts.join(' · ') };
}

/**
 * Initialise the Will-It-Fit widget.
 *
 * @param {string}   productId
 * @param {Object}   [opts]   Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.checkRoomFit]
 */
export async function initWillItFitWidget(productId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const checkFit = opts.checkRoomFit ?? ((id, dims) => _defaultCheckRoomFit(id, dims));

  // Hide result section initially
  try { $w('#fitResultSection').hide(); } catch {}
  try { $w('#fitNoData').hide(); } catch {}

  if (!productId) return;

  try {
    $w('#fitCheckBtn').onClick(async () => {
      const roomWidth = parseInput($w('#fitRoomWidth').value);
      const roomDepth = parseInput($w('#fitRoomDepth').value);
      const doorwayWidth = parseInput($w('#fitDoorwayWidth').value);

      if (!roomWidth && !roomDepth && !doorwayWidth) return;

      const roomDims = {};
      if (roomWidth) roomDims.roomWidth = roomWidth;
      if (roomDepth) roomDims.roomDepth = roomDepth;
      if (doorwayWidth) {
        roomDims.doorwayWidth = doorwayWidth;
        roomDims.doorwayHeight = 80; // standard doorway height
      }

      try { $w('#fitCheckBtn').disable(); } catch {}

      let result;
      try {
        result = await checkFit(productId, roomDims);
      } catch {
        try { $w('#fitNoData').show(); } catch {}
        try { $w('#fitCheckBtn').enable(); } catch {}
        return;
      }

      try { $w('#fitCheckBtn').enable(); } catch {}

      if (!result.success) {
        try { $w('#fitNoData').show(); } catch {}
        try { $w('#fitResultSection').hide(); } catch {}
        return;
      }

      const { verdict, details } = buildVerdict(result);

      try { $w('#fitVerdict').text = verdict; } catch {}
      try { $w('#fitDetails').text = details; } catch {}
      try { $w('#fitNoData').hide(); } catch {}
      try { $w('#fitResultSection').show(); } catch {}
    });
  } catch {}
}
