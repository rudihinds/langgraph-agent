/**
 * Setup file for Vitest tests
 * This file is loaded before test execution
 */

// Set up global vi object for mocking
import { vi } from 'vitest';

// Make vi available globally for all tests
// This allows us to use vi without importing it in every test file
global.vi = vi;

// Set global test timeout to avoid tests hanging
vi.setConfig({ testTimeout: 15000 });

// Silence console.error messages we expect during tests
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out specific messages that are expected during testing
  if (
    args[0]?.includes?.('Warning:') ||
    args[0]?.includes?.('Not implemented') ||
    args[0]?.includes?.('Loop detected')
  ) {
    return;
  }
  originalConsoleError(...args);
};

// Provide mock implementations for any globals we need
Object.defineProperty(global, 'process', {
  value: {
    ...global.process,
    env: {
      ...global.process.env,
      NODE_ENV: 'test'
    }
  }
});