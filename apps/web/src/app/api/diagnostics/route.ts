import { checkSupabaseStorage, testUpload } from "@/lib/diagnostic-tools";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("[API] Running storage diagnostics");
    const storageResult = await checkSupabaseStorage();

    // Only run upload test if we found the bucket
    let uploadResult = null;
    if (storageResult.success && storageResult.bucketExists) {
      uploadResult = await testUpload();
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      storage: storageResult,
      upload: uploadResult,
    });
  } catch (error) {
    console.error("[API] Diagnostics error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
