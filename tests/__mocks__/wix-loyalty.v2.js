// Mock wix-loyalty.v2 for vitest
import { vi } from 'vitest';

let mockAccount = null;
let mockRewards = [];

export const accounts = {
  getMyAccount: vi.fn(() => Promise.resolve(mockAccount)),
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
  rewards.listRewards.mockClear();
  rewards.redeemReward.mockClear();
}
