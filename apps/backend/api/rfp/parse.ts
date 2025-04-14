import { NextRequest, NextResponse } from "next/server";
import { parseRfpFromBuffer } from "../../lib/parsers/rfp.js";
import { logger } from "../../logger.js";
import { z } from "zod";

/**
 * Schema for validating the file upload request
 */
const UploadRequestSchema = z.object({
  file: z.instanceof(Blob),
  filename: z.string(),
  mimeType: z.string(),
});

/**
 * API handler for parsing RFP documents from the frontend
 *
 * This endpoint accepts multipart form data with a file and processes it
 * with the appropriate parser based on MIME type.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get the FormData from the request
    const formData = await request.formData();

    // Extract the file, filename, and mimeType
    const file = formData.get("file") as Blob | null;
    const filename = formData.get("filename") as string | null;
    const mimeType = formData.get("mimeType") as string | null;

    // Validate the request
    if (!file || !filename || !mimeType) {
      return NextResponse.json(
        { error: "Missing required fields: file, filename, or mimeType" },
        { status: 400 }
      );
    }

    logger.info(`Processing RFP document upload: ${filename} (${mimeType})`);

    // Convert the file to a buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse the document
    const result = await parseRfpFromBuffer(buffer, mimeType, filename);

    logger.info(
      `Successfully parsed document: ${filename}, result size: ${result.text.length} chars`
    );

    // Return the parsed document
    return NextResponse.json({
      text: result.text,
      metadata: {
        filename,
        mimeType,
        ...result.metadata,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error parsing RFP document: ${errorMessage}`);

    return NextResponse.json(
      { error: `Failed to parse document: ${errorMessage}` },
      { status: 500 }
    );
  }
}
