// Import required dependencies
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth";

// Base URL for the backend API
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:3001";

/**
 * This route file handles the /api/rfp/threads endpoint:
 * - GET: List all threads for the current user
 *
 * For development, it returns mock data when the backend is not available.
 */

// Mock data for development
const MOCK_THREADS = [
  {
    threadId: "thread_123",
    rfpId: "rfp_123",
    createdAt: new Date().toISOString(),
  },
  {
    threadId: "thread_456",
    rfpId: "rfp_456",
    createdAt: new Date().toISOString(),
  },
];

// GET /api/rfp/threads - List all threads for the current user
export async function GET(request: NextRequest) {
  try {
    // Get the session
    const sessionResult = await getSession();
    if (!sessionResult.success || !sessionResult.data?.session?.access_token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const accessToken = sessionResult.data.session.access_token;

    // Try to forward to backend API
    try {
      // Forward to backend API
      const response = await fetch(`${BACKEND_API_URL}/api/rfp/threads`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        // Set a short timeout to fail fast if backend is not available
        signal: AbortSignal.timeout(3000),
      });

      // Handle response
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch threads");
      }

      return NextResponse.json(data);
    } catch (error) {
      // If backend is unavailable, return mock data
      console.warn("Backend unavailable, returning mock data:", error);
      return NextResponse.json({ threads: MOCK_THREADS });
    }
  } catch (error) {
    console.error("Error proxying threads request:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
