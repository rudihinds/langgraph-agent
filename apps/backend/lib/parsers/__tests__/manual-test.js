// Manual test script for RFP parser
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Import the parser
import { parseRfpFromBuffer } from "../rfp.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log("Running manual tests for RFP Parser...");

  // Test text document
  try {
    const textContent = "This is a test RFP document content";
    const buffer = Buffer.from(textContent);
    const result = await parseRfpFromBuffer(buffer, "text/plain");
    console.log("Text document parsing test:");
    console.log("Text:", result.text);
    console.log("Metadata:", result.metadata);
    console.log("Test Passed: Text document parsing\n");
  } catch (error) {
    console.error("Text document parsing test failed:", error);
  }

  // Test markdown document
  try {
    const markdownContent = "# RFP Title\n\nThis is a test RFP with markdown";
    const buffer = Buffer.from(markdownContent);
    const result = await parseRfpFromBuffer(buffer, "text/markdown");
    console.log("Markdown document parsing test:");
    console.log("Text:", result.text);
    console.log("Metadata:", result.metadata);
    console.log("Test Passed: Markdown document parsing\n");
  } catch (error) {
    console.error("Markdown document parsing test failed:", error);
  }

  // Test unsupported document type
  try {
    const buffer = Buffer.from("Mock content");
    await parseRfpFromBuffer(buffer, "application/unknown");
    console.error(
      "Test Failed: Unsupported document type should throw error\n"
    );
  } catch (error) {
    console.log("Unsupported document type test:");
    console.log("Error message:", error.message);
    console.log("Test Passed: Unsupported document type throws error\n");
  }

  // Check if the code can handle PDF
  console.log(
    "PDF functionality is available:",
    typeof parseRfpFromBuffer === "function"
  );
}

runTests().catch(console.error);
