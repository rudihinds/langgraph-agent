"use client";

import { render, screen, fireEvent } from "@testing-library/react";
import { ModeToggle } from "../mode-toggle";
import { useTheme } from "next-themes";

// Mock next-themes
jest.mock("next-themes", () => ({
  useTheme: jest.fn(),
}));

describe("ModeToggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the mode toggle button with sun and moon icons", () => {
    const mockSetTheme = jest.fn();
    (useTheme as jest.Mock).mockReturnValue({ setTheme: mockSetTheme });

    render(<ModeToggle />);

    // Check for button with icons
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();

    // Both icons should be present
    expect(button.innerHTML).toContain("Sun");
    expect(button.innerHTML).toContain("Moon");
  });

  it("opens dropdown menu when clicked", () => {
    const mockSetTheme = jest.fn();
    (useTheme as jest.Mock).mockReturnValue({ setTheme: mockSetTheme });

    render(<ModeToggle />);

    // Click the button
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Check dropdown options are displayed
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("changes theme to light when Light option is clicked", () => {
    const mockSetTheme = jest.fn();
    (useTheme as jest.Mock).mockReturnValue({ setTheme: mockSetTheme });

    render(<ModeToggle />);

    // Open dropdown
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Click Light option
    const lightOption = screen.getByText("Light");
    fireEvent.click(lightOption);

    // Verify setTheme was called with 'light'
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("changes theme to dark when Dark option is clicked", () => {
    const mockSetTheme = jest.fn();
    (useTheme as jest.Mock).mockReturnValue({ setTheme: mockSetTheme });

    render(<ModeToggle />);

    // Open dropdown
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Click Dark option
    const darkOption = screen.getByText("Dark");
    fireEvent.click(darkOption);

    // Verify setTheme was called with 'dark'
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("changes theme to system when System option is clicked", () => {
    const mockSetTheme = jest.fn();
    (useTheme as jest.Mock).mockReturnValue({ setTheme: mockSetTheme });

    render(<ModeToggle />);

    // Open dropdown
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Click System option
    const systemOption = screen.getByText("System");
    fireEvent.click(systemOption);

    // Verify setTheme was called with 'system'
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });
});
