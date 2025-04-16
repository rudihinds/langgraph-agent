import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "../../lib/logger.js";
import { OrchestratorService } from "../../services/orchestrator.service.js";

/**
 * Schema for validating the resume request
 */
const ResumeRequestSchema = z.object({
  threadId: z.string(),
});

/**
 * API handler for resuming graph execution after feedback has been processed
 *
 * This endpoint instructs the graph to resume processing after a HITL interrupt
 * has been addressed with user feedback
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse the JSON request
    const body = await request.json();

    // Validate the request against the schema
    const validationResult = ResumeRequestSchema.safeParse(body);

    if (!validationResult.success) {
      logger.error(
        `Invalid resume request: ${JSON.stringify(validationResult.error.format())}`
      );
      return NextResponse.json(
        {
          error: "Invalid resume request",
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    // Extract validated data
    const { threadId } = validationResult.data;

    logger.info(
      `Resuming graph execution for thread ${threadId} after feedback`
    );

    // Create OrchestratorService instance
    const orchestratorService = new OrchestratorService();

    // Resume the graph execution
    await orchestratorService.resumeAfterFeedback(threadId);

    logger.info(`Successfully resumed graph execution for thread ${threadId}`);

    // Return success response
    return NextResponse.json({
      success: true,
      message: "Graph execution resumed successfully",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error resuming graph execution: ${errorMessage}`);

    return NextResponse.json(
      { error: `Failed to resume graph execution: ${errorMessage}` },
      { status: 500 }
    );
  }
}
