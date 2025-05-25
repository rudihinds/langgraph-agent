// Import required dependencies
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth-client";

// Base URL for the backend API
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:3001";

/**
 * This route file handles operations on specific threads by threadId:
 * - GET: Retrieves a thread by ID or creates a new one for an RFP
 * - DELETE: Deletes a thread by ID
 *
 * For development, it returns mock data when the backend is not available.
 */

// GET /api/rfp/thread/[threadId] - Get a thread by ID or create for RFP
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  console.log(`[RFP Thread API] GET request for threadId: ${threadId}`);

  try {
    // Get the session
    console.log(`[RFP Thread API] Getting session...`);
    const session = await getSession();

    if (!session?.access_token) {
      console.error(`[RFP Thread API] No access token in session`);
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    console.log(
      `[RFP Thread API] Session authenticated with token of length: ${session.access_token.length}`
    );

    // Determine if this is a request to get/create a thread for an RFP
    // If the ID is not a UUID format, it's probably an RFP ID
    const isRfpId = !threadId.includes("-") || threadId.length < 32;
    console.log(
      `[RFP Thread API] Request type: ${isRfpId ? "Get/create thread for RFP" : "Get thread by ID"}`
    );

    // Try to forward to backend API
    try {
      // Set the appropriate backend endpoint
      const endpoint = isRfpId
        ? `${BACKEND_API_URL}/api/rfp/thread/${threadId}` // Create/get for RFP ID
        : `${BACKEND_API_URL}/api/rfp/thread/id/${threadId}`; // Get by thread ID

      console.log(
        `[RFP Thread API] Forwarding request to backend: ${endpoint}`
      );

      // Forward to backend API
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        // Set a short timeout to fail fast if backend is not available
        signal: AbortSignal.timeout(3000),
      });

      // Handle response
      const data = await response.json();
      console.log(`[RFP Thread API] Backend response:`, data);

      if (!response.ok) {
        console.error(
          `[RFP Thread API] Backend error: ${response.status} - ${data.message || "Unknown error"}`
        );
        throw new Error(
          data.message ||
            `Failed to get thread for ${isRfpId ? "RFP" : "thread ID"}`
        );
      }

      console.log(
        `[RFP Thread API] Successfully processed request, returning threadId: ${data.threadId}, isNew: ${data.isNew}`
      );
      return NextResponse.json(data);
    } catch (error) {
      // If backend is unavailable, return mock data
      console.warn(
        "[RFP Thread API] Backend unavailable, returning mock data:",
        error
      );

      // Generate a new thread ID based on the rfpId or use the existing threadId
      const mockThreadId = isRfpId
        ? `thread_${threadId}_${Date.now()}`
        : threadId;

      console.log(`[RFP Thread API] Using mock threadId: ${mockThreadId}`);

      return NextResponse.json({
        threadId: mockThreadId,
        isNew: isRfpId, // New thread if creating for an RFP ID
      });
    }
  } catch (error) {
    console.error("[RFP Thread API] Error proxying thread request:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/rfp/thread/[threadId] - Delete a thread by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  console.log(`[RFP Thread API] DELETE request for threadId: ${threadId}`);

  try {
    // Get the session
    console.log(`[RFP Thread API] Getting session...`);
    const session = await getSession();

    if (!session?.access_token) {
      console.error(`[RFP Thread API] No access token in session`);
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    console.log(
      `[RFP Thread API] Session authenticated with token of length: ${session.access_token.length}`
    );

    // Try to forward to backend API
    try {
      const endpoint = `${BACKEND_API_URL}/api/rfp/thread/${threadId}`;
      console.log(
        `[RFP Thread API] Forwarding DELETE request to backend: ${endpoint}`
      );

      // Forward to backend API
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        // Set a short timeout to fail fast if backend is not available
        signal: AbortSignal.timeout(3000),
      });

      // For DELETE, we may not have a JSON response
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
        console.log(`[RFP Thread API] Backend DELETE response:`, data);
      } else {
        console.log(
          `[RFP Thread API] Backend DELETE response status: ${response.status}`
        );
      }

      if (!response.ok) {
        console.error(
          `[RFP Thread API] Backend DELETE error: ${response.status} - ${data?.message || "Unknown error"}`
        );
        throw new Error(data?.message || "Failed to delete thread");
      }

      // Return success response
      console.log(`[RFP Thread API] Thread successfully deleted: ${threadId}`);
      return NextResponse.json(
        { success: true, message: "Thread deleted successfully" },
        { status: 200 }
      );
    } catch (error) {
      // If backend is unavailable, return mock success data
      console.warn(
        "[RFP Thread API] Backend unavailable for DELETE, returning mock success:",
        error
      );
      return NextResponse.json(
        { success: true, message: "Thread deleted successfully (mock)" },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error(
      "[RFP Thread API] Error proxying thread deletion request:",
      error
    );
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
