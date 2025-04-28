import { render, screen } from "@testing-library/react";
import { HomeIcon } from "lucide-react";
import { NavItem } from "../DashboardLayout";

describe("NavItem", () => {
  it("renders correctly with label and icon", () => {
    render(
      <NavItem
        href="/test"
        icon={<HomeIcon data-testid="nav-icon" />}
        label="Test Item"
        isActive={false}
      />
    );

    expect(screen.getByText("Test Item")).toBeInTheDocument();
    expect(screen.getByTestId("nav-icon")).toBeInTheDocument();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/test");
  });

  it("applies active styles when active", () => {
    render(
      <NavItem
        href="/test"
        icon={<HomeIcon />}
        label="Test Item"
        isActive={true}
      />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveClass("bg-primary/10");
    expect(link).toHaveClass("text-primary");
  });

  it("applies inactive styles when not active", () => {
    render(
      <NavItem
        href="/test"
        icon={<HomeIcon />}
        label="Test Item"
        isActive={false}
      />
    );

    const link = screen.getByRole("link");
    expect(link).not.toHaveClass("bg-primary/10");
    expect(link).not.toHaveClass("text-primary");
    expect(link).toHaveClass("text-foreground");
  });

  it("hides label text when collapsed", () => {
    render(
      <NavItem
        href="/test"
        icon={<HomeIcon />}
        label="Test Item"
        isActive={false}
        isCollapsed={true}
      />
    );

    // Label should still be in the DOM but visually hidden
    const labelElement = screen.getByText("Test Item");
    expect(labelElement).toBeInTheDocument();
    expect(labelElement).toHaveClass("sr-only");
  });

  it("shows label text when not collapsed", () => {
    render(
      <NavItem
        href="/test"
        icon={<HomeIcon />}
        label="Test Item"
        isActive={false}
        isCollapsed={false}
      />
    );

    // Label should be visible
    const labelElement = screen.getByText("Test Item");
    expect(labelElement).toBeInTheDocument();
    expect(labelElement).not.toHaveClass("sr-only");
  });
});
