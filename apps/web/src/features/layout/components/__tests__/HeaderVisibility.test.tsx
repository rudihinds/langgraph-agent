import { render, screen } from "@testing-library/react";
import { DashboardLayoutProvider } from "../DashboardLayoutContext";
import HeaderWrapper from "../HeaderWrapper";
import { useSession } from "@/hooks/useSession";
import { usePathname } from "next/navigation";

// Mock the necessary hooks
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

// Mock the ThemeProvider to simplify testing
vi.mock("@/providers/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the SessionProvider and useSession
vi.mock("@/hooks/useSession", () => ({
  useSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("Header Visibility", () => {
  beforeEach(() => {
    // Set up default mocks
    (useSession as any).mockReturnValue({
      user: { email: "test@example.com" },
      isLoading: false,
    });
  });

  it("hides the main header on dashboard routes", () => {
    // Use the isolated components rather than the full RootLayout
    (usePathname as any).mockReturnValue("/dashboard");

    render(
      <DashboardLayoutProvider>
        <>
          <HeaderWrapper />
          <div data-testid="content">Content</div>
        </>
      </DashboardLayoutProvider>
    );

    // Header should not be rendered
    expect(screen.queryByText("Proposal Agent")).not.toBeInTheDocument();
  });

  it("shows the main header on non-dashboard routes", () => {
    // Mock a non-dashboard route
    (usePathname as any).mockReturnValue("/");

    render(
      <DashboardLayoutProvider>
        <>
          <HeaderWrapper />
          <div data-testid="content">Content</div>
        </>
      </DashboardLayoutProvider>
    );

    // Header should be rendered (we"ll at least expect the container to be there)
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });
});
