/**
 * Environment variables for the backend
 */

import "dotenv/config";

/**
 * Environment configuration
 */
export const env = {
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
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // Supabase configuration
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

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
};

// Validate required environment variables
if (
  !env.OPENAI_API_KEY &&
  !env.ANTHROPIC_API_KEY &&
  !env.MISTRAL_API_KEY &&
  !env.GEMINI_API_KEY
) {
  console.warn(
    "No LLM API keys provided. At least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, MISTRAL_API_KEY, or GEMINI_API_KEY is required for LLM functionality."
  );
}

// Check for Supabase configuration
if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  console.warn(
    "Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
  );
}

// Check for LangSmith configuration if tracing is enabled
if (env.LANGCHAIN_TRACING_V2 && !env.LANGCHAIN_API_KEY) {
  console.warn(
    "LangSmith tracing is enabled but missing LANGCHAIN_API_KEY. Set the LANGCHAIN_API_KEY environment variable."
  );
}
