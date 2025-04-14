/**
 * Logger utility for standardized logging across the application
 */

// Define the log levels as an object
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
};

class Logger {
  /**
   * Log levels in order of increasing verbosity
   */
  constructor(level = LogLevel.INFO) {
    this.logLevel = level;
  }

  /**
   * Get the singleton logger instance
   */
  static getInstance() {
    if (!Logger.instance) {
      // Use environment variable for log level if available
      const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
      const logLevel =
        envLogLevel && LogLevel[envLogLevel] !== undefined
          ? LogLevel[envLogLevel]
          : LogLevel.INFO;

      Logger.instance = new Logger(logLevel);
    }
    return Logger.instance;
  }

  /**
   * Set the log level
   */
  setLogLevel(level) {
    this.logLevel = level;
  }

  /**
   * Log an error message
   */
  error(message, ...args) {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  /**
   * Log a warning message
   */
  warn(message, ...args) {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  /**
   * Log an info message
   */
  info(message, ...args) {
    if (this.logLevel >= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * Log a debug message
   */
  debug(message, ...args) {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Log a trace message (most verbose)
   */
  trace(message, ...args) {
    if (this.logLevel >= LogLevel.TRACE) {
      console.debug(`[TRACE] ${message}`, ...args);
    }
  }
}

// Export the Logger class and LogLevel enum
export { Logger, LogLevel };
