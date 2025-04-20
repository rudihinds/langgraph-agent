import { serverSupabase } from "./client.js";
import { Logger } from "../logger.js";
import { FileObject } from "@supabase/storage-js";
import { getFileExtension } from "../utils/files.js";
import { RunnableLambda } from "@langchain/core/runnables";

const logger = Logger.getInstance();

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG = {
  stopAfterAttempt: 3,
};

// Interface for list files input
interface ListFilesInput {
  bucketName: string;
  path?: string;
  options?: Record<string, any>;
}

// Interface for download file input
interface DownloadFileInput {
  bucketName: string;
  path: string;
}

// Interface for upload file input
interface UploadFileInput {
  bucketName: string;
  path: string;
  fileBody: File | Blob | ArrayBuffer | string;
  options?: Record<string, any>;
}

/**
 * Creates a runnable for listing files that can be used with withRetry
 */
export const listFiles = new RunnableLambda({
  func: async (input: ListFilesInput): Promise<FileObject[]> => {
    const { bucketName, path = "", options = {} } = input;
    logger.debug(`Listing files in bucket ${bucketName}, path: ${path}`);

    const { data, error } = await serverSupabase.storage
      .from(bucketName)
      .list(path, options);

    if (error) throw error;
    if (!data)
      throw new Error("No data returned from Supabase storage list operation");

    logger.debug(
      `Successfully listed ${data.length} files in ${bucketName}/${path}`
    );
    return data;
  },
});

/**
 * Creates a runnable for downloading files that can be used with withRetry
 */
export const downloadFile = new RunnableLambda({
  func: async (input: DownloadFileInput): Promise<Blob> => {
    const { bucketName, path } = input;
    logger.debug(`Downloading file from bucket ${bucketName}, path: ${path}`);

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
  },
});

/**
 * Creates a runnable for uploading files that can be used with withRetry
 */
export const uploadFile = new RunnableLambda({
  func: async (input: UploadFileInput): Promise<Record<string, any>> => {
    const { bucketName, path, fileBody, options = {} } = input;
    logger.debug(`Uploading file to bucket ${bucketName}, path: ${path}`);

    const { data, error } = await serverSupabase.storage
      .from(bucketName)
      .upload(path, fileBody, options);

    if (error) throw error;

    logger.debug(`Successfully uploaded file to ${bucketName}/${path}`);
    return data || {};
  },
});

/**
 * Wrapper functions with better parameter typing for use in the application
 */

// Create wrapped functions with retry applied
export const listFilesWithRetry = listFiles.withRetry(DEFAULT_RETRY_CONFIG);
export const downloadFileWithRetry =
  downloadFile.withRetry(DEFAULT_RETRY_CONFIG);
export const uploadFileWithRetry = uploadFile.withRetry(DEFAULT_RETRY_CONFIG);
