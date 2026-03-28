/**
 * @file cf-ke61-assembly-cta.test.js
 * @description CF-ke61: Tests for AssemblyCTA module on the Product Page.
 *
 * Covers:
 *  - CTA hidden for Easy/unknown difficulty products
 *  - CTA shown for Medium difficulty products
 *  - 'Professional assembly recommended' title for Expert difficulty
 *  - White glove button wired to /getting-it-home
 *  - TaskRabbit button wired to dynamic URL from getTaskRabbitLink
 *  - TaskRabbit button falls back to static URL when backend returns failure
 *  - Assembly video button shown when guide has videoUrl
 *  - Assembly video button hidden when no guide / no videoUrl
 *  - GA4 assembly_help_cta_click tracked for each option
 *  - Handles null product state gracefully (no throw)
 *  - Collapses section on unexpected error
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('backend/assemblyGuides.web', () => ({
  getAssemblyInfo: vi.fn(),
  getTaskRabbitLink: vi.fn(),
  getAssemblyGuide: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

import { initAssemblyCTA } from '../src/public/AssemblyCTA.js';
import { getAssemblyInfo, getTaskRabbitLink, getAssemblyGuide } from 'backend/assemblyGuides.web';
import { trackEvent } from 'public/engagementTracker';

// ── Helpers ───────────────────────────────────────────────────────────

function make$w() {
  const elements = {};
  const $w = (id) => {
    if (!elements[id]) {
      elements[id] = {
        text: '',
        link: '',
        target: '',
        collapsed: true,
        hidden: false,
        accessibility: {},
        _clickHandler: null,
        onClick: vi.fn(function (fn) { this._clickHandler = fn; }),
        show: vi.fn(function () { this.hidden = false; }),
        hide: vi.fn(function () { this.hidden = true; }),
        expand: vi.fn(function () { this.collapsed = false; }),
        collapse: vi.fn(function () { this.collapsed = true; }),
      };
    }
    return elements[id];
  };
  $w._elements = elements;
  return $w;
}

function makeState(overrides = {}) {
  return {
    product: {
      _id: 'prod-seattle',
      sku: 'NDF-SEATTLE',
      name: 'Seattle Futon Frame',
      collections: ['futon-frames'],
      ...overrides,
    },
  };
}

function makeMediumInfo() {
  return { success: true, info: { difficulty: 'Medium', estimatedMinutes: 45 } };
}
function makeExpertInfo() {
  return { success: true, info: { difficulty: 'Expert', estimatedMinutes: 120 } };
}
function makeEasyInfo() {
  return { success: true, info: { difficulty: 'Easy', estimatedMinutes: 10 } };
}

const TASKRABBIT_URL = 'https://www.taskrabbit.com/m/featured/furniture-assembly?zip=28792&description=Assemble+Seattle+Futon+Frame';

beforeEach(() => {
  vi.clearAllMocks();
  getTaskRabbitLink.mockResolvedValue({ success: true, url: TASKRABBIT_URL });
  getAssemblyGuide.mockResolvedValue(null);
});

// ── Visibility by difficulty ─────────────────────────────────────────

describe('visibility by difficulty', () => {
  it('collapses section for Easy difficulty', async () => {
    getAssemblyInfo.mockResolvedValue(makeEasyInfo());
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#assemblyCTASection').collapsed).toBe(true);
  });

  it('collapses section when no assembly info for category', async () => {
    getAssemblyInfo.mockResolvedValue({ success: true, info: null });
    const $w = make$w();
    await initAssemblyCTA($w, makeState({ collections: ['unknown-category'] }));
    expect($w('#assemblyCTASection').collapsed).toBe(true);
  });

  it('expands section for Medium difficulty', async () => {
    getAssemblyInfo.mockResolvedValue(makeMediumInfo());
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#assemblyCTASection').collapsed).toBe(false);
  });

  it('expands section for Expert difficulty', async () => {
    getAssemblyInfo.mockResolvedValue(makeExpertInfo());
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#assemblyCTASection').collapsed).toBe(false);
  });

  it('also shows CTA for catalogContent "moderate" value', async () => {
    getAssemblyInfo.mockResolvedValue({ success: true, info: { difficulty: 'moderate' } });
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#assemblyCTASection').collapsed).toBe(false);
  });

  it('also shows CTA for catalogContent "difficult" value', async () => {
    getAssemblyInfo.mockResolvedValue({ success: true, info: { difficulty: 'difficult' } });
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#assemblyCTASection').collapsed).toBe(false);
  });
});

// ── Title text ────────────────────────────────────────────────────────

describe('title text', () => {
  it('shows standard CTA text for Medium', async () => {
    getAssemblyInfo.mockResolvedValue(makeMediumInfo());
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#assemblyCTATitle').text).toContain("Need help assembling?");
  });

  it('shows "Professional assembly recommended" for Expert', async () => {
    getAssemblyInfo.mockResolvedValue(makeExpertInfo());
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#assemblyCTATitle').text).toBe('Professional assembly recommended');
  });
});

// ── White Glove Delivery ──────────────────────────────────────────────

describe('white glove delivery button', () => {
  it('sets link to /getting-it-home', async () => {
    getAssemblyInfo.mockResolvedValue(makeMediumInfo());
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#btnWhiteGlove').link).toBe('/getting-it-home');
  });

  it('tracks white_glove click', async () => {
    getAssemblyInfo.mockResolvedValue(makeMediumInfo());
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    $w('#btnWhiteGlove')._clickHandler();
    // Allow a full event-loop tick for the dynamic import().then() chain to resolve
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(trackEvent).toHaveBeenCalledWith('assembly_help_cta_click', {
      productId: 'prod-seattle',
      option: 'white_glove',
    });
  });
});

// ── TaskRabbit ────────────────────────────────────────────────────────

describe('TaskRabbit button', () => {
  it('sets link from getTaskRabbitLink', async () => {
    getAssemblyInfo.mockResolvedValue(makeMediumInfo());
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#btnTaskRabbit').link).toBe(TASKRABBIT_URL);
    expect($w('#btnTaskRabbit').target).toBe('_blank');
  });

  it('falls back to static URL when getTaskRabbitLink returns failure', async () => {
    getAssemblyInfo.mockResolvedValue(makeMediumInfo());
    getTaskRabbitLink.mockResolvedValue({ success: false, url: '' });
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#btnTaskRabbit').link).toContain('taskrabbit.com');
  });

  it('tracks taskrabbit click', async () => {
    getAssemblyInfo.mockResolvedValue(makeMediumInfo());
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    $w('#btnTaskRabbit')._clickHandler();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(trackEvent).toHaveBeenCalledWith('assembly_help_cta_click', {
      productId: 'prod-seattle',
      option: 'taskrabbit',
    });
  });
});

// ── Assembly video button ─────────────────────────────────────────────

describe('assembly video button', () => {
  it('shows video button when guide has videoUrl', async () => {
    getAssemblyInfo.mockResolvedValue(makeMediumInfo());
    getAssemblyGuide.mockResolvedValue({
      videoUrl: 'https://youtube.com/watch?v=abc123',
    });
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#btnAssemblyVideo').hidden).toBe(false);
    expect($w('#btnAssemblyVideo').link).toBe('https://youtube.com/watch?v=abc123');
  });

  it('hides video button when no guide exists', async () => {
    getAssemblyInfo.mockResolvedValue(makeMediumInfo());
    getAssemblyGuide.mockResolvedValue(null);
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#btnAssemblyVideo').hidden).toBe(true);
  });

  it('hides video button when guide has no videoUrl', async () => {
    getAssemblyInfo.mockResolvedValue(makeMediumInfo());
    getAssemblyGuide.mockResolvedValue({ videoUrl: null });
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#btnAssemblyVideo').hidden).toBe(true);
  });

  it('tracks watch_video click', async () => {
    getAssemblyInfo.mockResolvedValue(makeMediumInfo());
    getAssemblyGuide.mockResolvedValue({ videoUrl: 'https://youtube.com/watch?v=xyz' });
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    $w('#btnAssemblyVideo')._clickHandler();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(trackEvent).toHaveBeenCalledWith('assembly_help_cta_click', {
      productId: 'prod-seattle',
      option: 'watch_video',
    });
  });
});

// ── Edge cases ────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('does not throw when state is null', async () => {
    const $w = make$w();
    await expect(initAssemblyCTA($w, null)).resolves.toBeUndefined();
  });

  it('does not throw when state.product is null', async () => {
    const $w = make$w();
    await expect(initAssemblyCTA($w, { product: null })).resolves.toBeUndefined();
  });

  it('collapses section when getAssemblyInfo throws', async () => {
    getAssemblyInfo.mockRejectedValue(new Error('network error'));
    const $w = make$w();
    await initAssemblyCTA($w, makeState());
    expect($w('#assemblyCTASection').collapsed).toBe(true);
  });
});
