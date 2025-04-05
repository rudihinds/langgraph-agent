"use client";

import { useRef, useState, FormEvent, useEffect } from "react";
import {
  createProposal,
  uploadProposalFile,
} from "@/app/api/proposals/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useRequireAuth, signOut } from "@/lib/client-auth";
import { ensureUserExists } from "@/lib/user-management";

interface ServerFormProps {
  proposalType: "rfp" | "application";
  formData: Record<string, any>;
  file?: File | null;
  onCancel: () => void;
}

export default function ServerForm({
  proposalType,
  formData,
  file,
  onCancel,
}: ServerFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingUser, setIsVerifyingUser] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Use the authentication hook to ensure the user is logged in
  const { user, loading, error } = useRequireAuth();

  // When component mounts, make a server call to ensure the user exists in our database
  useEffect(() => {
    if (user && !loading) {
      const verifyUserInDatabase = async () => {
        try {
          // Show loading state while verifying
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
              // User is not authenticated
              setIsVerifyingUser(false);
              toast({
                title: "Authentication Required",
                description: "Please log in to continue",
                variant: "destructive",
              });
              router.push("/login");
              return false;
            } else {
              // General error
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

  // Show error if authentication failed
  useEffect(() => {
    if (error) {
      toast({
        title: "Authentication Error",
        description: "Please log in to create a proposal.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Double-check authentication before proceeding
    if (!user && !loading) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to create a proposal.",
        variant: "destructive",
      });
      router.push("/login");
      return;
    }

    // Don't allow submission during verification
    if (isVerifyingUser) {
      toast({
        title: "Please Wait",
        description:
          "We're verifying your account. Please try again in a moment.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the FormData object
      const submitData = new FormData();

      // Add all form fields
      submitData.append("proposal_type", proposalType);

      // Add all the data from formData
      console.log("Preparing form data for submission:", formData);
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (key === "metadata") {
            // Always stringify the metadata object
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

      // Debug what we're submitting
      console.log("Form data ready for submission");

      // Submit the proposal
      console.log("Calling createProposal with form data");
      const result = await createProposal(submitData);
      console.log("Received result from createProposal:", result);

      if (!result.success) {
        // Handle different types of errors
        if (
          result.error?.includes("must be logged in") ||
          result.error?.includes("authentication") ||
          result.error?.includes("authenticated") ||
          result.error?.includes("session")
        ) {
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive",
          });
          await signOut("/login?error=session_expired");
          return;
        }

        throw new Error(result.error || "Failed to create proposal");
      }

      // If there's a file and the proposal was created successfully, upload it
      if (file && result.proposal?.id) {
        console.log(
          "Preparing to upload file:",
          file.name,
          "for proposal:",
          result.proposal.id
        );
        const fileData = new FormData();
        fileData.append("file", file);
        fileData.append("proposalId", result.proposal.id);

        const uploadResult = await uploadProposalFile(fileData);
        console.log("File upload result:", uploadResult);

        if (!uploadResult.success) {
          console.error("File upload failed:", uploadResult.error);
          toast({
            title: "Warning",
            description:
              "Proposal created but file upload failed. You can try uploading again later.",
            variant: "destructive",
          });
        } else {
          console.log("File uploaded successfully:", uploadResult.filePath);
          toast({
            title: "Success",
            description: "Proposal and document uploaded successfully.",
          });
        }
      }

      // Show success toast
      toast({
        title: "Success!",
        description: "Your proposal has been created successfully.",
      });

      // Navigate to success page
      router.push("/proposals/created");
    } catch (error) {
      console.error("Error submitting proposal:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create proposal",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // If still loading authentication, show loading state
  if (loading || isVerifyingUser) {
    return (
      <div className="flex justify-center py-8">
        {loading ? "Checking authentication..." : "Verifying your account..."}
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Hidden fields for the form data - we handle this in the submit handler */}
      <input type="hidden" name="proposal_type" value={proposalType} />

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>

        <Button type="submit" disabled={isSubmitting || !user}>
          {isSubmitting ? "Submitting..." : "Submit Proposal"}
        </Button>
      </div>
    </form>
  );
}
