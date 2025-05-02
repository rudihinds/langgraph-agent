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

interface Params {
  params: {
    threadId: string;
  };
}

// GET /api/rfp/thread/[threadId] - Get a thread by ID or create for RFP
export async function GET(request: NextRequest, { params }: Params) {
  try {
    // Get the session
    const session = await getSession();
    if (!session?.access_token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = params;

    // Determine if this is a request to get/create a thread for an RFP
    // If the ID is not a UUID format, it's probably an RFP ID
    const isRfpId = !threadId.includes("-") || threadId.length < 32;

    // Try to forward to backend API
    try {
      // Set the appropriate backend endpoint
      const endpoint = isRfpId
        ? `${BACKEND_API_URL}/api/rfp/thread/${threadId}` // Create/get for RFP ID
        : `${BACKEND_API_URL}/api/rfp/thread/id/${threadId}`; // Get by thread ID

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

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Failed to get thread for ${isRfpId ? "RFP" : "thread ID"}`
        );
      }

      return NextResponse.json(data);
    } catch (error) {
      // If backend is unavailable, return mock data
      console.warn("Backend unavailable, returning mock data:", error);

      // Generate a new thread ID based on the rfpId or use the existing threadId
      const mockThreadId = isRfpId
        ? `thread_${threadId}_${Date.now()}`
        : threadId;

      return NextResponse.json({
        threadId: mockThreadId,
        isNew: isRfpId, // New thread if creating for an RFP ID
      });
    }
  } catch (error) {
    console.error("Error proxying thread request:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/rfp/thread/[threadId] - Delete a thread by ID
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    // Get the session
    const session = await getSession();
    if (!session?.access_token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = params;

    // Try to forward to backend API
    try {
      // Forward to backend API
      const response = await fetch(
        `${BACKEND_API_URL}/api/rfp/thread/${threadId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          // Set a short timeout to fail fast if backend is not available
          signal: AbortSignal.timeout(3000),
        }
      );

      // For DELETE, we may not have a JSON response
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        throw new Error(data?.message || "Failed to delete thread");
      }

      // Return success response
      return NextResponse.json(
        { success: true, message: "Thread deleted successfully" },
        { status: 200 }
      );
    } catch (error) {
      // If backend is unavailable, return mock success data
      console.warn("Backend unavailable, returning mock success:", error);
      return NextResponse.json(
        { success: true, message: "Thread deleted successfully (mock)" },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error proxying thread deletion request:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
