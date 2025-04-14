import React, { useState, ChangeEvent, FormEvent } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Progress } from "./ui/progress";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertCircle, FileText, Upload } from "lucide-react";

interface ParsedRFP {
  text: string;
  metadata: {
    filename: string;
    mimeType: string;
    pageCount?: number;
    wordCount?: number;
    charCount?: number;
    [key: string]: any;
  };
}

/**
 * RFP Uploader Component
 *
 * Allows users to upload RFP documents for parsing and analysis.
 * Supports PDF, plain text, and other document formats.
 */
export function RfpUploader({
  onParsed,
  maxSize = 10 * 1024 * 1024, // 10MB default max size
}: {
  onParsed: (data: ParsedRFP) => void;
  maxSize?: number;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<string | null>(null);

  // Accepted mime types
  const acceptedTypes = [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  // Handle file selection
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setParsedPreview(null);

    if (!selectedFile) {
      return;
    }

    // Validate file type
    if (!acceptedTypes.includes(selectedFile.type)) {
      setError(
        `Unsupported file type: ${selectedFile.type}. Please upload a PDF, text, or markdown file.`
      );
      return;
    }

    // Validate file size
    if (selectedFile.size > maxSize) {
      setError(
        `File too large: ${(selectedFile.size / (1024 * 1024)).toFixed(2)}MB. Maximum allowed size is ${maxSize / (1024 * 1024)}MB.`
      );
      return;
    }

    setFile(selectedFile);
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(10);
      setError(null);

      // Prepare form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("filename", file.name);
      formData.append("mimeType", file.type);

      // Simulate progress (in a real app, use fetch with upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      // Upload file for parsing
      const response = await fetch("/api/rfp/parse", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to parse document");
      }

      // Handle successful parsing
      const data: ParsedRFP = await response.json();

      // Set a preview of the parsed text (first 500 chars)
      if (data.text) {
        setParsedPreview(
          data.text.substring(0, 500) + (data.text.length > 500 ? "..." : "")
        );
      }

      // Call the callback with the parsed data
      onParsed(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Upload RFP Document
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rfp-file">Select RFP Document</Label>
              <Input
                id="rfp-file"
                type="file"
                onChange={handleFileChange}
                accept={acceptedTypes.join(",")}
                disabled={isUploading}
              />
              <p className="text-sm text-gray-500">
                Supported formats: PDF, plain text, markdown
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {parsedPreview && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Document Preview:</h3>
                <div className="bg-gray-50 p-3 rounded text-sm max-h-40 overflow-y-auto">
                  {parsedPreview}
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={!file || isUploading}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? "Processing..." : "Upload & Parse Document"}
            </Button>
          </div>
        </form>
      </CardContent>

      {file && (
        <CardFooter className="flex justify-between text-sm text-gray-500 border-t pt-4">
          <span>Selected: {file.name}</span>
          <span>{(file.size / 1024).toFixed(1)}KB</span>
        </CardFooter>
      )}
    </Card>
  );
}
