import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChatPage from "../../../app/(dashboard)/chat/page.js";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => ({
    get: (param: string) => (param === "rfpId" ? "test-rfp-123" : null),
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  Toaster: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-toaster">{children}</div>
  ),
}));

// Mock the Thread component
vi.mock("../../../components/chat-ui/thread/index.js", () => ({
  Thread: () => <div data-testid="mock-thread">Thread Component</div>,
}));

// Mock the StreamProvider component
vi.mock("../../../components/chat-ui/providers/Stream.js", () => ({
  StreamProvider: ({
    children,
    rfpId,
  }: {
    children: React.ReactNode;
    rfpId?: string;
  }) => (
    <div data-testid="mock-stream-provider" data-rfpid={rfpId}>
      {children}
    </div>
  ),
}));

// Mock the ThreadProvider component
vi.mock("../../../components/chat-ui/providers/Thread.js", () => ({
  ThreadProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-thread-provider">{children}</div>
  ),
}));

describe("ChatPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the Thread component wrapped with necessary providers", () => {
    // Act
    render(<ChatPage />);

    // Assert
    expect(screen.getByTestId("mock-thread")).toBeDefined();
    expect(screen.getByTestId("mock-stream-provider")).toBeDefined();
    expect(screen.getByTestId("mock-thread-provider")).toBeDefined();
    expect(screen.getByTestId("mock-toaster")).toBeDefined();
  });

  it("should pass rfpId from URL to StreamProvider", () => {
    // Act
    render(<ChatPage />);

    // Assert
    const streamProvider = screen.getByTestId("mock-stream-provider");
    expect(streamProvider.getAttribute("data-rfpid")).toBe("test-rfp-123");
  });
});
