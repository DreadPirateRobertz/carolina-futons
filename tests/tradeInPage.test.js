import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetValuation = vi.fn();
const mockSubmit = vi.fn();
vi.mock('backend/tradeInService.web', () => ({
  getTradeInValuation: mockGetValuation,
  submitTradeInRequest: mockSubmit,
}));
vi.mock('public/a11yHelpers', () => ({ announce: vi.fn() }));

function makeEl() {
  return {
    text: '', value: '',
    show: vi.fn(), hide: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
  };
}
const elements = new Map();
function getEl(sel) { if (!elements.has(sel)) elements.set(sel, makeEl()); return elements.get(sel); }
let onReadyHandler = null;
globalThis.$w = Object.assign((sel) => getEl(sel), { onReady: (fn) => { onReadyHandler = fn; } });

beforeEach(async () => {
  elements.clear();
  vi.clearAllMocks();
  vi.resetModules();
  onReadyHandler = null;
  await import('../src/pages/Trade In.js');
  await onReadyHandler();
});

describe('Trade In page', () => {
  it('shows step 1 on ready', async () => {
    expect(getEl('#tradeInStep1').show).toHaveBeenCalled();
    expect(getEl('#tradeInStep2').hide).toHaveBeenCalled();
    expect(getEl('#tradeInStep3').hide).toHaveBeenCalled();
  });

  it('dropdown change triggers estimate refresh', async () => {
    getEl('#itemTypeDropdown').value = 'frame';
    getEl('#conditionDropdown').value = 'good';
    mockGetValuation.mockResolvedValue({ success: true, eligible: true, creditMin: 50, creditMax: 100 });
    const changeCb = getEl('#itemTypeDropdown').onChange.mock.calls[0][0];
    await changeCb();
    expect(mockGetValuation).toHaveBeenCalledWith('frame', 'good');
    expect(getEl('#estimateText').text).toContain('$50');
  });

  it('shows eligibility error when not eligible', async () => {
    getEl('#itemTypeDropdown').value = 'frame';
    getEl('#conditionDropdown').value = 'poor';
    mockGetValuation.mockResolvedValue({ success: true, eligible: false, message: 'Too worn' });
    const changeCb = getEl('#conditionDropdown').onChange.mock.calls[0][0];
    await changeCb();
    expect(getEl('#eligibilityError').text).toBe('Too worn');
  });

  it('shows error when valuation throws', async () => {
    getEl('#itemTypeDropdown').value = 'frame';
    getEl('#conditionDropdown').value = 'good';
    mockGetValuation.mockRejectedValue(new Error('boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const changeCb = getEl('#conditionDropdown').onChange.mock.calls[0][0];
    await changeCb();
    expect(getEl('#eligibilityError').text).toContain('Unable to calculate');
    errSpy.mockRestore();
  });

  it('shows error when result.success=false', async () => {
    getEl('#itemTypeDropdown').value = 'frame';
    getEl('#conditionDropdown').value = 'good';
    mockGetValuation.mockResolvedValue({ success: false, message: 'Unavailable' });
    const changeCb = getEl('#conditionDropdown').onChange.mock.calls[0][0];
    await changeCb();
    expect(getEl('#eligibilityError').text).toBe('Unavailable');
  });

  it('nextStep1Btn shows error if no valuation', async () => {
    const nextCb = getEl('#nextStep1Btn').onClick.mock.calls[0][0];
    nextCb();
    expect(getEl('#validationError').text).toContain('eligible item');
  });

  it('nextStep1Btn advances to step 2 when eligible', async () => {
    getEl('#itemTypeDropdown').value = 'frame';
    getEl('#conditionDropdown').value = 'good';
    mockGetValuation.mockResolvedValue({ success: true, eligible: true, creditMin: 50, creditMax: 100 });
    const changeCb = getEl('#itemTypeDropdown').onChange.mock.calls[0][0];
    await changeCb();
    const nextCb = getEl('#nextStep1Btn').onClick.mock.calls[0][0];
    nextCb();
    expect(getEl('#tradeInStep2').show).toHaveBeenCalled();
  });

  it('backBtn returns to step 1', async () => {
    const cb = getEl('#backBtn').onClick.mock.calls[0][0];
    cb();
    expect(getEl('#tradeInStep1').show).toHaveBeenCalled();
  });

  it('photosUpload onChange parses file URLs', async () => {
    getEl('#photosUpload').value = [{ url: 'a.jpg' }, { url: 'b.jpg' }];
    const cb = getEl('#photosUpload').onChange.mock.calls[0][0];
    cb();
    // silent — just exercises branch
  });

  it('submit validates required fields (firstName)', async () => {
    const cb = getEl('#submitBtn').onClick.mock.calls[0][0];
    await cb();
    expect(getEl('#validationError').text).toContain('First name');
  });

  it('submit validates required fields (lastName)', async () => {
    getEl('#firstNameInput').value = 'A';
    const cb = getEl('#submitBtn').onClick.mock.calls[0][0];
    await cb();
    expect(getEl('#validationError').text).toContain('Last name');
  });

  it('submit validates required fields (email)', async () => {
    getEl('#firstNameInput').value = 'A';
    getEl('#lastNameInput').value = 'B';
    const cb = getEl('#submitBtn').onClick.mock.calls[0][0];
    await cb();
    expect(getEl('#validationError').text).toContain('Email');
  });

  it('submit success shows step 3', async () => {
    getEl('#firstNameInput').value = 'A';
    getEl('#lastNameInput').value = 'B';
    getEl('#emailInput').value = 'a@b.co';
    mockSubmit.mockResolvedValue({ success: true, requestId: 'req-1', creditMin: 50, creditMax: 100 });
    const cb = getEl('#submitBtn').onClick.mock.calls[0][0];
    await cb();
    expect(getEl('#tradeInStep3').show).toHaveBeenCalled();
    expect(getEl('#confirmationRequest').text).toContain('req-1');
  });

  it('submit failure shows error', async () => {
    getEl('#firstNameInput').value = 'A';
    getEl('#lastNameInput').value = 'B';
    getEl('#emailInput').value = 'a@b.co';
    mockSubmit.mockResolvedValue({ success: false, message: 'Service down' });
    const cb = getEl('#submitBtn').onClick.mock.calls[0][0];
    await cb();
    expect(getEl('#validationError').text).toBe('Service down');
  });

  it('submit exception shows generic error', async () => {
    getEl('#firstNameInput').value = 'A';
    getEl('#lastNameInput').value = 'B';
    getEl('#emailInput').value = 'a@b.co';
    mockSubmit.mockRejectedValue(new Error('net'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cb = getEl('#submitBtn').onClick.mock.calls[0][0];
    await cb();
    expect(getEl('#validationError').text).toContain('unexpected');
    errSpy.mockRestore();
  });
});
