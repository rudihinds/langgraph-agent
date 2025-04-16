import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "../../lib/logger.js";
import { OrchestratorService } from "../../services/orchestrator.service.js";

/**
 * Schema for validating the status request
 */
const StatusRequestSchema = z.object({
  threadId: z.string(),
});

/**
 * API handler for checking the status of HITL interrupts
 *
 * This endpoint provides detailed information about the current interrupt
 * status including the reason for interruption, content being evaluated,
 * and any evaluation results
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get the URL to extract parameters
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json(
        { error: "Missing required parameter: threadId" },
        { status: 400 }
      );
    }

    logger.info(`Checking interrupt status for thread ${threadId}`);

    // Create OrchestratorService instance
    const orchestratorService = new OrchestratorService();

    // Check if the thread is currently interrupted
    const isInterrupted = await orchestratorService.detectInterrupt(threadId);

    if (!isInterrupted) {
      logger.info(`No active interrupt found for thread ${threadId}`);
      return NextResponse.json({
        interrupted: false,
        message: "No active interrupt found for this thread",
      });
    }

    // Get detailed interrupt information
    const interruptDetails =
      await orchestratorService.getInterruptDetails(threadId);

    logger.info(
      `Retrieved interrupt details for thread ${threadId}: ${interruptDetails?.reason}`
    );

    // Return the interrupt details
    return NextResponse.json({
      interrupted: true,
      details: interruptDetails,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error checking interrupt status: ${errorMessage}`);

    return NextResponse.json(
      { error: `Failed to check interrupt status: ${errorMessage}` },
      { status: 500 }
    );
  }
}
