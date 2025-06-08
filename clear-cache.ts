#!/usr/bin/env tsx
import { ProposalDocumentService } from "./apps/backend/lib/db/proposal-documents.js";

async function clearCache() {
  try {
    console.log("🔍 Checking cached content for RFP...");

    const doc = await ProposalDocumentService.getByProposalId(
      "146e788b-70dd-4079-ac9a-5d3253ff4a11"
    );

    if (!doc) {
      console.log("❌ Document not found");
      return;
    }

    console.log("📄 Current cached content preview:");
    console.log(doc.parsed_text?.substring(0, 300) + "...");
    console.log(
      "Is mock content?",
      doc.parsed_text?.includes("mock PDF content generated for development")
    );

    // Clear the cached parsed text
    await ProposalDocumentService.updateParsedText(doc.id, null);
    console.log(
      "✅ Cleared cached parsed text - next load will re-parse from storage"
    );
  } catch (error) {
    console.error("❌ Failed to clear cache:", error);
  }
}

clearCache().catch(console.error);
