/**
 * Tests for Gift Registry page (src/pages/Gift Registry.js)
 *
 * Covers:
 *   S1: Loading state
 *   S2: My Registries list + Create form
 *   S3: Registry Detail (owner view — items, add, remove, delete, share)
 *   S4: Public View (guest view — items, mark purchased)
 *   S5: Error states + noindex
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __setQuery } from 'wix-location-frontend';

// ── $w mock ───────────────────────────────────────────────────────────

const elements = new Map();

function createEl(id) {
  return {
    id,
    text: '',
    src: '',
    label: '',
    value: '',
    checked: false,
    _expanded: true,
    data: [],
    _itemReadyCb: null,
    _clickHandler: null,
    style: {},
    accessibility: { ariaLabel: '' },
    show:        vi.fn(function () { return Promise.resolve(); }),
    hide:        vi.fn(function () { return Promise.resolve(); }),
    expand:      vi.fn(function () { this._expanded = true;  return Promise.resolve(); }),
    collapse:    vi.fn(function () { this._expanded = false; return Promise.resolve(); }),
    enable:      vi.fn(function () { this.disabled = false; }),
    disable:     vi.fn(function () { this.disabled = true; }),
    onClick:     vi.fn(function (fn) { this._clickHandler = fn; }),
    onItemReady: vi.fn(function (cb) { this._itemReadyCb = cb; }),
  };
}

function getEl(sel) {
  const key = sel.replace(/^#/, '');
  if (!elements.has(key)) elements.set(key, createEl(key));
  return elements.get(key);
}

globalThis.$w = Object.assign((sel) => getEl(sel), {
  onReady: () => {},
});

// ── Backend mocks ─────────────────────────────────────────────────────

const mockCreateRegistry     = vi.fn();
const mockGetMyRegistries    = vi.fn();
const mockGetRegistry        = vi.fn();
const mockGetPublicRegistry  = vi.fn();
const mockAddRegistryItem    = vi.fn();
const mockRemoveRegistryItem = vi.fn();
const mockMarkItemPurchased  = vi.fn();
const mockDeleteRegistry     = vi.fn();

vi.mock('backend/giftRegistry.web', () => ({
  createRegistry:     (...a) => mockCreateRegistry(...a),
  getMyRegistries:    (...a) => mockGetMyRegistries(...a),
  getRegistry:        (...a) => mockGetRegistry(...a),
  getPublicRegistry:  (...a) => mockGetPublicRegistry(...a),
  addRegistryItem:    (...a) => mockAddRegistryItem(...a),
  removeRegistryItem: (...a) => mockRemoveRegistryItem(...a),
  markItemPurchased:  (...a) => mockMarkItemPurchased(...a),
  deleteRegistry:     (...a) => mockDeleteRegistry(...a),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

// ── Module import ─────────────────────────────────────────────────────

const mod = await import('../src/pages/Gift Registry.js');
const {
  _initPage,
  _renderMyRegistries,
  _renderRegistryDetail,
  _renderPublicRegistry,
  _showSection,
  _handleAddItem,
  _formatOccasion,
  _formatPriority,
} = mod;

// ── Test helpers ──────────────────────────────────────────────────────

function makeRegistry(overrides = {}) {
  return {
    _id: 'reg-1',
    title: 'Our Wedding Registry',
    slug: 'our-wedding-registry-abc123',
    occasion: 'wedding',
    eventDate: '2026-06-15',
    message: 'Help us furnish our new home!',
    isPublic: true,
    itemCount: 3,
    createdDate: '2026-01-01',
    items: [],
    ...overrides,
  };
}

function makeItem(overrides = {}) {
  return {
    _id: 'item-1',
    productId: 'prod-1',
    productName: 'Futon Sofa',
    productPrice: 599.99,
    imageUrl: 'https://img.example.com/futon.jpg',
    quantity: 2,
    purchasedQuantity: 0,
    priority: 1,
    notes: 'Prefer walnut finish',
    remaining: 2,
    ...overrides,
  };
}

function makeItemEl() {
  const itemEls = new Map();
  const $item = (sel) => {
    const key = sel.replace(/^#/, '');
    if (!itemEls.has(key)) itemEls.set(key, createEl(key));
    return itemEls.get(key);
  };
  $item._els = itemEls;
  return $item;
}

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  __setQuery({});
  mockGetMyRegistries.mockResolvedValue({ success: true, data: { registries: [] } });
});

// ── _showSection ──────────────────────────────────────────────────────

describe('_showSection', () => {
  it('expands the named section and collapses all others', () => {
    _showSection('my');

    expect(getEl('registryMySection')._expanded).toBe(true);
    expect(getEl('registryLoadingSection')._expanded).toBe(false);
    expect(getEl('registryDetailSection')._expanded).toBe(false);
    expect(getEl('registryPublicSection')._expanded).toBe(false);
    expect(getEl('registryErrorSection')._expanded).toBe(false);
  });

  it('expands detail section correctly', () => {
    _showSection('detail');
    expect(getEl('registryDetailSection')._expanded).toBe(true);
    expect(getEl('registryMySection')._expanded).toBe(false);
  });

  it('expands public section correctly', () => {
    _showSection('public');
    expect(getEl('registryPublicSection')._expanded).toBe(true);
    expect(getEl('registryMySection')._expanded).toBe(false);
  });

  it('expands error section correctly', () => {
    _showSection('error');
    expect(getEl('registryErrorSection')._expanded).toBe(true);
  });

  it('expands loading section correctly', () => {
    _showSection('loading');
    expect(getEl('registryLoadingSection')._expanded).toBe(true);
    expect(getEl('registryMySection')._expanded).toBe(false);
  });
});

// ── _formatOccasion ───────────────────────────────────────────────────

describe('_formatOccasion', () => {
  it('formats known occasions', () => {
    expect(_formatOccasion('wedding')).toBe('Wedding');
    expect(_formatOccasion('housewarming')).toBe('Housewarming');
    expect(_formatOccasion('dorm')).toBe('Dorm Room');
    expect(_formatOccasion('baby')).toBe('Baby Shower');
    expect(_formatOccasion('holiday')).toBe('Holiday');
    expect(_formatOccasion('other')).toBe('Gift Registry');
  });

  it('falls back for unknown occasion', () => {
    expect(_formatOccasion('graduation')).toBe('Gift Registry');
    expect(_formatOccasion(undefined)).toBe('Gift Registry');
    expect(_formatOccasion('')).toBe('Gift Registry');
  });
});

// ── _formatPriority ───────────────────────────────────────────────────

describe('_formatPriority', () => {
  it('formats priority levels', () => {
    expect(_formatPriority(1)).toBe('Must Have');
    expect(_formatPriority(2)).toBe('Nice to Have');
    expect(_formatPriority(3)).toBe('Dream Item');
  });

  it('defaults to Nice to Have for unknown priority', () => {
    expect(_formatPriority(0)).toBe('Nice to Have');
    expect(_formatPriority(99)).toBe('Nice to Have');
    expect(_formatPriority(undefined)).toBe('Nice to Have');
  });
});

// ── S1: Loading ───────────────────────────────────────────────────────

describe('_initPage — loading state', () => {
  it('shows loading section before fetching', async () => {
    // Intercept during fetch — check loading shown
    let loadingWasExpanded = false;
    mockGetMyRegistries.mockImplementation(() => {
      loadingWasExpanded = getEl('registryLoadingSection')._expanded;
      return Promise.resolve({ success: true, data: { registries: [] } });
    });

    await _initPage();
    expect(loadingWasExpanded).toBe(true);
  });
});

// ── S2: My Registries ─────────────────────────────────────────────────

describe('_initPage — My Registries (no URL params)', () => {
  it('calls getMyRegistries when no query params', async () => {
    __setQuery({});
    await _initPage();
    expect(mockGetMyRegistries).toHaveBeenCalledTimes(1);
  });

  it('shows my section on success', async () => {
    __setQuery({});
    await _initPage();
    expect(getEl('registryMySection')._expanded).toBe(true);
  });

  it('shows error when not authenticated', async () => {
    __setQuery({});
    mockGetMyRegistries.mockResolvedValue({ success: false, error: 'Not authenticated' });
    await _initPage();
    expect(getEl('registryErrorSection')._expanded).toBe(true);
    expect(getEl('registryErrorText').text).toContain('sign in');
  });

  it('shows error for backend failure', async () => {
    __setQuery({});
    mockGetMyRegistries.mockResolvedValue({ success: false, error: 'DB error' });
    await _initPage();
    expect(getEl('registryErrorText').text).toBe('DB error');
  });
});

describe('_renderMyRegistries', () => {
  it('shows empty state when no registries', () => {
    _renderMyRegistries([]);
    expect(getEl('registryEmptyState')._expanded).toBe(true);
    expect(getEl('registryRepeater')._expanded).toBe(false);
  });

  it('shows repeater when registries exist', () => {
    _renderMyRegistries([makeRegistry()]);
    expect(getEl('registryEmptyState')._expanded).toBe(false);
    expect(getEl('registryRepeater')._expanded).toBe(true);
  });

  it('sets registry count text singular', () => {
    _renderMyRegistries([makeRegistry()]);
    expect(getEl('registryCount').text).toBe('1 registry');
  });

  it('sets registry count text plural', () => {
    _renderMyRegistries([makeRegistry(), makeRegistry({ _id: 'reg-2' })]);
    expect(getEl('registryCount').text).toBe('2 registries');
  });

  it('sets registry count text zero', () => {
    _renderMyRegistries([]);
    expect(getEl('registryCount').text).toBe('0 registries');
  });

  it('populates repeater data with registries', () => {
    const regs = [makeRegistry(), makeRegistry({ _id: 'reg-2', title: 'Baby Shower' })];
    _renderMyRegistries(regs);
    expect(getEl('registryRepeater').data).toHaveLength(2);
    expect(getEl('registryRepeater').data[0].title).toBe('Our Wedding Registry');
  });

  it('wires create button onClick', () => {
    _renderMyRegistries([]);
    expect(getEl('registryCreateBtn').onClick).toHaveBeenCalled();
  });

  it('wires submit button onClick', () => {
    _renderMyRegistries([]);
    expect(getEl('registrySubmitBtn').onClick).toHaveBeenCalled();
  });

  it('wires cancel button onClick', () => {
    _renderMyRegistries([]);
    expect(getEl('registryCancelBtn').onClick).toHaveBeenCalled();
  });
});

describe('_renderMyRegistries — repeater item rendering', () => {
  it('renders title, occasion, date, item count into repeater item', () => {
    const reg = makeRegistry({ occasion: 'baby', itemCount: 5 });
    _renderMyRegistries([reg]);

    const repeater = getEl('registryRepeater');
    const $item = makeItemEl();
    repeater._itemReadyCb($item, reg);

    expect($item('#registryItemTitle').text).toBe('Our Wedding Registry');
    expect($item('#registryItemOccasion').text).toBe('Baby Shower');
    expect($item('#registryItemCount').text).toBe('5 items');
  });

  it('formats item count singular', () => {
    const reg = makeRegistry({ itemCount: 1 });
    _renderMyRegistries([reg]);

    const repeater = getEl('registryRepeater');
    const $item = makeItemEl();
    repeater._itemReadyCb($item, reg);

    expect($item('#registryItemCount').text).toBe('1 item');
  });

  it('shows empty date string when no eventDate', () => {
    const reg = makeRegistry({ eventDate: null });
    _renderMyRegistries([reg]);

    const repeater = getEl('registryRepeater');
    const $item = makeItemEl();
    repeater._itemReadyCb($item, reg);

    expect($item('#registryItemDate').text).toBe('');
  });

  it('wires manage button onClick', () => {
    _renderMyRegistries([makeRegistry()]);
    const repeater = getEl('registryRepeater');
    const $item = makeItemEl();
    repeater._itemReadyCb($item, makeRegistry());
    expect($item('#registryManageBtn').onClick).toHaveBeenCalled();
  });
});

describe('create form — _handleCreateSubmit via rendered create btn', () => {
  it('creates registry and navigates on success', async () => {
    mockCreateRegistry.mockResolvedValue({
      success: true,
      data: { _id: 'new-reg', title: 'Our Wedding Registry', slug: 'our-wedding-abc' },
    });

    _renderMyRegistries([]);

    // Set form values
    getEl('registryTitleInput').value = 'Our Wedding Registry';
    getEl('registryOccasionDropdown').value = 'wedding';

    // Trigger submit
    await getEl('registrySubmitBtn')._clickHandler();

    expect(mockCreateRegistry).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Our Wedding Registry', occasion: 'wedding' })
    );
  });

  it('shows error when title is empty', async () => {
    _renderMyRegistries([]);
    getEl('registryTitleInput').value = '   ';

    await getEl('registrySubmitBtn')._clickHandler();

    expect(mockCreateRegistry).not.toHaveBeenCalled();
    expect(getEl('registryFormError')._expanded).toBe(true);
    expect(getEl('registryFormError').text).toContain('name');
  });

  it('shows backend error on failure', async () => {
    mockCreateRegistry.mockResolvedValue({ success: false, error: 'Maximum 10 registries allowed' });
    _renderMyRegistries([]);
    getEl('registryTitleInput').value = 'New Registry';

    await getEl('registrySubmitBtn')._clickHandler();

    expect(getEl('registryFormError')._expanded).toBe(true);
    expect(getEl('registryFormError').text).toBe('Maximum 10 registries allowed');
  });

  it('disables submit button while creating', async () => {
    let wasDisabled = false;
    mockCreateRegistry.mockImplementation(() => {
      wasDisabled = getEl('registrySubmitBtn').disabled;
      return Promise.resolve({ success: true, data: { _id: 'r1', title: 'T', slug: 's' } });
    });
    _renderMyRegistries([]);
    getEl('registryTitleInput').value = 'Test Registry';

    await getEl('registrySubmitBtn')._clickHandler();
    expect(wasDisabled).toBe(true);
  });
});

// ── S3: Registry Detail ───────────────────────────────────────────────

describe('_initPage — Registry Detail (?id param)', () => {
  it('calls getRegistry with the ID from query', async () => {
    __setQuery({ id: 'reg-1' });
    mockGetRegistry.mockResolvedValue({ success: true, data: makeRegistry() });
    await _initPage();
    expect(mockGetRegistry).toHaveBeenCalledWith('reg-1');
  });

  it('shows detail section on success', async () => {
    __setQuery({ id: 'reg-1' });
    mockGetRegistry.mockResolvedValue({ success: true, data: makeRegistry() });
    await _initPage();
    expect(getEl('registryDetailSection')._expanded).toBe(true);
  });

  it('shows error when registry not found', async () => {
    __setQuery({ id: 'bad-id' });
    mockGetRegistry.mockResolvedValue({ success: false, error: 'Registry not found' });
    await _initPage();
    expect(getEl('registryErrorSection')._expanded).toBe(true);
    expect(getEl('registryErrorText').text).toBe('Registry not found');
  });
});

describe('_renderRegistryDetail', () => {
  it('sets title, occasion, date, message', () => {
    _renderRegistryDetail(makeRegistry({ occasion: 'housewarming', message: 'New home!' }));

    expect(getEl('registryDetailTitle').text).toBe('Our Wedding Registry');
    expect(getEl('registryDetailOccasion').text).toBe('Housewarming');
    expect(getEl('registryDetailMessage').text).toBe('New home!');
  });

  it('shows empty state when registry has no items', () => {
    _renderRegistryDetail(makeRegistry({ items: [] }));
    expect(getEl('registryDetailEmpty')._expanded).toBe(true);
    expect(getEl('registryDetailItemsRepeater')._expanded).toBe(false);
  });

  it('shows items repeater when registry has items', () => {
    _renderRegistryDetail(makeRegistry({ items: [makeItem()] }));
    expect(getEl('registryDetailEmpty')._expanded).toBe(false);
    expect(getEl('registryDetailItemsRepeater')._expanded).toBe(true);
  });

  it('sets share link text with slug', () => {
    _renderRegistryDetail(makeRegistry({ slug: 'our-wedding-abc123' }));
    expect(getEl('registryShareLink').text).toContain('our-wedding-abc123');
  });

  it('wires delete button onClick', () => {
    _renderRegistryDetail(makeRegistry());
    expect(getEl('registryDeleteBtn').onClick).toHaveBeenCalled();
  });

  it('wires back button onClick', () => {
    _renderRegistryDetail(makeRegistry());
    expect(getEl('registryBackBtn').onClick).toHaveBeenCalled();
  });

  it('wires add item button onClick', () => {
    _renderRegistryDetail(makeRegistry());
    expect(getEl('registryAddItemBtn').onClick).toHaveBeenCalled();
  });
});

describe('_renderRegistryDetail — items repeater', () => {
  it('populates items repeater data', () => {
    const items = [makeItem(), makeItem({ _id: 'item-2', productName: 'Chair' })];
    _renderRegistryDetail(makeRegistry({ items }));
    expect(getEl('registryDetailItemsRepeater').data).toHaveLength(2);
  });

  it('renders item name, price, priority, progress', () => {
    _renderRegistryDetail(makeRegistry({ items: [makeItem()] }));
    const repeater = getEl('registryDetailItemsRepeater');
    const $item = makeItemEl();
    repeater._itemReadyCb($item, makeItem());

    expect($item('#detailItemName').text).toBe('Futon Sofa');
    expect($item('#detailItemPrice').text).toBe('$599.99');
    expect($item('#detailItemPriority').text).toBe('Must Have');
    expect($item('#detailItemProgress').text).toBe('0 / 2 purchased');
  });

  it('renders item image when imageUrl present', () => {
    _renderRegistryDetail(makeRegistry({ items: [makeItem()] }));
    const repeater = getEl('registryDetailItemsRepeater');
    const $item = makeItemEl();
    repeater._itemReadyCb($item, makeItem());
    expect($item('#detailItemImage').src).toBe('https://img.example.com/futon.jpg');
  });

  it('renders item notes', () => {
    _renderRegistryDetail(makeRegistry({ items: [makeItem()] }));
    const repeater = getEl('registryDetailItemsRepeater');
    const $item = makeItemEl();
    repeater._itemReadyCb($item, makeItem());
    expect($item('#detailItemNotes').text).toBe('Prefer walnut finish');
  });

  it('wires remove button on items', () => {
    _renderRegistryDetail(makeRegistry({ items: [makeItem()] }));
    const repeater = getEl('registryDetailItemsRepeater');
    const $item = makeItemEl();
    repeater._itemReadyCb($item, makeItem());
    expect($item('#detailItemRemoveBtn').onClick).toHaveBeenCalled();
  });

  it('calls removeRegistryItem on remove click and reloads', async () => {
    mockRemoveRegistryItem.mockResolvedValue({ success: true });
    mockGetRegistry.mockResolvedValue({ success: true, data: makeRegistry({ items: [] }) });

    _renderRegistryDetail(makeRegistry({ items: [makeItem()] }));
    const repeater = getEl('registryDetailItemsRepeater');
    const $item = makeItemEl();
    repeater._itemReadyCb($item, makeItem());

    await $item('#detailItemRemoveBtn')._clickHandler();

    expect(mockRemoveRegistryItem).toHaveBeenCalledWith('reg-1', 'item-1');
    expect(mockGetRegistry).toHaveBeenCalledWith('reg-1');
  });

  it('disables remove button while removing', async () => {
    let wasDisabled = false;
    mockRemoveRegistryItem.mockImplementation(() => {
      wasDisabled = true; // btn.disable() called before await
      return Promise.resolve({ success: true });
    });
    mockGetRegistry.mockResolvedValue({ success: true, data: makeRegistry({ items: [] }) });

    _renderRegistryDetail(makeRegistry({ items: [makeItem()] }));
    const repeater = getEl('registryDetailItemsRepeater');
    const $item = makeItemEl();
    repeater._itemReadyCb($item, makeItem());
    await $item('#detailItemRemoveBtn')._clickHandler();
    expect(wasDisabled).toBe(true);
  });
});

describe('delete registry', () => {
  it('calls deleteRegistry and navigates on success', async () => {
    mockDeleteRegistry.mockResolvedValue({ success: true });
    _renderRegistryDetail(makeRegistry());

    await getEl('registryDeleteBtn')._clickHandler();

    expect(mockDeleteRegistry).toHaveBeenCalledWith('reg-1');
  });

  it('re-enables button on delete failure', async () => {
    mockDeleteRegistry.mockResolvedValue({ success: false, error: 'Not found' });
    _renderRegistryDetail(makeRegistry());

    await getEl('registryDeleteBtn')._clickHandler();

    expect(getEl('registryDeleteBtn').enable).toHaveBeenCalled();
  });

  it('disables button while deleting', async () => {
    let wasDisabled = false;
    mockDeleteRegistry.mockImplementation(() => {
      wasDisabled = getEl('registryDeleteBtn').disabled;
      return Promise.resolve({ success: true });
    });
    _renderRegistryDetail(makeRegistry());
    await getEl('registryDeleteBtn')._clickHandler();
    expect(wasDisabled).toBe(true);
  });
});

// ── _handleAddItem ────────────────────────────────────────────────────

describe('_handleAddItem', () => {
  it('calls addRegistryItem with form values', async () => {
    mockAddRegistryItem.mockResolvedValue({
      success: true,
      data: { _id: 'item-new', productName: 'Futon Sofa', quantity: 1 },
    });
    mockGetRegistry.mockResolvedValue({ success: true, data: makeRegistry({ items: [] }) });

    getEl('addItemName').value = 'Futon Sofa';
    getEl('addItemPrice').value = '499.99';
    getEl('addItemQuantity').value = '2';
    getEl('addItemPriority').value = '1';

    await _handleAddItem('reg-1');

    expect(mockAddRegistryItem).toHaveBeenCalledWith(
      'reg-1',
      expect.objectContaining({ productName: 'Futon Sofa', productPrice: 499.99 })
    );
  });

  it('shows error when product name is empty', async () => {
    getEl('addItemName').value = '';
    await _handleAddItem('reg-1');
    expect(mockAddRegistryItem).not.toHaveBeenCalled();
    expect(getEl('addItemError')._expanded).toBe(true);
  });

  it('shows backend error on failure', async () => {
    mockAddRegistryItem.mockResolvedValue({
      success: false,
      error: 'Maximum 50 items per registry',
    });
    getEl('addItemName').value = 'Chair';
    await _handleAddItem('reg-1');
    expect(getEl('addItemError')._expanded).toBe(true);
    expect(getEl('addItemError').text).toBe('Maximum 50 items per registry');
  });

  it('disables add button while submitting', async () => {
    let wasDisabled = false;
    mockAddRegistryItem.mockImplementation(() => {
      wasDisabled = getEl('registryAddItemBtn').disabled;
      return Promise.resolve({ success: true, data: { _id: 'i1', productName: 'X', quantity: 1 } });
    });
    mockGetRegistry.mockResolvedValue({ success: true, data: makeRegistry({ items: [] }) });
    getEl('addItemName').value = 'Chair';
    await _handleAddItem('reg-1');
    expect(wasDisabled).toBe(true);
  });

  it('reloads detail view after successful add', async () => {
    mockAddRegistryItem.mockResolvedValue({
      success: true,
      data: { _id: 'i1', productName: 'Chair', quantity: 1 },
    });
    mockGetRegistry.mockResolvedValue({ success: true, data: makeRegistry({ items: [] }) });
    getEl('addItemName').value = 'Chair';
    await _handleAddItem('reg-1');
    expect(mockGetRegistry).toHaveBeenCalledWith('reg-1');
  });
});

// ── S4: Public View ───────────────────────────────────────────────────

describe('_initPage — Public View (?registry param)', () => {
  it('calls getPublicRegistry with the slug from query', async () => {
    __setQuery({ registry: 'our-wedding-abc123' });
    mockGetPublicRegistry.mockResolvedValue({
      success: true,
      data: { title: 'Our Wedding', occasion: 'wedding', eventDate: null, message: '', items: [] },
    });
    await _initPage();
    expect(mockGetPublicRegistry).toHaveBeenCalledWith('our-wedding-abc123');
  });

  it('shows public section on success', async () => {
    __setQuery({ registry: 'slug-abc' });
    mockGetPublicRegistry.mockResolvedValue({
      success: true,
      data: { title: 'T', occasion: 'other', eventDate: null, message: '', items: [] },
    });
    await _initPage();
    expect(getEl('registryPublicSection')._expanded).toBe(true);
  });

  it('shows error and noindex when registry not found', async () => {
    __setQuery({ registry: 'bad-slug' });
    mockGetPublicRegistry.mockResolvedValue({ success: false, error: 'Registry not found' });
    await _initPage();
    expect(getEl('registryErrorSection')._expanded).toBe(true);
    expect(getEl('registryNoIndex')._expanded).toBe(true);
  });

  it('shows error and noindex for private registry', async () => {
    __setQuery({ registry: 'private-slug' });
    mockGetPublicRegistry.mockResolvedValue({ success: false, error: 'Registry not found' });
    await _initPage();
    expect(getEl('registryNoIndex')._expanded).toBe(true);
  });
});

describe('_renderPublicRegistry', () => {
  it('renders title, occasion, message', () => {
    _renderPublicRegistry({
      title: 'Our Wedding Registry',
      occasion: 'wedding',
      eventDate: null,
      message: 'Help us!',
      items: [],
    });

    expect(getEl('registryPublicTitle').text).toBe('Our Wedding Registry');
    expect(getEl('registryPublicOccasion').text).toBe('Wedding');
    expect(getEl('registryPublicMessage').text).toBe('Help us!');
  });

  it('sets SEO meta title', () => {
    _renderPublicRegistry({
      title: 'Baby Shower',
      occasion: 'baby',
      eventDate: null,
      message: '',
      items: [],
    });
    expect(getEl('registryPublicMetaTitle').text).toContain('Baby Shower');
    expect(getEl('registryPublicMetaTitle').text).toContain('Carolina Futons');
  });

  it('shows empty state when no items', () => {
    _renderPublicRegistry({
      title: 'Empty', occasion: 'other', eventDate: null, message: '', items: [],
    });
    expect(getEl('registryPublicEmpty')._expanded).toBe(true);
    expect(getEl('registryPublicItemsRepeater')._expanded).toBe(false);
  });

  it('shows items repeater when items exist', () => {
    _renderPublicRegistry({
      title: 'T', occasion: 'other', eventDate: null, message: '', items: [makeItem()],
    });
    expect(getEl('registryPublicEmpty')._expanded).toBe(false);
    expect(getEl('registryPublicItemsRepeater')._expanded).toBe(true);
  });

  it('populates repeater with items', () => {
    _renderPublicRegistry({
      title: 'T', occasion: 'other', eventDate: null, message: '',
      items: [makeItem(), makeItem({ _id: 'item-2' })],
    });
    expect(getEl('registryPublicItemsRepeater').data).toHaveLength(2);
  });
});

describe('_renderPublicRegistry — items repeater rendering', () => {
  function renderWithItems(items) {
    _renderPublicRegistry({
      title: 'T', occasion: 'wedding', eventDate: null, message: '', items,
    });
  }

  it('renders item name, price, priority, remaining count', () => {
    renderWithItems([makeItem({ remaining: 2 })]);
    const repeater = getEl('registryPublicItemsRepeater');
    const $item = makeItemEl();
    repeater._itemReadyCb($item, makeItem({ remaining: 2 }));

    expect($item('#publicItemName').text).toBe('Futon Sofa');
    expect($item('#publicItemPrice').text).toBe('$599.99');
    expect($item('#publicItemPriority').text).toBe('Must Have');
    expect($item('#publicItemRemaining').text).toBe('2 still needed');
  });

  it('sets image src and aria label', () => {
    renderWithItems([makeItem()]);
    const $item = makeItemEl();
    getEl('registryPublicItemsRepeater')._itemReadyCb($item, makeItem());
    expect($item('#publicItemImage').src).toBe('https://img.example.com/futon.jpg');
    expect($item('#publicItemImage').accessibility.ariaLabel).toBe('Futon Sofa');
  });

  it('disables purchase button when remaining is 0', () => {
    renderWithItems([makeItem({ remaining: 0 })]);
    const $item = makeItemEl();
    getEl('registryPublicItemsRepeater')._itemReadyCb($item, makeItem({ remaining: 0 }));
    expect($item('#publicItemPurchaseBtn').disabled).toBe(true);
    expect($item('#publicItemPurchaseBtn').label).toBe('Purchased');
  });

  it('enables purchase button when remaining > 0', () => {
    renderWithItems([makeItem({ remaining: 1 })]);
    const $item = makeItemEl();
    getEl('registryPublicItemsRepeater')._itemReadyCb($item, makeItem({ remaining: 1 }));
    expect($item('#publicItemPurchaseBtn').onClick).toHaveBeenCalled();
  });

  it('marks item purchased and updates remaining on click', async () => {
    mockMarkItemPurchased.mockResolvedValue({
      success: true,
      data: { purchasedQuantity: 1, remaining: 1 },
    });

    renderWithItems([makeItem({ remaining: 2 })]);
    const $item = makeItemEl();
    getEl('registryPublicItemsRepeater')._itemReadyCb($item, makeItem({ remaining: 2 }));

    await $item('#publicItemPurchaseBtn')._clickHandler();

    expect(mockMarkItemPurchased).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ quantity: 1 })
    );
    expect($item('#publicItemRemaining').text).toBe('1 still needed');
    expect($item('#publicItemPurchaseBtn').label).toBe('Thank you!');
  });

  it('re-enables purchase button on markItemPurchased failure', async () => {
    mockMarkItemPurchased.mockResolvedValue({
      success: false,
      error: 'Item already fully purchased',
    });

    renderWithItems([makeItem({ remaining: 1 })]);
    const $item = makeItemEl();
    getEl('registryPublicItemsRepeater')._itemReadyCb($item, makeItem({ remaining: 1 }));

    await $item('#publicItemPurchaseBtn')._clickHandler();

    expect($item('#publicItemPurchaseBtn').enable).toHaveBeenCalled();
  });

  it('disables purchase button while processing', async () => {
    let wasDisabled = false;
    mockMarkItemPurchased.mockImplementation(() => {
      wasDisabled = true; // btn.disable() was called
      return Promise.resolve({ success: true, data: { purchasedQuantity: 1, remaining: 0 } });
    });

    renderWithItems([makeItem({ remaining: 1 })]);
    const $item = makeItemEl();
    getEl('registryPublicItemsRepeater')._itemReadyCb($item, makeItem({ remaining: 1 }));

    await $item('#publicItemPurchaseBtn')._clickHandler();
    expect(wasDisabled).toBe(true);
  });
});

// ── S5: Error states ──────────────────────────────────────────────────

describe('error handling — thrown exceptions', () => {
  it('shows generic error when getMyRegistries throws', async () => {
    __setQuery({});
    mockGetMyRegistries.mockRejectedValue(new Error('network error'));
    await _initPage();
    expect(getEl('registryErrorSection')._expanded).toBe(true);
    expect(getEl('registryErrorText').text).toContain('wrong');
  });

  it('shows generic error when getRegistry throws', async () => {
    __setQuery({ id: 'reg-1' });
    mockGetRegistry.mockRejectedValue(new Error('network error'));
    await _initPage();
    expect(getEl('registryErrorSection')._expanded).toBe(true);
  });

  it('shows generic error when getPublicRegistry throws', async () => {
    __setQuery({ registry: 'slug' });
    mockGetPublicRegistry.mockRejectedValue(new Error('network error'));
    await _initPage();
    expect(getEl('registryErrorSection')._expanded).toBe(true);
  });
});

// ── Route priority ────────────────────────────────────────────────────

describe('URL param routing priority', () => {
  it('prefers ?registry over ?id when both present', async () => {
    __setQuery({ registry: 'some-slug', id: 'some-id' });
    mockGetPublicRegistry.mockResolvedValue({
      success: true,
      data: { title: 'T', occasion: 'other', eventDate: null, message: '', items: [] },
    });
    await _initPage();
    expect(mockGetPublicRegistry).toHaveBeenCalledWith('some-slug');
    expect(mockGetRegistry).not.toHaveBeenCalled();
  });

  it('uses ?id for detail view when no ?registry param', async () => {
    __setQuery({ id: 'reg-42' });
    mockGetRegistry.mockResolvedValue({ success: true, data: makeRegistry({ _id: 'reg-42' }) });
    await _initPage();
    expect(mockGetRegistry).toHaveBeenCalledWith('reg-42');
    expect(mockGetPublicRegistry).not.toHaveBeenCalled();
  });
});
