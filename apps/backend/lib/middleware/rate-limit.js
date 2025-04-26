/**
 * Rate Limiting Middleware
 *
 * This middleware implements API rate limiting based on client IP address.
 * It tracks request counts within configurable time windows and rejects
 * requests that exceed the defined limits.
 */

import { Logger } from "../logger.js";

// Initialize logger
const logger = Logger.getInstance();

/**
 * Options for configuring the rate limiting middleware
 * @typedef {Object} RateLimitOptions
 * @property {number} windowMs - Time window in milliseconds (e.g., 60000 for 1 minute)
 * @property {number} maxRequests - Maximum number of requests allowed per window
 * @property {number} [cleanupInterval] - Interval in ms to clean up expired entries (default: 10 minutes)
 */

/**
 * Rate limit data stored for each IP address
 * @typedef {Object} RateLimitData
 * @property {number} count - Request count in current window
 * @property {number} window - Current time window identifier
 * @property {number} timestamp - Last request timestamp
 */

/**
 * Stores rate limiting data keyed by IP address
 * @type {Map<string, RateLimitData>}
 */
const ipRequestStore = new Map();

/**
 * Get the client IP address from the request
 * @param {import('express').Request} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIp(req) {
  // Get IP from X-Forwarded-For header or fallback to connection remote address
  return (
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

/**
 * Calculate the current time window based on timestamp and window size
 * @param {number} timestamp - Current timestamp in milliseconds
 * @param {number} windowMs - Window size in milliseconds
 * @returns {number} Current window identifier
 */
function calculateTimeWindow(timestamp, windowMs) {
  return Math.floor(timestamp / windowMs);
}

/**
 * Create a rate limit exceeded response
 * @param {import('express').Response} res - Express response object
 * @param {number} retryAfter - Seconds until rate limit reset
 * @returns {void}
 */
function createRateLimitExceededResponse(res, retryAfter) {
  res
    .status(429)
    .set({
      "Retry-After": retryAfter,
    })
    .json({
      error: "Too Many Requests",
      retryAfter: retryAfter,
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
    });
}

/**
 * Log rate limit status for a request
 * @param {string} ip - Client IP address
 * @param {number} requestCount - Current request count
 * @param {number} limit - Maximum allowed requests
 * @param {boolean} exceeded - Whether the rate limit was exceeded
 */
function logRateLimitStatus(ip, requestCount, limit, exceeded = false) {
  const logMethod = exceeded ? "warn" : "info";
  const message = exceeded ? "Rate limit exceeded" : "Rate limit status";

  logger[logMethod](message, {
    ip,
    requestCount,
    limit,
  });
}

/**
 * Schedule periodic cleanup of expired rate limiting data
 * @param {number} cleanupIntervalMs - Cleanup interval in milliseconds
 * @param {number} windowMs - Window size in milliseconds
 */
function setupStoreCleanup(cleanupIntervalMs, windowMs) {
  // Add buffer time to ensure windows are fully expired
  const bufferMs = 1000; // 1 second buffer

  setInterval(() => {
    const now = Date.now();
    const currentWindow = calculateTimeWindow(now, windowMs);

    // Count before cleanup
    const countBefore = ipRequestStore.size;

    // Remove entries from previous time windows
    for (const [ip, data] of ipRequestStore.entries()) {
      if (data.window < currentWindow) {
        ipRequestStore.delete(ip);
      }
    }

    // Count after cleanup
    const countAfter = ipRequestStore.size;
    const removed = countBefore - countAfter;

    if (removed > 0) {
      logger.info(
        `Rate limit store cleanup: removed ${removed} expired entries`,
        {
          beforeCount: countBefore,
          afterCount: countAfter,
        }
      );
    }
  }, cleanupIntervalMs);
}

/**
 * Creates a middleware function that limits the rate of requests based on IP address
 *
 * @param {RateLimitOptions} options - Configuration options for the rate limiter
 * @returns {import('express').RequestHandler} Express middleware function
 */
export function rateLimitMiddleware(options) {
  // Ensure options are valid with defaults
  const windowMs = options.windowMs || 60000; // Default: 1 minute
  const maxRequests = options.maxRequests || 60; // Default: 60 requests per minute
  const cleanupInterval = options.cleanupInterval || 600000; // Default: 10 minutes

  // Setup periodic cleanup of expired entries
  setupStoreCleanup(cleanupInterval, windowMs);

  return function (req, res, next) {
    const ip = getClientIp(req);
    const now = Date.now();
    const currentWindow = calculateTimeWindow(now, windowMs);

    // Get existing entry for this IP or create a new one
    let ipData = ipRequestStore.get(ip);

    // Check if this is a new window or first request
    if (!ipData || ipData.window < currentWindow) {
      // First request in this window or window has changed
      ipData = {
        count: 1,
        window: currentWindow,
        timestamp: now,
      };
      ipRequestStore.set(ip, ipData);

      // Log rate limit status
      logRateLimitStatus(ip, 1, maxRequests);

      // Allow the request
      return next();
    }

    // Increment the counter for existing IP and window
    ipData.count += 1;
    ipData.timestamp = now;
    ipRequestStore.set(ip, ipData);

    // Check if rate limit is exceeded
    if (ipData.count > maxRequests) {
      // Calculate seconds until rate limit reset
      const resetTime = (currentWindow + 1) * windowMs;
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      // Log rate limit exceeded
      logRateLimitStatus(ip, ipData.count, maxRequests, true);

      // Send rate limit exceeded response
      createRateLimitExceededResponse(res, retryAfter);
      return;
    }

    // Log rate limit status
    logRateLimitStatus(ip, ipData.count, maxRequests);

    // Allow the request
    next();
  };
}
