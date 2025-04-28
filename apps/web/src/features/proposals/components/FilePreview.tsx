"use client";

import React, { useState, useRef } from "react";
import { Card, CardContent } from "@/features/ui/components/card";
import { Button } from "@/features/ui/components/button";
import { Input } from "@/features/ui/components/input";
import { FileType, Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/utils";

interface FileInfo {
  name: string;
  size: number;
  type: string;
  isValid: boolean;
  file: File;
}

interface FilePreviewProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  maxSize?: number;
  acceptedTypes?: string[];
}

export function FilePreview({
  file,
  onFileChange,
  maxSize = 50 * 1024 * 1024, // 50MB default
  acceptedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
}: FilePreviewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileSelect = (selectedFile: File) => {
    const isValidType = acceptedTypes.includes(selectedFile.type);
    const isValidSize = selectedFile.size <= maxSize;

    onFileChange(selectedFile);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = () => {
    onFileChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Display either the file preview or the dropzone
  return (
    <div className="w-full">
      <Input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept={acceptedTypes.join(",")}
      />

      {file ? (
        <Card className="overflow-hidden border border-border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
                  <FileType className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>{formatFileSize(file.size)}</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/60"></span>
                    <span>
                      {file.type.split("/")[1]?.toUpperCase() || "DOCUMENT"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {acceptedTypes.includes(file.type) && file.size <= maxSize ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRemove}
                    className="h-8 w-8 rounded-full"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove file</span>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border bg-background/50 hover:bg-muted/40"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleButtonClick}
        >
          <div className="bg-primary/10 p-3 rounded-full mb-3">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-medium mb-1">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">
            PDFs, DOC, DOCX, TXT (up to {formatFileSize(maxSize)})
          </p>
        </div>
      )}
    </div>
  );
}
