import { describe, it, expect } from "vitest";
import { ProposalStateAnnotation, ProposalState, ProposalStateSchema } from "../state";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { StateGraph } from "@langchain/langgraph";

describe("ProposalStateAnnotation", () => {
  it("should initialize with default values", () => {
    // Create a graph with our state annotation
    const graph = new StateGraph({
      channels: ProposalStateAnnotation
    });
    
    // Initialize state with empty object
    const state = graph.getInitialState({});
    
    // Check default values
    expect(state.messages).toEqual([]);
    expect(state.rfpDocument).toBeUndefined();
    expect(state.funderInfo).toBeUndefined();
    expect(state.research).toBeNull();
    expect(state.solutionSought).toBeNull();
    expect(state.connectionPairs).toEqual([]);
    expect(state.proposalSections).toEqual({});
    expect(state.evaluations).toEqual({});
    expect(state.currentSection).toBeUndefined();
    expect(state.currentPhase).toBe("research");
    expect(state.userFeedback).toBeUndefined();
    expect(state.metadata).toBeDefined();
    expect(state.metadata.createdAt).toBeDefined();
  });

  it("should handle message updates correctly", async () => {
    // Create a graph with our state annotation
    const graph = new StateGraph({
      channels: ProposalStateAnnotation
    });
    
    // Create a node that updates messages
    const addMessageNode = async (state: ProposalState) => {
      const message = new HumanMessage("This is a test message");
      return { messages: [message] };
    };
    
    // Add node to graph
    graph.addNode("add_message", addMessageNode);
    graph.setEntryPoint("add_message");
    
    // Compile graph
    const app = graph.compile();
    
    // Run graph and get updated state
    const result = await app.invoke({});
    
    // Check that message was added
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe("This is a test message");
  });

  it("should handle multiple message updates", async () => {
    // Create a graph with our state annotation
    const graph = new StateGraph({
      channels: ProposalStateAnnotation
    });
    
    // Create nodes that add messages
    const addHumanMessageNode = async (state: ProposalState) => {
      const message = new HumanMessage("Human message");
      return { messages: [message] };
    };
    
    const addAIMessageNode = async (state: ProposalState) => {
      const message = new AIMessage("AI response");
      return { messages: [message] };
    };
    
    // Add nodes to graph
    graph.addNode("add_human_message", addHumanMessageNode);
    graph.addNode("add_ai_message", addAIMessageNode);
    
    // Define the flow
    graph.setEntryPoint("add_human_message");
    graph.addEdge("add_human_message", "add_ai_message");
    
    // Compile graph
    const app = graph.compile();
    
    // Run graph and get updated state
    const result = await app.invoke({});
    
    // Check that both messages were added
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].content).toBe("Human message");
    expect(result.messages[1].content).toBe("AI response");
  });

  it("should handle proposal section updates", async () => {
    // Create a graph with our state annotation
    const graph = new StateGraph({
      channels: ProposalStateAnnotation
    });
    
    // Create a node that adds a section
    const addSectionNode = async (state: ProposalState) => {
      return { 
        proposalSections: { 
          introduction: {
            name: "introduction",
            content: "This is the introduction",
            status: "pending",
            version: 1,
            lastUpdated: new Date().toISOString()
          }
        } 
      };
    };
    
    // Add node to graph
    graph.addNode("add_section", addSectionNode);
    graph.setEntryPoint("add_section");
    
    // Compile graph
    const app = graph.compile();
    
    // Run graph and get updated state
    const result = await app.invoke({});
    
    // Check that section was added
    expect(Object.keys(result.proposalSections)).toHaveLength(1);
    expect(result.proposalSections.introduction).toBeDefined();
    expect(result.proposalSections.introduction.content).toBe("This is the introduction");
  });

  it("should validate state with Zod schema", () => {
    // Create valid state
    const validState = {
      messages: [new HumanMessage("Test")],
      rfpDocument: "RFP content",
      connectionPairs: [
        {
          id: "cp1",
          applicantStrength: "Strength",
          funderNeed: "Need",
          alignmentRationale: "Rationale",
          confidenceScore: 0.8
        }
      ],
      proposalSections: {
        introduction: {
          name: "introduction",
          content: "Content",
          status: "pending",
          version: 1,
          lastUpdated: new Date().toISOString()
        }
      },
      currentPhase: "research",
      metadata: {
        createdAt: new Date().toISOString()
      }
    };
    
    // Parse with the schema
    const result = ProposalStateSchema.safeParse(validState);
    
    // Check that validation passed
    expect(result.success).toBe(true);
  });

  it("should reject invalid state with Zod schema", () => {
    // Create invalid state
    const invalidState = {
      messages: [new HumanMessage("Test")],
      rfpDocument: "RFP content",
      // Invalid connection pair missing required fields
      connectionPairs: [
        {
          id: "cp1"
        }
      ],
      // Invalid phase
      currentPhase: "invalid_phase",
      metadata: {
        createdAt: new Date().toISOString()
      }
    };
    
    // Parse with the schema
    const result = ProposalStateSchema.safeParse(invalidState);
    
    // Check that validation failed
    expect(result.success).toBe(false);
  });
});