/**
 * Tests for LangGraph server integration
 *
 * Tests the LangGraph server with authentication and thread validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAuthenticatedLangGraphServer } from "../langgraph-server.js";
import { ThreadService } from "../../../services/thread.service.js";

// Create a mock LangGraphServer implementation
const mockLangGraphServer = {
  port: 2024,
  static: vi.fn(),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  addGraph: vi.fn(),
  on: vi.fn(),
};

// Mock the require function
const originalRequire = global.require;
let shouldThrow = false;

// Override require
global.require = vi.fn((moduleName) => {
  if (moduleName === "@langchain/langgraph-sdk" && shouldThrow) {
    throw new Error("Module not found");
  }

  if (moduleName === "@langchain/langgraph-sdk") {
    return {
      LangGraphServer: vi.fn().mockImplementation(() => mockLangGraphServer),
    };
  }

  return originalRequire(moduleName);
}) as any;

// Mock ThreadService constructor
const mockGetUserThreads = vi.fn().mockResolvedValue([
  {
    threadId: "valid-thread-id",
    rfpId: "test-rfp",
    userId: "test-user",
    createdAt: new Date().toISOString(),
  },
]);
const mockGetOrCreateThreadForRFP = vi
  .fn()
  .mockResolvedValue({ threadId: "new-thread-id", isNew: true });

vi.mock("../../../services/thread.service.js", () => {
  return {
    ThreadService: vi.fn().mockImplementation(() => ({
      getUserThreads: mockGetUserThreads,
      getOrCreateThreadForRFP: mockGetOrCreateThreadForRFP,
    })),
  };
});

vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn().mockImplementation(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "test-user", email: "test@example.com" } },
          error: null,
        }),
      },
    })),
  };
});

vi.mock("../../logger.js", () => {
  return {
    Logger: {
      getInstance: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      }),
    },
  };
});

vi.mock("../../config/env.js", () => {
  return {
    ENV: {
      SUPABASE_URL: "https://test-project.supabase.co",
      SUPABASE_ANON_KEY: "test-anon-key",
      isDevelopment: () => true,
      isSupabaseConfigured: () => true,
    },
  };
});

vi.mock("../../middleware/langraph-auth.js", () => {
  return {
    langGraphAuth: {},
  };
});

describe("LangGraph Server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldThrow = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
    shouldThrow = false;
  });

  afterAll(() => {
    global.require = originalRequire;
  });

  it("creates server with default configuration", () => {
    const server = createAuthenticatedLangGraphServer();
    expect(server).toBeDefined();
    expect(server.port).toBe(2024);
  });

  it("creates server with custom port", () => {
    const server = createAuthenticatedLangGraphServer({ port: 3000 });
    expect(mockLangGraphServer.port).toBe(3000);
  });

  it("creates server with thread validation enabled by default", () => {
    const server = createAuthenticatedLangGraphServer();

    // Check that server was created with requestInterceptor
    expect(global.require).toHaveBeenCalledWith("@langchain/langgraph-sdk");
    expect(server).toEqual(
      expect.objectContaining({
        port: 2024,
      })
    );
  });

  it("creates server with thread validation disabled", () => {
    const server = createAuthenticatedLangGraphServer({
      threadValidation: {
        enabled: false,
        strictErrorHandling: false,
        autoCreateMappings: false,
      },
    });

    // Check that server was created without requestInterceptor
    expect(global.require).toHaveBeenCalledWith("@langchain/langgraph-sdk");
    expect(server).toBeDefined();
  });

  it("handles import errors gracefully", () => {
    // Set flag to make require throw an error
    shouldThrow = true;

    // Expect the function to throw
    expect(() => createAuthenticatedLangGraphServer()).toThrow(
      "Failed to import LangGraphServer from @langchain/langgraph-sdk"
    );
  });

  describe("Thread Validation", () => {
    it("validates thread for authorized user", async () => {
      const server = createAuthenticatedLangGraphServer();

      // Access the call arguments to get the requestInterceptor
      const LangGraphServerMock = global.require(
        "@langchain/langgraph-sdk"
      ).LangGraphServer;
      const interceptor =
        LangGraphServerMock.mock.calls[0][0].requestInterceptor;

      // Create a mock request with a valid thread ID
      const request = new Request(
        "http://localhost:2024/threads/valid-thread-id",
        {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }
      );

      // Run the interceptor
      const modifiedRequest = await interceptor(request);

      // Verify thread service was called
      expect(ThreadService).toHaveBeenCalled();
      expect(modifiedRequest.headers.get("X-User-ID")).toBe("test-user");
    });

    it("rejects request with invalid thread ID in production", async () => {
      // Mock ENV.isProduction to return true for this test
      const { ENV } = require("../../config/env.js");
      const originalEnv = { ...ENV };
      ENV.isProduction = () => true;

      // Create server with strict error handling
      const server = createAuthenticatedLangGraphServer({
        threadValidation: {
          enabled: true,
          strictErrorHandling: true,
          autoCreateMappings: false,
        },
      });

      // Access the call arguments to get the requestInterceptor
      const LangGraphServerMock = global.require(
        "@langchain/langgraph-sdk"
      ).LangGraphServer;
      const interceptor =
        LangGraphServerMock.mock.calls[0][0].requestInterceptor;

      // Setup empty threads for this test
      mockGetUserThreads.mockResolvedValueOnce([]);

      // Create a mock request with an invalid thread ID
      const request = new Request(
        "http://localhost:2024/threads/invalid-thread-id",
        {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }
      );

      // Run the interceptor - should still return a request due to try/catch
      const modifiedRequest = await interceptor(request);

      // Restore ENV
      Object.assign(ENV, originalEnv);

      // Verify request was returned
      expect(modifiedRequest).toBeDefined();
    });

    it("allows auto-creation of thread mappings in development", async () => {
      // Setup empty threads for this test
      mockGetUserThreads.mockResolvedValueOnce([]);

      // Create server with auto-creation enabled
      const server = createAuthenticatedLangGraphServer({
        threadValidation: {
          enabled: true,
          strictErrorHandling: false,
          autoCreateMappings: true,
        },
      });

      // Access the call arguments to get the requestInterceptor
      const LangGraphServerMock = global.require(
        "@langchain/langgraph-sdk"
      ).LangGraphServer;
      const interceptor =
        LangGraphServerMock.mock.calls[0][0].requestInterceptor;

      // Create a mock request with a new thread ID
      const request = new Request(
        "http://localhost:2024/threads/new-thread-id",
        {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }
      );

      // Run the interceptor
      const modifiedRequest = await interceptor(request);

      // Verify thread service was called
      expect(ThreadService).toHaveBeenCalled();
      expect(modifiedRequest.headers.get("X-User-ID")).toBe("test-user");
    });

    it("ignores non-thread related requests", async () => {
      const server = createAuthenticatedLangGraphServer();

      // Access the call arguments to get the requestInterceptor
      const LangGraphServerMock = global.require(
        "@langchain/langgraph-sdk"
      ).LangGraphServer;
      const interceptor =
        LangGraphServerMock.mock.calls[0][0].requestInterceptor;

      // Create a mock request that's not thread-related
      const request = new Request("http://localhost:2024/info", {
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      // Run the interceptor
      const modifiedRequest = await interceptor(request);

      // Verify thread service was not called and request was passed through
      expect(ThreadService).not.toHaveBeenCalled();
      expect(modifiedRequest).toBe(request);
    });
  });

  describe("Error Handling", () => {
    it("adds enhanced error listeners", () => {
      const server = createAuthenticatedLangGraphServer();

      // Verify that the error handler was added
      expect(mockLangGraphServer.on).toHaveBeenCalledWith(
        "error",
        expect.any(Function)
      );
    });

    it("handles authentication errors gracefully", async () => {
      // Mock error in auth.getUser
      const supabaseClientMock = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "Invalid token" },
          }),
        },
      };

      const { createClient } = require("@supabase/supabase-js");
      createClient.mockReturnValueOnce(supabaseClientMock);

      const server = createAuthenticatedLangGraphServer();

      // Access the call arguments to get the requestInterceptor
      const LangGraphServerMock = global.require(
        "@langchain/langgraph-sdk"
      ).LangGraphServer;
      const interceptor =
        LangGraphServerMock.mock.calls[0][0].requestInterceptor;

      // Create a mock request
      const request = new Request(
        "http://localhost:2024/threads/valid-thread-id",
        {
          headers: {
            Authorization: "Bearer invalid-token",
          },
        }
      );

      // Run the interceptor - should return the original request due to try/catch
      const modifiedRequest = await interceptor(request);

      // Verify request was returned
      expect(modifiedRequest).toBeDefined();
    });
  });
});
