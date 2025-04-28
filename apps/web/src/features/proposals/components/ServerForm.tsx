"use client";

import { useRef, useState, FormEvent, useEffect, ChangeEvent } from "react";
import { createProposal, uploadProposalFile } from "@/features/proposals/api";
import { Button } from "@/features/ui/components/button";
import { useRouter } from "next/navigation";
import { useToast } from "@/features/ui/components/use-toast";
import { toast as sonnerToast } from "sonner";
import { useRequireAuth, signOut } from "@/lib/supabase/auth";
import { Loader2, Upload, FileText, Trash, Info } from "lucide-react";
import { UploadResult } from "@/features/proposals/api";
import { Input } from "@/features/ui/components/input";
import { Label } from "@/features/ui/components/label";
import { Alert, AlertTitle, AlertDescription } from "@/features/ui/components/alert";
import { cn } from "@/lib/utils/utils";
import { z } from "zod";

interface ServerFormProps {
  proposalType: "rfp" | "application";
  formData: Record<string, any>;
  file?: File | null;
  onCancel: () => void;
  className?: string;
}

export default function ServerForm({
  proposalType,
  formData,
  file: initialFile,
  onCancel,
  className,
}: ServerFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingUser, setIsVerifyingUser] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(
    initialFile || null
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileValidation, setFileValidation] = useState<{
    isValid: boolean;
    message?: string;
  }>({ isValid: true });

  const router = useRouter();
  const { toast } = useToast();

  const { user, loading, error } = useRequireAuth();

  useEffect(() => {
    if (user && !loading) {
      const verifyUserInDatabase = async () => {
        try {
          setIsVerifyingUser(true);

          console.log("Starting user verification process...");

          const response = await fetch("/api/auth/verify-user", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          });

          console.log(`Verification response status: ${response.status}`);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("User verification failed:", errorData);

            if (response.status === 401) {
              setIsVerifyingUser(false);
              toast({
                title: "Authentication Required",
                description: "Please log in to continue",
                variant: "destructive",
              });
              router.push("/login");
              return false;
            } else {
              setIsVerifyingUser(false);
              toast({
                title: "Verification Error",
                description:
                  errorData.error || "Verification failed. Please try again.",
                variant: "destructive",
              });
              console.error(`Verification error: ${JSON.stringify(errorData)}`);
              return false;
            }
          }

          const data = await response.json();
          console.log("Verification successful:", data.success);

          if (data.success) {
            setIsVerifyingUser(false);
            toast({
              title: "Success!",
              description: "Account verified successfully",
            });
            return true;
          } else {
            setIsVerifyingUser(false);
            toast({
              title: "Verification Error",
              description: data.error || "Unknown verification error",
              variant: "destructive",
            });
            console.error("Verification failed:", data.error);
            return false;
          }
        } catch (error) {
          console.error("Error during user verification:", error);
          setIsVerifyingUser(false);
          toast({
            title: "Network Error",
            description:
              "Network error. Please check your connection and try again.",
            variant: "destructive",
          });
          return false;
        }
      };

      verifyUserInDatabase();
    }
  }, [user, loading, toast, router]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Authentication Error",
        description: "Please log in to create a proposal.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // File selection handler
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setUploadError(null);

    // Validation logic
    if (file) {
      const isSizeValid = file.size <= 5 * 1024 * 1024; // 5MB limit
      const fileType = file.type;
      const isTypeValid = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
      ].includes(fileType);

      setFileValidation({
        isValid: isSizeValid && isTypeValid,
        message: !isSizeValid
          ? "File too large (max 5MB)"
          : !isTypeValid
            ? "Invalid file type (PDF or DOCX only)"
            : undefined,
      });
    } else {
      setFileValidation({ isValid: true });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(`[ServerForm] Form submission for ${proposalType} proposal`);

    if (!user && !loading) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to create a proposal.",
        variant: "destructive",
      });
      router.push("/login");
      return;
    }

    if (isVerifyingUser) {
      toast({
        title: "Please Wait",
        description:
          "We're verifying your account. Please try again in a moment.",
      });
      return;
    }

    // If this is an RFP proposal and needs a file, validate it
    if (proposalType === "rfp" && selectedFile && !fileValidation.isValid) {
      toast({
        title: "Invalid File",
        description: fileValidation.message || "Please select a valid file.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = new FormData();

      // Append all form fields EXCEPT the file to the first FormData
      submitData.append("proposal_type", proposalType);
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (key === "metadata") {
            submitData.append(key, JSON.stringify(value));
          } else if (value instanceof Date) {
            submitData.append(key, value.toISOString());
          } else if (typeof value === "object") {
            submitData.append(key, JSON.stringify(value));
          } else {
            submitData.append(key, String(value));
          }
        }
      });

      // 1. Call createProposal (which no longer handles files)
      const createResult = await createProposal(submitData);

      if (!createResult.success || !createResult.proposal?.id) {
        if (createResult.error?.includes("session")) {
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive",
          });
          await signOut("/login?error=session_expired");
          setIsSubmitting(false);
          return;
        }
        throw new Error(createResult.error || "Failed to create proposal");
      }

      const newProposalId = createResult.proposal.id;

      // 2. If a file was selected, call uploadProposalFile
      let uploadOk = true;
      if (selectedFile) {
        // Prepare file upload data
        const fileData = new FormData();
        fileData.append("file", selectedFile);
        fileData.append("proposalId", newProposalId);

        // Show a loading toast during upload
        const uploadPromise = uploadProposalFile(fileData);

        try {
          // Show toast for the upload process
          sonnerToast.promise(uploadPromise, {
            loading: "Uploading document...",
            success: "Document uploaded successfully!",
            error: "Failed to upload document.",
          });

          // Await the actual result separately
          const uploadResult = await uploadPromise;

          if (!uploadResult.success) {
            console.error(
              "[ServerForm] File upload failed:",
              uploadResult.message || "Unknown error"
            );
            uploadOk = false;
          }
        } catch (uploadError) {
          console.error("[ServerForm] Upload error:", uploadError);
          uploadOk = false;
        }
      }

      if (uploadOk) {
        toast({
          title: "Success!",
          description: "Your proposal has been created.",
        });

        // Redirect to the success page
        router.push("/proposals/created");
      } else {
        toast({
          title: "Partial Success",
          description:
            "Proposal created but file upload failed. Try uploading again later.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("[ServerForm] Submission error:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isVerifyingUser) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Authentication error. Please try logging in again.
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={cn("space-y-6", className)}
    >
      <input type="hidden" name="proposal_type" value={proposalType} />

      {proposalType === "rfp" && (
        <div className="space-y-4">
          <Label htmlFor="rfpDocument" className="block text-sm font-medium">
            Upload RFP Document (PDF or DOCX, max 5MB)
          </Label>

          <div className="flex items-center gap-2 mb-2">
            <label
              htmlFor="file-upload"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-input bg-background",
                "hover:bg-muted cursor-pointer"
              )}
            >
              <Upload className="w-4 h-4" />
              {selectedFile ? "Change File" : "Upload RFP File"}
            </label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedFile && (
              <div className="flex items-center gap-1.5 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedFile(null);
                    setFileValidation({ isValid: true });
                  }}
                  className="w-6 h-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove file"
                >
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {fileValidation.message && (
            <p className="flex items-center text-sm text-destructive">
              <Info className="w-3.5 h-3.5 mr-1" />
              {fileValidation.message}
            </p>
          )}

          {uploadError && (
            <Alert variant="destructive" className="mt-2">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="flex flex-col pt-4 space-y-3">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={
            isSubmitting ||
            isVerifyingUser ||
            (proposalType === "rfp" &&
              !!selectedFile &&
              !fileValidation.isValid)
          }
        >
          {isSubmitting ? (
            <>
              <Loader2
                className="w-4 h-4 mr-2 animate-spin"
                data-testid="submitting-indicator"
              />
              Submitting...
            </>
          ) : (
            "Create Proposal"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full"
        >
          Back
        </Button>
      </div>
    </form>
  );
}
