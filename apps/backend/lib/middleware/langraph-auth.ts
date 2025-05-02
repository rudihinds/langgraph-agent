/**
 * Custom authentication handler for LangGraph based on Supabase JWT tokens
 */

import { Auth, HTTPException } from "@langchain/langgraph-sdk/auth";
import { extractBearerToken, validateToken } from "../supabase/auth-utils.js";
import { Logger } from "../logger.js";

// Initialize logger
const logger = Logger.getInstance();

/**
 * Creates a LangGraph authentication handler that validates Supabase JWT tokens
 * and provides user context to graphs
 */
export const createLangGraphAuth = () => {
  return new Auth()
    .authenticate(async (request: Request) => {
      try {
        // Extract token from Authorization header
        const authorization = request.headers.get("authorization");
        const token = extractBearerToken(authorization || "");

        if (!token) {
          throw new HTTPException(401, {
            message: "Missing or invalid authorization token",
            headers: {
              "X-Auth-Status": "missing-token",
            },
          });
        }

        // Validate the token
        const validationResult = await validateToken(token);

        if (!validationResult.valid || !validationResult.user) {
          // Check if token is invalid due to expiration
          const isExpired = validationResult.error
            ?.toLowerCase()
            .includes("expired");

          throw new HTTPException(401, {
            message: validationResult.error || "Invalid token",
            headers: {
              "X-Auth-Status": isExpired ? "token-expired" : "invalid-token",
              "X-Token-Refresh-Required": isExpired ? "true" : "false",
            },
          });
        }

        // Return user identity for context
        return validationResult.user.id;
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        logger.error("Authentication error", { error });
        throw new HTTPException(401, {
          message: "Authentication failed",
          cause: error,
        });
      }
    })
    .on("*", ({ value, user }) => {
      // Add owner metadata to resources
      if ("metadata" in value) {
        value.metadata ??= {};
        value.metadata.owner = user.identity;
        // Add timestamp for audit purposes
        value.metadata.lastModified = new Date().toISOString();
      }

      // Filter resources by owner
      return { owner: user.identity };
    })
    .on("threads", ({ user }) => {
      // Return a filter based on owner identity
      // Use the simple string format (simpler than the $eq object format)
      return { owner: user.identity };
    })
    .on("store", ({ user, value }) => {
      if (value.namespace != null) {
        // If using namespaced storage (user_id, resource_type, resource_id)
        const [userId, resourceType, resourceId] = value.namespace;
        if (userId !== user.identity) {
          throw new HTTPException(403, {
            message: "Access denied to resource",
          });
        }
      }
    });
};

/**
 * Default LangGraph authentication handler instance
 */
export const langGraphAuth = createLangGraphAuth();
