import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";
import { NextRequest } from "next/server";

/**
 * API proxy for LangGraph server
 *
 * This forwards requests to the LangGraph backend and handles
 * authentication by forwarding the Authorization header.
 */
export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl:
      process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024",
    apiKey: process.env.LANGSMITH_API_KEY || "",
    runtime: "edge",
    // The baseRoute is not required, but is useful for debugging
    baseRoute: "/api/langgraph",
  });
