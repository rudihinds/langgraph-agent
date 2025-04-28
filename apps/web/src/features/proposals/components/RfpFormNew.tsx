"use client";

import React, { useState } from "react";
import { FormOverlay } from "./FormOverlay";
import { useFileUploadToast } from "./UploadToast";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/features/ui/components/card";
import { Button } from "@/features/ui/components/button";
import { uploadProposalFileEnhanced } from "@/features/proposals/api/actions";
import { AppointmentPicker } from "@/features/ui/components/appointment-picker";
import { formatDateForAPI } from "@/lib/utils/date-utils";
import { FormErrorBoundary } from "@/features/ui/components/form-error";
import { FormField } from "@/features/ui/components/form-field";
import { FileUploadField } from "@/features/ui/components/file-upload-field";
import { useZodForm } from "@/lib/forms/useZodForm";
import {
  rfpFormSchema,
  RfpFormValues,
} from "@/lib/forms/schemas/rfp-form-schema";

type RfpFormProps = {
  userId: string;
  onSuccess?: (proposalId: string) => void;
};

export function RfpForm({ userId, onSuccess }: RfpFormProps) {
  // Track overlay and form submission state
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [currentOverlayStep, setCurrentOverlayStep] = useState(0);
  const [proposalId, setProposalId] = useState<string | null>(null);

  // File upload handling
  const [file, setFile] = useState<File | null>(null);

  // Use the form validation hook
  const { values, errors, isSubmitting, setValue, handleSubmit } =
    useZodForm(rfpFormSchema);

  // Use the toast hook
  const fileUploadToast = useFileUploadToast();
  const showToast = fileUploadToast?.showFileUploadToast || (() => "toast-id");
  const updateToast = fileUploadToast?.updateFileUploadToast || (() => {});

  // File handling functions
  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setValue("file", selectedFile);
  };

  // Handle form submission
  const onSubmit = handleSubmit(async (formValues: RfpFormValues) => {
    try {
      // Start overlay and progress indicators
      setOverlayVisible(true);
      setCurrentOverlayStep(0);

      // Show toast for the upload process
      const toastId = showToast({
        fileName: formValues.file.name,
        status: "uploading",
        progress: 10,
      });

      // Validating step
      await new Promise((resolve) => setTimeout(resolve, 500));
      setCurrentOverlayStep(1);
      updateToast(toastId, {
        progress: 30,
        status: "uploading",
        message: "Creating proposal...",
      });

      // Uploading step
      await new Promise((resolve) => setTimeout(resolve, 500));
      setCurrentOverlayStep(2);
      updateToast(toastId, {
        progress: 60,
        status: "uploading",
        message: "Uploading document...",
      });

      // Perform the actual upload
      const result = await uploadProposalFileEnhanced({
        userId,
        title: formValues.title,
        description: formValues.description,
        deadline: formatDateForAPI(formValues.deadline),
        fundingAmount: formValues.fundingAmount,
        file: formValues.file,
      });

      // Handle success
      if (result.success && result.proposalId) {
        setProposalId(result.proposalId);
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
      // Reset UI for error state
      setOverlayVisible(false);

      // Show error toast
      showToast({
        fileName: formValues.file.name,
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to upload document",
      });

      throw error; // Let the form hook handle the error
    }
  });

  // Define accepted file types
  const ACCEPTED_FILE_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  return (
    <FormErrorBoundary initialErrors={errors}>
      <form onSubmit={onSubmit} className="max-w-2xl mx-auto space-y-4">
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

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3 border-b bg-muted/30">
            <CardTitle>Upload RFP Document</CardTitle>
            <CardDescription>
              Enter information about the RFP and upload the document
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Required fields indicator */}
            <p className="mb-2 text-xs text-muted-foreground">
              <span className="text-destructive">*</span> Required fields
            </p>

            {/* Title field */}
            <FormField
              id="title"
              type="text"
              label="Title"
              value={values.title || ""}
              onChange={(value) => setValue("title", value)}
              error={errors.title}
              required
              placeholder="Enter a title for this RFP"
            />

            {/* Description field */}
            <FormField
              id="description"
              type="textarea"
              label="Description"
              value={values.description || ""}
              onChange={(value) => setValue("description", value)}
              error={errors.description}
              required
              placeholder="Enter a brief description of this RFP"
              rows={4}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Deadline field */}
              <FormField
                id="deadline"
                type="date"
                label="Submission Deadline"
                value={values.deadline}
                onChange={(date) => setValue("deadline", date)}
                error={errors.deadline}
                required
                DatePickerComponent={AppointmentPicker}
                allowManualInput={true}
              />

              {/* Funding Amount field */}
              <FormField
                id="fundingAmount"
                type="text"
                label="Funding Amount"
                value={values.fundingAmount || ""}
                onChange={(value) => setValue("fundingAmount", value)}
                error={errors.fundingAmount}
                required
                placeholder="e.g. 10000"
                inputMode="numeric"
              />
            </div>

            {/* File upload field */}
            <FileUploadField
              id="file-upload"
              label="RFP Document"
              file={file}
              onChange={handleFileChange}
              error={errors.file}
              required
              maxSize={50 * 1024 * 1024} // 50MB
              acceptedTypes={ACCEPTED_FILE_TYPES}
              supportedFormatsText="Supported formats: PDF, DOC, DOCX, TXT, XLS, XLSX (max 50MB)"
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Button
            type="submit"
            className="w-full md:w-auto"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </FormErrorBoundary>
  );
}
