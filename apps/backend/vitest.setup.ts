/**
 * Setup file for Vitest tests
 * This file is loaded before test execution
 */

// Set up global vi object for mocking
import { vi } from "vitest";

// Make vi available globally
// @ts-ignore
global.vi = vi;

// Set global test timeout (15 seconds is a good balance)
vi.setConfig({ testTimeout: 15000 });

// Silence expected console errors during testing
const originalConsoleError = console.error;
console.error = (...args) => {
  // Allow errors that are expected during testing
  const errorMsg = args[0]?.toString() || "";
  if (errorMsg.includes("unimplemented") || errorMsg.includes("Warning:")) {
    return;
  }
  originalConsoleError(...args);
};

// Mock environment variables for testing
process.env.SUPABASE_URL = "https://mock-supabase-url.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key";
process.env.SUPABASE_ANON_KEY = "mock-anon-key";
process.env.NODE_ENV = "test";

// Mock implementations for global variables
vi.mock("@/lib/supabase/client.js", () => ({
  serverSupabase: {
    storage: {
      from: () => ({
        list: vi
          .fn()
          .mockResolvedValue({
            data: [{ metadata: { mimetype: "application/pdf" } }],
            error: null,
          }),
        download: vi.fn().mockResolvedValue({
          data: {
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
          },
          error: null,
        }),
      }),
    },
  },
}));
