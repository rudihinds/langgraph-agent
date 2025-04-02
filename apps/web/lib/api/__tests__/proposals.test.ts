import { getProposals, calculateProgress } from "../proposals";
import { createServerClient } from "@supabase/ssr";

// Mock the dependencies
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: jest.fn((name) => ({ value: "mocked-cookie-value" })),
  })),
}));

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(),
}));

jest.mock("@/lib/checkpoint/PostgresCheckpointer", () => ({
  PostgresCheckpointer: jest.fn().mockImplementation(() => ({
    getCheckpoint: jest.fn(),
  })),
}));

describe("proposals API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getProposals", () => {
    it("returns empty array when no user session is found", async () => {
      // Mock Supabase client
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
          }),
        },
      });

      const result = await getProposals();

      expect(result).toEqual([]);
    });

    it("returns proposals from database when user is authenticated", async () => {
      // Sample checkpoint data
      const mockCheckpoints = [
        {
          proposal_id: "proposal-1",
          namespace: "test-namespace-1",
          state: {
            metadata: {
              proposalTitle: "Test Proposal 1",
              organization: "Org 1",
              status: "in_progress",
            },
            currentPhase: "research",
            sectionStatus: {
              intro: "completed",
              background: "in_progress",
              methodology: "not_started",
            },
          },
          created_at: "2023-07-01T00:00:00Z",
          updated_at: "2023-07-02T00:00:00Z",
        },
        {
          proposal_id: "proposal-2",
          namespace: "test-namespace-2",
          state: {
            metadata: {
              proposalTitle: "Test Proposal 2",
              organization: "Org 2",
              status: "completed",
            },
            currentPhase: "review",
            sectionStatus: {
              intro: "completed",
              background: "completed",
              methodology: "completed",
            },
          },
          created_at: "2023-07-03T00:00:00Z",
          updated_at: "2023-07-04T00:00:00Z",
        },
      ];

      // Mock Supabase client
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: "user-123", email: "test@example.com" },
              },
            },
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({
            data: mockCheckpoints,
            error: null,
          }),
        }),
      };

      (createServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await getProposals();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("proposal-1");
      expect(result[0].title).toBe("Test Proposal 1");
      expect(result[0].progress).toBe(50); // Based on sectionStatus calculation

      expect(result[1].id).toBe("proposal-2");
      expect(result[1].title).toBe("Test Proposal 2");
      expect(result[1].progress).toBe(100); // Based on sectionStatus calculation
    });

    it("handles database errors gracefully", async () => {
      // Mock Supabase client with error
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: "user-123", email: "test@example.com" },
              },
            },
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({
            data: null,
            error: new Error("Database error"),
          }),
        }),
      };

      (createServerClient as jest.Mock).mockReturnValue(mockSupabase);

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await getProposals();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result).toEqual([]);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("calculateProgress", () => {
    it("returns 0 when sectionStatus is empty", () => {
      const result = calculateProgress({});
      expect(result).toBe(0);
    });

    it("calculates progress correctly for mixed statuses", () => {
      const sectionStatus = {
        section1: "completed",
        section2: "in_progress",
        section3: "not_started",
      };

      // Completed: 1, In Progress: 1, Not Started: 1
      // (1 + 0.5*1) / 3 = 0.5 = 50%
      const result = calculateProgress(sectionStatus);
      expect(result).toBe(50);
    });

    it("returns 100 when all sections are completed", () => {
      const sectionStatus = {
        section1: "completed",
        section2: "completed",
        section3: "completed",
      };

      const result = calculateProgress(sectionStatus);
      expect(result).toBe(100);
    });

    it("returns 0 when all sections are not started", () => {
      const sectionStatus = {
        section1: "not_started",
        section2: "not_started",
        section3: "not_started",
      };

      const result = calculateProgress(sectionStatus);
      expect(result).toBe(0);
    });
  });
});
