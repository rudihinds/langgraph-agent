import "@testing-library/jest-dom";

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  })),
  useSearchParams: vi.fn(() => ({
    get: vi.fn(),
    getAll: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] || null,
    length: Object.keys(store).length,
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock console.error to avoid polluting test output
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out React-specific warnings that pollute test output
  if (
    typeof args[0] === "string" &&
    (args[0].includes("Warning:") ||
      args[0].includes("React does not recognize"))
  ) {
    return;
  }
  originalConsoleError(...args);
};
