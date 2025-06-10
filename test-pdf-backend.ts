#!/usr/bin/env tsx
import { serverSupabase } from "./apps/backend/lib/supabase/client.js";
import { parseRfpFromBuffer } from "./apps/backend/lib/parsers/rfp.js";

async function testPdfInBackend() {
  try {
    console.log("🔍 Testing PDF parsing in backend context...");

    // Download the actual file
    const { data, error } = await serverSupabase.storage
      .from("proposal-documents")
      .download(
        "146e788b-70dd-4079-ac9a-5d3253ff4a11/Race Equity RFP - 280125.pdf"
      );

    if (error || !data) {
      console.error("❌ Failed to download file:", error?.message);
      return;
    }

    console.log("✅ File downloaded successfully");
    console.log("📄 File size:", data.size);

    // Convert to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("🔄 Converting to buffer...");
    console.log("📊 Buffer length:", buffer.length);
    console.log("📊 Buffer type:", buffer.constructor.name);

    // Test parsing
    console.log("🔄 Testing parseRfpFromBuffer...");
    const result = await parseRfpFromBuffer(
      buffer,
      "pdf",
      "Race Equity RFP - 280125.pdf"
    );

    console.log("✅ Parse result:");
    console.log("📊 Text length:", result.text.length);
    console.log("📄 Text preview:", result.text.substring(0, 200));
    console.log(
      "❓ Is mock content?",
      result.text.includes("mock PDF content generated for development")
    );

    if (result.text.includes("Race Equity")) {
      console.log("🎉 SUCCESS: Found real RFP content!");
    } else {
      console.log("❌ FAILURE: Still getting mock content");
    }
  } catch (error) {
    console.error("❌ Error testing PDF parsing:", error);
  }
}

testPdfInBackend();
