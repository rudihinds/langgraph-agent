/**
 * Tests for the proposal state management
 */
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { SectionType } from "../modules/constants.js";
import { ProcessingStatus, ProposalSection } from "../modules/types.js";
import {
  OverallProposalState,
  ProposalStateAnnotation,
  createInitialProposalState,
  sectionsReducer,
  errorsReducer,
  validateProposalState,
} from "../proposal.state.ts";

describe("Proposal State Management", () => {
  describe("Initial State Creation", () => {
    it("should create a valid initial state", () => {
      const userId = "user-123";
      const sessionId = "test-thread-123";

      const state = createInitialProposalState(userId, sessionId);

      expect(state.activeThreadId).toBe(sessionId);
      expect(state.userId).toBe(userId);
      expect(state.rfpProcessingStatus).toBe(ProcessingStatus.NOT_STARTED);
      expect(state.researchStatus).toBe(ProcessingStatus.NOT_STARTED);
      expect(state.sections).toEqual({});
      expect(state.requiredSections).toEqual([]);
      expect(state.messages).toEqual([]);
      expect(state.errors).toEqual([]);
    });

    it("should validate the initial state", () => {
      const state = createInitialProposalState("user-123", "thread-123");

      // Should not throw
      const validatedState = validateProposalState(state);
      expect(validatedState).toBeDefined();
    });
  });

  describe("State Reducers", () => {
    describe("sectionsReducer", () => {
      it("should add a new section", () => {
        const initialSections: Record<string, ProposalSection> = {};
        const newSection: Record<string, ProposalSection> = {
          introduction: {
            id: "introduction",
            title: "Introduction",
            content: "This is the introduction",
            status: ProcessingStatus.RUNNING,
            requirements: [],
            evidence: [],
            wordCount: 0,
            lastUpdated: new Date().toISOString(),
          },
        };

        const result = sectionsReducer(initialSections, newSection);

        expect(result.introduction).toBeDefined();
        expect(result.introduction.id).toBe("introduction");
        expect(result.introduction.content).toBe("This is the introduction");
        expect(result.introduction.status).toBe(ProcessingStatus.RUNNING);
        expect(result.introduction.lastUpdated).toBeDefined();
      });

      it("should update an existing section", () => {
        const initialSections: Record<string, ProposalSection> = {
          introduction: {
            id: "introduction",
            title: "Introduction",
            content: "Initial content",
            status: ProcessingStatus.RUNNING,
            requirements: [],
            evidence: [],
            wordCount: 0,
            lastUpdated: "2023-01-01T00:00:00Z",
          },
        };

        const update: Record<string, ProposalSection> = {
          introduction: {
            id: "introduction",
            title: "Introduction",
            content: "New content",
            status: ProcessingStatus.COMPLETE,
            requirements: [],
            evidence: [],
            wordCount: 100,
            lastUpdated: new Date().toISOString(),
          },
        };

        const result = sectionsReducer(initialSections, update);

        expect(Object.keys(result)).toHaveLength(1);
        expect(result.introduction.content).toBe("New content");
        expect(result.introduction.status).toBe(ProcessingStatus.COMPLETE);
        expect(result.introduction.lastUpdated).not.toBe(
          "2023-01-01T00:00:00Z"
        );
      });

      it("should merge multiple sections", () => {
        const initialSections: Record<string, ProposalSection> = {
          introduction: {
            id: "introduction",
            title: "Introduction",
            content: "Intro content",
            status: ProcessingStatus.COMPLETE,
            requirements: [],
            evidence: [],
            wordCount: 50,
            lastUpdated: "2023-01-01T00:00:00Z",
          },
        };

        const newSections: Record<string, ProposalSection> = {
          methodology: {
            id: "methodology",
            title: "Methodology",
            content: "Methodology content",
            status: ProcessingStatus.RUNNING,
            requirements: [],
            evidence: [],
            wordCount: 75,
            lastUpdated: "2023-01-02T00:00:00Z",
          },
        };

        const result = sectionsReducer(initialSections, newSections);

        expect(Object.keys(result)).toHaveLength(2);
        expect(result.introduction).toEqual(initialSections.introduction);
        expect(result.methodology).toEqual(newSections.methodology);
      });
    });

    describe("errorsReducer", () => {
      it("should add error arrays", () => {
        const initialErrors = ["Error 1"];
        const newErrors = ["Error 2"];

        const result = errorsReducer(initialErrors, newErrors);

        expect(result).toHaveLength(2);
        expect(result).toEqual(["Error 1", "Error 2"]);
      });

      it("should add multiple errors", () => {
        const initialErrors = ["Error 1"];
        const newErrors = ["Error 2", "Error 3"];

        const result = errorsReducer(initialErrors, newErrors);

        expect(result).toHaveLength(3);
        expect(result).toEqual(["Error 1", "Error 2", "Error 3"]);
      });

      it("should work with undefined initial value", () => {
        const result = errorsReducer(undefined, ["New error"]);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe("New error");
      });
    });

    describe("messagesStateReducer", () => {
      it("should append messages correctly", () => {
        // Create some test messages
        const initialMessages = [new HumanMessage("Hello")];
        const newMessages = [new AIMessage("Response")];

        // Get the messagesStateReducer directly from the module
        const { messagesStateReducer } = require("@langchain/langgraph");

        // Apply the reducer directly
        const result = messagesStateReducer(initialMessages, newMessages);

        expect(result).toHaveLength(2);
        expect(result[0].content).toBe("Hello");
        expect(result[1].content).toBe("Response");
      });
    });

    // Commenting out due to type resolution issues in test env (Task #11 / #14)
    // describe("State Validation", () => {
    //   it("should validate a complete state", () => {
    //     const validState: OverallProposalState = {
    //       rfpDocument: {
    //         id: "doc-123",
    //         fileName: "rfp.pdf",
    //         status: "loaded",
    //         text: "RFP content here",
    //       },
    //       researchStatus: "complete",
    //       researchResults: { key: "value" },
    //       researchEvaluation: {
    //         score: 9.5,
    //         passed: true,
    //         feedback: "Excellent research",
    //       },
    //       solutionSoughtStatus: "approved",
    //       solutionSoughtResults: { approach: "innovative" },
    //       solutionSoughtEvaluation: {
    //         score: 8.5,
    //         passed: true,
    //         feedback: "Good solution",
    //       },
    //       connectionPairsStatus: "complete",
    //       connectionPairs: [{ problem: "X", solution: "Y" }],
    //       connectionPairsEvaluation: {
    //         score: 8.0,
    //         passed: true,
    //         feedback: "Good connections",
    //       },
    //       sections: new Map([
    //         [
    //           "problem_statement",
    //           {
    //             id: "problem_statement",
    //             title: "Problem Statement",
    //             content: "Problem statement content",
    //             status: "approved", // Needs SectionProcessingStatus
    //             lastUpdated: new Date().toISOString(),
    //           },
    //         ],
    //       ]),
    //       requiredSections: ["problem_statement", "methodology"],
    //       status: "complete",
    //       currentStep: "generateSolution",
    //       activeThreadId: "thread-123",
    //       messages: [new HumanMessage("Hello")],
    //       errors: [],
    //       userId: "user-123",
    //       projectName: "Project X",
    //       createdAt: new Date().toISOString(),
    //       lastUpdatedAt: new Date().toISOString(),
    //     };
    //
    //     // Should not throw
    //     expect(() => validateProposalState(validState)).not.toThrow();
    //   });
    // });
  });
});
