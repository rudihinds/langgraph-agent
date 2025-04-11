// Add global test setup for Vitest
import '@testing-library/jest-dom';

// Mock Next.js specific features
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    pathname: '/',
    query: {},
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/',
}));

// Mock cookies API
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: vi.fn().mockReturnValue([]),
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

// Silence console errors in tests
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out specific React-related warnings to keep test output clean
  if (
    args[0]?.includes?.('Warning:') ||
    args[0]?.includes?.('React does not recognize') ||
    args[0]?.includes?.('validateDOMNesting')
  ) {
    return;
  }
  originalConsoleError(...args);
};

// Set up global timeout
vi.setConfig({ testTimeout: 10000 });