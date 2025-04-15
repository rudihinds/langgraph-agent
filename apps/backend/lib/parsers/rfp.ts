import pdf from "pdf-parse";
import mammoth from "mammoth";
// import { Logger } from '../../../../apps/web/src/lib/logger/index.js';

// const logger = Logger.getInstance();
const logger = {
  debug: (..._args: any[]) => {},
  info: (..._args: any[]) => {},
  warn: (..._args: any[]) => {},
  error: (..._args: any[]) => {},
}; // Mock logger implementation

// Custom Error for unsupported types
export class UnsupportedFileTypeError extends Error {
  constructor(fileType: string) {
    super(`Unsupported file type: ${fileType}`);
    this.name = "UnsupportedFileTypeError";
  }
}

// Custom Error for parsing issues
export class ParsingError extends Error {
  constructor(fileType: string, originalError?: Error) {
    super(
      `Failed to parse ${fileType} file.${originalError ? ` Reason: ${originalError.message}` : ""}`
    );
    this.name = "ParsingError";
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

interface ParsedDocument {
  text: string;
  metadata: Record<string, any>;
  // sections?: Array<{ title?: string; content: string }>; // Future enhancement?
}

/**
 * Parses text content and metadata from a Buffer representing an RFP document.
 * Supports PDF, DOCX, and TXT file types.
 *
 * @param buffer The file content as a Buffer.
 * @param fileType The determined file type (e.g., 'pdf', 'docx', 'txt'). Case-insensitive.
 * @param filePath Optional path of the original file for metadata purposes.
 * @returns A promise resolving to an object containing the extracted text and metadata.
 * @throws {UnsupportedFileTypeError} If the fileType is not supported.
 * @throws {ParsingError} If parsing fails for a supported type.
 */
export async function parseRfpFromBuffer(
  buffer: Buffer,
  fileType: string,
  filePath?: string
): Promise<{ text: string; metadata: Record<string, any> }> {
  const lowerCaseFileType = fileType.toLowerCase();
  logger.debug(
    `Attempting to parse buffer for file type: ${lowerCaseFileType}`,
    { filePath }
  );

  if (lowerCaseFileType === "pdf") {
    try {
      // pdf-parse is mocked in tests
      const data = await pdf(buffer);
      const metadata: Record<string, any> = {
        format: "pdf",
        info: data.info, // PDF specific metadata
        metadata: data.metadata, // PDF specific metadata (e.g., XML)
        numPages: data.numpages,
        filePath, // Include original path if provided
      };
      // Add common metadata fields if they exist
      if (data.info?.Title) metadata.title = data.info.Title;
      if (data.info?.Author) metadata.author = data.info.Author;
      if (data.info?.Subject) metadata.subject = data.info.Subject;
      if (data.info?.Keywords) metadata.keywords = data.info.Keywords;
      if (data.info?.CreationDate)
        metadata.creationDate = data.info.CreationDate;
      if (data.info?.ModDate) metadata.modificationDate = data.info.ModDate;

      logger.info(`Successfully parsed PDF`, {
        filePath,
        pages: data.numpages,
      });
      if (!data.text?.trim()) {
        logger.warn(`Parsed PDF text content is empty or whitespace`, {
          filePath,
        });
      }
      return { text: data.text || "", metadata };
    } catch (error: any) {
      logger.error(`Failed to parse PDF`, { filePath, error: error.message });
      throw new ParsingError("pdf", error);
    }
  } else if (lowerCaseFileType === "docx") {
    try {
      // mammoth is mocked in tests
      const result = await mammoth.extractRawText({ buffer });
      const metadata = {
        format: "docx",
        filePath,
      };
      logger.info(`Successfully parsed DOCX`, { filePath });
      if (!result.value?.trim()) {
        logger.warn(`Parsed DOCX text content is empty or whitespace`, {
          filePath,
        });
      }
      // Note: mammoth doesn't easily expose standard metadata like author, title etc.
      return { text: result.value || "", metadata };
    } catch (error: any) {
      logger.error(`Failed to parse DOCX`, { filePath, error: error.message });
      throw new ParsingError("docx", error);
    }
  } else if (lowerCaseFileType === "txt") {
    try {
      const text = buffer.toString("utf-8");
      const metadata = {
        format: "txt",
        filePath,
      };
      logger.info(`Successfully parsed TXT`, { filePath });
      if (!text.trim()) {
        logger.warn(`Parsed TXT content is empty or whitespace`, { filePath });
      }
      return { text, metadata };
    } catch (error: any) {
      logger.error(`Failed to parse TXT (toString failed)`, {
        filePath,
        error: error.message,
      });
      throw new ParsingError("txt", error);
    }
  } else {
    logger.warn(`Unsupported file type encountered: ${fileType}`, { filePath });
    throw new UnsupportedFileTypeError(fileType);
  }
}

// --- Helper Functions ---

async function parsePdf(buffer: ArrayBuffer): Promise<ParsedDocument> {
  // pdf-parse expects a Buffer
  const nodeBuffer = Buffer.from(buffer);
  const data = await pdf(nodeBuffer);
  return {
    text: data.text || "",
    metadata: {
      pdfVersion: data.version,
      pageCount: data.numpages,
      info: data.info, // Author, Title, etc.
    },
  };
}

async function parseDocx(buffer: ArrayBuffer): Promise<ParsedDocument> {
  // mammoth works directly with ArrayBuffer
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  return {
    text: value || "",
    metadata: {
      // mammoth focuses on text extraction, less metadata
    },
  };
}

function parseTxt(buffer: ArrayBuffer): ParsedDocument {
  const decoder = new TextDecoder("utf-8"); // Assume UTF-8 for text files
  const text = decoder.decode(buffer);
  return {
    text: text || "",
    metadata: {},
  };
}
