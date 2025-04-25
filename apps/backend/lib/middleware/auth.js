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

// Time threshold (in seconds) before token expiration when clients should be notified to refresh
// 10 minutes provides adequate time for client-side refresh while not being too frequent
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
 * Validates required Supabase environment variables
 *
 * @param {Object} logger - Logger instance
 * @param {string} requestId - Request identifier for logging
 * @returns {Object|null} Error response object if validation fails, null if successful
 */
function validateSupabaseConfig(logger, requestId) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    logger.error("Missing Supabase environment variables", {
      requestId,
      missingVars: {
        url: !supabaseUrl,
        anonKey: !supabaseAnonKey,
      },
    });

    return createErrorResponse(
      500,
      "Server configuration error",
      "Server configuration error"
    );
  }

  return null;
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
function extractBearerToken(req, logger, requestId) {
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
 * 4. Sets X-Token-Refresh-Recommended header if token is close to expiring
 * 5. Logs warnings for tokens close to expiration
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object for setting headers
 * @param {Object} session - User session containing expiration timestamp
 * @param {Object} logger - Logger instance
 * @param {string} requestId - Request identifier for logging
 * @param {string} userId - User ID for logging
 * @returns {void}
 */
function processTokenExpiration(req, res, session, logger, requestId, userId) {
  // Handle missing session data gracefully
  if (!session) {
    logger.warn("Missing session data during token expiration processing", {
      requestId,
      userId,
    });
    return;
  }

  // Handle missing expiration data
  if (!session.expires_at) {
    logger.warn("Session missing expiration timestamp", {
      requestId,
      userId,
      session: { hasExpiresAt: false },
    });
    return;
  }

  const currentTimeSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = session.expires_at;
  const secondsUntilExpiration = expiresAtSeconds - currentTimeSeconds;

  // Attach expiration metadata to request for downstream handlers
  req.tokenExpiresIn = secondsUntilExpiration;
  req.tokenRefreshRecommended =
    secondsUntilExpiration <= TOKEN_REFRESH_RECOMMENDATION_THRESHOLD_SECONDS;

  // Set header to recommend token refresh if needed
  if (req.tokenRefreshRecommended) {
    res.setHeader("X-Token-Refresh-Recommended", "true");
  }

  // Prepare common log data for consistent structure
  const logData = {
    requestId,
    userId,
    timeRemaining: secondsUntilExpiration,
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
 * Different authentication error types receive specialized handling:
 * - Expired tokens: Include refresh_required flag to guide client-side refresh
 * - Other auth errors: Return standard 401 with error details
 *
 * @param {Object} res - Express response object
 * @param {Object} error - Error object from Supabase
 * @param {Object} logger - Logger instance
 * @param {string} requestId - Request identifier for logging
 * @returns {void}
 */
function handleAuthenticationError(res, error, logger, requestId) {
  // Special handling for expired tokens to facilitate client-side refresh
  if (error.message && error.message.includes("expired")) {
    logger.warn("Token expired", { requestId });
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
  const { token, error: extractError } = extractBearerToken(
    req,
    logger,
    requestId
  );

  if (extractError) {
    return res.status(extractError.status).json(extractError.responseBody);
  }

  try {
    // Validate Supabase configuration
    const configError = validateSupabaseConfig(logger, requestId);
    if (configError) {
      return res.status(configError.status).json(configError.responseBody);
    }

    // Initialize Supabase client with proper configuration
    const supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Validate the token and get the user
    const { data, error } = await supabaseClient.auth.getUser();

    // Handle authentication errors
    if (error) {
      return handleAuthenticationError(res, error, logger, requestId);
    }

    // Authentication successful - attach user and supabase client to request
    req.user = data.user;
    req.supabase = supabaseClient;

    // Process token expiration information
    processTokenExpiration(
      req,
      res,
      data.session,
      logger,
      requestId,
      data.user.id
    );

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
