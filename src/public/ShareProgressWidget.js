/**
 * @module ShareProgressWidget
 * @description Social sharing of gamification achievements.
 * CF-fxby
 */

/**
 * @param {{ getShareableProgress?: Function, $w?: Function }} [opts]
 */
export async function initShareProgressWidget(opts = {}) {
  const _getShareableProgress = opts.getShareableProgress;
  const _$w = opts.$w || $w;
  const _navigator = opts.navigator || (typeof navigator !== 'undefined' ? navigator : null);

  let progress;
  try {
    progress = await _getShareableProgress();
  } catch (e) {
    try { _$w('#shareStatus').text = 'Unable to load progress. Please try again later.'; } catch (_) {}
    try { _$w('#shareStatus').show(); } catch (_) {}
    try { _$w('#shareCard').collapse(); } catch (_) {}
    return;
  }

  if (progress && progress.error) {
    try { _$w('#shareStatus').text = 'Unable to load progress. Please try again later.'; } catch (_) {}
    try { _$w('#shareStatus').show(); } catch (_) {}
    try { _$w('#shareCard').collapse(); } catch (_) {}
    return;
  }

  // Populate share card
  try { _$w('#shareTitle').text = `${progress.tierName} Member`; } catch (e) {}
  try { _$w('#shareTierBadge').text = progress.tierName; } catch (e) {}
  try {
    const stats = [`${progress.totalPoints.toLocaleString()} points`];
    if (progress.streak > 0) stats.push(`${progress.streak}-day streak`);
    if (progress.topBadges?.length > 0) stats.push(progress.topBadges.join(', '));
    _$w('#shareStats').text = stats.join(' · ');
  } catch (e) {}

  // Facebook share
  try {
    _$w('#shareFacebook').onClick(() => {
      const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(progress.shareUrl)}&quote=${encodeURIComponent(progress.shareText)}`;
      if (typeof globalThis.open === 'function') globalThis.open(url, '_blank');
    });
  } catch (e) {}

  // Twitter/X share
  try {
    _$w('#shareTwitter').onClick(() => {
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(progress.shareText)}&url=${encodeURIComponent(progress.shareUrl)}`;
      if (typeof globalThis.open === 'function') globalThis.open(url, '_blank');
    });
  } catch (e) {}

  // Copy link
  try {
    _$w('#shareCopyLink').onClick(async () => {
      try {
        if (_navigator?.clipboard?.writeText) {
          await _navigator.clipboard.writeText(progress.shareUrl);
          _$w('#shareStatus').text = 'Link copied!';
        } else {
          _$w('#shareStatus').text = progress.shareUrl;
        }
        _$w('#shareStatus').show();
      } catch (err) {
        _$w('#shareStatus').text = progress.shareUrl;
        _$w('#shareStatus').show();
      }
    });
  } catch (e) {}

  // Web Share API (mobile)
  if (_navigator?.share) {
    try {
      _$w('#shareCard').onClick(async () => {
        try {
          await _navigator.share({
            title: `${progress.tierName} Member at Carolina Futons`,
            text: progress.shareText,
            url: progress.shareUrl,
          });
          _$w('#shareStatus').text = 'Shared!';
          _$w('#shareStatus').show();
        } catch (err) {
          // User cancelled or share failed — no-op
        }
      });
    } catch (e) {}
  }
}
