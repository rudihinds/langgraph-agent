#!/usr/bin/env tsx
import { parsePdf } from "./lib/parsers/pdf-parser.js";
import { serverSupabase } from "./lib/supabase/client.js";

async function testPdfParsing() {
  try {
    console.log("🔍 Testing PDF parsing for Race Equity RFP...");

    // Download the actual PDF file
    const { data, error } = await serverSupabase.storage
      .from("proposal-documents")
      .download(
        "146e788b-70dd-4079-ac9a-5d3253ff4a11/Race Equity RFP - 280125.pdf"
      );

    if (error) {
      console.error("❌ Storage download error:", error);
      return;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    console.log("✅ Downloaded PDF, buffer size:", buffer.length, "bytes");

    // Parse the PDF
    const result = await parsePdf(buffer);
    console.log("📄 Parse result:", {
      textLength: result.text.length,
      pages: result.numpages,
      textPreview: result.text.substring(0, 300) + "...",
      isMockContent: result.text.includes(
        "mock PDF content generated for development"
      ),
    });

    if (result.text.includes("mock PDF content generated for development")) {
      console.log(
        "⚠️  WARNING: Using mock content instead of actual PDF content!"
      );
    } else {
      console.log("✅ Successfully parsed actual PDF content");
    }
  } catch (error) {
    console.error("❌ PDF parsing test failed:", error);
  }
}

testPdfParsing().catch(console.error);
