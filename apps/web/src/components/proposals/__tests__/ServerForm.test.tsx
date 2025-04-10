import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ServerForm from "../ServerForm"; // Correct default import
import { toast as sonnerToast } from "sonner";
import { useToast } from "@/components/ui/use-toast";
import { UploadResult } from "@/lib/proposal-actions/upload-helper";

// --- Mock Server Actions ---
// Define mocks *inside* the factory
vi.mock("@/app/api/proposals/actions", () => {
  const mockUploadProposalFile = vi.fn();
  const mockCreateProposal = vi.fn();
  return {
    uploadProposalFile: mockUploadProposalFile,
    createProposal: mockCreateProposal,
  };
});

// Need to re-import the mocked functions after vi.mock
import {
  uploadProposalFile as mockUploadProposalFile,
  createProposal as mockCreateProposal,
} from "@/app/api/proposals/actions";

// --- Mock Toasts ---
const mockUiToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockUiToast }),
}));

// Define sonner mock inside factory
vi.mock("sonner", () => {
  const mockSonnerPromise = vi.fn();
  return {
    toast: { promise: mockSonnerPromise },
  };
});

// Re-import the mocked sonner promise function
import { toast as sonnerToast } from "sonner";
const mockSonnerPromise = sonnerToast.promise as ReturnType<typeof vi.fn>;

// --- Mock Auth Hook ---
// We need a way to control the auth state for different tests
let mockAuthState = {
  user: { id: "test-user-123" },
  loading: false,
  error: null,
};
vi.mock("@/lib/client-auth", () => ({
  useRequireAuth: () => mockAuthState,
  signOut: vi.fn(),
}));

// --- Mock Router ---
const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockRouterPush })),
  redirect: vi.fn(), // Keep mock if ServerForm uses it elsewhere
}));

// --- Mock Verify User API ---
// Mock the global fetch used by the verify user useEffect
global.fetch = vi.fn();

describe("ServerForm Frontend Integration", () => {
  const testFile = new File(["test content"], "test-rfp.pdf", {
    type: "application/pdf",
  });
  const testProposalId = "new-prop-456";

  // Helper to render with default props
  const renderComponent = (
    props: Partial<React.ComponentProps<typeof ServerForm>> = {}
  ) => {
    const defaultProps: React.ComponentProps<typeof ServerForm> = {
      proposalType: "rfp",
      formData: { title: "Test RFP Title" }, // Example required data
      file: testFile,
      onCancel: vi.fn(),
      ...props,
    };
    return render(<ServerForm {...defaultProps} />);
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Default successful API mocks
    mockCreateProposal.mockResolvedValue({
      success: true,
      proposal: { id: testProposalId },
    });
    mockUploadProposalFile.mockResolvedValue({
      success: true,
      message: "Mock upload success!",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    // Default auth state
    mockAuthState = {
      user: { id: "test-user-123" },
      loading: false,
      error: null,
    };

    // Mock sonner promise behavior
    // The actual promise resolves/rejects, toast displays based on that
    mockSonnerPromise.mockImplementation(async (promise, options) => {
      try {
        const result = await promise;
        // Check our action's success flag inside the result
        if (result && result.success) {
          options.success(result);
        } else {
          // If action returns success: false, treat as error for toast
          throw result; // Throw the result object itself
        }
      } catch (error) {
        options.error(error);
      }
    });
  });

  afterEach(() => {
    // Ensure timers are cleared if used
    vi.useRealTimers();
  });

  it("should call createProposal and then uploadProposalFile with correct FormData on submit", async () => {
    renderComponent();

    // Wait for the button to appear after initial loading/verification
    const submitButton = await waitFor(() =>
      screen.getByRole("button", {
        name: /Create Proposal/i,
      })
    );
    await userEvent.click(submitButton);

    // Check createProposal call (ensure formData is passed correctly, might need more specific check)
    await waitFor(() => expect(mockCreateProposal).toHaveBeenCalledTimes(1));
    const createArgs = mockCreateProposal.mock.calls[0][0] as FormData;
    expect(createArgs.get("title")).toBe("Test RFP Title");
    expect(createArgs.get("proposal_type")).toBe("rfp");

    // Check uploadProposalFile call *after* createProposal succeeds
    await waitFor(() =>
      expect(mockUploadProposalFile).toHaveBeenCalledTimes(1)
    );
    const uploadArgs = mockUploadProposalFile.mock.calls[0][0] as FormData;
    expect(uploadArgs.get("proposalId")).toBe(testProposalId);
    expect(uploadArgs.get("file")).toBeInstanceOf(File);
    expect((uploadArgs.get("file") as File).name).toBe(testFile.name);
  });

  it("should display sonner promise toast states for upload", async () => {
    renderComponent();

    // Wait for the button to appear
    const submitButton = await waitFor(() =>
      screen.getByRole("button", {
        name: /Create Proposal/i,
      })
    );
    await userEvent.click(submitButton);

    // Wait for createProposal to resolve (needed before upload starts)
    await waitFor(() => expect(mockCreateProposal).toHaveBeenCalled());

    // Check that sonner toast promise was called
    await waitFor(() => expect(mockSonnerPromise).toHaveBeenCalledTimes(1));

    // Check the arguments passed to sonner toast promise
    const sonnerArgs = mockSonnerPromise.mock.calls[0];
    expect(sonnerArgs[1].loading).toBe("Uploading document...");

    // Instead, check the final UI toast for overall success
    await waitFor(() => {
      expect(mockUiToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Success!" })
      );
    });
  });

  it("should display sonner error toast when uploadProposalFile action fails", async () => {
    const uploadErrorMsg = "Upload failed miserably!";
    mockUploadProposalFile.mockResolvedValue({
      success: false,
      message: uploadErrorMsg,
    });

    renderComponent();

    // Wait for the button to appear
    const submitButton = await waitFor(() =>
      screen.getByRole("button", {
        name: /Create Proposal/i,
      })
    );

    // Clear toast history from verification before clicking submit
    mockUiToast.mockClear();

    await userEvent.click(submitButton);

    await waitFor(() => expect(mockCreateProposal).toHaveBeenCalled());
    await waitFor(() => expect(mockUploadProposalFile).toHaveBeenCalled());
    await waitFor(() => expect(mockSonnerPromise).toHaveBeenCalledTimes(1));

    // Check error callback was called
    const sonnerArgs = mockSonnerPromise.mock.calls[0];
    // await waitFor(() => {
    // expect(sonnerArgs[1].error).toHaveBeenCalled(); // <-- REMOVE: Not a spy
    // Our implementation throws the result object on success: false
    // expect(sonnerArgs[1].error).toHaveBeenCalledWith({
    //   success: false,
    //   message: uploadErrorMsg,
    // });
    // });

    // Check final UI toast was NOT the success one, and potentially check for an error toast
    await waitFor(() => {
      // Check that the SPECIFIC error toast for upload failure was shown
      expect(mockUiToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Upload Failed",
          description: uploadErrorMsg,
          variant: "destructive",
        })
      );
    });
    // Check no navigation happened
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("should set isSubmitting state correctly during submission process", async () => {
    // Keep mocks simple for this state test
    mockCreateProposal.mockResolvedValue({
      success: true,
      proposal: { id: testProposalId },
    });
    mockUploadProposalFile.mockResolvedValue({
      success: true,
      message: "Normal success!",
    });

    renderComponent();

    // Wait for the button to appear
    const submitButton = await waitFor(() =>
      screen.getByRole("button", {
        name: /Create Proposal/i,
      })
    );

    // Verify button is initially enabled
    expect(submitButton.disabled).toBe(false);

    // Click the button
    await userEvent.click(submitButton);

    // Verify the button enters submitting state (disabled + shows loading text)
    await waitFor(() => {
      expect(submitButton.disabled).toBe(true);
      expect(submitButton.textContent).toMatch(/Submitting.../i);
    });

    // Wait for actions to complete and success toast to be shown
    await waitFor(() => {
      expect(mockUiToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Success!" })
      );
    });

    // Verify routing occurs after success
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/proposals/created");
    });
  });

  // Example: Test submitting without a file when type is not RFP
  it("should NOT call uploadProposalFile if proposalType is not rfp", async () => {
    renderComponent({ proposalType: "application", file: undefined }); // No file

    // Wait for the button to appear
    const submitButton = await waitFor(() =>
      screen.getByRole("button", {
        name: /Create Proposal/i,
      })
    );
    await userEvent.click(submitButton);

    await waitFor(() => expect(mockCreateProposal).toHaveBeenCalledTimes(1));

    // Ensure upload was NOT called
    expect(mockUploadProposalFile).not.toHaveBeenCalled();

    // Should still navigate on success
    await waitFor(() =>
      expect(mockRouterPush).toHaveBeenCalledWith("/proposals/created")
    );
  });

  // Add more tests if needed:
  // - Test validation errors shown in the UI
});
