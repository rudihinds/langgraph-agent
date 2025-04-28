"use client";

import React, { useState, useRef, useEffect } from "react";
import { FilePreview } from "./FilePreview";
import { SubmitButton } from "./SubmitButton";
import { FormOverlay } from "./FormOverlay";
import { useFileUploadToast } from "./UploadToast";
import { Input } from "@/features/ui/components/input";
import { Label } from "@/features/ui/components/label";
import { Textarea } from "@/features/ui/components/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/features/ui/components/card";
import { Button } from "@/features/ui/components/button";
import { cn } from "@/lib/utils/utils";
import { uploadProposalFileEnhanced } from "@/features/proposals/api/actions";
import { FileCheck, Upload, AlertCircle } from "lucide-react";
import { DatePicker } from "@/features/ui/components/date-picker";
import { format } from "date-fns";
import { AppointmentPicker } from "@/features/ui/components/appointment-picker";
import { formatDateForAPI } from "@/lib/utils/date-utils";
import { FormErrorBoundary, FieldError } from "@/features/ui/components/form-error";

// Simple validation helper function
const validateField = (
  value: string,
  minLength: number,
  fieldName: string
): string | null => {
  if (!value.trim()) return `${fieldName} is required`;
  if (value.trim().length < minLength)
    return `${fieldName} must be at least ${minLength} characters`;
  return null;
};

type RfpFormProps = {
  userId: string;
  onSuccess?: (proposalId: string) => void;
};

export function RfpForm({ userId, onSuccess }: RfpFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: number;
    type: string;
    isValid: boolean;
  } | null>(null);
  const [formStep, setFormStep] = useState<number>(1); // 1: Form, 2: Validating, 3: Creating, 4: Uploading, 5: Completed
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [currentOverlayStep, setCurrentOverlayStep] = useState(0);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [fundingAmount, setFundingAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Use the hook if available, otherwise provide fallbacks
  const fileUploadToast = useFileUploadToast();
  const showToast = fileUploadToast?.showFileUploadToast || (() => "toast-id");
  const updateToast = fileUploadToast?.updateFileUploadToast || (() => {});

  // File size limit in bytes (50MB)
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const ACCEPTED_FILE_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);

    if (selectedFile) {
      const isValidType = ACCEPTED_FILE_TYPES.includes(selectedFile.type);
      const isValidSize = selectedFile.size <= MAX_FILE_SIZE;
      const isValid = isValidType && isValidSize;

      setFileInfo({
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        isValid,
      });

      if (!isValid) {
        if (!isValidType) {
          setErrors((prev) => ({
            ...prev,
            file: "File type not supported. Please upload PDF, DOC, DOCX, TXT, XLS, or XLSX.",
          }));
        } else if (!isValidSize) {
          setErrors((prev) => ({
            ...prev,
            file: "File size exceeds 50MB limit.",
          }));
        }
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.file;
          return newErrors;
        });
      }
    } else {
      setFileInfo(null);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.file;
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    try {
      console.log("Validating RFP form data");

      const newErrors: Record<string, string> = {};
      let isValid = true;

      // Validate title
      const titleError = validateField(title, 5, "Title");
      if (titleError) {
        console.log("Validation error: Title is invalid");
        newErrors.title = titleError;
        isValid = false;
      }

      // Validate description
      const descriptionError = validateField(description, 10, "Description");
      if (descriptionError) {
        console.log("Validation error: Description is invalid");
        newErrors.description = descriptionError;
        isValid = false;
      }

      // Validate deadline
      const deadlineError = !deadline ? "Deadline is required" : null;
      if (deadlineError) {
        console.log("Validation error: Deadline is missing");
        newErrors.deadline = deadlineError;
        isValid = false;
      }

      // Validate funding amount
      const fundingAmountError = validateField(
        fundingAmount,
        1,
        "Funding Amount"
      );
      if (fundingAmountError) {
        console.log("Validation error: Funding amount is invalid");
        newErrors.fundingAmount = fundingAmountError;
        isValid = false;
      } else if (!/^\d+(\.\d{1,2})?$/.test(fundingAmount)) {
        console.log("Validation error: Funding amount format is invalid");
        newErrors.fundingAmount =
          "Please enter a valid funding amount (e.g., 10000 or 10000.00)";
        isValid = false;
      }

      // Validate file upload
      if (!file || !fileInfo?.isValid) {
        console.log("Validation error: File is missing or invalid");
        newErrors.file = "Please select a valid file to upload.";
        isValid = false;
      }

      // Add a generic _form error if validation failed
      if (!isValid) {
        console.log("Form validation failed with errors:", newErrors);
      } else {
        console.log("Form validation successful");
      }

      setErrors(newErrors);
      return isValid;
    } catch (error) {
      console.error("Unexpected error during form validation:", error);
      setErrors({
        _form: "An unexpected error occurred during validation.",
      });
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Submit button clicked, validating form...");

    const isValid = validateForm();
    console.log(
      "Form validation result:",
      isValid ? "Valid" : "Invalid",
      isValid ? "" : "Errors:",
      isValid ? "" : errors
    );

    if (!isValid) {
      console.log("Attempting to focus the first field with an error");

      // Focus the first field with an error (excluding _form which is a general error)
      const firstErrorField = Object.keys(errors).find(
        (key) => key !== "_form"
      );

      if (firstErrorField) {
        const field = document.getElementById(firstErrorField);
        if (field) {
          console.log(`Focusing on field: ${firstErrorField}`);
          field.focus();
          field.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }

      // Show a toast notification
      showToast({
        fileName: file?.name || "Form",
        status: "error",
        message: "Please correct the validation errors before continuing",
      });

      return;
    }

    if (isSubmitting) {
      console.log(
        "Form is already submitting, ignoring additional submit request"
      );
      return;
    }

    console.log("Form is valid, proceeding with submission");
    setIsSubmitting(true);

    try {
      // Start overlay and progress indicators
      setOverlayVisible(true);
      setFormStep(2); // Validating
      console.log("Starting form submission process: Validating");

      // Show toast for the upload process
      const toastId = showToast({
        fileName: file!.name,
        status: "uploading",
        progress: 10,
      });

      // Validating step
      await new Promise((resolve) => setTimeout(resolve, 500));
      setFormStep(3); // Creating
      setCurrentOverlayStep(1);
      console.log("Form submission step: Creating");
      updateToast(toastId, {
        progress: 30,
        status: "uploading",
        message: "Creating proposal...",
      });

      // Uploading step
      await new Promise((resolve) => setTimeout(resolve, 500));
      setFormStep(4); // Uploading
      setCurrentOverlayStep(2);
      console.log("Form submission step: Uploading");
      updateToast(toastId, {
        progress: 60,
        status: "uploading",
        message: "Uploading document...",
      });

      // Perform the actual upload
      console.log("Calling uploadProposalFile API");
      const result = await uploadProposalFileEnhanced({
        userId,
        title,
        description,
        deadline: deadline ? formatDateForAPI(deadline) : "",
        fundingAmount: fundingAmount || "",
        file: file!,
      });

      // Handle success
      if (result.success && result.proposalId) {
        setProposalId(result.proposalId);
        setFormStep(5); // Completed
        setCurrentOverlayStep(3);

        updateToast(toastId, {
          progress: 100,
          status: "success",
          message: "Document uploaded successfully!",
        });

        // Close overlay after short delay
        setTimeout(() => {
          setOverlayVisible(false);
          if (result.proposalId && onSuccess) {
            onSuccess(result.proposalId);
          }
        }, 1500);
      } else {
        // Try parsing Zod error from the server
        let errorMessage = result.error || "Failed to upload document";
        try {
          const parsedError = JSON.parse(errorMessage);
          // Format Zod error messages if possible
          const messages = Object.values(parsedError).flat().join(", ");
          if (messages) errorMessage = messages;
        } catch (e) {
          // Ignore if parsing fails, use original error string
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Upload error:", error);

      // Update UI for error state
      setFormStep(1);
      setOverlayVisible(false);

      // Show error toast
      showToast({
        fileName: file!.name,
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to upload document",
      });

      setErrors((prev) => ({
        ...prev,
        submit:
          error instanceof Error ? error.message : "Failed to upload document",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormErrorBoundary initialErrors={errors}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Form overlay for progress feedback */}
        {overlayVisible && (
          <FormOverlay
            isVisible={overlayVisible}
            currentStep={currentOverlayStep}
            onComplete={() => {
              setOverlayVisible(false);
              if (proposalId && onSuccess) onSuccess(proposalId);
            }}
          />
        )}

        <Card className="shadow-md border-0">
          <CardHeader className="bg-muted/30 border-b pb-3">
            <CardTitle>Upload RFP Document</CardTitle>
            <CardDescription>
              Enter information about the RFP and upload the document
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Required fields indicator */}
            <p className="text-xs text-muted-foreground mb-2">
              <span className="text-destructive">*</span> Required fields
            </p>

            {/* Title field */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-base font-medium">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for this RFP"
                className={cn(
                  errors.title
                    ? "border-destructive/70 ring-0 focus-visible:ring-destructive/30"
                    : "border-input"
                )}
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? "title-error" : undefined}
              />
              {errors.title && (
                <FieldError error={errors.title} id="title-error" />
              )}
            </div>

            {/* Description field */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-base font-medium">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a brief description of this RFP"
                className={cn(
                  "h-20 resize-none",
                  errors.description
                    ? "border-destructive/70 ring-0 focus-visible:ring-destructive/30"
                    : "border-input"
                )}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? "desc-error" : undefined}
              />
              {errors.description && (
                <FieldError error={errors.description} id="desc-error" />
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Deadline field */}
              <div className="space-y-1.5">
                <Label htmlFor="deadline" className="text-base font-medium">
                  Submission Deadline{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div
                  className={cn(
                    "rounded-md",
                    errors.deadline ? "border-destructive/70" : ""
                  )}
                >
                  <AppointmentPicker
                    date={deadline}
                    onDateChange={setDeadline}
                    label=""
                    error={errors.deadline}
                    className="w-full"
                    allowManualInput={true}
                  />
                </div>
              </div>

              {/* Funding Amount field */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="fundingAmount"
                  className="text-base font-medium"
                >
                  Funding Amount <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fundingAmount"
                  type="text"
                  inputMode="numeric"
                  value={fundingAmount}
                  onChange={(e) => setFundingAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  className={cn(
                    errors.fundingAmount
                      ? "border-destructive/70 ring-0 focus-visible:ring-destructive/30"
                      : "border-input"
                  )}
                  aria-invalid={!!errors.fundingAmount}
                  aria-describedby={
                    errors.fundingAmount ? "amount-error" : undefined
                  }
                />
                {errors.fundingAmount && (
                  <FieldError error={errors.fundingAmount} id="amount-error" />
                )}
              </div>
            </div>

            {/* File upload field */}
            <div className="space-y-1.5">
              <Label htmlFor="file-upload" className="text-base font-medium">
                RFP Document <span className="text-destructive">*</span>
              </Label>

              <div
                className={cn(
                  "border rounded-md p-3",
                  errors.file ? "border-destructive/70" : "border-border"
                )}
              >
                {!fileInfo && (
                  <div className="flex flex-col items-center justify-center py-3">
                    <Upload className="w-6 h-6 mb-1.5 text-muted-foreground" />
                    <p className="mb-1 text-sm font-medium">
                      Drag and drop or click to upload
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Supported formats: PDF, DOC, DOCX, TXT, XLS, XLSX (max
                      50MB)
                    </p>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleFileChange(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1"
                      onClick={() => {
                        document.getElementById("file-upload")?.click();
                      }}
                    >
                      Select File
                    </Button>
                  </div>
                )}

                {fileInfo && (
                  <FilePreview
                    file={file}
                    onFileChange={handleFileChange}
                    maxSize={MAX_FILE_SIZE}
                    acceptedTypes={ACCEPTED_FILE_TYPES}
                  />
                )}
              </div>

              {errors.file && (
                <FieldError error={errors.file} id="file-error" />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Button type="submit" className="w-full md:w-auto" size="lg">
            Create
          </Button>
        </div>
      </form>
    </FormErrorBoundary>
  );
}
