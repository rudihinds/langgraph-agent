"use client";

import React, { useState, useRef, useEffect } from "react";
import { FilePreview } from "./FilePreview";
import { SubmitButton } from "./SubmitButton";
import { FormOverlay } from "./FormOverlay";
import { useFileUploadToast } from "./UploadToast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadProposalFile } from "@/lib/proposal-actions/actions";
import { FileCheck, Upload, AlertCircle } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { AppointmentPicker } from "@/components/ui/appointment-picker";
import { formatDateForAPI } from "@/lib/utils/date-utils";

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

type EnhancedRfpFormProps = {
  userId: string;
  onSuccess?: (proposalId: string) => void;
};

export function EnhancedRfpForm({ userId, onSuccess }: EnhancedRfpFormProps) {
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
    const newErrors: Record<string, string> = {};

    const titleError = validateField(title, 5, "Title");
    if (titleError) newErrors.title = titleError;

    const descriptionError = validateField(description, 10, "Description");
    if (descriptionError) newErrors.description = descriptionError;

    const deadlineError = !deadline ? "Deadline is required" : null;
    if (deadlineError) {
      newErrors.deadline = deadlineError;
    }

    const fundingAmountError = validateField(
      fundingAmount,
      1,
      "Funding Amount"
    );
    if (fundingAmountError) {
      newErrors.fundingAmount = fundingAmountError;
    } else if (!/^\d+(\.\d{1,2})?$/.test(fundingAmount)) {
      newErrors.fundingAmount =
        "Please enter a valid funding amount (e.g., 10000 or 10000.00)";
    }

    if (!file || !fileInfo?.isValid) {
      newErrors.file = "Please select a valid file to upload.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Start overlay and progress indicators
      setOverlayVisible(true);
      setFormStep(2); // Validating

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
      updateToast(toastId, {
        progress: 30,
        status: "uploading",
        message: "Creating proposal...",
      });

      // Uploading step
      await new Promise((resolve) => setTimeout(resolve, 500));
      setFormStep(4); // Uploading
      setCurrentOverlayStep(2);
      updateToast(toastId, {
        progress: 60,
        status: "uploading",
        message: "Uploading document...",
      });

      // Perform the actual upload
      const result = await uploadProposalFile({
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
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Remove the entire Progress Stepper section */}
      {/* 
      <ProgressStepper
        activeStep={formStep}
        steps={[
          { title: "Information", description: "Enter proposal details" },
          { title: "Validating", description: "Checking document" },
          { title: "Creating", description: "Creating proposal" },
          { title: "Uploading", description: "Uploading document" },
          { title: "Completed", description: "Process complete" },
        ]}
        fixed={true}
      /> 
      */}

      {/* Remove the extra padding div, as the stepper is gone */}
      {/* <div className="pt-8"> */}
      {/* Ensure the Card has some top margin now */}
      <Card className="mt-8 shadow-md">
        <CardHeader>
          {/* Remove the CardTitle */}
          <CardTitle className="text-2xl">Create New Proposal</CardTitle>
          <CardDescription>
            Upload an RFP document to create a new proposal. Supported formats
            include PDF, DOC, DOCX, TXT, XLS, and XLSX.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Proposal Title</Label>
              <Input
                id="title"
                placeholder="Enter the title of your proposal"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={cn(errors.title && "border-destructive")}
              />
              {errors.title && (
                <p className="text-sm font-medium text-destructive">
                  {errors.title}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Provide a brief description of the proposal"
                className={cn(
                  "min-h-24",
                  errors.description && "border-destructive"
                )}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {errors.description && (
                <p className="text-sm font-medium text-destructive">
                  {errors.description}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Submission Deadline</Label>
              <AppointmentPicker
                date={deadline}
                onDateChange={setDeadline}
                label=""
                error={errors.deadline}
                className="w-full"
                allowManualInput={true}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fundingAmount">Funding Amount</Label>
              <Input
                id="fundingAmount"
                type="text"
                placeholder="Enter the funding amount"
                className={cn(errors.fundingAmount && "border-destructive")}
                value={fundingAmount}
                onChange={(e) => setFundingAmount(e.target.value)}
              />
              {errors.fundingAmount && (
                <p className="text-sm font-medium text-destructive">
                  {errors.fundingAmount}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">RFP Document</Label>
              <FilePreview
                file={file}
                onFileChange={handleFileChange}
                maxSize={MAX_FILE_SIZE}
                acceptedTypes={ACCEPTED_FILE_TYPES}
              />
              {errors.file && (
                <p className="text-sm font-medium text-destructive">
                  {errors.file}
                </p>
              )}
            </div>

            {errors.submit && (
              <div className="flex items-start gap-2 p-3 border rounded-md bg-destructive/10 border-destructive text-destructive">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{errors.submit}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <SubmitButton
                type="submit"
                disabled={!fileInfo?.isValid || isSubmitting}
                state={isSubmitting ? "loading" : "idle"}
                loadingText="Uploading..."
                successText="Uploaded!"
                errorText="Failed"
                disabledText="Select Valid File"
                icon={<Upload className="w-4 h-4 mr-2" />}
                successIcon={<FileCheck className="w-4 h-4 mr-2" />}
              >
                Upload RFP
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
      {/* Remove the closing div for the extra padding */}
      {/* </div> */}

      {/* Loading Overlay */}
      <FormOverlay
        isVisible={overlayVisible}
        currentStep={currentOverlayStep}
        onComplete={() => {
          setOverlayVisible(false);
          if (proposalId && onSuccess) onSuccess(proposalId);
        }}
      />
    </div>
  );
}
