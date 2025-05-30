/**
 * Jest Test Setup
 * Global configuration and mocks for testing
 */

// Mock environment variables
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true });
Object.defineProperty(process.env, 'DATABASE_URL', { value: 'postgresql://test:test@localhost:5432/test_db', writable: true });
Object.defineProperty(process.env, 'OPENAI_API_KEY', { value: 'test-api-key', writable: true });

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 