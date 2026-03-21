// Mock wix-loyalty.v2 for vitest
import { vi } from 'vitest';

let mockAccount = null;
let mockRewards = [];

export const accounts = {
  getMyAccount: vi.fn(() => Promise.resolve(mockAccount)),
  getAccount: vi.fn((_memberId) => Promise.resolve(mockAccount)),
  earnPoints: vi.fn((accountId, options) => Promise.resolve({ account: mockAccount })),
  adjustPoints: vi.fn((accountId, options) => Promise.resolve({ account: mockAccount })),
};

export const rewards = {
  listRewards: vi.fn(() => Promise.resolve({ rewards: mockRewards })),
  redeemReward: vi.fn((rewardId) => Promise.resolve({ couponCode: 'REWARD-TEST123' })),
};

export const transactions = {
  listTransactions: vi.fn(() => Promise.resolve({ transactions: [] })),
};

// Test helpers
export function __setAccount(account) { mockAccount = account; }
export function __setRewards(r) { mockRewards = r; }
export function __reset() {
  mockAccount = null;
  mockRewards = [];
  accounts.getMyAccount.mockClear();
  accounts.getAccount.mockClear();
  accounts.earnPoints.mockClear();
  accounts.adjustPoints.mockClear();
  rewards.listRewards.mockClear();
  rewards.redeemReward.mockClear();
}
