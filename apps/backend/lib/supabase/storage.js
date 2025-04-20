import { serverSupabase } from "./client.js";
import { Logger } from "../logger.js";
import { FileObject } from "@supabase/storage-js";

const logger = Logger.getInstance();

/**
 * Default retry configuration for storage operations
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 500,
  backoffFactor: 2,
  maxDelayMs: 5000,
  jitter: true,
};

/**
 * Determines if an error should trigger a retry
 *
 * @param {Error} error - The error to evaluate
 * @returns {boolean} - Whether to retry the operation
 */
function shouldRetryError(error) {
  // Don't retry on client errors except for rate limits
  if (error.status) {
    // Never retry on 404 (not found) or 403 (forbidden)
    if (error.status === 404 || error.status === 403) {
      return false;
    }

    // Retry on rate limits (429)
    if (error.status === 429) {
      return true;
    }

    // Retry on all server errors (5xx)
    if (error.status >= 500) {
      return true;
    }

    // Don't retry on other 4xx client errors
    if (error.status >= 400) {
      return false;
    }
  }

  // Retry on network errors, timeouts, and other transient issues
  return true;
}

/**
 * Implements delay with exponential backoff and optional jitter
 *
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {object} config - Retry configuration
 * @returns {Promise<void>} - Promise that resolves after the delay
 */
async function delay(attempt, config) {
  const { initialDelayMs, backoffFactor, maxDelayMs, jitter } = config;

  // Calculate delay with exponential backoff
  let delayMs = initialDelayMs * Math.pow(backoffFactor, attempt);

  // Apply jitter if enabled (adds or subtracts up to 25% randomly)
  if (jitter) {
    const jitterFactor = 0.25; // 25% jitter
    const randomJitter = 1 - jitterFactor + Math.random() * jitterFactor * 2;
    delayMs = delayMs * randomJitter;
  }

  // Cap at max delay
  delayMs = Math.min(delayMs, maxDelayMs);

  logger.debug(
    `Retry delay: ${Math.round(delayMs)}ms (attempt ${attempt + 1})`
  );

  // Return a promise that resolves after the delay
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Lists files in a Supabase storage bucket with retry logic
 *
 * @param {string} bucketName - Name of the bucket
 * @param {string} path - Path within the bucket to list
 * @param {object} options - Options for the list operation
 * @param {object} retryConfig - Retry configuration (optional)
 * @returns {Promise<FileObject[]>} - Promise that resolves to the list of files
 */
export async function listFilesWithRetry(
  bucketName,
  path = "",
  options = {},
  retryConfig = DEFAULT_RETRY_CONFIG
) {
  const { maxRetries } = retryConfig;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.debug(
        `Listing files in bucket ${bucketName}, path: ${path} (attempt ${attempt + 1})`
      );

      const { data, error } = await serverSupabase.storage
        .from(bucketName)
        .list(path, options);

      if (error) throw error;
      if (!data)
        throw new Error(
          "No data returned from Supabase storage list operation"
        );

      logger.debug(
        `Successfully listed ${data.length} files in ${bucketName}/${path}`
      );
      return data;
    } catch (error) {
      lastError = error;
      logger.warn(
        `Error listing files in bucket ${bucketName}, path: ${path} (attempt ${attempt + 1})`,
        { error: error.message }
      );

      // If we should not retry this error or we've reached max retries, throw it
      if (!shouldRetryError(error) || attempt >= maxRetries - 1) {
        throw error;
      }

      // Delay before next attempt
      await delay(attempt, retryConfig);
    }
  }

  // If we get here, all retries failed
  throw lastError;
}

/**
 * Downloads a file from Supabase storage with retry logic
 *
 * @param {string} bucketName - Name of the bucket
 * @param {string} path - Path to the file within the bucket
 * @param {object} retryConfig - Retry configuration (optional)
 * @returns {Promise<Blob>} - Promise that resolves to the downloaded file
 */
export async function downloadFileWithRetry(
  bucketName,
  path,
  retryConfig = DEFAULT_RETRY_CONFIG
) {
  const { maxRetries } = retryConfig;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.debug(
        `Downloading file from bucket ${bucketName}, path: ${path} (attempt ${attempt + 1})`
      );

      const { data, error } = await serverSupabase.storage
        .from(bucketName)
        .download(path);

      if (error) throw error;
      if (!data)
        throw new Error(
          "No data returned from Supabase storage download operation"
        );

      logger.debug(`Successfully downloaded file from ${bucketName}/${path}`);
      return data;
    } catch (error) {
      lastError = error;
      logger.warn(
        `Error downloading file from bucket ${bucketName}, path: ${path} (attempt ${attempt + 1})`,
        { error: error.message }
      );

      // If we should not retry this error or we've reached max retries, throw it
      if (!shouldRetryError(error) || attempt >= maxRetries - 1) {
        throw error;
      }

      // Delay before next attempt
      await delay(attempt, retryConfig);
    }
  }

  // If we get here, all retries failed
  throw lastError;
}

/**
 * Uploads a file to Supabase storage with retry logic
 *
 * @param {string} bucketName - Name of the bucket
 * @param {string} path - Path where the file should be uploaded
 * @param {File|Blob|ArrayBuffer|string} fileBody - File content
 * @param {object} options - Options for the upload operation
 * @param {object} retryConfig - Retry configuration (optional)
 * @returns {Promise<object>} - Promise that resolves to the upload result
 */
export async function uploadFileWithRetry(
  bucketName,
  path,
  fileBody,
  options = {},
  retryConfig = DEFAULT_RETRY_CONFIG
) {
  const { maxRetries } = retryConfig;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.debug(
        `Uploading file to bucket ${bucketName}, path: ${path} (attempt ${attempt + 1})`
      );

      const { data, error } = await serverSupabase.storage
        .from(bucketName)
        .upload(path, fileBody, options);

      if (error) throw error;

      logger.debug(`Successfully uploaded file to ${bucketName}/${path}`);
      return data || {};
    } catch (error) {
      lastError = error;
      logger.warn(
        `Error uploading file to bucket ${bucketName}, path: ${path} (attempt ${attempt + 1})`,
        { error: error.message }
      );

      // If we should not retry this error or we've reached max retries, throw it
      if (!shouldRetryError(error) || attempt >= maxRetries - 1) {
        throw error;
      }

      // Delay before next attempt
      await delay(attempt, retryConfig);
    }
  }

  // If we get here, all retries failed
  throw lastError;
}
