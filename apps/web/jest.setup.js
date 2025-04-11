// Add any global test setup here
// For example:
// import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
  }),
}));

// Mock console.error to keep tests clean
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out specific error messages if needed
  if (
    args[0]?.includes?.('Warning:') ||
    args[0]?.includes?.('React does not recognize')
  ) {
    return;
  }
  originalConsoleError(...args);
};

// Global test timeout
jest.setTimeout(10000);