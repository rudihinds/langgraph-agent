import { Buffer } from "buffer";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { Logger } from "../../logger.js";

// Set the worker source path
const WORKER_SRC = "pdfjs-dist/legacy/build/pdf.worker.mjs";

// Define PDF.js worker source
if (typeof window === "undefined") {
  // In Node.js environments
  (pdfjsLib as any).GlobalWorkerOptions = {};
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = WORKER_SRC;
}

export interface ParsedDocument {
  text: string;
  metadata?: Record<string, any>;
}

/**
 * Parse an RFP document from a buffer
 *
 * @param buffer - The document buffer
 * @param fileType - The MIME type of the document
 * @returns The extracted text from the document
 */
export async function parseRfpDocument(
  buffer: Buffer,
  fileType?: string
): Promise<string> {
  try {
    Logger.getInstance().info(
      `Parsing document with fileType: ${fileType || "unknown"}`
    );

    if (!fileType) {
      // If no file type, try to detect from buffer or assume text
      return buffer.toString("utf-8");
    }

    // Handle different file types
    if (fileType.includes("pdf")) {
      return await parsePdfDocument(buffer);
    } else if (
      fileType.includes("text") ||
      fileType.includes("plain") ||
      fileType.includes("markdown") ||
      fileType.includes("md")
    ) {
      return buffer.toString("utf-8");
    } else if (
      fileType.includes("docx") ||
      fileType.includes("doc") ||
      fileType.includes("word")
    ) {
      // For MVP, just extract text as-is
      // In a production implementation, would use a library like mammoth.js for DOCX parsing
      return buffer.toString("utf-8");
    } else {
      // Default fallback
      Logger.getInstance().warn(
        `Unsupported file type: ${fileType}, attempting text extraction`
      );
      return buffer.toString("utf-8");
    }
  } catch (error) {
    Logger.getInstance().error(
      `Error parsing RFP document: ${error instanceof Error ? error.message : String(error)}`
    );
    throw new Error(
      `Failed to parse document: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parse a PDF document using pdf.js
 *
 * @param buffer - The PDF document buffer
 * @returns The extracted text from the PDF
 */
async function parsePdfDocument(buffer: Buffer): Promise<string> {
  try {
    // Load the PDF document
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDocument = await loadingTask.promise;

    // Extract text from each page
    const textContent: string[] = [];

    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const content = await page.getTextContent();

      const items = content.items;
      let lastY;
      let text = "";

      for (const item of items) {
        if ("str" in item) {
          // Add newlines between blocks of text
          if (lastY !== undefined && lastY !== item.transform[5]) {
            text += "\n";
          }

          text += item.str;
          lastY = item.transform[5];
        }
      }

      textContent.push(text);
    }

    return textContent.join("\n\n");
  } catch (error) {
    Logger.getInstance().error(
      `Error parsing PDF: ${error instanceof Error ? error.message : String(error)}`
    );
    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parses a document buffer based on its MIME type
 * @param buffer - The document buffer
 * @param mimeType - The MIME type of the document
 * @param filename - Optional filename for logging purposes
 * @returns Promise<ParsedDocument> - The parsed document with text content
 */
export async function parseRfpFromBuffer(
  buffer: Buffer,
  mimeType: string,
  filename = "unknown"
): Promise<ParsedDocument> {
  Logger.getInstance().info(`Parsing document: ${filename} (${mimeType})`);

  try {
    switch (true) {
      case mimeType.includes("pdf"):
        return await parsePdfBuffer(buffer);
      case mimeType.includes("text"):
        return parseTextBuffer(buffer);
      case mimeType.includes("markdown"):
      case mimeType.includes("md"):
        return parseTextBuffer(buffer);
      case mimeType.includes("docx"):
      case mimeType.includes("doc"):
        // For now, throw error for unsupported formats
        // In a real implementation, we would add docx parsing
        throw new Error("Word document parsing not yet implemented");
      default:
        Logger.getInstance().error(`Unsupported document type: ${mimeType}`);
        throw new Error("Unsupported document type");
    }
  } catch (error) {
    Logger.getInstance().error(`Error parsing document ${filename}: ${error}`);
    throw error;
  }
}

/**
 * Parses a PDF buffer using PDF.js
 * @param buffer - The PDF buffer
 * @returns Promise<ParsedDocument> - The parsed PDF document
 */
async function parsePdfBuffer(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;

    Logger.getInstance().info(`PDF loaded with ${pdf.numPages} pages`);

    let fullText = "";

    // Process each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      // Extract text strings and join with spaces
      const pageText = content.items.map((item: any) => item.str).join(" ");

      fullText += pageText + "\n\n";
    }

    return {
      text: fullText.trim(),
      metadata: {
        pageCount: pdf.numPages,
      },
    };
  } catch (error) {
    Logger.getInstance().error(`Failed to parse PDF: ${error}`);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Parses a text buffer
 * @param buffer - The text buffer
 * @returns ParsedDocument - The parsed text document
 */
function parseTextBuffer(buffer: Buffer): ParsedDocument {
  try {
    const text = buffer.toString("utf8");
    return {
      text,
      metadata: {
        charCount: text.length,
        wordCount: text.split(/\s+/).length,
      },
    };
  } catch (error) {
    Logger.getInstance().error(`Failed to parse text: ${error}`);
    throw new Error(`Failed to parse text: ${error.message}`);
  }
}
