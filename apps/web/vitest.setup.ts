// Add global test setup for Vitest
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Next.js specific features
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    pathname: "/",
    query: {},
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => "/",
}));

// Mock cookies API
vi.mock("next/headers", () => ({
  cookies: () => ({
    getAll: vi.fn().mockReturnValue([]),
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Silence console errors in tests
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out specific React-related warnings to keep test output clean
  if (
    args[0]?.includes?.("Warning:") ||
    args[0]?.includes?.("React does not recognize") ||
    args[0]?.includes?.("validateDOMNesting")
  ) {
    return;
  }
  originalConsoleError(...args);
};

// Set up global timeout
vi.setConfig({ testTimeout: 10000 });
