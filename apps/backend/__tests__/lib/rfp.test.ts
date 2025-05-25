import { parseRfpDocument, parseRfpFromBuffer } from "../rfp";
import { vi, describe, expect, test, beforeEach } from "vitest";

// Mock the PDF.js module
vi.mock("pdfjs-dist/legacy/build/pdf.js", () => {
  return {
    getDocument: vi.fn().mockImplementation(() => {
      const mockPdfDocument = {
        numPages: 2,
        getPage: vi.fn().mockImplementation(() => {
          return Promise.resolve({
            getTextContent: vi.fn().mockImplementation(() => {
              return Promise.resolve({
                items: [
                  { str: "Page 1 content" },
                  { str: "with more" },
                  { str: "text here." },
                ],
              });
            }),
          });
        }),
      };

      return {
        promise: Promise.resolve(mockPdfDocument),
      };
    }),
  };
});

// Mock the logger
vi.mock("../../../logger.js", () => {
  return {
    Logger: {
      getInstance: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      }),
    },
  };
});

// Get the mocked modules for type-safe mocking
const pdfjsLib = await vi.importMock("pdfjs-dist/legacy/build/pdf.js");
const loggerModule = await vi.importMock("../../../logger.js");
const mockLogger = loggerModule.Logger.getInstance();

describe("RFP Document Parser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should parse text documents correctly", async () => {
    // Setup
    const textContent = "Test RFP document content";
    const buffer = Buffer.from(textContent);

    // Execute
    const result = await parseRfpDocument(buffer, "text/plain");

    // Verify - parseRfpDocument returns a string
    expect(result).toBe(textContent);
    expect(mockLogger.info).toHaveBeenCalled();
  });

  test("should parse markdown documents correctly", async () => {
    // Setup
    const markdownContent = "# RFP Title\n\nThis is a test RFP";
    const buffer = Buffer.from(markdownContent);

    // Execute
    const result = await parseRfpDocument(buffer, "text/markdown");

    // Verify
    expect(result).toBe(markdownContent);
    expect(mockLogger.info).toHaveBeenCalled();
  });

  test("should attempt to parse PDF documents", async () => {
    // Setup
    const pdfBuffer = Buffer.from("Mock PDF content");

    // Execute
    const result = await parseRfpDocument(pdfBuffer, "application/pdf");

    // Verify
    expect(pdfjsLib.getDocument).toHaveBeenCalled();
    expect(result).toContain("Page 1 content");
    expect(result).toContain("with more");
    expect(result).toContain("text here");
    expect(mockLogger.info).toHaveBeenCalled();
  });

  test("should handle PDF parsing errors gracefully", async () => {
    // Setup
    const pdfBuffer = Buffer.from("Mock PDF content");
    vi.spyOn(pdfjsLib, "getDocument").mockImplementationOnce(() => {
      return {
        promise: Promise.reject(new Error("PDF parsing error")),
      };
    });

    // Execute & Verify
    await expect(
      parseRfpDocument(pdfBuffer, "application/pdf")
    ).rejects.toThrow("Failed to parse PDF: PDF parsing error");
    expect(mockLogger.error).toHaveBeenCalled();
  });

  test("should handle unknown file types by falling back to text extraction", async () => {
    // Setup
    const content = "Some content";
    const buffer = Buffer.from(content);

    // Execute
    const result = await parseRfpDocument(buffer, "application/unknown");

    // Verify
    expect(result).toContain(content);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  test("should handle missing file types", async () => {
    // Setup
    const content = "Some content";
    const buffer = Buffer.from(content);

    // Execute
    const result = await parseRfpDocument(buffer, undefined);

    // Verify
    expect(result).toContain(content);
    expect(mockLogger.info).toHaveBeenCalled();
  });
});

describe("parseRfpFromBuffer Function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should parse a PDF document correctly", async () => {
    // Arrange
    const buffer = Buffer.from("mock pdf content");
    const mimeType = "application/pdf";

    // Act
    const result = await parseRfpFromBuffer(buffer, mimeType);

    // Assert
    expect(pdfjsLib.getDocument).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.text).toContain("Page 1 content");
    expect(result.metadata).toHaveProperty("pageCount");
  });

  test("should parse a text document correctly", async () => {
    // Arrange
    const testText = "This is a test document content";
    const buffer = Buffer.from(testText);
    const mimeType = "text/plain";

    // Act
    const result = await parseRfpFromBuffer(buffer, mimeType);

    // Assert
    expect(result).toBeDefined();
    expect(result.text).toBe(testText);
    expect(result.metadata).toHaveProperty("charCount", testText.length);
  });

  test("should parse a markdown document correctly", async () => {
    // Arrange
    const markdownContent = "# RFP Title\n\nThis is a test RFP";
    const buffer = Buffer.from(markdownContent);
    const mimeType = "text/markdown";

    // Act
    const result = await parseRfpFromBuffer(buffer, mimeType);

    // Assert
    expect(result).toBeDefined();
    expect(result.text).toBe(markdownContent);
    expect(result.metadata).toHaveProperty("charCount", markdownContent.length);
  });

  test("should throw an error for unsupported document types", async () => {
    // Arrange
    const buffer = Buffer.from("mock content");
    const mimeType = "application/unknown";

    // Act & Assert
    await expect(parseRfpFromBuffer(buffer, mimeType)).rejects.toThrow(
      "Unsupported document type"
    );
  });

  test("should throw an error when PDF parsing fails", async () => {
    // Arrange
    const buffer = Buffer.from("mock pdf content");
    const mimeType = "application/pdf";

    // Mock PDF.js to throw an error
    vi.spyOn(pdfjsLib, "getDocument").mockImplementationOnce(() => ({
      promise: Promise.reject(new Error("PDF parsing failed")),
    }));

    // Act & Assert
    await expect(parseRfpFromBuffer(buffer, mimeType)).rejects.toThrow(
      "Failed to parse PDF: PDF parsing failed"
    );
  });
});
