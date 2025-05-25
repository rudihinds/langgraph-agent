import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import HeaderWrapper from "../HeaderWrapper";
import { User } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("@/hooks/useSession", () => ({
  useSession: vi.fn(),
}));

vi.mock("../Header", () => ({
  __esModule: true,
  default: vi.fn(({ user }) => (
    <div data-testid="header-component">
      {user ? `Authenticated: ${user.email}` : "Not authenticated"}
    </div>
  )),
}));

import { useSession } from "@/hooks/useSession";

describe("HeaderWrapper", () => {
  const mockUser: User = {
    id: "user-123",
    email: "test@example.com",
    user_metadata: {},
    app_metadata: {},
    aud: "authenticated",
    created_at: "",
  };

  it("renders Header with user when authenticated", () => {
    (useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockUser,
      isLoading: false,
    });

    render(<HeaderWrapper />);

    expect(screen.getByTestId("header-component")).toHaveTextContent(
      `Authenticated: ${mockUser.email}`
    );
  });

  it("renders Header with null user when not authenticated", () => {
    (useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isLoading: false,
    });

    render(<HeaderWrapper />);

    expect(screen.getByTestId("header-component")).toHaveTextContent(
      "Not authenticated"
    );
  });

  it("renders Header with null user during loading state", () => {
    (useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isLoading: true,
    });

    render(<HeaderWrapper />);

    expect(screen.getByTestId("header-component")).toHaveTextContent(
      "Not authenticated"
    );
  });
});
