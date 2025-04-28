"use client";

import React from "react";
import { toast, Toast } from "sonner";
import { X, CheckCircle, AlertCircle, FileText, Loader2 } from "lucide-react";
import { Button } from "@/features/ui/components/button";
import { cn } from "@/lib/utils/utils";

// Types
type FileUploadStatus = "uploading" | "success" | "error" | "processing";

type FileUploadToastProps = {
  fileName: string;
  progress?: number;
  status: FileUploadStatus;
  message?: string;
  onCancel?: () => void;
};

type UpdateToastProps = {
  progress?: number;
  status?: FileUploadStatus;
  message?: string;
};

// Custom hook for file upload toasts
export function useFileUploadToast() {
  const showFileUploadToast = (props: FileUploadToastProps): string => {
    return toast.custom(
      (t) => (
        <FileUploadToast
          {...props}
          onDismiss={() => toast.dismiss(t.id)}
          id={t.id}
        />
      ),
      {
        duration: props.status === "success" ? 5000 : Infinity,
      }
    );
  };

  const updateFileUploadToast = (id: string, update: UpdateToastProps) => {
    toast.custom(
      (t) => (
        <FileUploadToast
          fileName={(t.title as string) || "File"}
          status={(t.data?.status as FileUploadStatus) || "uploading"}
          progress={(t.data?.progress as number) || 0}
          message={(t.data?.message as string) || ""}
          {...update}
          onDismiss={() => toast.dismiss(t.id)}
          id={t.id}
        />
      ),
      {
        id,
        data: update,
        duration: update.status === "success" ? 5000 : Infinity,
      }
    );
  };

  return {
    showFileUploadToast,
    updateFileUploadToast,
  };
}

// File Upload Toast Component
interface FileUploadToastComponentProps extends FileUploadToastProps {
  onDismiss: () => void;
  id: string;
}

function FileUploadToast({
  fileName,
  progress = 0,
  status,
  message,
  onCancel,
  onDismiss,
  id,
}: FileUploadToastComponentProps) {
  const getStatusIcon = () => {
    switch (status) {
      case "uploading":
      case "processing":
        return (
          <div className="bg-primary/10 p-2 rounded-full">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          </div>
        );
      case "success":
        return (
          <div className="bg-green-100 p-2 rounded-full">
            <CheckCircle className="h-4 w-4 text-green-600" />
          </div>
        );
      case "error":
        return (
          <div className="bg-red-100 p-2 rounded-full">
            <AlertCircle className="h-4 w-4 text-red-600" />
          </div>
        );
      default:
        return (
          <div className="bg-primary/10 p-2 rounded-full">
            <FileText className="h-4 w-4 text-primary" />
          </div>
        );
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "uploading":
        return message || "Uploading...";
      case "processing":
        return message || "Processing...";
      case "success":
        return message || "Upload complete!";
      case "error":
        return message || "Upload failed";
      default:
        return "Uploading file...";
    }
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow-lg border w-full max-w-md flex gap-3 relative">
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>

      {getStatusIcon()}

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1 pr-4">
          <h3 className="font-medium text-sm truncate">{fileName}</h3>
          {status === "uploading" && (
            <span className="text-xs text-muted-foreground">
              {Math.round(progress)}%
            </span>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{getStatusText()}</p>

          {status === "uploading" && (
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {status === "error" && onCancel && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={onCancel}
            >
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
