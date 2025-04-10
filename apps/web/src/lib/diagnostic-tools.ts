"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

/**
 * Diagnostic function to check Supabase storage configuration
 */
export async function checkSupabaseStorage() {
  console.log("[DIAGNOSTIC] Starting storage check");

  try {
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    if (!supabase) {
      return { error: "Failed to create Supabase client" };
    }

    // Check auth status
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const isAuthenticated = !!session?.user;

    // List buckets
    const { data: buckets, error: bucketsError } =
      await supabase.storage.listBuckets();

    if (bucketsError) {
      return {
        error: `Error listing buckets: ${bucketsError.message}`,
        isAuthenticated,
      };
    }

    // Check for proposal-documents bucket
    const targetBucket = "proposal-documents";
    const bucketExists = buckets?.some((b) => b.name === targetBucket);

    return {
      success: true,
      isAuthenticated,
      buckets: buckets?.map((b) => b.name) || [],
      bucketExists,
      userId: session?.user?.id,
    };
  } catch (error) {
    return {
      error: `Storage check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Try a simple upload test to the Supabase storage
 */
export async function testUpload() {
  console.log("[DIAGNOSTIC] Starting upload test");

  try {
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    if (!supabase) {
      return { error: "Failed to create Supabase client" };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return { error: "User not authenticated" };
    }

    // Create test content
    const testContent = "Test file " + new Date().toISOString();
    const testBlob = new Blob([testContent], { type: "text/plain" });
    const testPath = `test-${Date.now()}.txt`;

    // Try to upload
    const { data, error } = await supabase.storage
      .from("proposal-documents")
      .upload(testPath, testBlob);

    if (error) {
      return { error: `Upload failed: ${error.message}` };
    }

    return {
      success: true,
      path: data.path,
      message: "Test upload successful",
    };
  } catch (error) {
    return {
      error: `Upload test failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
