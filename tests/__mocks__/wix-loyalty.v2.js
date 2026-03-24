// Mock wix-loyalty.v2 for vitest
import { vi } from 'vitest';

let mockAccount = null;
let mockRewards = [];
let mockAccountsByMemberId = new Map();

export const accounts = {
  getMyAccount: vi.fn(() => Promise.resolve(mockAccount)),
  getAccountBySecondaryId: vi.fn(({ memberId } = {}) => {
    const acct = memberId && mockAccountsByMemberId.get(memberId);
    if (!acct) return Promise.reject(new Error(`No loyalty account for member ${memberId}`));
    return Promise.resolve({ account: acct });
  }),
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
export function __seedLoyaltyAccount(memberId, account) { mockAccountsByMemberId.set(memberId, account); }
export function __reset() {
  mockAccount = null;
  mockRewards = [];
  mockAccountsByMemberId = new Map();
  accounts.getMyAccount.mockClear();
  accounts.getAccountBySecondaryId.mockClear();
  accounts.earnPoints.mockClear();
  accounts.adjustPoints.mockClear();
  rewards.listRewards.mockClear();
  rewards.redeemReward.mockClear();
  transactions.listTransactions.mockClear();
}
