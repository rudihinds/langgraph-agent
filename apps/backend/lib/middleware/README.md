# Backend Middleware

This directory contains Express middleware functions used across the application.

## Available Middleware

- [Authentication](#authentication-middleware)
- [Rate Limiting](#rate-limiting-middleware)

## Authentication Middleware

The authentication middleware validates JWT tokens from Supabase, implements token refresh handling, and provides standardized error responses.

For full details, see the [Backend Authentication Documentation](../../../backend-auth.md).

### Token Refresh Implementation

The authentication middleware provides token expiration information to route handlers. This allows routes to notify clients when tokens are nearing expiration via response headers.

#### Token Expiration Properties

The middleware attaches the following properties to the request object:

```typescript
interface AuthenticatedRequest extends Request {
  // User info and authenticated client
  user?: { id: string; email: string };
  supabase?: SupabaseClient;

  // Token expiration properties
  tokenExpiresIn?: number; // Seconds until token expires
  tokenRefreshRecommended?: boolean; // True if token will expire soon
}
```

#### Implementing Token Refresh Headers in Route Handlers

Route handlers should check for the `tokenRefreshRecommended` flag and set the appropriate header:

```typescript
// Example route handler with token refresh header
router.get(
  "/protected-route",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if token refresh is recommended (set by auth middleware)
      if (req.tokenRefreshRecommended === true) {
        // Add header to response
        res.setHeader("X-Token-Refresh-Recommended", "true");

        // Optional: Log the recommendation
        logger.info(`Token refresh recommended for user ${req.user?.id}`, {
          tokenExpiresIn: req.tokenExpiresIn,
        });
      }

      // Process the request normally...

      return res.json({ success: true, data: "Protected data" });
    } catch (error) {
      logger.error("Error in protected route:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);
```

#### Client-Side Handling

Clients should implement interceptors or similar mechanisms to handle:

1. **Proactive Refresh**: When `X-Token-Refresh-Recommended` header is present
2. **Reactive Refresh**: When receiving 401 responses with `refresh_required: true`

See the [RFP API documentation](../../api/rfp/README.md#token-refresh-handling) for client-side implementation examples.

## Rate Limiting Middleware

The rate limiting middleware protects API endpoints by limiting the number of requests a client can make within a specific time window.

### Features

- IP-based request tracking
- Configurable time windows and rate limits
- Automatic cleanup of expired data
- Standardized 429 (Too Many Requests) responses
- Detailed logging of rate limit status

### Usage

```javascript
import { rateLimitMiddleware } from "../lib/middleware/rate-limit.js";
import express from "express";

const app = express();

// Apply rate limiting to all routes
app.use(
  rateLimitMiddleware({
    windowMs: 60000, // 1 minute window
    maxRequests: 60, // 60 requests per minute
    cleanupInterval: 600000, // Cleanup every 10 minutes
  })
);

// Or apply to specific routes
app.use(
  "/api/public",
  rateLimitMiddleware({
    windowMs: 60000, // 1 minute
    maxRequests: 120, // More permissive for public API
  })
);

app.use(
  "/api/admin",
  rateLimitMiddleware({
    windowMs: 60000, // 1 minute
    maxRequests: 300, // More permissive for admin API
  })
);
```

### Configuration Options

| Parameter         | Type   | Description                             | Default             |
| ----------------- | ------ | --------------------------------------- | ------------------- |
| `windowMs`        | number | Time window in milliseconds             | 60000 (1 minute)    |
| `maxRequests`     | number | Maximum requests per window             | 60                  |
| `cleanupInterval` | number | Interval to clean expired entries in ms | 600000 (10 minutes) |

### Client Behavior

When a client exceeds the rate limit, the middleware:

1. Returns a 429 (Too Many Requests) status code
2. Adds a `Retry-After` header with seconds until reset
3. Returns a JSON response with:
   ```json
   {
     "error": "Too Many Requests",
     "retryAfter": 58,
     "message": "Rate limit exceeded. Try again in 58 seconds."
   }
   ```

### IP Address Detection

The middleware tries to get the client IP address from:

1. `X-Forwarded-For` header (first IP in case of multiple proxies)
2. Connection remote address

### Memory Management

The middleware automatically cleans up old entries to prevent memory leaks:

- A background cleanup task runs at the specified `cleanupInterval`
- Entries from expired time windows are removed
- Cleanup operations are logged with the number of removed entries

### Best Practices

1. **Apply Early**: The rate limiting middleware should be applied early in your middleware stack, usually right after essential middleware like body parsers.

2. **Tiered Approach**: Consider applying different rate limits to different routes based on their sensitivity and expected usage patterns.

3. **Monitoring**: Monitor the rate limiting logs to detect unusual patterns that might indicate abuse.

4. **Client Notification**: Make sure your frontend handles 429 responses gracefully, potentially implementing backoff logic.

5. **Trusted Proxies**: If your application runs behind a load balancer or proxy, ensure your Express app is configured with the appropriate `trust proxy` setting to correctly identify client IPs.
