import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "../../lib/logger.js";
import { OrchestratorService } from "../../services/orchestrator.service.js";

/**
 * Schema for validating the feedback submission request
 */
const FeedbackSubmissionSchema = z.object({
  threadId: z.string(),
  feedback: z.object({
    type: z.enum(["approve", "revise", "regenerate"]),
    comments: z.string().optional(),
    specificEdits: z.record(z.any()).optional(),
    timestamp: z.string(),
  }),
});

/**
 * API handler for submitting user feedback during HITL interrupts
 *
 * This endpoint accepts user feedback for proposal content that is
 * awaiting review and updates the state with the feedback information
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse the JSON request
    const body = await request.json();

    // Validate the request against the schema
    const validationResult = FeedbackSubmissionSchema.safeParse(body);

    if (!validationResult.success) {
      logger.error(
        `Invalid feedback submission: ${JSON.stringify(validationResult.error.format())}`
      );
      return NextResponse.json(
        {
          error: "Invalid feedback submission",
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    // Extract validated data
    const { threadId, feedback } = validationResult.data;

    logger.info(
      `Processing feedback submission for thread ${threadId}: ${feedback.type}`
    );

    // Create OrchestratorService instance
    const orchestratorService = new OrchestratorService();

    // Submit the feedback and update state
    const updatedState = await orchestratorService.submitFeedback(
      threadId,
      feedback
    );

    logger.info(`Successfully processed feedback for thread ${threadId}`);

    // Return success response with updated state
    return NextResponse.json({
      success: true,
      state: {
        interruptStatus: updatedState.interruptStatus,
        processingStatus: updatedState.processingStatus,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error processing feedback submission: ${errorMessage}`);

    return NextResponse.json(
      { error: `Failed to process feedback: ${errorMessage}` },
      { status: 500 }
    );
  }
}
