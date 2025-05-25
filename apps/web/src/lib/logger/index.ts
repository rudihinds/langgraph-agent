/**
 * Standardized logging utility for consistent logging across the application
 */

const LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal",
} as const;

type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel];

interface LogContext {
  [key: string]: unknown;
}

/**
 * Log a message with the specified level and optional context/error
 */
function log(
  level: LogLevelType,
  message: string,
  context?: LogContext,
  error?: Error | unknown
): void {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  const logData = {
    timestamp,
    level,
    message,
    ...(context && typeof context === "object" && context !== null
      ? { context }
      : {}),
    ...(error
      ? {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  name: error.name,
                  stack: error.stack,
                }
              : error,
        }
      : {}),
  };

  switch (level) {
    case LogLevel.DEBUG:
      console.debug(formattedMessage, context || "", error || "");
      break;
    case LogLevel.INFO:
      console.info(formattedMessage, context || "", error || "");
      break;
    case LogLevel.WARN:
      console.warn(formattedMessage, context || "", error || "");
      break;
    case LogLevel.ERROR:
    case LogLevel.FATAL:
      console.error(formattedMessage, context || "", error || "");
      break;
    default:
      console.log(formattedMessage, context || "", error || "");
  }

  // Future extension point: send logs to external services like Sentry, Datadog, etc.
}

/**
 * Logger object with convenience methods for each log level
 */
export const logger = {
  debug: (message: string, context?: LogContext) =>
    log(LogLevel.DEBUG, message, context),
  info: (message: string, context?: LogContext) =>
    log(LogLevel.INFO, message, context),
  warn: (message: string, context?: LogContext, error?: Error | unknown) =>
    log(LogLevel.WARN, message, context, error),
  error: (message: string, context?: LogContext, error?: Error | unknown) =>
    log(LogLevel.ERROR, message, context, error),
  fatal: (message: string, context?: LogContext, error?: Error | unknown) =>
    log(LogLevel.FATAL, message, context, error),
};
