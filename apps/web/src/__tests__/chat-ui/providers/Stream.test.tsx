import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  StreamProvider,
  useStream,
} from "@/features/chat-ui/providers/StreamProvider";
import * as authInterceptorModule from "@/features/auth/api/auth-interceptor";

// Mock the auth interceptor module
const mockAuthFetch = vi.fn();
const mockCreateAuthInterceptor = vi.hoisted(() => {
  return vi.fn(() => ({
    fetch: mockAuthFetch,
  }));
});

vi.mock("@/features/auth/api/auth-interceptor", () => ({
  createAuthInterceptor: mockCreateAuthInterceptor,
}));

// Create a test component to access the context
const TestComponent = ({
  onMount,
}: {
  onMount: (contextValue: any) => void;
}) => {
  const streamContext = useStream();

  React.useEffect(() => {
    if (streamContext) {
      onMount(streamContext);
    }
  }, [streamContext, onMount]);

  return <div>Test Component</div>;
};

describe("StreamProvider Authentication Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use auth interceptor for API requests when sending messages", async () => {
    // Arrange
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: "Mock response" }),
    });

    let contextValue: any;

    // Act
    render(
      <StreamProvider>
        <TestComponent
          onMount={(value) => {
            contextValue = value;
          }}
        />
      </StreamProvider>
    );

    // Wait for context to be available
    await waitFor(() => expect(contextValue).toBeDefined());

    // Send a message
    await act(async () => {
      await contextValue.sendMessage("Test message");
    });

    // Assert
    expect(mockCreateAuthInterceptor).toHaveBeenCalled();
    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/api/langgraph/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: expect.any(String),
      })
    );

    // Verify the message was included in the request body
    const requestBody = JSON.parse(mockAuthFetch.mock.calls[0][1].body);
    expect(requestBody).toHaveProperty("message", "Test message");
  });

  it("should update messages state with human and AI messages after successful response", async () => {
    // Arrange
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: "AI response message" }),
    });

    let contextValue: any;

    // Act
    render(
      <StreamProvider>
        <TestComponent
          onMount={(value) => {
            contextValue = value;
          }}
        />
      </StreamProvider>
    );

    await waitFor(() => expect(contextValue).toBeDefined());

    // Initial state
    expect(contextValue.messages).toEqual([]);

    // Send a message
    await act(async () => {
      await contextValue.sendMessage("Human message");
    });

    // Assert
    expect(contextValue.messages).toHaveLength(2);
    expect(contextValue.messages[0].role).toBe("human");
    expect(contextValue.messages[0].content).toBe("Human message");
    expect(contextValue.messages[1].role).toBe("assistant");
    expect(contextValue.messages[1].content).toBe("AI response message");
  });

  it("should handle authentication errors gracefully", async () => {
    // Arrange
    const authError = new Error("Authentication failed");
    mockAuthFetch.mockRejectedValue(authError);

    let contextValue: any;

    // Act
    render(
      <StreamProvider>
        <TestComponent
          onMount={(value) => {
            contextValue = value;
          }}
        />
      </StreamProvider>
    );

    await waitFor(() => expect(contextValue).toBeDefined());

    // Send a message that will trigger an auth error
    await act(async () => {
      await contextValue.sendMessage("Error message");
    });

    // Assert
    expect(contextValue.error).toEqual(authError);
    expect(contextValue.isLoading).toBe(false);

    // Human message should still be added to the messages array
    expect(contextValue.messages).toHaveLength(1);
    expect(contextValue.messages[0].role).toBe("human");
    expect(contextValue.messages[0].content).toBe("Error message");
  });
});
