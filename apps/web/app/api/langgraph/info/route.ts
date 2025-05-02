import { NextResponse } from "next/server";

/**
 * GET /api/langgraph/info
 *
 * Returns information about the LangGraph server
 */
export async function GET() {
  try {
    // Get the LangGraph API URL from environment
    const langGraphApiUrl =
      process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ?? "http://localhost:2024";

    // Try to fetch server info directly from the LangGraph server
    const response = await fetch(`${langGraphApiUrl}/info`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      // Fallback to mock data if the server can't be reached
      return NextResponse.json(
        {
          version: "1.0.0",
          name: "Proposal Engine",
          status: "available",
          graphs: ["proposal_generation"],
        },
        { status: 200 }
      );
    }

    // If the LangGraph server responds, return its data
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching LangGraph info:", error);

    // Return fallback mock data in case of any error
    return NextResponse.json(
      {
        version: "1.0.0",
        name: "Proposal Engine",
        status: "available",
        graphs: ["proposal_generation"],
      },
      { status: 200 }
    );
  }
}
