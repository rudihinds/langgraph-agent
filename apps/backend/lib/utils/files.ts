/**
 * File-related utility functions for handling file paths,
 * extensions, and other common operations.
 */

/**
 * Extracts the file extension from a path.
 *
 * @param filePath - The file path to extract the extension from
 * @returns The extension (without the dot) or empty string if no extension
 */
export function getFileExtension(filePath: string): string {
  if (!filePath) return "";

  // Handle paths with query parameters or fragments
  const pathWithoutParams = filePath.split(/[?#]/)[0];

  // Get the last segment of the path (the filename)
  const filename = pathWithoutParams.split("/").pop();
  if (!filename) return "";

  // Split by dots and get the last part
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

/**
 * Determines MIME type from a file extension.
 *
 * @param extension - The file extension (without dot)
 * @returns The corresponding MIME type or default text/plain
 */
export function getMimeTypeFromExtension(extension: string): string {
  const mimeMap: Record<string, string> = {
    // Document formats
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    rtf: "application/rtf",
    txt: "text/plain",
    md: "text/markdown",

    // Image formats
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",

    // Other common formats
    csv: "text/csv",
    json: "application/json",
    xml: "application/xml",
    html: "text/html",
    htm: "text/html",
    zip: "application/zip",
  };

  return mimeMap[extension.toLowerCase()] || "text/plain";
}

/**
 * Extracts filename from a path.
 *
 * @param filePath - The file path to extract the filename from
 * @returns The filename without directory path
 */
function getFileName(filePath: string): string {
  if (!filePath) return "";

  // Handle paths with query parameters or fragments
  const pathWithoutParams = filePath.split(/[?#]/)[0];

  // Get the last segment of the path
  const filename = pathWithoutParams.split("/").pop();
  return filename || "";
}

/**
 * Converts bytes to human readable file size.
 *
 * @param bytes - The number of bytes
 * @param decimals - Number of decimal places in the result
 * @returns Formatted file size (e.g., "1.5 MB")
 */
function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
  );
}
