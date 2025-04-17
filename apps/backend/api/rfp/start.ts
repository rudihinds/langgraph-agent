import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Logger } from "../../lib/logger.js";
import { OrchestratorService } from "../../services/orchestrator.service.js";
import { createProposalAgentWithCheckpointer } from "../../agents/proposal-agent/graph.js";

// Initialize logger
const logger = Logger.getInstance();

// Schema for RFP start request
const startRfpSchema = z.object({
  userId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  sections: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
});

/**
 * API handler to start proposal generation
 *
 * This endpoint initiates the proposal generation process
 * for a given RFP description.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const data = await request.json();
    logger.info(`Received start request for RFP: ${data.title}`);

    const result = startRfpSchema.safeParse(data);

    if (!result.success) {
      logger.warn(`Invalid request data: ${result.error.message}`);
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    const { userId, title, description, sections, requirements } = result.data;

    // Create graph with appropriate checkpointer
    const graph = createProposalAgentWithCheckpointer(userId);
    const orchestratorService = new OrchestratorService(
      graph,
      graph.checkpointer
    );

    // Start the proposal generation
    const { threadId, state } =
      await orchestratorService.startProposalGeneration({
        title,
        description,
        sections,
        requirements,
        userId,
      });

    logger.info(`Started proposal generation with threadId: ${threadId}`);

    return NextResponse.json({
      threadId,
      state,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error starting proposal generation: ${errorMessage}`);

    return NextResponse.json(
      { error: `Failed to start proposal generation: ${errorMessage}` },
      { status: 500 }
    );
  }
}
