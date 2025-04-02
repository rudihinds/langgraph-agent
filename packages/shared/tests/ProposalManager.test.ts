import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ProposalManager } from "../src/checkpoint/ProposalManager";
import { PostgresCheckpointer } from "../src/checkpoint/PostgresCheckpointer";
import { ThreadManager } from "../src/checkpoint/threadManager";
import {
  ProposalStateType,
  defaultProposalState,
} from "../src/state/proposalState";
import {
  serializeState,
  deserializeState,
} from "../src/checkpoint/serializers";

// Mock dependencies
vi.mock("../src/checkpoint/PostgresCheckpointer");
vi.mock("../src/checkpoint/threadManager");
vi.mock("../src/checkpoint/serializers");
vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234",
}));

describe("ProposalManager", () => {
  let proposalManager: ProposalManager;
  let mockCheckpointer: any;
  let mockThreadManager: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Setup mocks
    mockCheckpointer = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({
        namespace: "proposal:123",
        state: { test: "data" },
        writes: null,
      }),
      listNamespaces: vi
        .fn()
        .mockResolvedValue(["proposal:123", "proposal:456"]),
    };

    mockThreadManager = {
      createThread: vi.fn().mockResolvedValue("thread-id-1234"),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [
              {
                proposal_id: "123",
                namespace: "proposal:123",
                state: JSON.stringify({
                  metadata: { proposalTitle: "Test Proposal" },
                }),
                created_at: "2023-01-01T00:00:00.000Z",
                updated_at: "2023-01-02T00:00:00.000Z",
              },
            ],
            error: null,
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
    };

    // Mock serializeState and deserializeState
    vi.mocked(serializeState).mockResolvedValue({ test: "serialized" });
    vi.mocked(deserializeState).mockImplementation(async (state: any) => {
      if (state?.test === "data") {
        return {
          ...defaultProposalState,
          metadata: {
            ...defaultProposalState.metadata,
            proposalId: "123",
            userId: "user-123",
            proposalTitle: "Test Proposal",
          },
          currentPhase: "research",
        } as ProposalStateType;
      }
      return state;
    });

    // Create the ProposalManager with mocks
    proposalManager = new ProposalManager({
      checkpointer: mockCheckpointer as unknown as PostgresCheckpointer,
      threadManager: mockThreadManager as unknown as ThreadManager,
      supabaseClient: mockSupabaseClient,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createProposal", () => {
    it("should create a new proposal with initial state", async () => {
      const result = await proposalManager.createProposal({
        title: "New Proposal",
        userId: "user-123",
      });

      // Check the result
      expect(result).toEqual({
        proposalId: "test-uuid-1234",
        threadId: "thread-id-1234",
      });

      // Verify thread was created
      expect(mockThreadManager.createThread).toHaveBeenCalledWith({
        proposalId: "test-uuid-1234",
        userId: "user-123",
      });

      // Verify state was saved
      expect(mockCheckpointer.put).toHaveBeenCalledWith({
        namespace: "proposal:test-uuid-1234",
        state: { test: "serialized" },
        writes: null,
      });

      // Verify serializeState was called with proper initial state
      expect(serializeState).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            proposalId: "test-uuid-1234",
            userId: "user-123",
            proposalTitle: "New Proposal",
          }),
        })
      );
    });

    it("should merge provided initial state with defaults", async () => {
      const initialState: Partial<ProposalStateType> = {
        rfpAnalysis: { organization: "Test Org" },
        currentPhase: "connection_pairs",
      };

      await proposalManager.createProposal({
        title: "New Proposal",
        userId: "user-123",
        initialState,
      });

      // Verify serializeState was called with merged state
      expect(serializeState).toHaveBeenCalledWith(
        expect.objectContaining({
          rfpAnalysis: { organization: "Test Org" },
          currentPhase: "connection_pairs",
          metadata: expect.objectContaining({
            proposalId: "test-uuid-1234",
            userId: "user-123",
            proposalTitle: "New Proposal",
          }),
        })
      );
    });
  });

  describe("getProposal", () => {
    it("should retrieve a proposal by ID", async () => {
      const proposal = await proposalManager.getProposal("123");

      // Verify checkpointer.get was called with correct namespace
      expect(mockCheckpointer.get).toHaveBeenCalledWith({
        namespace: "proposal:123",
      });

      // Verify result was deserialized
      expect(deserializeState).toHaveBeenCalledWith({ test: "data" });

      // Check the result
      expect(proposal).toEqual(
        expect.objectContaining({
          metadata: expect.objectContaining({
            proposalId: "123",
            userId: "user-123",
          }),
        })
      );
    });

    it("should return null if proposal not found", async () => {
      mockCheckpointer.get.mockResolvedValueOnce(null);

      const proposal = await proposalManager.getProposal("not-found");

      // Verify checkpointer.get was called
      expect(mockCheckpointer.get).toHaveBeenCalled();

      // Verify correct result
      expect(proposal).toBeNull();
    });
  });

  describe("updateProposal", () => {
    it("should update a proposal with partial updates", async () => {
      // Mock current state
      const currentState: ProposalStateType = {
        ...defaultProposalState,
        metadata: {
          ...defaultProposalState.metadata,
          proposalId: "123",
          userId: "user-123",
          proposalTitle: "Test Proposal",
        },
        currentPhase: "research",
      };

      vi.mocked(deserializeState).mockResolvedValueOnce(currentState);

      // Updates to apply
      const updates: Partial<ProposalStateType> = {
        currentPhase: "connection_pairs",
        rfpAnalysis: { test: "updated" },
      };

      const result = await proposalManager.updateProposal({
        proposalId: "123",
        userId: "user-123",
        updates,
      });

      // Verify state was updated and saved
      expect(mockCheckpointer.put).toHaveBeenCalledWith({
        namespace: "proposal:123",
        state: { test: "serialized" },
        writes: null,
      });

      // Verify serializeState was called with updated state
      expect(serializeState).toHaveBeenCalledWith(
        expect.objectContaining({
          currentPhase: "connection_pairs",
          rfpAnalysis: { test: "updated" },
          metadata: expect.objectContaining({
            proposalId: "123",
            userId: "user-123",
            updatedAt: expect.any(String),
          }),
        })
      );

      // Check result
      expect(result).toEqual(
        expect.objectContaining({
          currentPhase: "connection_pairs",
          rfpAnalysis: { test: "updated" },
        })
      );
    });

    it("should throw error if proposal not found", async () => {
      mockCheckpointer.get.mockResolvedValueOnce(null);

      await expect(
        proposalManager.updateProposal({
          proposalId: "not-found",
          userId: "user-123",
          updates: { currentPhase: "connection_pairs" },
        })
      ).rejects.toThrow("Proposal not found");
    });

    it("should throw error if user doesn't own the proposal", async () => {
      const currentState: ProposalStateType = {
        ...defaultProposalState,
        metadata: {
          ...defaultProposalState.metadata,
          proposalId: "123",
          userId: "different-user",
          proposalTitle: "Test Proposal",
        },
      };

      vi.mocked(deserializeState).mockResolvedValueOnce(currentState);

      await expect(
        proposalManager.updateProposal({
          proposalId: "123",
          userId: "user-123",
          updates: { currentPhase: "connection_pairs" },
        })
      ).rejects.toThrow("User does not have permission");
    });
  });

  describe("listUserProposals", () => {
    it("should list proposals using Supabase client when available", async () => {
      const proposals = await proposalManager.listUserProposals("user-123");

      // Verify Supabase client was used
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        "user_id",
        "user-123"
      );

      // Check results
      expect(proposals).toHaveLength(1);
      expect(proposals[0]).toMatchObject({
        proposalId: "123",
        title: "Test Proposal",
      });
    });

    it("should list proposals using checkpointer when Supabase client not available", async () => {
      // Create ProposalManager without Supabase client
      proposalManager = new ProposalManager({
        checkpointer: mockCheckpointer as unknown as PostgresCheckpointer,
        threadManager: mockThreadManager as unknown as ThreadManager,
      });

      // Mock deserializeState to return different states for different namespaces
      vi.mocked(deserializeState)
        .mockResolvedValueOnce({
          ...defaultProposalState,
          metadata: {
            ...defaultProposalState.metadata,
            proposalId: "123",
            userId: "user-123",
            proposalTitle: "First Proposal",
          },
          currentPhase: "research",
        } as ProposalStateType)
        .mockResolvedValueOnce({
          ...defaultProposalState,
          metadata: {
            ...defaultProposalState.metadata,
            proposalId: "456",
            userId: "different-user", // This one should be filtered out
            proposalTitle: "Second Proposal",
          },
          currentPhase: "connection_pairs",
        } as ProposalStateType);

      const proposals = await proposalManager.listUserProposals("user-123");

      // Verify checkpointer was used
      expect(mockCheckpointer.listNamespaces).toHaveBeenCalledWith({
        match: "proposal:",
        matchType: "PREFIX",
      });

      // Check results - should only include proposals for user-123
      expect(proposals).toHaveLength(1);
      expect(proposals[0].proposalId).toBe("123");
      expect(proposals[0].title).toBe("First Proposal");
    });

    it("should handle errors from Supabase", async () => {
      mockSupabaseClient.from().select().eq = vi.fn().mockReturnValue({
        data: null,
        error: { message: "Database error" },
      });

      await expect(
        proposalManager.listUserProposals("user-123")
      ).rejects.toThrow("Failed to list proposals");
    });
  });

  describe("deleteProposal", () => {
    it("should delete a proposal when Supabase client is available", async () => {
      const result = await proposalManager.deleteProposal("123", "user-123");

      // Verify Supabase client was used for deletion
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled();

      // Check result
      expect(result).toBe(true);
    });

    it("should throw error when Supabase client is not available", async () => {
      // Create ProposalManager without Supabase client
      proposalManager = new ProposalManager({
        checkpointer: mockCheckpointer as unknown as PostgresCheckpointer,
        threadManager: mockThreadManager as unknown as ThreadManager,
      });

      await expect(
        proposalManager.deleteProposal("123", "user-123")
      ).rejects.toThrow("Direct database access is required");
    });

    it("should throw error if user doesn't own the proposal", async () => {
      const currentState: ProposalStateType = {
        ...defaultProposalState,
        metadata: {
          ...defaultProposalState.metadata,
          proposalId: "123",
          userId: "different-user",
          proposalTitle: "Test Proposal",
        },
      };

      vi.mocked(deserializeState).mockResolvedValueOnce(currentState);

      await expect(
        proposalManager.deleteProposal("123", "user-123")
      ).rejects.toThrow("User does not have permission");
    });
  });

  describe("validateProposalState", () => {
    it("should return no errors for valid state", () => {
      const validState: ProposalStateType = {
        ...defaultProposalState,
        metadata: {
          ...defaultProposalState.metadata,
          proposalId: "123",
          userId: "user-123",
        },
      };

      const errors = proposalManager.validateProposalState(validState);
      expect(errors).toHaveLength(0);
    });

    it("should detect missing required metadata", () => {
      const invalidState: ProposalStateType = {
        ...defaultProposalState,
        metadata: {
          ...defaultProposalState.metadata,
          proposalId: "", // Empty
          userId: "", // Empty
        },
      };

      const errors = proposalManager.validateProposalState(invalidState);
      expect(errors).toContain("Missing proposal ID in metadata");
      expect(errors).toContain("Missing user ID in metadata");
    });

    it("should validate array fields", () => {
      const invalidState = {
        ...defaultProposalState,
        messages: "not an array" as any,
        connectionPairs: { invalid: true } as any,
        metadata: {
          ...defaultProposalState.metadata,
          proposalId: "123",
          userId: "user-123",
        },
      };

      const errors = proposalManager.validateProposalState(invalidState);
      expect(errors).toContain("Messages must be an array");
      expect(errors).toContain("Connection pairs must be an array");
    });

    it("should validate section status values", () => {
      const invalidState: ProposalStateType = {
        ...defaultProposalState,
        sectionStatus: {
          ...defaultProposalState.sectionStatus,
          problem_statement: "invalid_status" as any,
        },
        metadata: {
          ...defaultProposalState.metadata,
          proposalId: "123",
          userId: "user-123",
        },
      };

      const errors = proposalManager.validateProposalState(invalidState);
      expect(errors[0]).toContain(
        'Invalid status "invalid_status" for section "problem_statement"'
      );
    });

    it("should validate phase value", () => {
      const invalidState: ProposalStateType = {
        ...defaultProposalState,
        currentPhase: "invalid_phase" as any,
        metadata: {
          ...defaultProposalState.metadata,
          proposalId: "123",
          userId: "user-123",
        },
      };

      const errors = proposalManager.validateProposalState(invalidState);
      expect(errors[0]).toContain('Invalid phase "invalid_phase"');
    });
  });
});
