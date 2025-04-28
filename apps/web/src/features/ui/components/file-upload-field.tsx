import React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/features/ui/components/button";
import { Label } from "@/features/ui/components/label";
import { FieldError } from "@/features/ui/components/form-error";
import { FilePreview } from "@/features/proposals/components/FilePreview";
import { cn } from "@/lib/utils/utils";

export type FileUploadFieldProps = {
  id: string;
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  required?: boolean;
  maxSize?: number;
  acceptedTypes?: string[];
  className?: string;
  description?: string;
  supportedFormatsText?: string;
};

export function FileUploadField({
  id,
  label,
  file,
  onChange,
  error,
  required = false,
  maxSize = 50 * 1024 * 1024, // 50MB default
  acceptedTypes = [],
  className,
  description,
  supportedFormatsText,
}: FileUploadFieldProps) {
  const fileInfo = file
    ? {
        name: file.name,
        size: file.size,
        type: file.type,
        isValid:
          file.size <= maxSize &&
          (acceptedTypes.length === 0 || acceptedTypes.includes(file.type)),
      }
    : null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-base font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      <div
        className={cn(
          "border rounded-md p-3",
          error ? "border-destructive/70" : "border-border"
        )}
      >
        {!fileInfo && (
          <div className="flex flex-col items-center justify-center py-3">
            <Upload className="w-6 h-6 mb-1.5 text-muted-foreground" />
            <p className="mb-1 text-sm font-medium">
              Drag and drop or click to upload
            </p>
            {supportedFormatsText && (
              <p className="text-xs text-muted-foreground mb-2">
                {supportedFormatsText}
              </p>
            )}
            <input
              id={id}
              type="file"
              accept={acceptedTypes.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                onChange(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => {
                document.getElementById(id)?.click();
              }}
            >
              Select File
            </Button>
          </div>
        )}

        {file && fileInfo && (
          <FilePreview
            file={file}
            onFileChange={onChange}
            maxSize={maxSize}
            acceptedTypes={acceptedTypes}
          />
        )}
      </div>

      {error && <FieldError error={error} id={`${id}-error`} />}
    </div>
  );
}
