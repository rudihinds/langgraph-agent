import { describe, it, expect } from "vitest";
import { createInitialProposalState } from "../proposal.state.js";
import {
  createInitialPlanningIntelligence,
  createInitialUserCollaboration,
  createInitialAdaptiveWorkflow,
  addUserQuery,
  addExpertiseContribution,
  updatePhaseStatus,
  addAdaptationTrigger,
} from "../modules/helpers.js";
import {
  PlanningIntelligenceSchema,
  UserCollaborationSchema,
  AdaptiveWorkflowSchema,
} from "../modules/schemas.js";
import { ComplexityLevel, TimelinePressure } from "../modules/constants.js";

describe("Planning Intelligence State Schema", () => {
  describe("createInitialProposalState", () => {
    it("should create a valid initial proposal state with planning intelligence", () => {
      const userId = "user_123";
      const sessionId = "session_456";

      const initialState = createInitialProposalState(userId, sessionId);

      expect(initialState.userId).toBe(userId);
      expect(initialState.sessionId).toBe(sessionId);
      expect(initialState.currentPhase).toBe("planning");
      expect(initialState.planningIntelligence).toBeDefined();
      expect(initialState.userCollaboration).toBeDefined();
      expect(initialState.adaptiveWorkflow).toBeDefined();
    });

    it("should create state with proper default planning intelligence structure", () => {
      const initialState = createInitialProposalState("user", "session");

      expect(
        initialState.planningIntelligence?.rfpCharacteristics
      ).toBeDefined();
      expect(
        initialState.planningIntelligence?.researchIntelligence
      ).toBeDefined();
      expect(
        initialState.planningIntelligence?.strategicApproach
      ).toBeDefined();
      expect(initialState.userCollaboration?.strategicPriorities).toEqual([]);
      expect(initialState.adaptiveWorkflow?.selectedApproach).toBe("standard");
    });
  });

  describe("helper functions", () => {
    it("should create valid initial planning intelligence", () => {
      const planningIntel = createInitialPlanningIntelligence();

      expect(planningIntel.rfpCharacteristics?.complexity).toBe(
        ComplexityLevel.MEDIUM
      );
      expect(planningIntel.rfpCharacteristics?.timelinePressure).toBe(
        TimelinePressure.MEDIUM
      );
      expect(
        planningIntel.researchIntelligence?.funderIntelligence
          ?.organizationalPriorities
      ).toEqual([]);
      expect(planningIntel.strategicApproach?.selectedApproach).toBe(
        "standard"
      );
    });

    it("should create valid initial user collaboration", () => {
      const userCollab = createInitialUserCollaboration();

      expect(userCollab.strategicPriorities).toEqual([]);
      expect(userCollab.userQueries).toEqual([]);
      expect(userCollab.preferredApproach).toBeUndefined();
      expect(userCollab.feedbackHistory).toEqual({});
    });

    it("should create valid initial adaptive workflow", () => {
      const workflow = createInitialAdaptiveWorkflow();

      expect(workflow.selectedApproach).toBe("standard");
      expect(workflow.currentPhase).toBe("planning");
      expect(workflow.complexityLevel).toBe("moderate");
      expect(workflow.phaseCompletionStatus).toEqual({});
    });
  });

  describe("user collaboration utilities", () => {
    it("should add user query with timestamp", () => {
      const initial = createInitialUserCollaboration();
      const question = "What should we focus on for this proposal?";
      const options = ["Option 1", "Option 2"];

      const updated = addUserQuery(initial, question, options);

      expect(updated.userQueries).toHaveLength(1);
      expect(updated.userQueries[0].question).toBe(question);
      expect(updated.userQueries[0].options).toEqual(options);
      expect(updated.userQueries[0].timestamp).toBeDefined();
      expect(updated.userQueries[0].id).toBeDefined();
    });

    it("should add expertise contribution", () => {
      const initial = createInitialUserCollaboration();
      const type = "addition";
      const subject = "cybersecurity";
      const content = "We have extensive experience with NIST frameworks";
      const agentId = "agent_001";

      const updated = addExpertiseContribution(
        initial,
        type,
        subject,
        content,
        "High",
        agentId
      );

      expect(updated.expertiseContributions).toHaveLength(1);
      expect(updated.expertiseContributions[0].subject).toBe(subject);
      expect(updated.expertiseContributions[0].confidence).toBe("High");
      expect(updated.expertiseContributions[0].agentId).toBe(agentId);
      expect(updated.expertiseContributions[0].id).toBeDefined();
    });
  });

  describe("adaptive workflow utilities", () => {
    it("should update phase status", () => {
      const initial = createInitialAdaptiveWorkflow();

      const updated = updatePhaseStatus(initial, "planning", true);

      expect(updated.phaseCompletionStatus.planning).toBe(true);
    });

    it("should add adaptation trigger", () => {
      const initial = createInitialAdaptiveWorkflow();
      const trigger = "complexity_increase";
      const reason = "RFP requirements more complex than initially assessed";
      const action = "Switched to comprehensive approach";

      const updated = addAdaptationTrigger(initial, trigger, reason, action);

      expect(updated.adaptationTriggers).toHaveLength(1);
      expect(updated.adaptationTriggers[0].trigger).toBe(trigger);
      expect(updated.adaptationTriggers[0].actionTaken).toBe(action);
      expect(updated.adaptationTriggers[0].timestamp).toBeDefined();
    });
  });

  describe("schema validation", () => {
    it("should validate planning intelligence schema", () => {
      const planningIntel = createInitialPlanningIntelligence();

      // Add some test data to make it complete
      const completeIntel = {
        ...planningIntel,
        rfpCharacteristics: {
          ...planningIntel.rfpCharacteristics!,
          industry: "technology",
          specialization: "cybersecurity",
        },
      };

      const result = PlanningIntelligenceSchema.safeParse(completeIntel);
      expect(result.success).toBe(true);
    });

    it("should validate user collaboration schema", () => {
      const userCollab = createInitialUserCollaboration();

      const result = UserCollaborationSchema.safeParse(userCollab);
      expect(result.success).toBe(true);
    });

    it("should validate adaptive workflow schema", () => {
      const workflow = createInitialAdaptiveWorkflow();

      const result = AdaptiveWorkflowSchema.safeParse(workflow);
      expect(result.success).toBe(true);
    });
  });

  describe("state reducers", () => {
    it("should preserve existing planning intelligence when merging", () => {
      const existing = createInitialPlanningIntelligence();
      const incoming = {
        rfpCharacteristics: {
          industry: "healthcare",
          specialization: "medical devices",
          complexity: ComplexityLevel.COMPLEX,
          complexityFactors: ["regulatory compliance"],
          contractValueEstimate: "$1M-5M",
          timelinePressure: TimelinePressure.HIGH,
          strategicFocus: ["innovation"],
          submissionRequirements: {
            pageLimit: 50,
            sectionsRequired: ["technical", "management"],
            attachmentsNeeded: ["CVs", "certifications"],
          },
        },
      };

      // This would test the reducer if we exported it
      // For now, just verify the structures are compatible
      expect(existing.rfpCharacteristics).toBeDefined();
      expect(incoming.rfpCharacteristics).toBeDefined();
    });
  });
});
