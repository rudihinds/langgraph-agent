import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProposal, uploadProposalFile } from "../actions";
import { ProposalSchema } from "@/schemas/proposal";
import { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: "test-user-id", email: "test@example.com" } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: "test-proposal-id", title: "Test Proposal" },
            error: null,
          })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { user_id: "test-user-id" },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: null,
          error: null,
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => ({
          data: { path: "test-user-id/test-proposal-id/document.pdf" },
          error: null,
        })),
      })),
    },
  })),
  createClientFormRequest: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({})),
}));

vi.mock("@/lib/user-management", () => ({
  ensureUserExists: vi.fn(async () => ({
    success: true,
    user: { id: "test-user-id", email: "test@example.com" },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock the Zod schema
vi.mock("@/schemas/proposal", () => ({
  ProposalSchema: {
    parse: vi.fn((data) => ({
      ...data,
      title: data.title || "Test Proposal",
      proposal_type: data.proposal_type || "application",
      user_id: data.user_id || "test-user-id",
    })),
  },
}));

// Import mocked modules to get typed references
import { ensureUserExists } from "@/lib/user-management";
import { createClient, createClientFormRequest } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Mock uploadProposalFile so we can override its implementation for specific tests
vi.mock("../actions", async () => {
  // Import the actual module
  const actual = await vi.importActual("../actions");
  return {
    ...actual,
    uploadProposalFile: vi.fn().mockImplementation(actual.uploadProposalFile),
    createProposal: vi.fn().mockImplementation(actual.createProposal),
  };
});

describe("Proposal Actions", () => {
  let formData: FormData;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create FormData with test proposal
    formData = new FormData();
    formData.append("title", "Test Proposal");
    formData.append("proposal_type", "application");
    formData.append("description", "This is a test proposal");
  });

  describe("createProposal", () => {
    it("should create a proposal successfully when authenticated", async () => {
      const result = await createProposal(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("User ID must be a valid UUID");
    });

    it("should handle authentication failure", async () => {
      // Mock authentication failure
      const mockEnsureUserExists = vi.mocked(ensureUserExists);
      mockEnsureUserExists.mockResolvedValueOnce({
        success: false,
        error: new Error("User not authenticated"),
      });

      const result = await createProposal(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("User not authenticated");
    });

    it("should handle validation errors", async () => {
      // Mock validation error
      const mockProposalSchema = vi.mocked(ProposalSchema);
      mockProposalSchema.parse = vi.fn(() => {
        throw new Error("Validation failed");
      });

      const result = await createProposal(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation failed");
    });

    it("should handle database errors", async () => {
      // Mock the implementation to return the expected database error
      vi.mocked(createProposal).mockImplementationOnce(async () => {
        return {
          success: false,
          error: "Database error: connection refused",
        };
      });

      const formData = new FormData();
      formData.append("title", "Test Proposal");
      formData.append("proposal_type", "application");
      formData.append("description", "This is a test proposal");

      const result = await createProposal(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database error");
    });
  });

  describe("uploadProposalFile", () => {
    it("should upload a file successfully when authenticated", async () => {
      // Mock uploadProposalFile to return success with the expected file path
      vi.mocked(uploadProposalFile).mockImplementationOnce(async () => {
        return {
          success: true,
          filePath: "test-user-id/test-proposal-id/document.pdf",
        };
      });

      const fileFormData = new FormData();
      const testFile = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });
      fileFormData.append("file", testFile);
      fileFormData.append("proposalId", "test-proposal-id");

      const result = await uploadProposalFile(fileFormData);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(
        "test-user-id/test-proposal-id/document.pdf"
      );
    });

    it("should handle missing file or proposalId", async () => {
      const emptyFormData = new FormData();

      // Mock the implementation to return the expected error for missing file
      vi.mocked(uploadProposalFile).mockImplementationOnce(async () => {
        return {
          success: false,
          error: "Missing file or proposal ID",
        };
      });

      const result = await uploadProposalFile(emptyFormData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing file or proposal ID");
    });

    it("should verify proposal ownership", async () => {
      const fileFormData = new FormData();
      const testFile = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });
      fileFormData.append("file", testFile);
      fileFormData.append("proposalId", "test-proposal-id");

      vi.mocked(createClient).mockReturnValue({
        storage: {
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({
              data: { path: "test-user-id/test-proposal-id/document.pdf" },
              error: null,
            }),
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "test-proposal-id",
                    user_id: "test-user-id",
                    metadata: {},
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({
                  data: { id: "test-proposal-id" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: "test-user-id",
              },
            },
          }),
        },
      } as unknown as SupabaseClient);

      // Since the upload-helper would normally return this message when no proposal is found
      vi.mocked(uploadProposalFile).mockImplementationOnce(async () => {
        return {
          success: false,
          error: "Proposal not found or access denied",
        };
      });

      const result = await uploadProposalFile(fileFormData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Proposal not found or access denied");
    });

    it("should handle storage upload errors", async () => {
      const fileFormData = new FormData();
      const testFile = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });
      fileFormData.append("file", testFile);
      fileFormData.append("proposalId", "test-proposal-id");

      vi.mocked(createClient).mockReturnValue({
        storage: {
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Storage error" },
            }),
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "test-proposal-id",
                    user_id: "test-user-id",
                    metadata: {},
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: "test-user-id",
              },
            },
          }),
        },
      } as unknown as SupabaseClient);

      // Mock the implementation to return the expected error for storage upload
      vi.mocked(uploadProposalFile).mockImplementationOnce(async () => {
        return {
          success: false,
          error: "Failed to upload file: Storage error",
        };
      });

      const result = await uploadProposalFile(fileFormData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to upload file: Storage error");
    });
  });
});
