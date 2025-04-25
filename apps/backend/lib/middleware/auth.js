/**
 * Authentication middleware for Express.js
 *
 * This middleware validates JWT tokens, detects expired tokens, and provides
 * token expiration information to enable proactive token refresh handling.
 * It attaches user data and token metadata to the request object when authentication succeeds.
 *
 * The middleware handles several key authentication scenarios:
 * 1. Valid tokens: User data and Supabase client attached to the request
 * 2. Expired tokens: 401 response with refresh_required flag
 * 3. Invalid/missing tokens: 401 response with descriptive error
 * 4. Server configuration errors: 500 response
 *
 * For valid tokens, the middleware calculates expiration time and adds:
 * - req.tokenExpiresIn: Seconds until token expiration
 * - req.tokenRefreshRecommended: Boolean indicating if refresh is recommended (≤ 10min)
 *
 * @module auth
 */

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../logger.js";

// Number of seconds before token expiration when refresh should be recommended (10 minutes)
const TOKEN_REFRESH_RECOMMENDATION_THRESHOLD_SECONDS = 600;

/**
 * Creates a standardized error response object
 *
 * @param {number} status - HTTP status code for the response
 * @param {string} errorType - Short error type identifier (e.g., "Invalid token")
 * @param {string} message - Detailed error message
 * @param {Object} [additionalData] - Optional additional fields to include in the response
 * @returns {Object} Formatted error response object
 */
function createErrorResponse(status, errorType, message, additionalData = {}) {
  return {
    status,
    responseBody: {
      error: errorType,
      message,
      ...additionalData,
    },
  };
}

/**
 * Extracts bearer token from authorization header
 *
 * Validates the Authorization header format and extracts the JWT token.
 * Returns either the extracted token or structured error information.
 *
 * @param {Object} req - Express request object
 * @param {Object} logger - Logger instance
 * @param {string} requestId - Request identifier for logging
 * @returns {Object} Object containing either:
 *   - { token: string } - The successfully extracted token
 *   - { error: Object } - Error response object from createErrorResponse
 */
function extractAuthToken(req, logger, requestId) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Missing or invalid authorization header", { requestId });
    return {
      error: createErrorResponse(
        401,
        "Authentication required",
        "Authorization header missing or invalid format"
      ),
    };
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    logger.warn("Empty token in authorization header", { requestId });
    return {
      error: createErrorResponse(
        401,
        "Invalid token",
        "Authentication token cannot be empty"
      ),
    };
  }

  return { token };
}

/**
 * Calculates token expiration information and attaches it to the request
 *
 * This function:
 * 1. Calculates seconds remaining until token expiration
 * 2. Determines if token is close to expiration (within threshold)
 * 3. Attaches expiration metadata to the request object
 * 4. Logs warnings for tokens close to expiration
 *
 * @param {Object} req - Express request object
 * @param {Object} session - User session containing expiration timestamp
 * @param {Object} logger - Logger instance
 * @param {string} requestId - Request identifier for logging
 * @param {string} userId - User ID for logging
 * @returns {void}
 */
function processTokenExpiration(req, session, logger, requestId, userId) {
  if (!session || !session.expires_at) return;

  const currentTimeSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = session.expires_at;
  const timeRemainingSeconds = expiresAtSeconds - currentTimeSeconds;

  // Attach expiration metadata to request for downstream handlers
  req.tokenExpiresIn = timeRemainingSeconds;
  req.tokenRefreshRecommended =
    timeRemainingSeconds <= TOKEN_REFRESH_RECOMMENDATION_THRESHOLD_SECONDS;

  // Prepare common log data for consistent structure
  const logData = {
    requestId,
    userId,
    timeRemaining: timeRemainingSeconds,
    expiresAt: expiresAtSeconds,
  };

  // Log appropriate message based on expiration proximity
  if (req.tokenRefreshRecommended) {
    logger.warn("Token close to expiration", logData);
  } else {
    logger.info("Valid authentication with healthy token expiration", logData);
  }
}

/**
 * Handles authentication errors and sends appropriate response
 *
 * @param {Object} res - Express response object
 * @param {Object} error - Error object from Supabase
 * @param {Object} logger - Logger instance
 * @param {string} requestId - Request identifier for logging
 * @returns {void}
 */
function handleAuthError(res, error, logger, requestId) {
  // Special handling for expired tokens
  if (error.message && error.message.includes("expired")) {
    logger.warn("Auth error: expired token", { requestId, error });
    const { status, responseBody } = createErrorResponse(
      401,
      "Token expired",
      "Token has expired",
      { refresh_required: true }
    );
    return res.status(status).json(responseBody);
  }

  // Handle other authentication errors
  logger.warn("Auth error: invalid token", { requestId, error });
  const { status, responseBody } = createErrorResponse(
    401,
    "Invalid token",
    error.message
  );
  return res.status(status).json(responseBody);
}

/**
 * Middleware that validates authentication tokens and handles token refresh requirements
 *
 * The middleware performs several key functions:
 * 1. Extracts and validates JWT token from the Authorization header
 * 2. Initializes an authenticated Supabase client with the token
 * 3. Verifies the token with Supabase Auth
 * 4. Attaches user data and token metadata to the request
 * 5. Handles various authentication failure scenarios with appropriate responses
 *
 * On successful authentication:
 * - Attaches authenticated user to req.user
 * - Attaches authenticated Supabase client to req.supabase
 * - Provides token expiration info via req.tokenExpiresIn
 * - Sets req.tokenRefreshRecommended flag if token expires within threshold
 *
 * On failed authentication:
 * - Returns appropriate 401 status with descriptive error message
 * - For expired tokens, includes refresh_required: true flag for client-side handling
 *
 * @param {Object} req - Express request object with headers and possibly other middleware data
 * @param {Object} res - Express response object for sending responses
 * @param {Function} next - Express next function to pass control to the next middleware/route
 * @returns {Promise<void>}
 *
 * @example
 * // Apply middleware to all routes in a router
 * router.use(authMiddleware);
 *
 * @example
 * // Apply middleware to a specific route
 * app.get('/api/protected', authMiddleware, (req, res) => {
 *   // Access authenticated user data
 *   const user = req.user;
 *
 *   // Use the authenticated Supabase client
 *   const supabase = req.supabase;
 *
 *   // Check if token refresh is recommended
 *   if (req.tokenRefreshRecommended) {
 *     // Add header to suggest token refresh to client
 *     res.set('X-Token-Refresh-Recommended', 'true');
 *   }
 *
 *   res.json({ user });
 * });
 */
export async function authMiddleware(req, res, next) {
  const logger = Logger.getInstance();
  const requestId = req.headers["x-request-id"] || "unknown";

  // Extract and validate token from authorization header
  const { token, error: extractError } = extractAuthToken(
    req,
    logger,
    requestId
  );

  if (extractError) {
    return res.status(extractError.status).json(extractError.responseBody);
  }

  try {
    // Check for required environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.error("Missing Supabase environment variables", { requestId });
      const { status, responseBody } = createErrorResponse(
        500,
        "Server configuration error",
        "Server configuration error"
      );
      return res.status(status).json(responseBody);
    }

    // Initialize Supabase client with proper configuration
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Validate the token and get the user
    const { data, error } = await supabase.auth.getUser();

    // Handle authentication errors
    if (error) {
      return handleAuthError(res, error, logger, requestId);
    }

    // Authentication successful - attach user and supabase client to request
    req.user = data.user;
    req.supabase = supabase;

    // Process token expiration information
    processTokenExpiration(req, data.session, logger, requestId, data.user.id);

    // Continue to next middleware or route handler
    next();
  } catch (err) {
    // Handle unexpected errors
    logger.error("Unexpected auth error", {
      requestId,
      error: err.message,
      stack: err.stack,
    });

    const { status, responseBody } = createErrorResponse(
      500,
      "Authentication error",
      "Internal server error during authentication"
    );
    return res.status(status).json(responseBody);
  }
}
