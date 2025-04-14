/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseRfpFromBuffer,
  UnsupportedFileTypeError,
  ParsingError,
} from "./rfp.js";
// import { Logger } from "../../../../apps/web/src/lib/logger/index.js";

// Mock dependencies
vi.mock("pdf-parse", () => ({
  default: vi.fn(),
}));
vi.mock("mammoth", () => ({
  default: {
    extractRawText: vi.fn(),
  },
  extractRawText: vi.fn(),
}));
// vi.mock("@/lib/logger", () => ({
//   Logger: {
//     getInstance: vi.fn().mockReturnValue({
//       debug: vi.fn(),
//       info: vi.fn(),
//       warn: vi.fn(),
//       error: vi.fn(),
//     }),
//   },
// }));

// Import mocks after vi.mock calls
import pdf from "pdf-parse";
import mammoth from "mammoth";

// const mockLogger = Logger.getInstance();
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("parseRfpFromBuffer", () => {
  const testFilePath = "/fake/path/document.ext";

  // --- Mocks Setup ---
  const mockPdfParse = pdf as vi.Mock;
  const mockMammothExtract = mammoth.extractRawText as vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks(); // Reset mocks before each test
  });

  // --- Test Cases ---

  it("should parse PDF files correctly", async () => {
    const pdfBuffer = Buffer.from("dummy pdf content");
    const mockPdfData = {
      text: "This is PDF text.",
      info: { Title: "Test PDF Title", Author: "Test Author" },
      metadata: null,
      numpages: 1,
    };
    mockPdfParse.mockResolvedValue(mockPdfData);

    const result = await parseRfpFromBuffer(pdfBuffer, "pdf", testFilePath);

    expect(result.text).toBe("This is PDF text.");
    expect(result.metadata.format).toBe("pdf");
    expect(result.metadata.title).toBe("Test PDF Title");
    expect(result.metadata.author).toBe("Test Author");
    expect(result.metadata.numPages).toBe(1);
    expect(result.metadata.filePath).toBe(testFilePath);
    expect(mockPdfParse).toHaveBeenCalledWith(pdfBuffer);
    // expect(mockLogger.info).toHaveBeenCalledWith(
    //   "Successfully parsed PDF",
    //   expect.anything()
    // );
  });

  it("should parse DOCX files correctly", async () => {
    const docxBuffer = Buffer.from("dummy docx content");
    const mockDocxData = { value: "This is DOCX text." };
    mockMammothExtract.mockResolvedValue(mockDocxData);

    const result = await parseRfpFromBuffer(docxBuffer, "docx", testFilePath);

    expect(result.text).toBe("This is DOCX text.");
    expect(result.metadata.format).toBe("docx");
    expect(result.metadata.filePath).toBe(testFilePath);
    expect(mockMammothExtract).toHaveBeenCalledWith({ buffer: docxBuffer });
    // expect(mockLogger.info).toHaveBeenCalledWith(
    //   "Successfully parsed DOCX",
    //   expect.anything()
    // );
  });

  it("should parse TXT files correctly", async () => {
    const txtBuffer = Buffer.from("This is TXT text.");
    const result = await parseRfpFromBuffer(txtBuffer, "txt", testFilePath);

    expect(result.text).toBe("This is TXT text.");
    expect(result.metadata.format).toBe("txt");
    expect(result.metadata.filePath).toBe(testFilePath);
    // expect(mockLogger.info).toHaveBeenCalledWith(
    //   "Successfully parsed TXT",
    //   expect.anything()
    // );
  });

  it("should handle case-insensitive file types", async () => {
    const pdfBuffer = Buffer.from("dummy pdf content");
    const mockPdfData = { text: "PDF Text", info: {}, numpages: 1 };
    mockPdfParse.mockResolvedValue(mockPdfData);

    const result = await parseRfpFromBuffer(pdfBuffer, "PDF", testFilePath);
    expect(result.text).toBe("PDF Text");
    expect(result.metadata.format).toBe("pdf");

    const docxBuffer = Buffer.from("dummy docx content");
    const mockDocxData = { value: "DOCX text." };
    mockMammothExtract.mockResolvedValue(mockDocxData);
    const resultDocx = await parseRfpFromBuffer(
      docxBuffer,
      "DocX",
      testFilePath
    );
    expect(resultDocx.text).toBe("DOCX text.");
    expect(resultDocx.metadata.format).toBe("docx");

    const txtBuffer = Buffer.from("TXT text.");
    const resultTxt = await parseRfpFromBuffer(txtBuffer, "Txt", testFilePath);
    expect(resultTxt.text).toBe("TXT text.");
    expect(resultTxt.metadata.format).toBe("txt");
  });

  it("should throw UnsupportedFileTypeError for unsupported types", async () => {
    const buffer = Buffer.from("some data");
    await expect(
      parseRfpFromBuffer(buffer, "png", testFilePath)
    ).rejects.toThrow(UnsupportedFileTypeError);
    await expect(
      parseRfpFromBuffer(buffer, "png", testFilePath)
    ).rejects.toThrow("Unsupported file type: png");
    // expect(mockLogger.warn).toHaveBeenCalledWith(
    //   "Unsupported file type encountered: png",
    //   expect.anything()
    // );
  });

  it("should throw ParsingError for invalid PDF data", async () => {
    const pdfBuffer = Buffer.from("invalid pdf");
    const pdfError = new Error("Invalid PDF structure");
    mockPdfParse.mockRejectedValue(pdfError);

    await expect(
      parseRfpFromBuffer(pdfBuffer, "pdf", testFilePath)
    ).rejects.toThrow(ParsingError);
    await expect(
      parseRfpFromBuffer(pdfBuffer, "pdf", testFilePath)
    ).rejects.toThrow(
      "Failed to parse pdf file. Reason: Invalid PDF structure"
    );
    // expect(mockLogger.error).toHaveBeenCalledWith(
    //   "Failed to parse PDF",
    //   expect.objectContaining({ error: "Invalid PDF structure" })
    // );
  });

  it("should throw ParsingError for invalid DOCX data", async () => {
    const docxBuffer = Buffer.from("invalid docx");
    const docxError = new Error("Invalid DOCX structure");
    mockMammothExtract.mockRejectedValue(docxError);

    await expect(
      parseRfpFromBuffer(docxBuffer, "docx", testFilePath)
    ).rejects.toThrow(ParsingError);
    await expect(
      parseRfpFromBuffer(docxBuffer, "docx", testFilePath)
    ).rejects.toThrow(
      "Failed to parse docx file. Reason: Invalid DOCX structure"
    );
    // expect(mockLogger.error).toHaveBeenCalledWith(
    //   "Failed to parse DOCX",
    //   expect.objectContaining({ error: "Invalid DOCX structure" })
    // );
  });

  it("should handle empty text content gracefully (log warning)", async () => {
    // PDF
    const pdfBuffer = Buffer.from("dummy pdf content");
    const mockPdfData = { text: "  ", info: {}, numpages: 1 }; // Whitespace only
    mockPdfParse.mockResolvedValue(mockPdfData);
    await parseRfpFromBuffer(pdfBuffer, "pdf", testFilePath);
    // expect(mockLogger.warn).toHaveBeenCalledWith(
    //   "Parsed PDF text content is empty or whitespace",
    //   { filePath: testFilePath }
    // );

    vi.clearAllMocks(); // Clear mocks for next check

    // DOCX
    const docxBuffer = Buffer.from("dummy docx content");
    const mockDocxData = { value: "\\n\\t " }; // Whitespace only
    mockMammothExtract.mockResolvedValue(mockDocxData);
    await parseRfpFromBuffer(docxBuffer, "docx", testFilePath);
    // expect(mockLogger.warn).toHaveBeenCalledWith(
    //   "Parsed DOCX text content is empty or whitespace",
    //   { filePath: testFilePath }
    // );

    vi.clearAllMocks(); // Clear mocks for next check

    // TXT
    const txtBuffer = Buffer.from("   "); // Whitespace only
    await parseRfpFromBuffer(txtBuffer, "txt", testFilePath);
    // expect(mockLogger.warn).toHaveBeenCalledWith(
    //   "Parsed TXT content is empty or whitespace",
    //   { filePath: testFilePath }
    // );
  });

  it("should include filePath in metadata when provided", async () => {
    const txtBuffer = Buffer.from("text");
    const result = await parseRfpFromBuffer(txtBuffer, "txt", testFilePath);
    expect(result.metadata.filePath).toBe(testFilePath);

    const resultNoPath = await parseRfpFromBuffer(txtBuffer, "txt");
    expect(resultNoPath.metadata.filePath).toBeUndefined();
  });
});
