#!/usr/bin/env tsx

async function testPdfImport() {
  try {
    console.log("🔍 Testing pdf-parse import...");
    const pdfParse = await import("pdf-parse");
    console.log("✅ pdf-parse imported successfully");
    console.log("📦 Has default export:", !!pdfParse.default);
    console.log("📦 Type of default:", typeof pdfParse.default);
  } catch (error) {
    console.log("❌ pdf-parse import failed:", error);
  }
}

testPdfImport();
