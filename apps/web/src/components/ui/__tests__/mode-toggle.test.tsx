"use client";

import { render, screen, fireEvent } from "@testing-library/react";
import { ModeToggle } from "../mode-toggle";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Create a mock module for next-themes
const mockSetTheme = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "system",
    setTheme: mockSetTheme,
  }),
}));

// Mock the Dropdown components since they use portals which may not work in tests
vi.mock("@/components/ui/dropdown-menu", () => {
  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dropdown-menu">{children}</div>
    ),
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dropdown-trigger">{children}</div>
    ),
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dropdown-content">{children}</div>
    ),
    DropdownMenuItem: ({
      onClick,
      children,
    }: {
      onClick?: () => void;
      children: React.ReactNode;
    }) => (
      <button
        data-testid={`menu-item-${String(children).toLowerCase()}`}
        onClick={onClick}
      >
        {children}
      </button>
    ),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ModeToggle", () => {
  it("renders the mode toggle button with sun and moon icons", () => {
    render(<ModeToggle />);

    const button = screen
      .getByTestId("dropdown-trigger")
      .querySelector("button");
    expect(button).toBeInTheDocument();

    // Check for SVG icons using their classes
    expect(button?.innerHTML).toContain("lucide-sun");
    expect(button?.innerHTML).toContain("lucide-moon");
  });

  it("opens dropdown menu when clicked", () => {
    render(<ModeToggle />);

    // Verify dropdown content and items are rendered
    expect(screen.getByTestId("dropdown-content")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-light")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-dark")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-system")).toBeInTheDocument();
  });

  it("changes theme to light when Light option is clicked", () => {
    render(<ModeToggle />);

    // Click Light option
    fireEvent.click(screen.getByTestId("menu-item-light"));

    // Check if setTheme was called with "light"
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("changes theme to dark when Dark option is clicked", () => {
    render(<ModeToggle />);

    // Click Dark option
    fireEvent.click(screen.getByTestId("menu-item-dark"));

    // Check if setTheme was called with "dark"
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("changes theme to system when System option is clicked", () => {
    render(<ModeToggle />);

    // Click System option
    fireEvent.click(screen.getByTestId("menu-item-system"));

    // Check if setTheme was called with "system"
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });
});
