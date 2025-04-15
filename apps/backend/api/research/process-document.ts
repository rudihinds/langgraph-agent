import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import {
  invokeResearchAgent,
  executeResearchWorkflow,
  createOrchestrator,
} from "../../agents/index.js";
import { getServerSession } from "../../lib/auth.js";
import { Logger } from "@/lib/logger.js";

// Initialize logger
const logger = Logger.getInstance();

// Schema for validating request body
const requestSchema = z.object({
  documentId: z.string().min(1),
  useOrchestrator: z.boolean().optional().default(false),
  threadId: z.string().optional(),
});

/**
 * API route handler for processing RFP documents
 *
 * This handler can process a document either directly through the research agent
 * or through the orchestrator workflow
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user session
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the request body
    const body = await req.json();

    try {
      const { documentId, useOrchestrator, threadId } =
        requestSchema.parse(body);

      logger.info("Processing document request received", {
        documentId,
        useOrchestrator,
        userId: session.user.id,
      });

      if (useOrchestrator) {
        // Process through orchestrator workflow
        const orchestrator = await createOrchestrator({
          userId: session.user.id,
          projectId: "default", // Could be extracted from document metadata
          threadId,
        });

        const result = await executeResearchWorkflow(orchestrator, documentId);

        return NextResponse.json({
          success: true,
          threadId: result.threadId,
          status: result.status,
          rfpAnalysis: result.research?.rfpAnalysis,
          solutionSought: result.research?.solutionSought,
        });
      } else {
        // Process directly through research agent
        const result = await invokeResearchAgent({
          documentId,
          threadId,
        });

        return NextResponse.json({
          success: true,
          status: result.status,
          rfpDocument: {
            id: result.rfpDocument.id,
            metadata: result.rfpDocument.metadata,
          },
          researchResults: {
            // These would be populated when the research agent completes
            deepResearch: result.deepResearch,
            solutionSought: result.solutionSought,
          },
        });
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json({ error: error.errors }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    logger.error("Error processing document", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "An error occurred while processing the document" },
      { status: 500 }
    );
  }
}
