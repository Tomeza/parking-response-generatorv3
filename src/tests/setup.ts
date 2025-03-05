import { jest } from '@jest/globals';

// モックの設定
jest.mock('../lib/busy-period', () => ({
  isBusyPeriod: jest.fn(() => Promise.resolve(false)),
  getNextBusyPeriod: jest.fn(() => Promise.resolve(null))
}));

// グローバル設定
beforeEach(() => {
  jest.clearAllMocks();
}); 