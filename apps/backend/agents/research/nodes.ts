import { HumanMessage } from "@langchain/core/messages";
import { ResearchState } from "./state";
import { createDeepResearchAgent, createSolutionSoughtAgent } from "./agents";

/**
 * Document loader node
 * 
 * Loads RFP document content from a database or file system
 * and attaches it to the agent state
 */
export async function documentLoaderNode(state: ResearchState) {
  try {
    // Implementation to fetch document from database would go here
    // This is a placeholder for actual implementation
    const documentText = "Sample RFP document content";
    
    return { 
      rfpDocument: { 
        ...state.rfpDocument,
        text: documentText,
        metadata: {} 
      },
      status: { ...state.status, documentLoaded: true }
    };
  } catch (error) {
    return { 
      errors: [`Failed to load document: ${error.message}`],
      status: { ...state.status, documentLoaded: false }
    };
  }
}

/**
 * Deep research node
 * 
 * Invokes the deep research agent to analyze RFP documents
 * and extract structured information
 */
export async function deepResearchNode(state: ResearchState) {
  try {
    // Create and invoke the deep research agent
    const agent = createDeepResearchAgent();
    const result = await agent.invoke({
      messages: [new HumanMessage(state.rfpDocument.text)]
    });
    
    // Parse the JSON response from the agent
    const lastMessage = result.messages[result.messages.length - 1];
    const jsonContent = JSON.parse(lastMessage.content as string);
    
    return { 
      deepResearchResults: jsonContent,
      status: { ...state.status, researchComplete: true },
      messages: [...state.messages, ...result.messages]
    };
  } catch (error) {
    return { 
      errors: [`Failed to perform deep research: ${error.message}`],
      status: { ...state.status, researchComplete: false }
    };
  }
}

/**
 * Solution sought node
 * 
 * Invokes the solution sought agent to identify what 
 * the funder is seeking based on research results
 */
export async function solutionSoughtNode(state: ResearchState) {
  try {
    // Create a message combining document text and research results
    const message = `RFP Text: ${state.rfpDocument.text}\n\nResearch Results: ${JSON.stringify(state.deepResearchResults)}`;
    
    // Create and invoke the solution sought agent
    const agent = createSolutionSoughtAgent();
    const result = await agent.invoke({
      messages: [new HumanMessage(message)]
    });
    
    // Parse the JSON response from the agent
    const lastMessage = result.messages[result.messages.length - 1];
    const jsonContent = JSON.parse(lastMessage.content as string);
    
    return { 
      solutionSoughtResults: jsonContent,
      status: { ...state.status, solutionAnalysisComplete: true },
      messages: [...state.messages, ...result.messages]
    };
  } catch (error) {
    return { 
      errors: [`Failed to analyze solution sought: ${error.message}`],
      status: { ...state.status, solutionAnalysisComplete: false }
    };
  }
}