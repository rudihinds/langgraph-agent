"use client";

import React from "react";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Calendar,
  CheckCircle2,
  Edit2,
  FileText,
  Building,
  Target,
  DollarSign,
  AlertCircle,
  Check,
  ChevronLeft,
  Save,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { FunderDetails } from "./FunderDetailsView";
import { CheckItem } from "@/components/ui/check-item";
import { z } from "zod";
import { Question } from "./ApplicationQuestionsView";
import { ProposalType } from "./ProposalCreationFlow";
import ServerForm from "./ServerForm";
import { formatDateForAPI, formatDateForUI } from "@/lib/utils/date-utils";

// MODEL
export interface ReviewProposalViewProps {
  onSubmit: (data: any) => void;
  onBack: () => void;
  onEdit: (step: number) => void;
  funderDetails: FunderDetails;
  applicationQuestions: Question[];
  proposalType: ProposalType;
  isSubmitting?: boolean;
  rfpDetails?: any;
}

interface UseReviewProposalModel {
  isSubmitting: boolean;
  handleSubmit: () => void;
  handleBack: () => void;
  handleEdit: (step: number) => void;
  formattedBudget: string;
  preparedFormData: Record<string, any>;
}

function useReviewProposal({
  onSubmit,
  onBack,
  onEdit,
  funderDetails,
  applicationQuestions,
  proposalType,
  rfpDetails,
}: ReviewProposalViewProps): UseReviewProposalModel {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Format budget with commas for readability
  const formattedBudget = funderDetails.budgetRange
    ? `$${parseInt(funderDetails.budgetRange).toLocaleString()}`
    : "Not specified";

  // Prepare form data for submission
  const preparedFormData = {
    // Use only fields that exist in the database schema
    title:
      funderDetails.fundingTitle ||
      funderDetails.organizationName ||
      "Untitled Proposal",
    status: "draft",
    deadline: funderDetails.deadline
      ? funderDetails.deadline.toISOString()
      : null,
    // Use the funder field from the database
    funder: funderDetails.organizationName || "",
    // Store all other data in the metadata JSONB field
    metadata: {
      description: funderDetails.focusArea || "",
      funder_details: {
        funderName: funderDetails.organizationName,
        programName: funderDetails.fundingTitle,
        deadline: funderDetails.deadline
          ? funderDetails.deadline.toISOString()
          : null,
        funderType: "Unknown", // Default value
        budgetRange: funderDetails.budgetRange,
        focusArea: funderDetails.focusArea,
      },
      // Add application questions if we're in application flow
      ...(proposalType === "application"
        ? {
            questions: applicationQuestions.map((q) => {
              // Handle different question formats
              if (typeof q === "string") {
                return { question: q, required: true };
              } else if (q.text) {
                // Convert from { text: "..." } to { question: "..." }
                return {
                  question: q.text,
                  required: q.required ?? true,
                  maxLength: q.maxLength,
                };
              } else if (q.question) {
                // Already in the right format
                return q;
              } else {
                // Fallback for unexpected formats
                console.warn("Unexpected question format:", q);
                return {
                  question: String(q),
                  required: true,
                };
              }
            }),
          }
        : {}),
      // Add RFP document details if we're in RFP flow
      ...(proposalType === "rfp" && rfpDetails
        ? {
            rfp_details: {
              rfpUrl: rfpDetails.rfpUrl || "",
              rfpText: rfpDetails.rfpText || "",
              companyName: rfpDetails.companyName || "",
            },
            rfp_document: rfpDetails.document
              ? {
                  name: rfpDetails.document.name || "",
                  type: rfpDetails.document.type || "",
                  size: rfpDetails.document.size || 0,
                  lastModified: rfpDetails.document.lastModified || 0,
                }
              : null,
          }
        : {}),
      proposal_type: proposalType,
    },
  };

  const handleSubmit = useCallback(() => {
    setIsSubmitting(true);
    // Pass the preparedFormData to ensure proper structure for the database
    console.log("Submitting prepared form data:", preparedFormData);
    onSubmit(preparedFormData);
  }, [preparedFormData, onSubmit]);

  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);

  const handleEdit = useCallback(
    (step: number) => {
      onEdit(step);
    },
    [onEdit]
  );

  return {
    isSubmitting,
    handleSubmit,
    handleBack,
    handleEdit,
    formattedBudget,
    preparedFormData,
  };
}

// VIEW
interface ReviewProposalViewComponentProps extends ReviewProposalViewProps {
  isSubmitting: boolean;
  handleSubmit: () => void;
  handleBack: () => void;
  handleEdit: (step: number) => void;
  formattedBudget: string;
  preparedFormData: Record<string, any>;
}

function ReviewProposalViewComponent({
  funderDetails,
  applicationQuestions,
  isSubmitting,
  handleSubmit,
  handleBack,
  handleEdit,
  formattedBudget,
  proposalType,
  rfpDetails,
  preparedFormData,
  onCancel = handleBack,
}: ReviewProposalViewComponentProps) {
  return (
    <div className="container max-w-5xl px-4 py-8 mx-auto sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-3/4">
          <div className="mb-6">
            <h1 className="mb-2 text-3xl font-bold tracking-tight">
              Review Your Proposal
            </h1>
            <p className="text-lg text-muted-foreground">
              Review your proposal details before submission.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="mb-6 border-0 shadow-md">
              <CardHeader className="pb-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center">
                    <Building className="w-5 h-5 mr-2" />
                    Funder Details
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => handleEdit(1)}
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 bg-white divide-y">
                <div className="grid grid-cols-1 gap-4 py-3 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Organization Name
                    </h3>
                    <p className="font-medium">
                      {funderDetails.organizationName}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Grant/Funding Title
                    </h3>
                    <p className="font-medium">{funderDetails.fundingTitle}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 py-3 md:grid-cols-3">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Submission Deadline
                    </h3>
                    <p className="font-medium flex items-center">
                      <Calendar className="w-4 h-4 mr-1 text-muted-foreground" />
                      {funderDetails.deadline
                        ? format(
                            new Date(funderDetails.deadline),
                            "MMMM d, yyyy"
                          )
                        : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Approximate Budget
                    </h3>
                    <p className="font-medium flex items-center">
                      <DollarSign className="w-4 h-4 mr-1 text-muted-foreground" />
                      {formattedBudget}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Primary Focus Area
                    </h3>
                    <p className="font-medium flex items-center">
                      <Target className="w-4 h-4 mr-1 text-muted-foreground" />
                      {funderDetails.focusArea}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6 border-0 shadow-md">
              <CardHeader className="pb-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    {proposalType === "rfp"
                      ? "RFP Details"
                      : "Application Questions"}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => handleEdit(2)}
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 bg-white">
                <div className="space-y-4">
                  {applicationQuestions && applicationQuestions.length > 0 ? (
                    applicationQuestions.map((question, index) => (
                      <div
                        key={index}
                        className="border-b pb-3 last:border-b-0 last:pb-0"
                      >
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">
                          Question {index + 1}
                        </h3>
                        <p className="font-medium">
                          {typeof question === "string"
                            ? question
                            : question.question}
                        </p>
                      </div>
                    ))
                  ) : proposalType === "rfp" && rfpDetails?.file ? (
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 mr-3 text-blue-500" />
                      <div>
                        <p className="font-medium">{rfpDetails.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(rfpDetails.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-6 text-muted-foreground">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      No{" "}
                      {proposalType === "rfp"
                        ? "RFP document"
                        : "application questions"}{" "}
                      provided.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="lg:w-1/4">
          <div className="sticky space-y-6 top-32">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Final Steps</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-4">
                  Please review all information carefully before submitting your
                  proposal. Once submitted:
                </p>
                <ul className="space-y-2.5">
                  <CheckItem>
                    Your proposal will be saved to your dashboard
                  </CheckItem>
                  <CheckItem>
                    You'll be able to edit it later if needed
                  </CheckItem>
                  <CheckItem>You'll receive a confirmation email</CheckItem>
                </ul>
              </CardContent>
            </Card>

            <ServerForm
              proposalType={proposalType}
              formData={preparedFormData}
              file={proposalType === "rfp" ? rfpDetails?.file : null}
              onCancel={handleBack}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// COMPONENT
export default function ReviewProposalView(props: ReviewProposalViewProps) {
  const model = useReviewProposal(props);
  return <ReviewProposalViewComponent {...props} {...model} />;
}
