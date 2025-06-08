#!/usr/bin/env tsx
import { ProposalDocumentService } from "./apps/backend/lib/db/proposal-documents.js";

async function checkDbState() {
  try {
    console.log("🔍 Checking current database state...");

    const doc = await ProposalDocumentService.getByProposalId(
      "146e788b-70dd-4079-ac9a-5d3253ff4a11"
    );

    if (!doc) {
      console.log("❌ Document not found");
      return;
    }

    console.log("📄 Document state:");
    console.log("- ID:", doc.id);
    console.log("- File name:", doc.file_name);
    console.log("- Parsing status:", doc.parsing_status);
    console.log("- Parsed text length:", doc.parsed_text?.length || 0);
    console.log("- Parsed text is null?", doc.parsed_text === null);
    console.log("- Parsed text is empty?", doc.parsed_text === "");
    console.log(
      "- Is mock content?",
      doc.parsed_text?.includes("mock PDF content generated for development") ||
        false
    );

    if (doc.parsed_text) {
      console.log(
        "- Content preview:",
        doc.parsed_text.substring(0, 100) + "..."
      );
    }
  } catch (error) {
    console.error("❌ Error checking database state:", error);
  }
}

checkDbState();
