/**
 * Environment configuration
 *
 * Centralizes access to environment variables used throughout the application.
 */
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables from root .env and local .env if available
const rootEnvPath = path.resolve(process.cwd(), "../../../.env");
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
dotenv.config();

/**
 * Environment configuration
 */
export const ENV = {
  // Supabase Configuration
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // Database Configuration for Checkpointer
  DATABASE_URL: process.env.DATABASE_URL || "",
  SUPABASE_DB_HOST:
    process.env.SUPABASE_DB_HOST || "db.rqwgqyhonjnzvgwxbrvh.supabase.co",
  SUPABASE_DB_PORT: process.env.SUPABASE_DB_PORT || "5432",
  SUPABASE_DB_NAME: process.env.SUPABASE_DB_NAME || "postgres",
  SUPABASE_DB_USER: process.env.SUPABASE_DB_USER || "postgres",
  SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD || "",
  SUPABASE_SCHEMA: process.env.SUPABASE_SCHEMA || "public",

  // Checkpointer Configuration
  CHECKPOINTER_TABLE_NAME:
    process.env.CHECKPOINTER_TABLE_NAME || "checkpoints",
  CHECKPOINTER_TYPE: process.env.CHECKPOINTER_TYPE || "auto", // "auto", "memory", or "postgres"

  // Node Environment
  NODE_ENV: process.env.NODE_ENV || "development",

  // Test Configuration
  TEST_USER_ID: process.env.TEST_USER_ID || "test-user",

  // LLM Provider API Keys
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",

  // Default LLM model
  DEFAULT_MODEL:
    process.env.DEFAULT_MODEL || "anthropic/claude-3-5-sonnet-20240620",

  // Service configuration
  PORT: parseInt(process.env.PORT || "3001", 10),
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // LangGraph configuration
  LANGGRAPH_API_KEY: process.env.LANGGRAPH_API_KEY || "",
  LANGGRAPH_PROJECT_ID: process.env.LANGGRAPH_PROJECT_ID || "",

  // LangSmith configuration
  LANGCHAIN_TRACING_V2: process.env.LANGCHAIN_TRACING_V2 === "true",
  LANGCHAIN_ENDPOINT:
    process.env.LANGCHAIN_ENDPOINT || "https://api.smith.langchain.com",
  LANGCHAIN_API_KEY: process.env.LANGCHAIN_API_KEY || "",
  LANGCHAIN_PROJECT: process.env.LANGCHAIN_PROJECT || "proposal-agent",

  // Web/Backend configuration
  NEXT_PUBLIC_BACKEND_URL:
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001",
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

  // Validation
  /**
   * Check if Supabase credentials are configured
   */
  isSupabaseConfigured(): boolean {
    // If we have a direct DATABASE_URL, use that
    if (this.DATABASE_URL) return true;

    // Otherwise check for individual database connection parameters
    return Boolean(
      this.SUPABASE_DB_HOST &&
        this.SUPABASE_DB_PORT &&
        this.SUPABASE_DB_NAME &&
        this.SUPABASE_DB_USER &&
        this.SUPABASE_DB_PASSWORD
    );
  },

  /**
   * Get descriptive error for missing Supabase configuration
   */
  getSupabaseConfigError(): string | null {
    if (!this.SUPABASE_URL) {
      return "Missing SUPABASE_URL environment variable";
    }
    if (!this.SUPABASE_SERVICE_ROLE_KEY) {
      return "Missing SUPABASE_SERVICE_ROLE_KEY environment variable";
    }
    return null;
  },

  /**
   * Check if database connection is configured for checkpointer
   */
  isDatabaseConfigured(): boolean {
    return (
      Boolean(this.DATABASE_URL) ||
      (Boolean(this.SUPABASE_DB_HOST) &&
        Boolean(this.SUPABASE_DB_USER) &&
        Boolean(this.SUPABASE_DB_PASSWORD))
    );
  },

  /**
   * Determine if we should use PostgreSQL for checkpointing
   */
  shouldUsePostgresCheckpointer(): boolean {
    if (this.CHECKPOINTER_TYPE === "memory") return false;
    if (this.CHECKPOINTER_TYPE === "postgres") return true;

    // For "auto", check if we have the necessary configuration
    return this.isDatabaseConfigured();
  },

  /**
   * Check if running in development environment
   */
  isDevelopment(): boolean {
    return this.NODE_ENV === "development";
  },

  /**
   * Check if running in production environment
   */
  isProduction(): boolean {
    return this.NODE_ENV === "production";
  },

  /**
   * Check if any LLM API keys are configured
   */
  hasLLMApiKey(): boolean {
    return Boolean(
      this.OPENAI_API_KEY ||
        this.ANTHROPIC_API_KEY ||
        this.MISTRAL_API_KEY ||
        this.GEMINI_API_KEY
    );
  },

  /**
   * Validate required environment variables and log warnings
   */
  validateEnv(): void {
    // Check LLM API keys
    if (!this.hasLLMApiKey()) {
      console.warn(
        "No LLM API keys provided. At least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, MISTRAL_API_KEY, or GEMINI_API_KEY is required for LLM functionality."
      );
    }

    // Check for Supabase configuration
    if (!this.SUPABASE_URL || !this.SUPABASE_ANON_KEY) {
      console.warn(
        "Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
      );
    }

    // Check for database configuration if PostgreSQL checkpointer is explicitly requested
    if (this.CHECKPOINTER_TYPE === "postgres" && !this.isDatabaseConfigured()) {
      console.warn(
        "PostgreSQL checkpointer is configured, but database connection details are missing. Please set DATABASE_URL or the individual SUPABASE_DB_* environment variables."
      );
    }

    // Check for LangSmith configuration if tracing is enabled
    if (this.LANGCHAIN_TRACING_V2 && !this.LANGCHAIN_API_KEY) {
      console.warn(
        "LangSmith tracing is enabled but missing LANGCHAIN_API_KEY. Set the LANGCHAIN_API_KEY environment variable."
      );
    }
  },
};

// Run initial validation
ENV.validateEnv();

// Also export a lowercase version for backwards compatibility
export const env = ENV;
