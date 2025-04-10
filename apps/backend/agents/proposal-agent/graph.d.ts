import { CompiledGraph } from "@langchain/langgraph";
import { ProposalState } from "./state";

/**
 * The main compiled graph for the proposal agent
 */
export declare const graph: CompiledGraph;

/**
 * Example function to run the proposal agent
 * @param query Initial user query
 * @returns Final state after workflow execution
 */
export declare function runProposalAgent(query: string): Promise<ProposalState>;