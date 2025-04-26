import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Thread } from "../../../components/chat-ui/thread/index.js";
import { Message } from "../../../components/chat-ui/lib/types.js";

// Mock the providers that Thread component might depend on
const mockStreamContext: {
  messages: Message[];
  sendMessage: any;
  isLoading: boolean;
  threadId: string;
  error: null;
  interruptGeneration: any;
} = {
  messages: [],
  sendMessage: vi.fn(),
  isLoading: false,
  threadId: "123",
  error: null,
  interruptGeneration: vi.fn(),
};

// Mock component providers
vi.mock("../../../components/chat-ui/providers/Stream.js", () => ({
  useStream: () => mockStreamContext,
}));

vi.mock("../../../components/chat-ui/providers/Thread.js", () => ({
  useThread: () => ({
    threads: [],
    selectedThread: null,
    setSelectedThread: vi.fn(),
  }),
}));

describe("Thread Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock data if needed
    mockStreamContext.messages = [];
    mockStreamContext.isLoading = false;
    mockStreamContext.error = null;
  });

  it("should render the message input area", () => {
    // Arrange - Set up any necessary props or state

    // Act - Render the component
    const { container } = render(<Thread />);

    // Assert - Check that the message input is rendered
    const messageInput = screen.getByPlaceholderText(/type a message/i);
    expect(messageInput).toBeDefined();
    expect(messageInput).not.toBeNull();

    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDefined();
    expect(sendButton).not.toBeNull();
  });

  it("should display messages from the stream context", () => {
    // Arrange - Set up messages in the stream context
    mockStreamContext.messages = [
      {
        id: "1",
        role: "human",
        content: "Hello, this is a test message",
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        role: "assistant",
        content: "I am responding to your test message",
        createdAt: new Date().toISOString(),
      },
    ];

    // Act - Render the component
    render(<Thread />);

    // Assert - Check that messages are displayed
    const humanMessage = screen.getByText("Hello, this is a test message");
    expect(humanMessage).toBeDefined();
    expect(humanMessage).not.toBeNull();

    const aiMessage = screen.getByText("I am responding to your test message");
    expect(aiMessage).toBeDefined();
    expect(aiMessage).not.toBeNull();
  });

  it("should show loading state during message generation", () => {
    // Arrange - Set up loading state
    mockStreamContext.isLoading = true;

    // Act - Render the component
    render(<Thread />);

    // Assert - Check for loading indicator
    const loadingIndicator = screen.getByTestId("loading-indicator");
    expect(loadingIndicator).toBeDefined();
    expect(loadingIndicator).not.toBeNull();

    // Check for disabled input during loading
    const messageInput = screen.getByPlaceholderText(/type a message/i);
    // Checking the disabled attribute using standard DOM
    expect(messageInput.hasAttribute("disabled")).toBe(true);
  });
});
