/*
import { NextRequest, NextResponse } from "next/server";
import { ensureAuth } from "@/lib/supabase/middleware"; // Assuming middleware utility
import { logger } from "@/lib/logger";

// Base URL of the LangGraph server
const LANGGRAPH_BASE_URL = process.env.LANGGRAPH_API_URL;
const LANGSMITH_API_KEY = process.env.LANGSMITH_API_KEY;

if (!LANGGRAPH_BASE_URL) {
  logger.error("LANGGRAPH_API_URL environment variable is not set.");
  // Potentially throw error or handle differently depending on required availability
}

if (!LANGSMITH_API_KEY) {
  logger.warn("LANGSMITH_API_KEY environment variable is not set. LangGraph requests may fail authentication.");
  // Don't throw, but warn that things might not work
}

// Handler for all methods
async function handler(req: NextRequest) {
  logger.debug(`[API LangGraph Proxy] Received request: ${req.method} ${req.url}`);

  // 1. Ensure Authentication (using Supabase middleware pattern)
  const authResponse = await ensureAuth(req);
  if (authResponse) {
    logger.warn("[API LangGraph Proxy] Authentication failed.");
    return authResponse; // Return the unauthorized response
  }
  logger.debug("[API LangGraph Proxy] Authentication successful.");

  // 2. Construct Target LangGraph URL
  const path = req.nextUrl.pathname.replace("/api/langgraph", "");
  const targetUrl = `${LANGGRAPH_BASE_URL}${path}${req.nextUrl.search}`;
  logger.debug(`[API LangGraph Proxy] Target URL: ${targetUrl}`);

  if (!LANGGRAPH_BASE_URL) {
    logger.error("[API LangGraph Proxy] LangGraph base URL not configured.");
    return NextResponse.json({ error: "Proxy target not configured" }, { status: 500 });
  }

  // 3. Prepare Headers for LangGraph Request
  const headers = new Headers(req.headers);

  // Remove headers specific to the Next.js server that shouldn't be forwarded
  headers.delete("host");
  headers.delete("connection");
  // Add any other headers to remove as needed

  // Add LangSmith API Key if available
  if (LANGSMITH_API_KEY) {
    // Note: LangSmith might use a different header name, e.g., 'x-api-key' or 'Authorization: Bearer ...'
    // Verify the correct header name from LangSmith/LangGraph documentation if needed.
    headers.set("x-api-key", LANGSMITH_API_KEY); // Adjust if necessary
    logger.debug("[API LangGraph Proxy] Added LangSmith API key to headers.");
  } else {
    logger.warn("[API LangGraph Proxy] Proceeding without LangSmith API key.");
  }

  // Set content-type if not already set (important for POST/PUT)
  if ((req.method === "POST" || req.method === "PUT") && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
    logger.debug("[API LangGraph Proxy] Setting content-type to application/json.");
  }

  // Log final headers being sent (optional, remove sensitive keys in production logs)
  // logger.debug("[API LangGraph Proxy] Forwarding headers:", Object.fromEntries(headers.entries()));

  // 4. Forward the Request
  try {
    logger.debug(`[API LangGraph Proxy] Forwarding ${req.method} request to ${targetUrl}`);
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.body, // Forward the body
      // duplex: 'half', // Required for streaming request bodies in some environments
      redirect: "manual", // Handle redirects manually if needed
    });

    logger.debug(
      `[API LangGraph Proxy] Received response status: ${response.status} from ${targetUrl}`
    );

    // 5. Stream Response Back
    // Create a new NextResponse with the streamed body and original headers/status
    // Note: Directly passing response.headers might include unwanted hop-by-hop headers.
    // It's often better to selectively copy necessary headers.
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Filter out hop-by-hop headers like 'connection', 'keep-alive', 'transfer-encoding'
      if (!["connection", "keep-alive", "transfer-encoding", "content-encoding"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // Ensure correct content type for SSE
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
        responseHeaders.set("Content-Type", "text/event-stream; charset=utf-8");
        responseHeaders.set("Cache-Control", "no-cache");
        responseHeaders.set("Connection", "keep-alive");
        logger.debug("[API LangGraph Proxy] Setting SSE headers.");
    }

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    logger.error(`[API LangGraph Proxy] Error fetching ${targetUrl}:`, error);
    return NextResponse.json(
      { error: "Proxy request failed", details: error.message },
      { status: 502 } // Bad Gateway
    );
  }
}

// Export handlers for all relevant HTTP methods
export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
*/
