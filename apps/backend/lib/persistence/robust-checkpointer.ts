/**
 * Robust Checkpointer Factory
 *
 * This module provides a factory function for creating a checkpointer
 * that works with LangGraph 0.2.x and falls back to MemorySaver if
 * PostgreSQL connection fails.
 */
import { BaseCheckpointSaver, MemorySaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { ENV } from "../config/env.js";
import { Pool as PgPoolClass } from "pg"; // Import Pool class, aliasing to avoid confusion if needed

/**
 * Options for creating a checkpoint
 */
export interface RobustCheckpointerOptions {
  threadId?: string;
  useFallback?: boolean;
  fallbackLogLevel?: "error" | "warn" | "info" | "silent";
}

/**
 * Create a robust checkpointer that falls back to in-memory if Postgres fails
 *
 * @param options Configuration options
 * @returns A checkpointer instance (PostgreSQL or Memory)
 */
export async function createRobustCheckpointer(
  options: RobustCheckpointerOptions = {}
): Promise<BaseCheckpointSaver> {
  console.log("[RobustCheckpointer]: Factory function started.");
  const { threadId, useFallback = true, fallbackLogLevel = "warn" } = options;

  // Skip PostgreSQL entirely if not configured or explicitly using fallback
  if (!ENV.isSupabaseConfigured() || options.useFallback === true) {
    console.log(
      "[RobustCheckpointer]: Condition met to use MemorySaver (Supabase not configured or fallback forced)."
    );
    if (fallbackLogLevel !== "silent") {
      const message = !ENV.isSupabaseConfigured()
        ? "Supabase not configured. Using in-memory checkpointer."
        : "Using in-memory checkpointer as requested.";

      switch (fallbackLogLevel) {
        case "error":
          console.error("[RobustCheckpointer]:", message);
          break;
        case "warn":
          console.warn("[RobustCheckpointer]:", message);
          break;
        case "info":
          console.info("[RobustCheckpointer]:", message);
          break;
      }
    }
    console.log("[RobustCheckpointer]: Returning MemorySaver instance.");
    return new MemorySaver();
  }

  // Attempt to use PostgresSaver
  console.log("[RobustCheckpointer]: Attempting to use PostgresSaver.");
  let pool: InstanceType<typeof PgPoolClass> | undefined;
  try {
    const connectionString =
      ENV.DATABASE_URL ||
      `postgresql://${ENV.SUPABASE_DB_USER}:${ENV.SUPABASE_DB_PASSWORD}@${ENV.SUPABASE_DB_HOST}:${ENV.SUPABASE_DB_PORT}/${ENV.SUPABASE_DB_NAME}`;

    console.info(
      "[RobustCheckpointer]: Creating pg.Pool with connection string:",
      connectionString.replace(/:[^:]*@/, ":***@")
    );

    // Explicitly create a pg Pool instance
    pool = new PgPoolClass({
      connectionString: connectionString,
      // Add sensible timeouts
      connectionTimeoutMillis: 15000, // 15 seconds for acquiring connection
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      max: 10, // Max number of clients in the pool
    });

    // Optional: Add an error listener to the pool for background errors
    pool.on("error", (err, client) => {
      console.error(
        "[RobustCheckpointer pg.Pool]: Unexpected error on idle client",
        err
      );
    });

    console.log(
      "[RobustCheckpointer]: pg.Pool created. Instantiating PostgresSaver with pool."
    );
    // Instantiate PostgresSaver with the explicit pool
    const checkpointer = new PostgresSaver(pool);
    console.log("[RobustCheckpointer]: PostgresSaver instance created.");

    try {
      // Test connection by running setup
      console.log("[RobustCheckpointer]: Attempting PostgresSaver.setup()...");
      await checkpointer.setup();
      console.info("[RobustCheckpointer]: PostgresSaver.setup() successful.");
      console.log("[RobustCheckpointer]: Returning PostgresSaver instance.");
      // Important: Do NOT end the pool here, PostgresSaver manages it.
      return checkpointer;
    } catch (setupError) {
      console.error(
        "[RobustCheckpointer]: Failed during PostgresSaver.setup():",
        setupError
      );
      // Attempt to close the pool on setup failure
      if (pool) {
        console.log(
          "[RobustCheckpointer]: Attempting to end pool after setup failure..."
        );
        await pool
          .end()
          .catch((poolErr) =>
            console.error(
              "[RobustCheckpointer]: Error ending pool after setup failure:",
              poolErr
            )
          );
      }
      if (!useFallback) {
        console.error(
          "[RobustCheckpointer]: Fallback disabled, throwing setup error."
        );
        throw setupError;
      }
      console.warn(
        "[RobustCheckpointer]: Falling back to in-memory checkpointer due to setup failure."
      );
      console.log(
        "[RobustCheckpointer]: Returning MemorySaver instance due to setup failure."
      );
      return new MemorySaver();
    }
  } catch (connectionError) {
    console.error(
      "[RobustCheckpointer]: Failed during pg.Pool creation or initial connection attempt:",
      connectionError
    );
    // Attempt to close the pool if created before error
    if (pool) {
      console.log(
        "[RobustCheckpointer]: Attempting to end pool after connection error..."
      );
      await pool
        .end()
        .catch((poolErr) =>
          console.error(
            "[RobustCheckpointer]: Error ending pool after connection error:",
            poolErr
          )
        );
    }
    if (!useFallback) {
      console.error(
        "[RobustCheckpointer]: Fallback disabled, throwing connection error."
      );
      throw connectionError;
    }
    console.warn(
      "[RobustCheckpointer]: Falling back to in-memory checkpointer due to connection failure."
    );
    console.log(
      "[RobustCheckpointer]: Returning MemorySaver instance due to connection failure."
    );
    return new MemorySaver();
  }
}

/**
 * Generate a unique thread ID
 *
 * @param prefix Optional prefix
 * @returns A unique thread ID
 */
export function generateThreadId(prefix = "thread"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}
