#!/usr/bin/env tsx

import { ProposalDocumentService } from "../lib/db/proposal-documents.js";

async function testDocumentParsing() {
  try {
    console.log("Testing document parsing service...");

    // Get a document to test with
    const documentId = "30451355-5ee8-4aae-8370-4ffeba023fc1";

    console.log(`Fetching document ${documentId}...`);
    const document = await ProposalDocumentService.getById(documentId);

    if (!document) {
      console.error("Document not found");
      return;
    }

    console.log("Document found:", {
      id: document.id,
      fileName: document.file_name,
      filePath: document.file_path,
      parsingStatus: document.parsing_status,
    });

    console.log("Parsing document text...");
    const text = await ProposalDocumentService.getDocumentText(documentId);

    console.log("Parsing successful!");
    console.log("Text length:", text.length);
    console.log("First 200 characters:", text.substring(0, 200));

    // Verify it was saved
    const updatedDocument = await ProposalDocumentService.getById(documentId);
    console.log("Updated parsing status:", updatedDocument?.parsing_status);
    console.log(
      "Parsed text length in DB:",
      updatedDocument?.parsed_text?.length
    );
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testDocumentParsing();
