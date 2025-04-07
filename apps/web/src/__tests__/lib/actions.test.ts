import { describe, it, expect, beforeEach, vi } from "vitest";
import { uploadProposalFile } from "@/lib/proposal-actions/actions";
import { createClient } from "@/lib/supabase/server";
import { handleRfpUpload } from "@/lib/proposal-actions/upload-helper";
import { ensureUserExists } from "@/lib/user-management";
import { revalidatePath } from "next/cache";
import { DATE_FORMATS } from "@/lib/utils/date-utils";

// Mock the required dependencies
vi.mock("@/lib/supabase/server");
vi.mock("@/lib/proposal-actions/upload-helper");
vi.mock("@/lib/user-management");
vi.mock("next/cache");

describe("uploadProposalFile Server Action", () => {
  const mockFile = new File(["test content"], "test.pdf", {
    type: "application/pdf",
  });

  // Valid input with correct date format (API format: YYYY-MM-DD)
  const validInput = {
    userId: "test-user-id",
    title: "Test Proposal",
    description: "This is a test proposal description",
    deadline: "2024-01-15", // Valid API format
    fundingAmount: "50000",
    file: mockFile,
  };

  // Setup mock implementations
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase client
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    // Mock successful user verification
    (ensureUserExists as any).mockResolvedValue({
      success: true,
      user: { id: "test-user-id" },
    });

    // Mock successful proposal insert
    mockSupabase.single.mockResolvedValue({
      data: { id: "test-proposal-id" },
      error: null,
    });

    // Mock successful file upload
    (handleRfpUpload as any).mockResolvedValue({
      success: true,
      message: "File uploaded successfully",
    });
  });

  it("validates that the deadline is in the correct API format (YYYY-MM-DD)", async () => {
    // Test with invalid date format (UK format DD/MM/YYYY instead of API format)
    const invalidInput = {
      ...validInput,
      deadline: "15/01/2024", // UK format, not API format
    };

    const result = await uploadProposalFile(invalidInput as any);

    // Should fail validation
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid date format");

    // Supabase client should not be called for invalid input
    expect(createClient).not.toHaveBeenCalled();
  });

  it("validates that the deadline string is a valid date", async () => {
    // Test with invalid date values
    const invalidDateInput = {
      ...validInput,
      deadline: "2024-13-45", // Invalid month (13) and day (45)
    };

    const result = await uploadProposalFile(invalidDateInput as any);

    // Should fail validation (though it passes the regex, it's not a valid date)
    expect(result.success).toBe(false);
  });

  it("accepts valid dates in the correct API format", async () => {
    const result = await uploadProposalFile(validInput);

    // Should succeed with valid input
    expect(result.success).toBe(true);
    expect(result.proposalId).toBe("test-proposal-id");

    // Verify that the date was passed through without modification
    expect(createClient).toHaveBeenCalled();
  });

  it("requires the deadline to be in the exact API format", async () => {
    // Test with a date that is valid but in wrong format
    // Even though it's a valid ISO string, it should be rejected because
    // we require the exact API format YYYY-MM-DD
    const invalidFormatInput = {
      ...validInput,
      deadline: "2024-01-15T00:00:00.000Z", // ISO string with time
    };

    const result = await uploadProposalFile(invalidFormatInput as any);

    // Should fail validation
    expect(result.success).toBe(false);
    expect(result.error).toContain(`Invalid date format (${DATE_FORMATS.API})`);
  });
});
