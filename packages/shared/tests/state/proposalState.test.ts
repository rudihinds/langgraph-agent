import { describe, test, expect, beforeEach } from "vitest";
import {
  ProposalState,
  defaultProposalState,
  ProposalStateType,
  ConnectionPair,
  ProposalSection,
  SectionStatus,
  ProposalSections,
} from "../../src/state/proposalState";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

describe("ProposalState", () => {
  describe("Messages Channel", () => {
    test("should correctly append messages", () => {
      // Create initial state
      const initialState = {
        ...defaultProposalState,
        messages: [new HumanMessage("Hello")],
      };

      // Create an update
      const newMessages = [new AIMessage("Hi there!")];

      // Use the reducer directly from the state object
      const messages = ProposalState.channelDescriptions.messages;
      const updatedMessages = messages.reducer(
        initialState.messages,
        newMessages
      );

      // Create the new state
      const newState = {
        ...initialState,
        messages: updatedMessages,
      };

      // Check that the new state contains both messages
      expect(newState.messages.length).toBe(2);
      expect(newState.messages[0].content).toBe("Hello");
      expect(newState.messages[1].content).toBe("Hi there!");
    });
  });

  describe("RFP Analysis", () => {
    test("should set initial rfpAnalysis to null", () => {
      expect(defaultProposalState.rfpAnalysis).toBeNull();
    });

    test("should replace rfpAnalysis with new value", () => {
      // Initial state
      const initialState = { ...defaultProposalState };

      // Create an update with analysis data
      const newAnalysis = {
        fundingOrganization: "Test Foundation",
        fundingOpportunity: "Test Grant",
        keyPriorities: ["education", "sustainability"],
        detailedAnalysis: {
          fundingGoals: ["Improve education"],
          fundingObjectives: ["Support innovations"],
        },
        funderResearch: {
          missionStatement: "Supporting innovations in education",
        },
      };

      // Create the new state
      const newState = {
        ...initialState,
        rfpAnalysis: newAnalysis,
      };

      // Check that the analysis was set correctly
      expect(newState.rfpAnalysis).not.toBeNull();
      expect(newState.rfpAnalysis?.fundingOrganization).toBe("Test Foundation");
      expect(newState.rfpAnalysis?.keyPriorities).toContain("education");
    });
  });

  describe("Connection Pairs", () => {
    test("should start with empty connection pairs", () => {
      expect(defaultProposalState.connectionPairs).toEqual([]);
    });

    test("should add new connection pairs", () => {
      // Initial state
      const initialState = { ...defaultProposalState };

      // Create connection pairs to add
      const newPairs: ConnectionPair[] = [
        {
          id: "pair1",
          funderNeed: "Environmental sustainability",
          applicantStrength: "Solar panel expertise",
          alignmentScore: 9,
          alignmentExplanation: "Direct match for environmental goals",
          relevantSections: ["problem_statement", "solution"],
        },
      ];

      // Use the reducer directly from the state object
      const connectionPairsReducer =
        ProposalState.channelDescriptions.connectionPairs.reducer;
      const updatedPairs = connectionPairsReducer(
        initialState.connectionPairs,
        newPairs
      );

      // Create the new state
      const newState = {
        ...initialState,
        connectionPairs: updatedPairs,
      };

      // Check that the connection pair was added
      expect(newState.connectionPairs.length).toBe(1);
      expect(newState.connectionPairs[0].id).toBe("pair1");
      expect(newState.connectionPairs[0].alignmentScore).toBe(9);
    });

    test("should update existing connection pairs without duplicating", () => {
      // Initial state with one connection pair
      const initialState: ProposalStateType = {
        ...defaultProposalState,
        connectionPairs: [
          {
            id: "pair1",
            funderNeed: "Environmental sustainability",
            applicantStrength: "Solar panel expertise",
            alignmentScore: 7,
            alignmentExplanation: "Good match for environmental goals",
            relevantSections: ["problem_statement"],
          },
        ],
      };

      // Create an update with same ID but different content
      const updatedPair: ConnectionPair[] = [
        {
          id: "pair1",
          funderNeed: "Environmental sustainability",
          applicantStrength: "Solar panel expertise",
          alignmentScore: 9, // Improved score
          alignmentExplanation: "Direct match for environmental goals", // Updated explanation
          relevantSections: ["problem_statement", "solution"], // Added section
        },
      ];

      // Use the reducer directly from the state object
      const connectionPairsReducer =
        ProposalState.channelDescriptions.connectionPairs.reducer;
      const updatedPairs = connectionPairsReducer(
        initialState.connectionPairs,
        updatedPair
      );

      // Create the new state
      const newState = {
        ...initialState,
        connectionPairs: updatedPairs,
      };

      // Check that the connection pair was updated and not duplicated
      expect(newState.connectionPairs.length).toBe(1);
      expect(newState.connectionPairs[0].id).toBe("pair1");
      expect(newState.connectionPairs[0].alignmentScore).toBe(9);
      expect(newState.connectionPairs[0].alignmentExplanation).toBe(
        "Direct match for environmental goals"
      );
      expect(newState.connectionPairs[0].relevantSections).toContain(
        "solution"
      );
    });

    test("should handle adding multiple connection pairs at once", () => {
      // Initial state with one connection pair
      const initialState: ProposalStateType = {
        ...defaultProposalState,
        connectionPairs: [
          {
            id: "pair1",
            funderNeed: "Environmental sustainability",
            applicantStrength: "Solar panel expertise",
            alignmentScore: 9,
            alignmentExplanation: "Direct match for environmental goals",
            relevantSections: ["problem_statement", "solution"],
          },
        ],
      };

      // Add two new pairs
      const newPairs: ConnectionPair[] = [
        {
          id: "pair2",
          funderNeed: "Community involvement",
          applicantStrength: "Strong local partnerships",
          alignmentScore: 8,
          alignmentExplanation: "Good local connections",
          relevantSections: ["organizational_capacity"],
        },
        {
          id: "pair3",
          funderNeed: "Innovation",
          applicantStrength: "R&D department",
          alignmentScore: 7,
          alignmentExplanation: "Demonstrated innovation history",
          relevantSections: ["solution"],
        },
      ];

      // Use the reducer directly from the state object
      const connectionPairsReducer =
        ProposalState.channelDescriptions.connectionPairs.reducer;
      const updatedPairs = connectionPairsReducer(
        initialState.connectionPairs,
        newPairs
      );

      // Create the new state
      const newState = {
        ...initialState,
        connectionPairs: updatedPairs,
      };

      // Check that all three pairs exist
      expect(newState.connectionPairs.length).toBe(3);
      expect(newState.connectionPairs.map((pair) => pair.id)).toContain(
        "pair1"
      );
      expect(newState.connectionPairs.map((pair) => pair.id)).toContain(
        "pair2"
      );
      expect(newState.connectionPairs.map((pair) => pair.id)).toContain(
        "pair3"
      );
    });
  });

  describe("Proposal Sections", () => {
    test("should start with empty proposal sections", () => {
      expect(defaultProposalState.proposalSections).toEqual({});
    });

    test("should add a new proposal section", () => {
      // Initial state
      const initialState = { ...defaultProposalState };

      // Create a new section
      const newSection: ProposalSection = {
        content: "This is the problem statement content.",
        status: "draft_complete" as SectionStatus,
        metadata: {
          title: "Problem Statement",
          description: "Description of the problem",
          dependsOn: [],
        },
        version: 1,
      };

      // Use the reducer directly from the state object
      const proposalSectionsReducer =
        ProposalState.channelDescriptions.proposalSections.reducer;
      const updatedSections = proposalSectionsReducer(
        initialState.proposalSections,
        { problem_statement: newSection }
      );

      // Create the new state
      const newState = {
        ...initialState,
        proposalSections: updatedSections,
      };

      // Check that the section was added
      expect(newState.proposalSections.problem_statement).toBeDefined();
      expect(newState.proposalSections.problem_statement.content).toBe(
        "This is the problem statement content."
      );
      expect(newState.proposalSections.problem_statement.version).toBe(1);
    });

    test("should update an existing section and increment version", () => {
      // Initial state with one section
      const initialState: ProposalStateType = {
        ...defaultProposalState,
        proposalSections: {
          problem_statement: {
            content: "Initial content",
            status: "draft_complete" as SectionStatus,
            metadata: {
              title: "Problem Statement",
              description: "Description of the problem",
              dependsOn: [],
            },
            version: 1,
          },
        },
      };

      // Update the section
      const updatedSection: Partial<ProposalSection> = {
        content: "Updated content",
        status: "reviewed" as SectionStatus,
      };

      // Use the reducer directly from the state object
      const proposalSectionsReducer =
        ProposalState.channelDescriptions.proposalSections.reducer;
      const updatedSections = proposalSectionsReducer(
        initialState.proposalSections,
        { problem_statement: updatedSection }
      );

      // Create the new state
      const newState = {
        ...initialState,
        proposalSections: updatedSections,
      };

      // Check that the section was updated and version incremented
      expect(newState.proposalSections.problem_statement.content).toBe(
        "Updated content"
      );
      expect(newState.proposalSections.problem_statement.status).toBe(
        "reviewed"
      );
      expect(newState.proposalSections.problem_statement.version).toBe(2);
      // Check that metadata was preserved
      expect(newState.proposalSections.problem_statement.metadata.title).toBe(
        "Problem Statement"
      );
    });

    test("should handle multiple section updates simultaneously", () => {
      // Initial state with multiple sections
      const initialState: ProposalStateType = {
        ...defaultProposalState,
        proposalSections: {
          problem_statement: {
            content: "Problem content",
            status: "draft_complete" as SectionStatus,
            metadata: {
              title: "Problem Statement",
              description: "Description of the problem",
              dependsOn: [],
            },
            version: 1,
          },
          solution: {
            content: "Solution content",
            status: "in_progress" as SectionStatus,
            metadata: {
              title: "Solution",
              description: "Solution to the problem",
              dependsOn: ["problem_statement"],
            },
            version: 1,
          },
        },
      };

      // Update both sections and add a new one
      const updates: Partial<ProposalSections> = {
        problem_statement: {
          status: "approved" as SectionStatus,
        },
        solution: {
          content: "Updated solution content",
        },
        conclusion: {
          content: "New conclusion content",
          status: "draft_complete" as SectionStatus,
          metadata: {
            title: "Conclusion",
            description: "Conclusion of the proposal",
            dependsOn: ["problem_statement", "solution"],
          },
          version: 0, // Will be updated to 1
        },
      };

      // Use the reducer directly from the state object
      const proposalSectionsReducer =
        ProposalState.channelDescriptions.proposalSections.reducer;
      const updatedSections = proposalSectionsReducer(
        initialState.proposalSections,
        updates
      );

      // Create the new state
      const newState = {
        ...initialState,
        proposalSections: updatedSections,
      };

      // Check that all sections were properly updated
      expect(newState.proposalSections.problem_statement.status).toBe(
        "approved"
      );
      expect(newState.proposalSections.problem_statement.version).toBe(2);

      expect(newState.proposalSections.solution.content).toBe(
        "Updated solution content"
      );
      expect(newState.proposalSections.solution.version).toBe(2);

      expect(newState.proposalSections.conclusion).toBeDefined();
      expect(newState.proposalSections.conclusion.version).toBe(1);
    });
  });

  describe("Section Status", () => {
    test("should initialize with all sections as not started", () => {
      expect(defaultProposalState.sectionStatus.problem_statement).toBe(
        "not_started"
      );
      expect(defaultProposalState.sectionStatus.solution).toBe("not_started");
      expect(defaultProposalState.sectionStatus.organizational_capacity).toBe(
        "not_started"
      );
    });

    test("should update section status", () => {
      // Initial state
      const initialState = { ...defaultProposalState };

      // Update status for some sections
      const statusUpdates = {
        problem_statement: "in_progress" as SectionStatus,
        solution: "draft_complete" as SectionStatus,
      };

      // Use the reducer directly from the state object
      const sectionStatusReducer =
        ProposalState.channelDescriptions.sectionStatus.reducer;
      const updatedStatus = sectionStatusReducer(
        initialState.sectionStatus,
        statusUpdates
      );

      // Create the new state
      const newState = {
        ...initialState,
        sectionStatus: updatedStatus,
      };

      // Check that statuses were updated
      expect(newState.sectionStatus.problem_statement).toBe("in_progress");
      expect(newState.sectionStatus.solution).toBe("draft_complete");
      // Other sections should remain unchanged
      expect(newState.sectionStatus.organizational_capacity).toBe(
        "not_started"
      );
    });
  });

  describe("Workflow Phase", () => {
    test("should initialize with research phase", () => {
      expect(defaultProposalState.currentPhase).toBe("research");
    });

    test("should update workflow phase", () => {
      const initialState = { ...defaultProposalState };

      // Create the new state
      const newState = {
        ...initialState,
        currentPhase: "solution_analysis",
      };

      expect(newState.currentPhase).toBe("solution_analysis");
    });
  });

  describe("Metadata", () => {
    test("should initialize with default metadata", () => {
      expect(defaultProposalState.metadata.createdAt).toBeDefined();
      expect(defaultProposalState.metadata.updatedAt).toBeDefined();
      expect(defaultProposalState.metadata.proposalId).toBe("");
      expect(defaultProposalState.metadata.userId).toBe("");
      expect(defaultProposalState.metadata.proposalTitle).toBe("");
    });

    test("should update metadata and update timestamp", () => {
      const initialState = { ...defaultProposalState };
      const oldTimestamp = initialState.metadata.updatedAt;

      // Wait a bit to ensure timestamp changes
      const delay = () => new Promise((resolve) => setTimeout(resolve, 10));

      return delay().then(() => {
        const metadataUpdates = {
          proposalId: "prop-123",
          userId: "user-abc",
          proposalTitle: "Community Garden Project",
          customField: "custom value",
        };

        // Use the reducer directly from the state object
        const metadataReducer =
          ProposalState.channelDescriptions.metadata.reducer;
        const updatedMetadata = metadataReducer(
          initialState.metadata,
          metadataUpdates
        );

        // Create the new state
        const newState = {
          ...initialState,
          metadata: updatedMetadata,
        };

        expect(newState.metadata.proposalId).toBe("prop-123");
        expect(newState.metadata.userId).toBe("user-abc");
        expect(newState.metadata.proposalTitle).toBe(
          "Community Garden Project"
        );
        expect(newState.metadata.customField).toBe("custom value");
        // Created at should still be there
        expect(newState.metadata.createdAt).toBeDefined();
        // Updated timestamp should be newer
        expect(newState.metadata.updatedAt).not.toBe(oldTimestamp);
      });
    });
  });
});
