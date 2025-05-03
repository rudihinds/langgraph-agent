import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_LANGGRAPH_BACKEND_URL || "http://localhost:3001/api";

async function forwardRequest(request: NextRequest): Promise<Response> {
  const path = request.nextUrl.pathname.replace("/api/langgraph", "");
  const targetUrl = `${BACKEND_API_URL}/langgraph${path}${request.nextUrl.search}`;

  console.log(`[Proxy] Forwarding ${request.method} to: ${targetUrl}`);

  // Clone headers, removing host, adding custom ones if needed
  const headers = new Headers(request.headers);
  headers.delete("host");
  // Forward Authorization header if present
  const authorization = request.headers.get("Authorization");
  if (authorization) {
    headers.set("Authorization", authorization);
  }

  let body: BodyInit | null | undefined = undefined;
  let bodyLog = "No body or GET/HEAD request";

  // Handle body for relevant methods
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      // Log the content-type to understand what we receive
      const contentType = request.headers.get("content-type");
      console.log(`[Proxy] Incoming Content-Type: ${contentType}`);

      // Read the body to forward it. Need to clone first if logging.
      const requestClone = request.clone();
      const rawBody = await requestClone.text(); // Log raw text
      bodyLog = rawBody;
      body = rawBody; // Forward the raw body
      console.log(`[Proxy] Incoming Request Body (raw text): ${bodyLog}`);

      // Important: Ensure Content-Type is correctly forwarded for JSON
      if (contentType?.includes("application/json")) {
        headers.set("Content-Type", "application/json");
        // Try parsing for structured logging, but forward raw body
        try {
          const jsonBody = JSON.parse(rawBody);
          console.log("[Proxy] Incoming Request Body (parsed JSON):", jsonBody);
        } catch (parseError) {
          console.warn(
            "[Proxy] Failed to parse incoming body as JSON for logging."
          );
        }
      } else {
        // Forward the original Content-Type if not JSON
        if (contentType) {
          headers.set("Content-Type", contentType);
        }
      }
    } catch (error) {
      console.error("[Proxy] Error reading request body:", error);
      bodyLog = "Error reading body";
      // Decide how to handle body reading errors - perhaps return an error response?
      return new NextResponse("Error processing request body", { status: 500 });
    }
  }

  try {
    const backendResponse = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: body, // Forward the consumed body
      // IMPORTANT: Duplex required for streaming request bodies in Next.js Edge Runtime
      // @ts-ignore
      duplex: "half",
    });

    // Log backend response status for debugging
    console.log(`[Proxy] Backend response status: ${backendResponse.status}`);

    // Return the response from the backend directly
    // Ensure headers like Content-Type are passed correctly
    const responseHeaders = new Headers(backendResponse.headers);
    // Add CORS headers if needed, though often handled by the backend
    // responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Proxy] Error fetching backend URL ${targetUrl}:`, error);
    return new NextResponse("Proxy failed to connect to backend", {
      status: 502, // Bad Gateway
    });
  }
}

// Export handlers for all relevant HTTP methods
export const GET = forwardRequest;
export const POST = forwardRequest;
export const PUT = forwardRequest;
export const PATCH = forwardRequest;
export const DELETE = forwardRequest;
export const OPTIONS = async (request: NextRequest) => {
  // Basic CORS preflight response
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*", // Adjust in production
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};

export const runtime = "edge"; // Keep edge runtime if preferred
