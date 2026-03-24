/**
 * @file questShareCard.test.js
 * @description Tests for QuestShareCard module.
 *
 * Covers:
 *  - buildShareCardDataUrl returns valid SVG data URL with quest name and brand
 *  - showQuestShareCard shows card overlay
 *  - showQuestShareCard sets image src to SVG data URL
 *  - showQuestShareCard wires close button to hide card
 *  - showQuestShareCard wires share button
 *  - No-ops when card element absent
 *  - shareQuestCompletion uses Web Share API when available
 *  - shareQuestCompletion falls back to clipboard when share unavailable
 *  - shareQuestCompletion returns 'unavailable' when neither available
 *  - shareQuestCompletion returns 'shared' on success
 *  - shareQuestCompletion returns 'copied' on clipboard success
 *
 * CF-41x
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildShareCardDataUrl,
  shareQuestCompletion,
  showQuestShareCard,
} from '../src/public/QuestShareCard.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const QUEST = 'First Purchase';
const BADGE = '🏅';

function makeCard() {
  return { show: vi.fn(), hide: vi.fn() };
}

function makeImageEl() {
  return { src: null };
}

function makeBtn() {
  const btn = { _handler: null };
  btn.onClick = vi.fn((fn) => { btn._handler = fn; });
  return btn;
}

function make$w(card, imgEl, closeBtn, shareBtn) {
  return vi.fn((sel) => {
    if (sel === '#questShareCard')      return card    ?? null;
    if (sel === '#questShareCardImage') return imgEl   ?? null;
    if (sel === '#questShareCardClose') return closeBtn ?? null;
    if (sel === '#questShareCardShare') return shareBtn ?? null;
    return null;
  });
}

// ── Decode helper (handles UTF-8 emoji in base64 SVG) ───────────────────────

function decodeDataUrl(url) {
  const b64 = url.replace('data:image/svg+xml;base64,', '');
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ── buildShareCardDataUrl ────────────────────────────────────────────────────

describe('buildShareCardDataUrl', () => {
  it('returns a data URL', () => {
    const url = buildShareCardDataUrl({ badgeLabel: BADGE, questName: QUEST });
    expect(url).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('decoded SVG contains the quest name', () => {
    const svg = decodeDataUrl(buildShareCardDataUrl({ badgeLabel: BADGE, questName: QUEST }));
    expect(svg).toContain(QUEST);
  });

  it('decoded SVG contains brand name', () => {
    const svg = decodeDataUrl(buildShareCardDataUrl({ badgeLabel: BADGE, questName: QUEST }));
    expect(svg).toContain('Carolina Futons');
  });

  it('decoded SVG contains the badge label', () => {
    const svg = decodeDataUrl(buildShareCardDataUrl({ badgeLabel: BADGE, questName: QUEST }));
    expect(svg).toContain(BADGE);
  });

  it('escapes HTML entities in quest name', () => {
    const svg = decodeDataUrl(buildShareCardDataUrl({ badgeLabel: '', questName: '<script>alert(1)</script>' }));
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('accepts custom brand', () => {
    const svg = decodeDataUrl(buildShareCardDataUrl({ badgeLabel: '', questName: 'Q', brand: 'Acme' }));
    expect(svg).toContain('Acme');
  });
});

// ── shareQuestCompletion ─────────────────────────────────────────────────────

describe('shareQuestCompletion', () => {
  it('returns "shared" when Web Share API succeeds', async () => {
    const nav = { share: vi.fn().mockResolvedValue(undefined) };
    const result = await shareQuestCompletion({ questName: QUEST, navigator: nav });
    expect(result).toBe('shared');
    expect(nav.share).toHaveBeenCalledOnce();
  });

  it('share text includes quest name and brand', async () => {
    const nav = { share: vi.fn().mockResolvedValue(undefined) };
    await shareQuestCompletion({ questName: QUEST, navigator: nav });
    const call = nav.share.mock.calls[0][0];
    expect(call.text).toContain(QUEST);
    expect(call.text).toContain('Carolina Futons');
  });

  it('falls back to clipboard when share throws', async () => {
    const nav = { share: vi.fn().mockRejectedValue(new Error('AbortError')) };
    const clip = { writeText: vi.fn().mockResolvedValue(undefined) };
    const result = await shareQuestCompletion({ questName: QUEST, navigator: nav, clipboard: clip });
    expect(result).toBe('copied');
    expect(clip.writeText).toHaveBeenCalledOnce();
  });

  it('returns "copied" when clipboard succeeds without share API', async () => {
    const nav = {};
    const clip = { writeText: vi.fn().mockResolvedValue(undefined) };
    const result = await shareQuestCompletion({ questName: QUEST, navigator: nav, clipboard: clip });
    expect(result).toBe('copied');
  });

  it('returns "unavailable" when neither share nor clipboard is available', async () => {
    const result = await shareQuestCompletion({ questName: QUEST, navigator: {}, clipboard: null });
    expect(result).toBe('unavailable');
  });

  it('returns "unavailable" when clipboard.writeText rejects', async () => {
    const clip = { writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) };
    const result = await shareQuestCompletion({ questName: QUEST, navigator: {}, clipboard: clip });
    expect(result).toBe('unavailable');
  });
});

// ── showQuestShareCard ───────────────────────────────────────────────────────

describe('showQuestShareCard', () => {
  let card, imgEl, closeBtn, shareBtn, $w;

  beforeEach(() => {
    card     = makeCard();
    imgEl    = makeImageEl();
    closeBtn = makeBtn();
    shareBtn = makeBtn();
    $w       = make$w(card, imgEl, closeBtn, shareBtn);
  });

  it('shows the card overlay', async () => {
    await showQuestShareCard({ $w, questName: QUEST, badgeLabel: BADGE });
    expect(card.show).toHaveBeenCalledOnce();
  });

  it('sets image src to a data URL', async () => {
    await showQuestShareCard({ $w, questName: QUEST, badgeLabel: BADGE });
    expect(imgEl.src).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('does not show when card element is absent', async () => {
    const $wNoCard = make$w(null, imgEl, closeBtn, shareBtn);
    await showQuestShareCard({ $w: $wNoCard, questName: QUEST, badgeLabel: BADGE });
    expect(card.show).not.toHaveBeenCalled();
  });

  it('wires close button onClick to hide card', async () => {
    await showQuestShareCard({ $w, questName: QUEST, badgeLabel: BADGE });
    expect(closeBtn.onClick).toHaveBeenCalledOnce();
    closeBtn._handler();
    expect(card.hide).toHaveBeenCalledOnce();
  });

  it('still shows when close button is absent', async () => {
    const $wNoClose = make$w(card, imgEl, null, shareBtn);
    await showQuestShareCard({ $w: $wNoClose, questName: QUEST, badgeLabel: BADGE });
    expect(card.show).toHaveBeenCalledOnce();
  });

  it('wires share button onClick', async () => {
    await showQuestShareCard({ $w, questName: QUEST, badgeLabel: BADGE });
    expect(shareBtn.onClick).toHaveBeenCalledOnce();
  });

  it('share button triggers shareQuestCompletion with Web Share API', async () => {
    const nav = { share: vi.fn().mockResolvedValue(undefined) };
    await showQuestShareCard({ $w, questName: QUEST, badgeLabel: BADGE, navigator: nav });
    await shareBtn._handler();
    expect(nav.share).toHaveBeenCalledOnce();
  });

  it('still shows when share button is absent', async () => {
    const $wNoShare = make$w(card, imgEl, closeBtn, null);
    await showQuestShareCard({ $w: $wNoShare, questName: QUEST, badgeLabel: BADGE });
    expect(card.show).toHaveBeenCalledOnce();
  });

  it('uses default badge "🏆" when badgeLabel not provided', async () => {
    await showQuestShareCard({ $w, questName: QUEST });
    const svg = decodeDataUrl(imgEl.src);
    expect(svg).toContain('🏆');
  });
});
