import { render, screen } from "@testing-library/react";
import EmptyDashboard from "../EmptyDashboard";

// Mock the next/link component
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe("EmptyDashboard", () => {
  it("renders the empty state card with correct content", () => {
    render(<EmptyDashboard />);

    // Check for headings
    expect(screen.getByText("No Proposals Yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Create your first proposal to get started/i)
    ).toBeInTheDocument();

    // Check for benefits list
    expect(
      screen.getByText(/AI-assisted research and writing/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Generate persuasive content/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Export ready-to-submit proposals/i)
    ).toBeInTheDocument();

    // Check for CTA button
    const ctaButton = screen.getByRole("button", {
      name: /Create Your First Proposal/i,
    });
    expect(ctaButton).toBeInTheDocument();
  });

  it("links to the new proposal page", () => {
    render(<EmptyDashboard />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/proposals/new");
  });
});
