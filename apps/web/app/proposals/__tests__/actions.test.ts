import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js"; // Import type for mocking

// Import the helper function
import { handleRfpUpload } from "../../../lib/proposal-actions/upload-helper";

describe("handleRfpUpload Internal Logic", () => {
  // Test Inputs
  const mockProposalId = "prop-test-123";
  const mockUserId = "user-test-abc";
  const mockFileName = "test-rfp.docx";
  const mockFilePath = `${mockProposalId}/${mockFileName}`;
  const mockFileSize = 9876;
  const mockFileType =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const mockFile = new File(["word doc content"], mockFileName, {
    type: mockFileType,
  });
  Object.defineProperty(mockFile, "size", {
    value: mockFileSize,
    writable: false,
  });

  // Declare mock client variable and individual mocks
  let mockSupabaseClient: SupabaseClient;
  let mockStorageUpload: ReturnType<typeof vi.fn>;
  let mockStorageFrom: ReturnType<typeof vi.fn>;
  let mockDbFrom: ReturnType<typeof vi.fn>;
  let mockSelect: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockSelectEqId: ReturnType<typeof vi.fn>;
  let mockSelectEqUserId: ReturnType<typeof vi.fn>;
  let mockUpdateEqId: ReturnType<typeof vi.fn>;
  let mockUpdateEqUserId: ReturnType<typeof vi.fn>;
  let mockMaybeSingle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Define mocks fresh for each test
    mockStorageUpload = vi.fn();
    mockStorageFrom = vi.fn(() => ({ upload: mockStorageUpload }));

    // Mocks for DB chaining
    mockMaybeSingle = vi.fn();
    mockSelectEqUserId = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
    mockSelectEqId = vi.fn(() => ({ eq: mockSelectEqUserId })); // First eq returns object with second eq
    mockSelect = vi.fn(() => ({ eq: mockSelectEqId })); // Select returns object with first eq

    mockUpdateEqUserId = vi.fn(); // Second eq for update resolves the promise
    mockUpdateEqId = vi.fn(() => ({ eq: mockUpdateEqUserId })); // First eq returns object with second eq
    mockUpdate = vi.fn(() => ({ eq: mockUpdateEqId })); // Update returns object with first eq

    mockDbFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate }));

    // Create the mock Supabase client with fresh mocks
    mockSupabaseClient = {
      storage: { from: mockStorageFrom },
      from: mockDbFrom,
    } as unknown as SupabaseClient;

    // Apply default successful mock implementations
    mockStorageUpload.mockResolvedValue({
      data: { path: mockFilePath },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({ data: { metadata: {} }, error: null });
    mockUpdateEqUserId.mockResolvedValue({ error: null }); // Mock the final step of update chain
  });

  // Test focuses on the helper function now
  it("should upload file, fetch, merge, and update metadata (happy path)", async () => {
    const result = await handleRfpUpload(
      mockSupabaseClient,
      mockUserId,
      mockProposalId,
      mockFile
    );

    // 1. Check Storage Upload
    expect(mockStorageFrom).toHaveBeenCalledWith("proposal-documents");
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(mockStorageUpload).toHaveBeenCalledWith(mockFilePath, mockFile, {
      upsert: true,
    });

    // 2. Check Metadata Fetch chain
    expect(mockDbFrom).toHaveBeenCalledWith("proposals");
    expect(mockSelect).toHaveBeenCalledWith("metadata");
    expect(mockSelectEqId).toHaveBeenCalledWith("id", mockProposalId);
    expect(mockSelectEqUserId).toHaveBeenCalledWith("user_id", mockUserId);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);

    // 3. Check Metadata Update chain
    const expectedMetadata = {
      rfp_document: {
        name: mockFileName,
        path: mockFilePath,
        size: mockFileSize,
        type: mockFileType,
      },
    };
    expect(mockUpdate).toHaveBeenCalledWith({ metadata: expectedMetadata });
    expect(mockUpdateEqId).toHaveBeenCalledWith("id", mockProposalId);
    expect(mockUpdateEqUserId).toHaveBeenCalledWith("user_id", mockUserId);

    // 4. Check Result
    expect(result).toEqual({
      success: true,
      message: "File uploaded and metadata updated successfully.",
    });
  });

  it("should return error if storage upload fails", async () => {
    const storageError = {
      name: "StorageError",
      message: "Fake Storage Error",
    };
    mockStorageUpload.mockResolvedValue({
      data: null,
      error: storageError as any,
    });

    const result = await handleRfpUpload(
      mockSupabaseClient,
      mockUserId,
      mockProposalId,
      mockFile
    );

    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    // DB calls should not happen
    expect(mockDbFrom).not.toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      message: expect.stringContaining(
        "Failed to upload file: Fake Storage Error"
      ),
    });
  });

  it("should return error if metadata fetch fails", async () => {
    const fetchError = { message: "Fake DB Read Error" };
    // Mock failure at the maybeSingle step
    mockMaybeSingle.mockResolvedValue({ data: null, error: fetchError as any });

    const result = await handleRfpUpload(
      mockSupabaseClient,
      mockUserId,
      mockProposalId,
      mockFile
    );

    // Check calls up to the failure point
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(mockDbFrom).toHaveBeenCalledTimes(1);
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockSelectEqId).toHaveBeenCalledTimes(1);
    expect(mockSelectEqUserId).toHaveBeenCalledTimes(1);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    // Update should not happen
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      message: expect.stringContaining(
        "Failed to retrieve proposal metadata: Fake DB Read Error"
      ),
    });
  });

  it("should return error if proposal not found or wrong user", async () => {
    // Mock maybeSingle returning no data
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await handleRfpUpload(
      mockSupabaseClient,
      mockUserId,
      mockProposalId,
      mockFile
    );

    // Check calls up to the point of check
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(mockDbFrom).toHaveBeenCalledTimes(1);
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockSelectEqId).toHaveBeenCalledTimes(1);
    expect(mockSelectEqUserId).toHaveBeenCalledTimes(1);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    // Update should not happen
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      message: "Proposal not found or access denied.",
    });
  });

  it("should return error if metadata update fails", async () => {
    const updateError = { message: "Fake DB Update Error" };
    // Mock the final step of the update chain (second eq) to fail
    mockUpdateEqUserId.mockResolvedValue({ error: updateError as any });

    const result = await handleRfpUpload(
      mockSupabaseClient,
      mockUserId,
      mockProposalId,
      mockFile
    );

    // Check calls up to the failure point
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(mockDbFrom).toHaveBeenCalledTimes(2); // Called for select and update
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateEqId).toHaveBeenCalledTimes(1);
    expect(mockUpdateEqUserId).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: false,
      message: expect.stringContaining(
        "Failed to update proposal metadata: Fake DB Update Error"
      ),
    });
  });

  it("should correctly merge with existing metadata", async () => {
    const existingMetadata = { other_key: "value123", nested: { arr: [1] } };
    // Mock maybeSingle returning existing data
    mockMaybeSingle.mockResolvedValue({
      data: { metadata: existingMetadata },
      error: null,
    });

    const result = await handleRfpUpload(
      mockSupabaseClient,
      mockUserId,
      mockProposalId,
      mockFile
    );

    const expectedMergedMetadata = {
      ...existingMetadata,
      rfp_document: {
        name: mockFileName,
        path: mockFilePath,
        size: mockFileSize,
        type: mockFileType,
      },
    };

    // Check chain calls
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(mockDbFrom).toHaveBeenCalledTimes(2); // select + update
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      metadata: expectedMergedMetadata,
    });
    expect(mockUpdateEqId).toHaveBeenCalledWith("id", mockProposalId);
    expect(mockUpdateEqUserId).toHaveBeenCalledWith("user_id", mockUserId);
    expect(result).toEqual({
      success: true,
      message: "File uploaded and metadata updated successfully.",
    });
  });

  it("should overwrite existing rfp_document metadata when re-uploading", async () => {
    const oldRfpDocument = {
      name: "old_report.pdf",
      path: "prop-test-123/old_report.pdf",
      size: 1000,
      type: "application/pdf",
    };
    const existingMetadata = {
      other_key: "value123",
      rfp_document: oldRfpDocument, // Pre-existing RFP document info
    };
    // Mock maybeSingle returning existing data including old rfp_document
    mockMaybeSingle.mockResolvedValue({
      data: { metadata: existingMetadata },
      error: null,
    });

    // Use a different file for the new upload
    const newFileName = "new_submission.pdf";
    const newFilePath = `${mockProposalId}/${newFileName}`;
    const newFileSize = 5555;
    const newFileType = "application/pdf";
    const newFile = new File(["new pdf content"], newFileName, {
      type: newFileType,
    });
    Object.defineProperty(newFile, "size", {
      value: newFileSize,
      writable: false,
    });

    // Mock the storage upload for the *new* file path
    mockStorageUpload.mockResolvedValue({
      data: { path: newFilePath },
      error: null,
    });

    // Call the handler with the new file
    const result = await handleRfpUpload(
      mockSupabaseClient,
      mockUserId,
      mockProposalId,
      newFile
    );

    // 3. Check Metadata Update chain - Assert the new metadata overwrites old rfp_document
    const expectedMergedMetadata = {
      other_key: "value123", // Should be preserved
      rfp_document: {
        // Should be updated
        name: newFileName,
        path: newFilePath,
        size: newFileSize,
        type: newFileType,
      },
    };

    expect(mockUpdate).toHaveBeenCalledWith({
      metadata: expectedMergedMetadata,
    });
    expect(mockUpdateEqId).toHaveBeenCalledWith("id", mockProposalId);
    expect(mockUpdateEqUserId).toHaveBeenCalledWith("user_id", mockUserId);
    expect(result).toEqual({
      success: true,
      message: "File uploaded and metadata updated successfully.",
    });
  });

  // No longer need tests for FormData validation or Auth within the helper
  // Those are responsibility of the wrapper Action, which we aren't unit testing directly now
});

// Remove original describe block for the action wrapper if desired, or keep separate
// describe('uploadProposalFile Action Wrapper', () => {
//   // Add integration-style tests here if needed, mocking the helper
// });
