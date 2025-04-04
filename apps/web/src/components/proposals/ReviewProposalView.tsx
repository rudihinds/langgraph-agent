"use client";

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
import { z } from "zod";

// MODEL
export interface ReviewProposalViewProps {
  onSubmit: (data: any) => void;
  onBack: () => void;
  onEdit: (step: number) => void;
  funderDetails: FunderDetails;
  applicationQuestions: string[];
}

interface UseReviewProposalModel {
  isSubmitting: boolean;
  handleSubmit: () => void;
  handleBack: () => void;
  handleEdit: (step: number) => void;
  formattedBudget: string;
}

function useReviewProposal({ 
  onSubmit, 
  onBack, 
  onEdit,
  funderDetails
}: ReviewProposalViewProps): UseReviewProposalModel {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Format budget with commas for readability
  const formattedBudget = funderDetails.budgetRange 
    ? `$${parseInt(funderDetails.budgetRange).toLocaleString()}`
    : "Not specified";
  
  const handleSubmit = useCallback(() => {
    setIsSubmitting(true);
    
    // Simulate submission process
    setTimeout(() => {
      onSubmit({
        funderDetails,
        submittedAt: new Date()
      });
      setIsSubmitting(false);
    }, 1500);
  }, [funderDetails, onSubmit]);
  
  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);
  
  const handleEdit = useCallback((step: number) => {
    onEdit(step);
  }, [onEdit]);
  
  return {
    isSubmitting,
    handleSubmit,
    handleBack,
    handleEdit,
    formattedBudget
  };
}

// VIEW
interface ReviewProposalViewComponentProps extends ReviewProposalViewProps {
  isSubmitting: boolean;
  handleSubmit: () => void;
  handleBack: () => void;
  handleEdit: (step: number) => void;
  formattedBudget: string;
}

function ReviewProposalViewComponent({
  funderDetails,
  applicationQuestions,
  isSubmitting,
  handleSubmit,
  handleBack,
  handleEdit,
  formattedBudget
}: ReviewProposalViewComponentProps) {
  return (
    <div className="container max-w-5xl px-4 py-8 mx-auto sm:px-6 lg:px-8">
      {/* Progress steps */}
      <div className="mb-8">
        <div className="relative">
          <div className="flex h-2 mb-6 overflow-hidden text-xs bg-gray-100 rounded">
            <div className="flex flex-col justify-center w-full text-center text-white shadow-none whitespace-nowrap bg-primary"></div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center w-6 h-6 mb-1 border-2 border-gray-300 rounded-full bg-primary/10">
                <Check className="w-3 h-3 text-primary" />
              </div>
              <span>Funder Details</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center w-6 h-6 mb-1 border-2 border-gray-300 rounded-full bg-primary/10">
                <Check className="w-3 h-3 text-primary" />
              </div>
              <span>Application Questions</span>
            </div>
            <div className="flex flex-col items-center font-medium text-primary">
              <div className="flex items-center justify-center w-6 h-6 mb-1 text-white border-2 rounded-full border-primary bg-primary">
                3
              </div>
              <span>Review & Create</span>
            </div>
          </div>
        </div>
      </div>

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
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Organization Name</h3>
                    <p className="font-medium">{funderDetails.organizationName}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Grant/Funding Title</h3>
                    <p className="font-medium">{funderDetails.fundingTitle}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4 py-3 md:grid-cols-3">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Submission Deadline</h3>
                    <p className="font-medium flex items-center">
                      <Calendar className="w-4 h-4 mr-1 text-muted-foreground" />
                      {funderDetails.deadline ? format(new Date(funderDetails.deadline), "MMMM d, yyyy") : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Approximate Budget</h3>
                    <p className="font-medium flex items-center">
                      <DollarSign className="w-4 h-4 mr-1 text-muted-foreground" />
                      {formattedBudget}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Primary Focus Area</h3>
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
                    Application Questions
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
                      <div key={index} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Question {index + 1}</h3>
                        <p className="font-medium">{question}</p>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center p-6 text-muted-foreground">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      No application questions provided.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="lg:w-1/4">
          <div className="sticky space-y-4 top-8">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center px-4 py-2.5">
                    <span className="flex items-center justify-center w-6 h-6 mr-3 border-2 rounded-full bg-primary/10 border-primary">
                      <Check className="w-3 h-3 text-primary" />
                    </span>
                    Funder Details
                  </div>
                  <div className="flex items-center px-4 py-2.5">
                    <span className="flex items-center justify-center w-6 h-6 mr-3 border-2 rounded-full bg-primary/10 border-primary">
                      <Check className="w-3 h-3 text-primary" />
                    </span>
                    Application Questions
                  </div>
                  <div className="flex items-center px-4 py-2.5 font-medium rounded-md bg-primary/10 text-primary">
                    <span className="flex items-center justify-center w-6 h-6 mr-3 text-xs text-white rounded-full bg-primary">
                      3
                    </span>
                    Review & Create
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Final Steps</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-4">Please review all information carefully before submitting your proposal. Once submitted:</p>
                <ul className="space-y-2.5">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    Your proposal will be saved to your dashboard
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    You'll be able to edit it later if needed
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    You'll receive a confirmation email
                  </li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex flex-col space-y-3 pt-2">
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                size="lg" 
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Save className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Proposal"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleBack}
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            </div>
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