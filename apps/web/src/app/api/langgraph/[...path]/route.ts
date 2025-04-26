import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";

// This file acts as a proxy for requests to the LangGraph server.
// It handles authentication and request forwarding.

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl:
      process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024",
    // Add auth headers to the forwarded requests
    getHeaders: async (req) => {
      // Extract auth token from incoming request
      const token = req.headers.get("authorization");
      return {
        Authorization: token || "",
      };
    },
    runtime: "edge",
  });
