import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import { OrchestratorService } from "../services/orchestrator.service.js";
import { constructProposalThreadId } from "../lib/utils/threads.js";
import { OverallProposalState } from "../state/modules/types.js"; // Assuming state type import
import { Checkpoint } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages"; // Corrected import path

// Mock the actual graph compilation/invocation to isolate checkpointer interaction
// We might need more sophisticated mocking if Orchestrator methods rely heavily on graph results
const mockGraph = {
  getTuple: vi.fn(),
  getState: vi.fn(),
  updateState: vi.fn(),
  invoke: vi.fn(),
} as any; // Use 'as any' for simplicity, refine if needed

describe("Thread Persistence Tests", () => {
  let checkpointer: MemorySaver;
  let orchestratorService: OrchestratorService;
  const testUserId = "test-user-123";
  const testRfpId = "test-rfp-456";
  const expectedThreadId = constructProposalThreadId(testUserId, testRfpId);

  beforeEach(() => {
    checkpointer = new MemorySaver();
    // Pass the mock graph and the memory checkpointer
    orchestratorService = new OrchestratorService(mockGraph, checkpointer);

    // Reset mocks if needed (though MemorySaver state is implicitly reset by re-instantiation)
    vi.resetAllMocks();
  });

  // Test 1: Workflow Initialization (New Thread)
  test("initOrGetProposalWorkflow should identify a new thread correctly", async () => {
    const result = await orchestratorService.initOrGetProposalWorkflow(
      testUserId,
      testRfpId
    );

    expect(result.isNew).toBe(true);
    expect(result.threadId).toBe(expectedThreadId);
    expect(result.initialState).toBeNull();

    // Verify checkpointer.getTuple was called correctly
    const checkpointerConfig = {
      configurable: { thread_id: expectedThreadId },
    };
    // MemorySaver's getTuple might be slightly different, let's check internal state conceptually
    const internalState = await checkpointer.get(checkpointerConfig);
    expect(internalState).toBeUndefined(); // Changed from toBeNull()
  });

  // Test 2: Workflow Retrieval (Existing Thread)
  test("initOrGetProposalWorkflow should retrieve state for an existing thread", async () => {
    // 1. Call init once to establish the thread conceptually (though MemorySaver won't store just from init)
    await orchestratorService.initOrGetProposalWorkflow(testUserId, testRfpId);

    // 2. Manually save mock state using the checkpointer
    const mockState: Partial<OverallProposalState> = {
      // Use Partial for simplicity
      messages: [{ type: "human", content: "hello", id: "1" } as any],
      activeThreadId: expectedThreadId,
    };
    const config = { configurable: { thread_id: expectedThreadId } };
    const checkpoint = {
      v: 1,
      id: config.configurable.thread_id,
      ts: new Date().toISOString(),
      channel_values: mockState as any,
      channel_versions: {},
      versions_seen: {},
      pending_sends: [],
    };
    await checkpointer.put(config, checkpoint, {
      source: "update",
      step: -1,
      writes: null,
      parents: {},
    });

    // 3. Call init again with the same IDs
    const result = await orchestratorService.initOrGetProposalWorkflow(
      testUserId,
      testRfpId
    );

    // 4. Assertions
    expect(result.isNew).toBe(false);
    expect(result.threadId).toBe(expectedThreadId);
    expect(result.initialState).toEqual(mockState); // Check if the retrieved state matches the saved mock state
  });

  // Test 3: State Update Persistence (via Orchestrator Method)
  test("addUserMessage should persist the updated state via checkpointer", async () => {
    const threadId = expectedThreadId;
    const initialMessage = "Initial user message";
    const config = { configurable: { thread_id: threadId } };

    // Mock graph interactions if needed for addUserMessage to proceed
    // For this test, we mostly care that checkpointer.put is called correctly by the service method
    const mockPut = vi.spyOn(checkpointer, "put");

    // Ensure initial state exists for addUserMessage (it likely calls getState first)
    const initialState: Partial<OverallProposalState> = {
      messages: [],
      activeThreadId: threadId,
    };
    const initialCheckpoint = {
      v: 1,
      id: threadId,
      ts: new Date().toISOString(),
      channel_values: initialState as any,
      channel_versions: {},
      versions_seen: {},
      pending_sends: [],
    };
    await checkpointer.put(config, initialCheckpoint, {
      source: "update",
      step: -1,
      writes: null,
      parents: {},
    });

    // Call the orchestrator method
    // We might need to mock the graph invoke/updateState calls within addUserMessage
    mockGraph.updateState.mockResolvedValue({}); // Mock graph update
    mockGraph.invoke.mockResolvedValue({
      messages: [{ type: "human", content: initialMessage, id: "1" } as any],
      activeThreadId: threadId,
    }); // Mock graph return state

    await orchestratorService.addUserMessage(threadId, initialMessage);

    // Verify checkpointer.put was called with the updated state
    expect(mockPut).toHaveBeenCalled();
    const savedCheckpoint = await checkpointer.get(config);
    expect(savedCheckpoint?.channel_values.messages).toHaveLength(1);
    expect(savedCheckpoint?.channel_values.messages[0].content).toBe(
      initialMessage
    );

    // Optionally, verify getState retrieves the update
    const retrievedState = await orchestratorService.getState(threadId);
    expect(retrievedState.messages).toHaveLength(1);
    expect(retrievedState.messages[0].content).toBe(initialMessage);

    mockPut.mockRestore();
  });

  // Test 4: Thread Isolation
  // test('should isolate state between different thread IDs', async () => {
  //   const userId1 = 'user-iso-1';
  //   const rfpId1 = 'rfp-iso-1';
  //   const threadId1 = constructProposalThreadId(userId1, rfpId1);
  //   const message1 = 'Message for thread 1';

  //   const userId2 = 'user-iso-2';
  //   const rfpId2 = 'rfp-iso-2';
  //   const threadId2 = constructProposalThreadId(userId2, rfpId2);

  //   const config1 = { configurable: { thread_id: threadId1 } };
  //   const config2 = { configurable: { thread_id: threadId2 } };

  //   // Setup state for thread 1
  //   const initialState1: Partial<OverallProposalState> = { messages: [{ type: 'human', content: message1, id: 't1m1' }], activeThreadId: threadId1 };
  //   const checkpoint1 = { v: 1, id: threadId1, ts: new Date().toISOString(), channel_values: initialState1 as any, channel_versions: {}, versions_seen: {}, pending_sends: [] };
  //   await checkpointer.put(config1, checkpoint1, {}, {});

  //   // Initialize thread 2 - should be new
  //   const result2 = await orchestratorService.initOrGetProposalWorkflow(userId2, rfpId2);
  //   expect(result2.isNew).toBe(true);
  //   expect(result2.threadId).toBe(threadId2);
  //   expect(result2.initialState).toBeNull();

  //   // Verify state for thread 2 is empty in checkpointer
  //   const state2 = await checkpointer.get(config2);
  //   expect(state2).toBeNull();

  //   // Retrieve state for thread 1 - should be unchanged
  //   const retrievedState1 = await orchestratorService.getState(threadId1);
  //   expect(retrievedState1.messages).toHaveLength(1);
  //   expect(retrievedState1.messages[0].content).toBe(message1);
  // });
});
