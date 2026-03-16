import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    style: {}, accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    onClick: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

const $w = (sel) => getEl(sel);

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('public/designTokens.js', () => ({
  colors: { sunsetCoral: '#E8845C', espresso: '#3A2518' },
}));

vi.mock('public/engagementTracker', () => ({
  trackSocialShare: vi.fn(),
}));

vi.mock('wix-window-frontend', () => ({
  openUrl: vi.fn(),
  default: {
    openLightbox: vi.fn(() => Promise.resolve()),
    scrollTo: vi.fn(() => Promise.resolve()),
    trackEvent: vi.fn(),
    formFactor: 'Desktop',
  },
}));

vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: vi.fn(() => Promise.resolve(null)),
  },
  authentication: {
    promptLogin: vi.fn(),
  },
}));

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({
      eq: vi.fn(function () { return this; }),
      find: vi.fn(() => Promise.resolve({ items: [] })),
    })),
    insert: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  },
}));

const { trackSocialShare } = await import('public/engagementTracker');

const { initSocialShare, initWishlistButton } =
  await import('../src/public/product/socialWishlist.js');

// ── Tests ───────────────────────────────────────────────────────────

describe('initSocialShare', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  const product = { _id: 'p1', name: 'Test Futon', slug: 'test-futon', mainMedia: 'img.jpg' };

  it('does nothing when no product', () => {
    initSocialShare($w, null);
    expect(getEl('#shareFacebook').onClick).not.toHaveBeenCalled();
  });

  it('sets ARIA labels on share buttons', () => {
    initSocialShare($w, product);
    expect(getEl('#shareFacebook').accessibility.ariaLabel).toBe('Share on Facebook');
    expect(getEl('#sharePinterest').accessibility.ariaLabel).toBe('Share on Pinterest');
    expect(getEl('#shareEmail').accessibility.ariaLabel).toBe('Share via email');
    expect(getEl('#shareCopyLink').accessibility.ariaLabel).toBe('Copy product link');
  });

  it('registers onClick on Facebook button', () => {
    initSocialShare($w, product);
    expect(getEl('#shareFacebook').onClick).toHaveBeenCalled();
  });

  it('registers onClick on Pinterest button', () => {
    initSocialShare($w, product);
    expect(getEl('#sharePinterest').onClick).toHaveBeenCalled();
  });

  it('registers onClick on email button', () => {
    initSocialShare($w, product);
    expect(getEl('#shareEmail').onClick).toHaveBeenCalled();
  });

  it('registers onClick on copy link button', () => {
    initSocialShare($w, product);
    expect(getEl('#shareCopyLink').onClick).toHaveBeenCalled();
  });

  it('tracks facebook share on click', async () => {
    initSocialShare($w, product);
    const handler = getEl('#shareFacebook').onClick.mock.calls[0][0];
    handler();
    await new Promise(r => setTimeout(r, 0));
    expect(trackSocialShare).toHaveBeenCalledWith('facebook', 'product', 'p1');
  });

  it('tracks pinterest share on click', async () => {
    initSocialShare($w, product);
    const handler = getEl('#sharePinterest').onClick.mock.calls[0][0];
    handler();
    await new Promise(r => setTimeout(r, 0));
    expect(trackSocialShare).toHaveBeenCalledWith('pinterest', 'product', 'p1');
  });

  it('tracks email share on click', async () => {
    initSocialShare($w, product);
    const handler = getEl('#shareEmail').onClick.mock.calls[0][0];
    handler();
    await new Promise(r => setTimeout(r, 0));
    expect(trackSocialShare).toHaveBeenCalledWith('email', 'product', 'p1');
  });

  it('tracks copy link on click', async () => {
    initSocialShare($w, product);
    const handler = getEl('#shareCopyLink').onClick.mock.calls[0][0];
    handler();
    await new Promise(r => setTimeout(r, 0));
    expect(trackSocialShare).toHaveBeenCalledWith('copy_link', 'product', 'p1');
  });
});

describe('initWishlistButton', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  const product = { _id: 'p1', name: 'Test', mainMedia: 'img.jpg' };

  it('does nothing when no product', async () => {
    await initWishlistButton($w, null);
    expect(getEl('#wishlistBtn').onClick).not.toHaveBeenCalled();
  });

  it('registers onClick on wishlist button', async () => {
    await initWishlistButton($w, product);
    expect(getEl('#wishlistBtn').onClick).toHaveBeenCalled();
  });

  it('prompts login when user not logged in', async () => {
    await initWishlistButton($w, product);
    const clickHandler = getEl('#wishlistBtn').onClick.mock.calls[0][0];
    await clickHandler();
    const { authentication } = await import('wix-members-frontend');
    expect(authentication.promptLogin).toHaveBeenCalled();
  });

  it('sets heart icon active when product is already in wishlist', async () => {
    const { currentMember } = await import('wix-members-frontend');
    currentMember.getMember.mockResolvedValueOnce({ _id: 'member-1' });
    const wixData = (await import('wix-data')).default;
    wixData.query.mockReturnValueOnce({
      eq: vi.fn(function () { return this; }),
      find: vi.fn(() => Promise.resolve({ items: [{ _id: 'wish-1' }] })),
    });
    await initWishlistButton($w, product);
    expect(getEl('#wishlistIcon').src).toContain('svg');
    expect(getEl('#wishlistBtn').accessibility.ariaLabel).toBe('Remove from wishlist');
  });

  it('adds product to wishlist on click when logged in', async () => {
    const { currentMember } = await import('wix-members-frontend');
    // Init getMember — returns member, default query returns empty (no existing wishlist item)
    currentMember.getMember.mockResolvedValueOnce({ _id: 'member-1' });
    await initWishlistButton($w, product);

    // Click getMember — returns member
    currentMember.getMember.mockResolvedValueOnce({ _id: 'member-1' });
    const wixData = (await import('wix-data')).default;
    // Click query — returns empty (not in wishlist) → triggers insert
    wixData.query.mockReturnValueOnce({
      eq: vi.fn(function () { return this; }),
      find: vi.fn(() => Promise.resolve({ items: [] })),
    });
    const clickHandler = getEl('#wishlistBtn').onClick.mock.calls[0][0];
    await clickHandler();
    expect(wixData.insert).toHaveBeenCalledWith('Wishlist', expect.objectContaining({
      memberId: 'member-1',
      productId: 'p1',
      productName: 'Test',
    }));
    // After adding, heart is active → label is "Remove from wishlist"
    expect(getEl('#wishlistBtn').accessibility.ariaLabel).toBe('Remove from wishlist');
  });

  it('removes product from wishlist when already saved', async () => {
    const { currentMember } = await import('wix-members-frontend');
    currentMember.getMember.mockResolvedValueOnce({ _id: 'member-1' });
    await initWishlistButton($w, product);

    currentMember.getMember.mockResolvedValueOnce({ _id: 'member-1' });
    const wixData = (await import('wix-data')).default;
    // Click query — returns existing item → triggers remove
    wixData.query.mockReturnValueOnce({
      eq: vi.fn(function () { return this; }),
      find: vi.fn(() => Promise.resolve({ items: [{ _id: 'wish-1' }] })),
    });
    const clickHandler = getEl('#wishlistBtn').onClick.mock.calls[0][0];
    await clickHandler();
    expect(wixData.remove).toHaveBeenCalledWith('Wishlist', 'wish-1');
    // After removing, heart is inactive → label is "Add to wishlist"
    expect(getEl('#wishlistBtn').accessibility.ariaLabel).toBe('Add to wishlist');
  });

  it('handles wishlist toggle error gracefully', async () => {
    const { currentMember } = await import('wix-members-frontend');
    currentMember.getMember.mockResolvedValueOnce({ _id: 'member-1' });
    await initWishlistButton($w, product);

    currentMember.getMember.mockRejectedValueOnce(new Error('Auth error'));
    const clickHandler = getEl('#wishlistBtn').onClick.mock.calls[0][0];
    await clickHandler(); // Should not throw
  });
});

describe('initSocialShare — copy link clipboard', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  const product = { _id: 'p1', name: 'Test Futon', slug: 'test-futon', mainMedia: 'img.jpg' };

  it('copies product URL to clipboard and shows "Copied!" label', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      writable: true,
      configurable: true,
    });

    initSocialShare($w, product);
    const handler = getEl('#shareCopyLink').onClick.mock.calls[0][0];
    handler();
    await new Promise(r => setTimeout(r, 0));
    expect(writeText).toHaveBeenCalledWith('https://www.carolinafutons.com/product-page/test-futon');
    // Wait for writeText promise to resolve
    await new Promise(r => setTimeout(r, 0));
    expect(getEl('#shareCopyLink').label).toBe('Copied!');

    delete globalThis.navigator;
  });
});
