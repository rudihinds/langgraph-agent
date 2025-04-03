"use client";

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import LoginPage from "../page";
import { signIn } from "@/lib/supabase";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the next/navigation hooks
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock the signIn function
vi.mock("@/lib/supabase", () => ({
  signIn: vi.fn(),
}));

describe("LoginPage", () => {
  // Set up common mocks before each test
  beforeEach(() => {
    // Mock router
    const mockRouter = {
      push: vi.fn(),
      replace: vi.fn(),
    };
    (useRouter as any).mockReturnValue(mockRouter);

    // Mock search params
    const mockSearchParams = {
      get: vi.fn(),
    };
    (useSearchParams as any).mockReturnValue(mockSearchParams);

    // Reset the mock signIn function
    (signIn as any).mockReset();
  });

  it("renders login page with title and sign-in button", () => {
    render(<LoginPage />);

    // Check if the header is present
    expect(screen.getByText("Login")).toBeInTheDocument();

    // Check if the subtitle is present
    expect(
      screen.getByText("Sign in to access your dashboard")
    ).toBeInTheDocument();

    // Check if the sign-in button is present
    expect(
      screen.getByRole("button", { name: "Sign in with Google" })
    ).toBeInTheDocument();

    // Check if the "don't have an account" text is present
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();

    // Check for the "Back to Home" link
    expect(screen.getByText("Back to Home")).toBeInTheDocument();
  });

  it("handles sign-in button click and shows loading state", async () => {
    // Mock the signIn function to return a promise
    (signIn as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<LoginPage />);

    // Get the sign-in button
    const signInButton = screen.getByRole("button", {
      name: "Sign in with Google",
    });

    // Click the button
    fireEvent.click(signInButton);

    // Check if the button is disabled during loading
    expect(signInButton).toBeDisabled();

    // Check if the button text changed to loading message
    expect(screen.getByText("Signing in...")).toBeInTheDocument();

    // Verify that signIn was called
    expect(signIn).toHaveBeenCalledTimes(1);

    // Wait for promise to resolve
    await waitFor(() => {
      // Loading should be complete
      expect(
        screen.getByRole("button", { name: "Sign in with Google" })
      ).not.toBeDisabled();
    });
  });

  it("shows error message when sign-in fails", async () => {
    // Mock signIn to throw an error
    (signIn as any).mockRejectedValue(new Error("Failed to authenticate"));

    render(<LoginPage />);

    // Click the sign-in button
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with Google" })
    );

    // Wait for the error to appear
    await waitFor(() => {
      // Should show error alert
      expect(screen.getByText("Authentication Error")).toBeInTheDocument();
      // Should show error message
      expect(screen.getByText("Failed to authenticate")).toBeInTheDocument();
    });
  });

  it("displays error message from URL query parameter", () => {
    // Mock search params to return an error
    (useSearchParams as any).mockReturnValue({
      get: (param: string) => {
        if (param === "error") return "auth_error";
        return null;
      },
    });

    render(<LoginPage />);

    // Should show error alert
    expect(screen.getByText("Authentication Error")).toBeInTheDocument();

    // Should show the mapped error message from ERROR_MESSAGES
    expect(
      screen.getByText("Authentication failed. Please try again.")
    ).toBeInTheDocument();
  });

  it("displays recovery mode message when recovery=true in URL", () => {
    // Mock search params to indicate recovery mode
    (useSearchParams as any).mockReturnValue({
      get: (param: string) => {
        if (param === "recovery") return "true";
        return null;
      },
    });

    render(<LoginPage />);

    // Should show recovery mode alert
    expect(screen.getByText("Recovery mode")).toBeInTheDocument();

    // Use getAllByText to handle multiple elements with the same text
    const recoveryMessages = screen.getAllByText(
      "Previous session data was cleared due to sync issues. Please sign in again."
    );
    expect(recoveryMessages.length).toBeGreaterThan(0);
  });

  it("displays redirect information when redirect parameter is present", () => {
    // Mock search params to include a redirect path
    (useSearchParams as any).mockReturnValue({
      get: (param: string) => {
        if (param === "redirect") return "/dashboard";
        return null;
      },
    });

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", { value: localStorageMock });

    render(<LoginPage />);

    // Should display redirect information
    expect(
      screen.getByText(/you'll be redirected back to/i)
    ).toBeInTheDocument();
    expect(screen.getByText("/dashboard")).toBeInTheDocument();

    // Should store redirect path in localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "redirectAfterLogin",
      "/dashboard"
    );
  });
});
