import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame } from './fixtures/products.js';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('backend/swatchService.web', () => ({
  getProductSwatches: vi.fn().mockResolvedValue([
    { _id: 'sw-1', swatchName: 'Natural', swatchImage: 'https://example.com/natural.jpg', colorHex: '#D4B896', colorFamily: 'neutral', material: 'Cotton' },
    { _id: 'sw-2', swatchName: 'Espresso', swatchImage: null, colorHex: '#3A2518', colorFamily: 'brown', material: 'Microfiber' },
  ]),
  getSwatchCount: vi.fn().mockResolvedValue(24),
  getAllSwatchFamilies: vi.fn().mockResolvedValue(['neutral', 'brown', 'blue', 'red']),
}));

vi.mock('backend/emailService.web', () => ({
  submitSwatchRequest: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    mountainBlue: '#5B8FA8',
    sandDark: '#C4A882',
    success: '#4CAF50',
    sunsetCoral: '#E8845C',
  },
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

import { initSwatchSelector, initSwatchRequest } from '../src/public/product/swatchSelector.js';
import { getProductSwatches, getSwatchCount, getAllSwatchFamilies } from 'backend/swatchService.web';
import { submitSwatchRequest } from 'backend/emailService.web';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', data: [],
    style: { color: '', backgroundColor: '', borderColor: '', borderWidth: '', opacity: 0 },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onInput: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
    options: [],
    forEachItem: vi.fn(),
    checked: false,
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  return (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('swatchSelector', () => {
  let $w, product;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    product = { ...futonFrame, _id: 'prod-1' };
  });

  describe('initSwatchSelector', () => {
    it('fetches swatches, count, and families on init', async () => {
      await initSwatchSelector($w, product);
      expect(getProductSwatches).toHaveBeenCalledWith('prod-1');
      expect(getSwatchCount).toHaveBeenCalledWith('prod-1');
      expect(getAllSwatchFamilies).toHaveBeenCalled();
    });

    it('expands swatch section when swatches exist', async () => {
      await initSwatchSelector($w, product);
      expect($w('#swatchSection').expand).toHaveBeenCalled();
    });

    it('collapses swatch section when no swatches returned', async () => {
      getProductSwatches.mockResolvedValueOnce([]);
      await initSwatchSelector($w, product);
      expect($w('#swatchSection').collapse).toHaveBeenCalled();
    });

    it('collapses swatch section when swatches is null', async () => {
      getProductSwatches.mockResolvedValueOnce(null);
      await initSwatchSelector($w, product);
      expect($w('#swatchSection').collapse).toHaveBeenCalled();
    });

    it('displays swatch count text', async () => {
      await initSwatchSelector($w, product);
      expect($w('#swatchCount').text).toContain('2');
      expect($w('#swatchCount').text).toContain('24');
    });

    it('handles null product gracefully', async () => {
      await expect(initSwatchSelector($w, null)).resolves.not.toThrow();
    });

    it('collapses section on backend error', async () => {
      getProductSwatches.mockRejectedValueOnce(new Error('Network error'));
      await initSwatchSelector($w, product);
      expect($w('#swatchSection').collapse).toHaveBeenCalled();
    });

    it('registers click handler on view-all button', async () => {
      await initSwatchSelector($w, product);
      expect($w('#swatchViewAll').onClick).toHaveBeenCalled();
    });

    it('registers click handler on swatch request link', async () => {
      await initSwatchSelector($w, product);
      expect($w('#swatchRequestLink').onClick).toHaveBeenCalled();
    });

    it('sets up color filter with families', async () => {
      await initSwatchSelector($w, product);
      const filter = $w('#swatchColorFilter');
      expect(filter.options).toEqual([
        { label: 'All', value: '' },
        { label: 'Neutral', value: 'neutral' },
        { label: 'Brown', value: 'brown' },
        { label: 'Blue', value: 'blue' },
        { label: 'Red', value: 'red' },
      ]);
      expect(filter.value).toBe('');
    });

    it('renders swatch grid data with _id fallback', async () => {
      await initSwatchSelector($w, product);
      const grid = $w('#swatchGrid');
      expect(grid.data.length).toBe(2);
      expect(grid.data[0]._id).toBe('sw-1');
    });

    it('renders swatch grid items via onItemReady', async () => {
      await initSwatchSelector($w, product);
      const grid = $w('#swatchGrid');
      expect(grid.onItemReady).toHaveBeenCalled();

      // Simulate onItemReady callback with image swatch
      const itemReadyCb = grid.onItemReady.mock.calls[0][0];
      const $item = create$w();
      const swatchData = { _id: 'sw-1', swatchName: 'Natural', swatchImage: 'https://example.com/natural.jpg', colorHex: '#D4B896' };

      itemReadyCb($item, swatchData);
      expect($item('#swatchThumb').src).toBe('https://example.com/natural.jpg');
      expect($item('#swatchThumb').alt).toBe('Natural');
      expect($item('#swatchLabel').text).toBe('Natural');
    });

    it('renders color-only swatch (no image) via backgroundColor', async () => {
      await initSwatchSelector($w, product);
      const grid = $w('#swatchGrid');
      const itemReadyCb = grid.onItemReady.mock.calls[0][0];
      const $item = create$w();
      const swatchData = { _id: 'sw-2', swatchName: 'Espresso', swatchImage: null, colorHex: '#3A2518' };

      itemReadyCb($item, swatchData);
      expect($item('#swatchThumb').style.backgroundColor).toBe('#3A2518');
    });

    it('handles empty swatch name gracefully', async () => {
      await initSwatchSelector($w, product);
      const grid = $w('#swatchGrid');
      const itemReadyCb = grid.onItemReady.mock.calls[0][0];
      const $item = create$w();

      itemReadyCb($item, { _id: 'sw-x', swatchName: null, swatchImage: 'img.jpg' });
      expect($item('#swatchLabel').text).toBe('');
      expect($item('#swatchThumb').alt).toBe('Fabric swatch');
    });

    it('resets selectedSwatchId on re-init (SPA navigation)', async () => {
      // First init — simulated swatch selection via grid item click
      await initSwatchSelector($w, product);
      // Second init should reset state
      await initSwatchSelector($w, product);
      // No selected swatch border should be applied by default
      const grid = $w('#swatchGrid');
      const itemReadyCb = grid.onItemReady.mock.calls[grid.onItemReady.mock.calls.length - 1][0];
      const $item = create$w();
      itemReadyCb($item, { _id: 'sw-1', swatchName: 'Test' });
      // Unselected items get sandDark border
      expect($item('#swatchThumb').style.borderColor).toBe('#C4A882');
    });

    it('skips color filter when no families returned', async () => {
      getAllSwatchFamilies.mockResolvedValueOnce([]);
      await initSwatchSelector($w, product);
      // Filter should not have custom options set beyond defaults
      // (the function returns early when families is empty)
    });

    it('skips null entries in families list', async () => {
      getAllSwatchFamilies.mockResolvedValueOnce(['neutral', null, 'blue']);
      await initSwatchSelector($w, product);
      const filter = $w('#swatchColorFilter');
      expect(filter.options).toEqual([
        { label: 'All', value: '' },
        { label: 'Neutral', value: 'neutral' },
        { label: 'Blue', value: 'blue' },
      ]);
    });

    it('color filter onChange re-fetches filtered swatches', async () => {
      await initSwatchSelector($w, product);
      const filter = $w('#swatchColorFilter');
      expect(filter.onChange).toHaveBeenCalled();

      const onChangeCb = filter.onChange.mock.calls[0][0];
      filter.value = 'brown';
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-2', swatchName: 'Espresso', colorHex: '#3A2518' },
      ]);
      await onChangeCb();
      expect(getProductSwatches).toHaveBeenCalledWith('prod-1', 'brown');
    });

    it('color filter onChange with empty value passes null', async () => {
      await initSwatchSelector($w, product);
      const filter = $w('#swatchColorFilter');
      const onChangeCb = filter.onChange.mock.calls[0][0];
      filter.value = '';
      await onChangeCb();
      expect(getProductSwatches).toHaveBeenCalledWith('prod-1', null);
    });

    it('swatch click triggers variant match when finish dropdown has match', async () => {
      const onSelectVariant = vi.fn().mockResolvedValue(undefined);
      await initSwatchSelector($w, product, { onSelectVariant });

      // Set up finish dropdown with matching option
      $w('#finishDropdown').options = [
        { label: 'Natural', value: 'natural-finish' },
        { label: 'Espresso', value: 'espresso-finish' },
      ];

      const grid = $w('#swatchGrid');
      const itemReadyCb = grid.onItemReady.mock.calls[0][0];
      const $item = create$w();
      const swatchData = { _id: 'sw-1', swatchName: 'Natural' };

      itemReadyCb($item, swatchData);
      // Simulate click
      const clickCb = $item('#swatchThumb').onClick.mock.calls[0][0];
      await clickCb();

      expect($w('#finishDropdown').value).toBe('natural-finish');
      expect(onSelectVariant).toHaveBeenCalled();
    });

    it('swatch click falls back to tint overlay when no dropdown match', async () => {
      await initSwatchSelector($w, product);

      const grid = $w('#swatchGrid');
      const itemReadyCb = grid.onItemReady.mock.calls[0][0];
      const $item = create$w();
      const swatchData = { _id: 'sw-1', swatchName: 'Custom Fabric', colorHex: '#FF5500' };

      itemReadyCb($item, swatchData);
      const clickCb = $item('#swatchThumb').onClick.mock.calls[0][0];
      await clickCb();

      expect($w('#swatchTintOverlay').style.backgroundColor).toBe('#FF5500');
      expect($w('#swatchTintOverlay').style.opacity).toBe(0.25);
      expect($w('#swatchTintOverlay').show).toHaveBeenCalled();
    });

    it('swatch click skips tint when colorHex is missing', async () => {
      await initSwatchSelector($w, product);

      const grid = $w('#swatchGrid');
      const itemReadyCb = grid.onItemReady.mock.calls[0][0];
      const $item = create$w();
      const swatchData = { _id: 'sw-1', swatchName: 'Unknown', colorHex: null };

      itemReadyCb($item, swatchData);
      const clickCb = $item('#swatchThumb').onClick.mock.calls[0][0];
      await clickCb();

      expect($w('#swatchTintOverlay').show).not.toHaveBeenCalled();
    });

    it('view-all button opens swatch gallery modal', async () => {
      getProductSwatches.mockResolvedValue([
        { _id: 'sw-1', swatchName: 'Natural', swatchImage: 'img.jpg', colorHex: '#D4B896', colorFamily: 'neutral', material: 'Cotton' },
      ]);
      await initSwatchSelector($w, product);

      const viewAllCb = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllCb();

      expect($w('#swatchGalleryModal').show).toHaveBeenCalled();
      expect(getProductSwatches).toHaveBeenCalledWith('prod-1', null, 500);
    });

    it('gallery modal does not open if no swatches loaded', async () => {
      await initSwatchSelector($w, product);
      getProductSwatches.mockResolvedValueOnce([]);
      const viewAllCb = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllCb();

      expect($w('#swatchGalleryModal').show).not.toHaveBeenCalled();
    });

    it('gallery search filters swatches by name, family, and material', async () => {
      await initSwatchSelector($w, product);
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'Natural', colorFamily: 'neutral', material: 'Cotton', swatchImage: 'img.jpg' },
        { _id: 'sw-2', swatchName: 'Espresso', colorFamily: 'brown', material: 'Microfiber' },
      ]);

      const viewAllCb = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllCb();

      const searchInput = $w('#swatchSearch');
      expect(searchInput.onInput).toHaveBeenCalled();

      const inputCb = searchInput.onInput.mock.calls[0][0];
      // Search by material
      inputCb({ target: { value: 'cotton' } });
      // After filtering, gallery grid should be re-rendered (data set again)
      expect($w('#swatchGalleryGrid').data.length).toBe(1);
      expect($w('#swatchGalleryGrid').data[0].swatchName).toBe('Natural');
    });

    it('gallery search with empty string shows all swatches', async () => {
      await initSwatchSelector($w, product);
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'Natural', colorFamily: 'neutral', material: 'Cotton', swatchImage: 'img.jpg' },
        { _id: 'sw-2', swatchName: 'Espresso', colorFamily: 'brown', material: 'Microfiber' },
      ]);

      const viewAllCb = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllCb();

      const inputCb = $w('#swatchSearch').onInput.mock.calls[0][0];
      inputCb({ target: { value: '' } });
      expect($w('#swatchGalleryGrid').data.length).toBe(2);
    });

    it('gallery close button hides modal', async () => {
      getProductSwatches.mockResolvedValue([
        { _id: 'sw-1', swatchName: 'Natural', swatchImage: 'img.jpg' },
      ]);
      await initSwatchSelector($w, product);
      const viewAllCb = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllCb();

      const closeCb = $w('#swatchGalleryClose').onClick.mock.calls[0][0];
      closeCb();
      expect($w('#swatchGalleryModal').hide).toHaveBeenCalled();
    });

    it('gallery grid click shows swatch detail panel', async () => {
      getProductSwatches.mockResolvedValue([
        { _id: 'sw-1', swatchName: 'Natural', swatchImage: 'img.jpg', material: 'Cotton', careInstructions: 'Machine wash', colorFamily: 'neutral' },
      ]);
      await initSwatchSelector($w, product);
      const viewAllCb = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllCb();

      const galleryGrid = $w('#swatchGalleryGrid');
      expect(galleryGrid.onItemReady).toHaveBeenCalled();
      const itemReadyCb = galleryGrid.onItemReady.mock.calls[0][0];
      const $item = create$w();
      const swatchData = { _id: 'sw-1', swatchName: 'Natural', swatchImage: 'img.jpg', material: 'Cotton', careInstructions: 'Machine wash', colorFamily: 'neutral' };

      itemReadyCb($item, swatchData);
      const clickCb = $item('#sgThumb').onClick.mock.calls[0][0];
      await clickCb();

      expect($w('#swatchDetailName').text).toBe('Natural');
      expect($w('#swatchDetailMaterial').text).toBe('Material: Cotton');
      expect($w('#swatchDetailCare').text).toBe('Care: Machine wash');
      expect($w('#swatchDetailFamily').text).toBe('Color Family: Neutral');
      expect($w('#swatchDetail').expand).toHaveBeenCalled();
    });

    it('swatch detail handles missing optional fields', async () => {
      getProductSwatches.mockResolvedValue([
        { _id: 'sw-1', swatchName: 'Minimal', swatchImage: null },
      ]);
      await initSwatchSelector($w, product);
      const viewAllCb = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllCb();

      const galleryGrid = $w('#swatchGalleryGrid');
      const itemReadyCb = galleryGrid.onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReadyCb($item, { _id: 'sw-1', swatchName: 'Minimal' });
      const clickCb = $item('#sgThumb').onClick.mock.calls[0][0];
      await clickCb();

      expect($w('#swatchDetailMaterial').text).toBe('');
      expect($w('#swatchDetailCare').text).toBe('');
      expect($w('#swatchDetailFamily').text).toBe('');
    });

    it('assigns fallback _id when swatch has no _id', async () => {
      getProductSwatches.mockResolvedValueOnce([
        { swatchName: 'No ID Swatch', swatchImage: 'img.jpg' },
      ]);
      await initSwatchSelector($w, product);
      const grid = $w('#swatchGrid');
      expect(grid.data[0]._id).toBe('swatch-0');
    });
  });

  describe('initSwatchRequest', () => {
    let productWithOptions;

    beforeEach(() => {
      productWithOptions = {
        ...product,
        productOptions: [
          {
            name: 'Finish',
            choices: [
              { value: 'natural', description: 'Natural Oak' },
              { value: 'espresso', description: 'Espresso Brown' },
            ],
          },
          {
            name: 'Size',
            choices: [
              { value: 'full', description: 'Full' },
            ],
          },
        ],
      };
    });

    it('shows request button when product has finish/fabric options', () => {
      initSwatchRequest($w, productWithOptions);
      expect($w('#swatchRequestBtn').show).toHaveBeenCalled();
    });

    it('hides request button when product has no fabric options', () => {
      const simpleProduct = { ...product, productOptions: [{ name: 'Size', choices: [] }] };
      initSwatchRequest($w, simpleProduct);
      expect($w('#swatchRequestBtn').hide).toHaveBeenCalled();
    });

    it('hides request button when productOptions is undefined', () => {
      const noOpts = { ...product, productOptions: undefined };
      initSwatchRequest($w, noOpts);
      expect($w('#swatchRequestBtn').hide).toHaveBeenCalled();
    });

    it('registers click handler on request button', () => {
      initSwatchRequest($w, productWithOptions);
      expect($w('#swatchRequestBtn').onClick).toHaveBeenCalled();
    });

    it('does nothing when product is null', () => {
      expect(() => initSwatchRequest($w, null)).not.toThrow();
    });

    it('opens modal on button click showing product name', () => {
      initSwatchRequest($w, productWithOptions);
      const clickCb = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      clickCb();
      expect($w('#swatchProductName').text).toBe(productWithOptions.name);
      expect($w('#swatchModal').show).toHaveBeenCalled();
    });

    it('clears form fields when modal opens', () => {
      initSwatchRequest($w, productWithOptions);
      $w('#swatchName').value = 'Old Name';
      $w('#swatchEmail').value = 'old@email.com';
      $w('#swatchAddress').value = 'Old Address';

      const clickCb = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      clickCb();

      expect($w('#swatchName').value).toBe('');
      expect($w('#swatchEmail').value).toBe('');
      expect($w('#swatchAddress').value).toBe('');
    });

    it('populates fabric options in repeater', () => {
      initSwatchRequest($w, productWithOptions);
      const clickCb = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      clickCb();

      const repeater = $w('#swatchOptions');
      // Should only include Finish options (matches /finish|fabric|color|cover/)
      expect(repeater.data.length).toBe(2);
      expect(repeater.data[0].label).toBe('Natural Oak');
      expect(repeater.data[1].label).toBe('Espresso Brown');
    });

    it('uses value as label fallback when description is missing', () => {
      const prod = {
        ...product,
        productOptions: [{
          name: 'Fabric',
          choices: [{ value: 'linen' }],
        }],
      };
      initSwatchRequest($w, prod);
      const clickCb = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      clickCb();

      expect($w('#swatchOptions').data[0].label).toBe('linen');
    });

    it('submit handler calls submitSwatchRequest with form data', async () => {
      initSwatchRequest($w, productWithOptions);

      // Open modal first
      const openCb = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      openCb();

      // Fill form
      $w('#swatchName').value = 'John Doe';
      $w('#swatchEmail').value = 'john@example.com';
      $w('#swatchAddress').value = '123 Main St';

      // Mock checked swatch options
      $w('#swatchOptions').forEachItem.mockImplementation((cb) => {
        const $item1 = create$w();
        $item1('#swatchCheckbox').checked = true;
        cb($item1, { label: 'Natural Oak' });
        const $item2 = create$w();
        $item2('#swatchCheckbox').checked = false;
        cb($item2, { label: 'Espresso Brown' });
      });

      const submitCb = $w('#swatchSubmit').onClick.mock.calls[0][0];
      await submitCb();

      expect(submitSwatchRequest).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        address: '123 Main St',
        productId: 'prod-1',
        productName: productWithOptions.name,
        swatchNames: ['Natural Oak'],
      });
      expect($w('#swatchSubmit').disable).toHaveBeenCalled();
      expect($w('#swatchSuccess').show).toHaveBeenCalled();
    });

    it('submit does nothing when required fields are empty', async () => {
      initSwatchRequest($w, productWithOptions);
      const openCb = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      openCb();

      $w('#swatchName').value = '';
      $w('#swatchEmail').value = 'john@example.com';
      $w('#swatchAddress').value = '123 Main St';

      const submitCb = $w('#swatchSubmit').onClick.mock.calls[0][0];
      await submitCb();

      expect(submitSwatchRequest).not.toHaveBeenCalled();
    });

    it('submit does nothing when no swatches selected', async () => {
      initSwatchRequest($w, productWithOptions);
      const openCb = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      openCb();

      $w('#swatchName').value = 'John';
      $w('#swatchEmail').value = 'j@ex.com';
      $w('#swatchAddress').value = '123 St';
      $w('#swatchOptions').forEachItem.mockImplementation((cb) => {
        const $item = create$w();
        $item('#swatchCheckbox').checked = false;
        cb($item, { label: 'Natural' });
      });

      const submitCb = $w('#swatchSubmit').onClick.mock.calls[0][0];
      await submitCb();

      expect(submitSwatchRequest).not.toHaveBeenCalled();
    });

    it('submit shows error message on backend failure', async () => {
      submitSwatchRequest.mockRejectedValueOnce(new Error('Server error'));

      initSwatchRequest($w, productWithOptions);
      const openCb = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      openCb();

      $w('#swatchName').value = 'John';
      $w('#swatchEmail').value = 'j@ex.com';
      $w('#swatchAddress').value = '123 St';
      $w('#swatchOptions').forEachItem.mockImplementation((cb) => {
        const $item = create$w();
        $item('#swatchCheckbox').checked = true;
        cb($item, { label: 'Natural' });
      });

      const submitCb = $w('#swatchSubmit').onClick.mock.calls[0][0];
      await submitCb();

      expect($w('#swatchError').text).toContain('Something went wrong');
      expect($w('#swatchError').show).toHaveBeenCalled();
      expect($w('#swatchSubmit').enable).toHaveBeenCalled();
    });

    it('submit trims whitespace from form fields', async () => {
      initSwatchRequest($w, productWithOptions);
      const openCb = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      openCb();

      $w('#swatchName').value = '  John  ';
      $w('#swatchEmail').value = '  j@ex.com  ';
      $w('#swatchAddress').value = '  123 St  ';
      $w('#swatchOptions').forEachItem.mockImplementation((cb) => {
        const $item = create$w();
        $item('#swatchCheckbox').checked = true;
        cb($item, { label: 'Natural' });
      });

      const submitCb = $w('#swatchSubmit').onClick.mock.calls[0][0];
      await submitCb();

      expect(submitSwatchRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John',
          email: 'j@ex.com',
          address: '123 St',
        })
      );
    });

    it('matches Color option name for fabric detection', () => {
      const prod = {
        ...product,
        productOptions: [{ name: 'Color', choices: [{ value: 'red', description: 'Red' }] }],
      };
      initSwatchRequest($w, prod);
      expect($w('#swatchRequestBtn').show).toHaveBeenCalled();
    });

    it('matches Cover option name for fabric detection', () => {
      const prod = {
        ...product,
        productOptions: [{ name: 'Cover Material', choices: [{ value: 'leather', description: 'Leather' }] }],
      };
      initSwatchRequest($w, prod);
      expect($w('#swatchRequestBtn').show).toHaveBeenCalled();
    });
  });
});
