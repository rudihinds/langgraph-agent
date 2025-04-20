/**
 * Problem Statement Section Generator Node
 *
 * This node is responsible for generating the problem statement section of a proposal.
 * It uses the rfpDocument, research results, and connections to craft a compelling
 * problem statement that addresses the client's needs and challenges.
 */

import { Logger } from "@/lib/logger.js";
import {
  OverallProposalState,
  ProcessingStatus,
  SectionType,
  SectionProcessingStatus,
} from "@/state/proposal.state.js";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";

// Initialize logger
const logger = Logger.getInstance();

// Define the output schema for the problem statement generation
const problemStatementOutputSchema = z.object({
  content: z.string().describe("The formatted problem statement text"),
  keyPoints: z
    .array(z.string())
    .describe("List of key points addressed in the problem statement"),
  clientNeeds: z
    .array(z.string())
    .describe("List of specific client needs identified"),
  stakeholders: z
    .array(z.string())
    .describe("List of stakeholders affected by the problem"),
});

type ProblemStatementOutput = z.infer<typeof problemStatementOutputSchema>;

// Create a prompt template for problem statement generation
const problemStatementPromptTemplate = PromptTemplate.fromTemplate(`
You are an expert proposal writer tasked with creating a compelling problem statement section.
Your job is to clearly articulate the client's problem, its significance, and why it needs to be addressed.

## RFP DOCUMENT CONTENT
{rfpText}

## RESEARCH FINDINGS
{researchSummary}

## CONNECTION POINTS
{connectionPoints}

Based on the above information, create a comprehensive problem statement that:
1. Clearly defines the problem facing the client
2. Explains why this problem is significant
3. Describes who is affected by this problem
4. Outlines the consequences of not addressing the problem
5. Sets up the need for a solution (without describing the solution itself)

Ensure the problem statement is:
- Well-structured with clear paragraphs
- Written in a professional, third-person perspective
- Backed by evidence from the research
- Tailored to the specific client and their industry
- Between 500-800 words

Format your response as a JSON object with the following structure:
{outputFormat}
`);

/**
 * Generates a problem statement section based on RFP document and research
 *
 * @param state Current proposal state
 * @returns Updated partial state with problem statement section
 */
export async function problemStatementNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  logger.info("Starting problem statement generation", {
    threadId: state.activeThreadId,
  });

  // Create a copy of sections to modify
  const sections = new Map(state.sections);

  // Check if the problem statement section already exists and is not stale
  const existingSection = sections.get(SectionType.PROBLEM_STATEMENT);

  if (
    existingSection &&
    existingSection.status !== SectionProcessingStatus.QUEUED &&
    existingSection.status !== SectionProcessingStatus.STALE
  ) {
    logger.info(
      "Problem statement already exists and is not stale, skipping generation",
      {
        threadId: state.activeThreadId,
      }
    );

    return { sections };
  }

  try {
    // Setup the LLM model
    const model = new ChatOpenAI({
      modelName: process.env.LLM_MODEL || "gpt-4-turbo",
      temperature: 0.3,
    });

    // Extract needed information from state
    const rfpText = state.rfpDocument.text || "No RFP document available.";
    const researchSummary = state.researchResults
      ? JSON.stringify(state.researchResults, null, 2)
      : "No research results available.";
    const connectionPoints = state.connections
      ? JSON.stringify(state.connections, null, 2)
      : "No connection points available.";

    // Create output parser
    const outputParser = StructuredOutputParser.fromZodSchema(
      problemStatementOutputSchema
    );

    // Create the generation chain
    const chain = RunnableSequence.from([
      problemStatementPromptTemplate,
      model,
      outputParser,
    ]);

    // Execute the chain
    logger.info("Executing problem statement generation chain", {
      threadId: state.activeThreadId,
    });

    const result = (await chain.invoke({
      rfpText: rfpText.substring(0, 8000), // Limit size for context window
      researchSummary: researchSummary.substring(0, 3000),
      connectionPoints: connectionPoints.substring(0, 2000),
      outputFormat: outputParser.getFormatInstructions(),
    })) as ProblemStatementOutput;

    // Format the section with the generated content
    const now = new Date().toISOString();

    // Log the generation metadata and results separately
    logger.info("Problem statement generation metadata", {
      threadId: state.activeThreadId,
      model: process.env.LLM_MODEL || "gpt-4-turbo",
      timestamp: now,
      keyPoints: result.keyPoints,
      clientNeeds: result.clientNeeds,
      stakeholders: result.stakeholders,
    });

    // Create or update the problem statement section
    sections.set(SectionType.PROBLEM_STATEMENT, {
      id: SectionType.PROBLEM_STATEMENT,
      title: existingSection?.title || "Problem Statement",
      content: result.content,
      status: SectionProcessingStatus.READY_FOR_EVALUATION,
      lastUpdated: now,
    });

    logger.info("Problem statement generation completed successfully", {
      threadId: state.activeThreadId,
      contentLength: result.content.length,
      keyPointsCount: result.keyPoints.length,
    });

    // Return updated state
    return {
      sections,
      currentStep: "problem_statement_evaluation",
    };
  } catch (error) {
    // Handle errors
    logger.error("Error generating problem statement", {
      threadId: state.activeThreadId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update section with error status
    sections.set(SectionType.PROBLEM_STATEMENT, {
      id: SectionType.PROBLEM_STATEMENT,
      title: existingSection?.title || "Problem Statement",
      content: existingSection?.content || "",
      status: SectionProcessingStatus.ERROR,
      lastUpdated: new Date().toISOString(),
      lastError: error instanceof Error ? error.message : String(error),
    });

    // Return updated state with error
    return {
      sections,
      errors: [
        `Error generating problem statement: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }
}
