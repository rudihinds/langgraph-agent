import { render, screen } from "@testing-library/react";
import EmptyDashboard from "../EmptyDashboard";
import { vi, describe, it, expect } from "vitest";

// Mock the next/link component
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => {
    return <a href={href}>{children}</a>;
  },
}));

describe("EmptyDashboard", () => {
  it("renders the empty dashboard message", () => {
    render(<EmptyDashboard />);

    expect(screen.getByText("No Proposals Yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Create your first proposal to get started/i)
    ).toBeInTheDocument();
  });

  it("renders a create new proposal button", () => {
    render(<EmptyDashboard />);

    const createButton = screen.getByRole("link", {
      name: /Create Your First Proposal/i,
    });
    expect(createButton).toBeInTheDocument();
    expect(createButton).toHaveAttribute("href", "/proposals/new");
  });
});
