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

// Module-scoped variables to ensure singleton behavior
let pgPoolInstance: InstanceType<typeof PgPoolClass> | undefined;
let checkpointerInstance: BaseCheckpointSaver | undefined;
let setupInProgressPromise: Promise<BaseCheckpointSaver> | null = null;

// Default fallback behavior (can be overridden by ENV vars if desired later)
const DEFAULT_USE_FALLBACK = true;
const DEFAULT_FALLBACK_LOG_LEVEL: "error" | "warn" | "info" | "silent" = "warn";

/**
 * Get an initialized checkpointer instance (PostgreSQL or Memory).
 * Ensures that PostgresSaver.setup() is called only once.
 *
 * @returns A checkpointer instance.
 */
export async function getInitializedCheckpointer(): Promise<BaseCheckpointSaver> {
  // If an instance already exists, return it immediately
  if (checkpointerInstance) {
    console.log(
      "[SingletonCheckpointer]: Returning existing checkpointer instance."
    );
    return checkpointerInstance;
  }

  // If setup is already in progress, return the existing promise
  if (setupInProgressPromise) {
    console.log(
      "[SingletonCheckpointer]: Setup already in progress, returning existing promise."
    );
    return setupInProgressPromise;
  }

  console.log(
    "[SingletonCheckpointer]: Starting checkpointer setup process..."
  );
  setupInProgressPromise = (async (): Promise<BaseCheckpointSaver> => {
    try {
      const useFallback = DEFAULT_USE_FALLBACK;
      const fallbackLogLevel = DEFAULT_FALLBACK_LOG_LEVEL;

      console.log(
        "[SingletonCheckpointer]: --- Environment Variable Check ---"
      );
      console.log(
        `[SingletonCheckpointer]: ENV.DATABASE_URL: ${ENV.DATABASE_URL}`
      );
      console.log(
        `[SingletonCheckpointer]: ENV.SUPABASE_DB_HOST: ${ENV.SUPABASE_DB_HOST}`
      );
      console.log(
        `[SingletonCheckpointer]: ENV.SUPABASE_DB_PORT: ${ENV.SUPABASE_DB_PORT}`
      );
      console.log(
        `[SingletonCheckpointer]: ENV.SUPABASE_DB_USER: ${ENV.SUPABASE_DB_USER}`
      );
      console.log(
        `[SingletonCheckpointer]: ENV.SUPABASE_DB_PASSWORD: ${ENV.SUPABASE_DB_PASSWORD ? "********" : undefined}`
      );
      console.log(
        `[SingletonCheckpointer]: ENV.SUPABASE_DB_NAME: ${ENV.SUPABASE_DB_NAME}`
      );
      console.log(
        `[SingletonCheckpointer]: ENV.isSupabaseConfigured(): ${ENV.isSupabaseConfigured()}`
      );
      console.log(
        "[SingletonCheckpointer]: --- End Environment Variable Check ---"
      );

      if (ENV.isSupabaseConfigured()) {
        console.log(
          "[SingletonCheckpointer]: Supabase is configured, attempting PostgresSaver initialization."
        );
        try {
          const connectionString =
            ENV.DATABASE_URL ||
            `postgresql://${ENV.SUPABASE_DB_USER}:${ENV.SUPABASE_DB_PASSWORD}@${ENV.SUPABASE_DB_HOST}:${ENV.SUPABASE_DB_PORT}/${ENV.SUPABASE_DB_NAME}`;

          console.log(
            `[SingletonCheckpointer]: Using connection string: ${connectionString.replace(ENV.SUPABASE_DB_PASSWORD || "DUMMY_PASSWORD_FOR_LOG", "********")}`
          );

          pgPoolInstance = new PgPoolClass({
            connectionString: connectionString,
            connectionTimeoutMillis: 15000,
            idleTimeoutMillis: 30000,
            max: 10,
          });

          pgPoolInstance.on("error", (err) => {
            console.error(
              "[SingletonCheckpointer pg.Pool]: Unexpected error on idle client",
              err
            );
          });

          const pgSaver = new PostgresSaver(pgPoolInstance);
          await pgSaver.setup();
          console.log(
            "[SingletonCheckpointer]: PostgresSaver.setup() completed successfully."
          );

          checkpointerInstance = pgSaver;
          console.log(
            "[SingletonCheckpointer]: PostgresSaver initialized and set as checkpointerInstance."
          );
          return checkpointerInstance;
        } catch (pgError) {
          console.error(
            "[SingletonCheckpointer]: Failed during PostgresSaver initialization or setup:",
            pgError
          );
          if (pgPoolInstance) {
            await pgPoolInstance
              .end()
              .catch((poolErr) =>
                console.error(
                  "[SingletonCheckpointer]: Error ending pool after PG failure:",
                  poolErr
                )
              );
            pgPoolInstance = undefined;
          }

          if (!useFallback) {
            console.error(
              "[SingletonCheckpointer]: Fallback disabled, throwing PG error."
            );
            throw pgError;
          }
          // Fallthrough to MemorySaver creation if fallback is enabled
        }
      }

      // Fallback to MemorySaver
      // This block is reached if Supabase is not configured OR if Postgres setup failed AND fallback is enabled.
      const message = !ENV.isSupabaseConfigured()
        ? "Supabase not configured. Using in-memory checkpointer."
        : "Using in-memory checkpointer due to previous error or forced fallback.";

      if (fallbackLogLevel !== "silent") {
        switch (fallbackLogLevel) {
          case "error":
            console.error("[SingletonCheckpointer]:", message);
            break;
          case "warn":
            console.warn("[SingletonCheckpointer]:", message);
            break;
          case "info":
            console.info("[SingletonCheckpointer]:", message);
            break;
        }
      }
      console.log(
        "[SingletonCheckpointer]: Initializing MemorySaver as fallback."
      );
      checkpointerInstance = new MemorySaver();
      console.log(
        "[SingletonCheckpointer]: MemorySaver initialized and set as checkpointerInstance."
      );
      return checkpointerInstance;
    } finally {
      console.log(
        "[SingletonCheckpointer]: Checkpointer setup process finished."
      );
      setupInProgressPromise = null;
    }
  })();
  return setupInProgressPromise;
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
