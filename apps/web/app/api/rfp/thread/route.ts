// Import required dependencies
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth-client";

// Base URL for the backend API
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:3001";

/**
 * This route file serves as a proxy for RFP thread API requests.
 * It forwards requests to the backend API and handles authentication.
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

// GET /api/rfp/thread - Get all threads for the current user
export async function GET(request: NextRequest) {
  try {
    // Get the session
    const session = await getSession();
    if (!session?.access_token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Try to forward to backend API
    try {
      const response = await fetch(`${BACKEND_API_URL}/api/rfp/threads`, {
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
        throw new Error(data.message || "Failed to fetch threads");
      }

      return NextResponse.json(data);
    } catch (error) {
      // If backend is unavailable, return mock data
      console.warn("Backend unavailable, returning mock data:", error);
      return NextResponse.json({ threads: MOCK_THREADS });
    }
  } catch (error) {
    console.error("Error proxying thread request:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/rfp/thread - Create a new thread for an RFP
export async function POST(request: NextRequest) {
  try {
    // Get the session
    const session = await getSession();
    if (!session?.access_token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();

    // Try to forward to backend API
    try {
      const response = await fetch(`${BACKEND_API_URL}/api/rfp/thread`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
        // Set a short timeout to fail fast if backend is not available
        signal: AbortSignal.timeout(3000),
      });

      // Handle response
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create thread");
      }

      return NextResponse.json(data);
    } catch (error) {
      // If backend is unavailable, return mock data
      console.warn("Backend unavailable, returning mock data:", error);

      // Generate a new thread ID based on rfpId
      const rfpId = body.rfpId || "unknown";
      const threadId = `thread_${rfpId}_${Date.now()}`;

      return NextResponse.json({
        threadId,
        isNew: true,
      });
    }
  } catch (error) {
    console.error("Error proxying thread creation request:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
