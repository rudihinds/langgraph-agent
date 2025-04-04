"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ApplicationQuestionsView from "./ApplicationQuestionsView";
import RFPResponseView from "./RFPResponseView";
import FunderDetailsView from "./FunderDetailsView";
import ReviewProposalView from "./ReviewProposalView";
import { Button } from "@/components/ui/button";
import { useProposalSubmission } from "@/hooks/useProposalSubmission";
import { toast } from "@/components/ui/use-toast";
import { Question } from "./ApplicationQuestionsView";
import { FunderDetails } from "./FunderDetailsView";

// MODEL
export type ProposalType = "rfp" | "application";

export interface ProposalCreationFlowProps {
  proposalType: ProposalType;
  onCancel: () => void;
}

interface UseProposalCreationFlowModel {
  currentStep: number;
  totalSteps: number;
  funderDetails: FunderDetails;
  applicationQuestions: Question[];
  rfpDetails: any;
  isSubmitting: boolean;
  handleNext: (data: any) => void;
  handleBack: () => void;
  handleEdit: (step: number) => void;
  handleCancel: () => void;
}

function useProposalCreationFlow({
  proposalType,
  onCancel,
}: ProposalCreationFlowProps): UseProposalCreationFlowModel {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [funderDetails, setFunderDetails] = useState<FunderDetails>(
    {} as FunderDetails
  );
  const [applicationQuestions, setApplicationQuestions] = useState<Question[]>(
    []
  );
  const [rfpDetails, setRfpDetails] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { submitProposal, uploadFile, loading, error } = useProposalSubmission({
    onSuccess: (proposalId) => {
      toast({
        title: "Success!",
        description: "Your proposal has been created successfully.",
      });
      // Navigate to the dashboard
      router.push("/dashboard");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create proposal: ${error.message}`,
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const totalSteps = proposalType === "rfp" ? 3 : 3;

  // Set up history state handling to intercept browser back button
  useEffect(() => {
    // Push an entry for the first step
    if (currentStep === 1) {
      window.history.replaceState(
        { step: 1, proposalType },
        "",
        window.location.pathname
      );
    }

    // Handle popstate event (browser back/forward buttons)
    const handlePopState = (event: PopStateEvent) => {
      // If the user navigates back to the previous page
      if (!event.state || !event.state.step) {
        // Redirect them back to dashboard instead of losing their progress
        onCancel();
        return;
      }

      // Set the step from history state
      const historyStep = event.state.step;
      setCurrentStep(historyStep);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [proposalType, onCancel]);

  const handleNext = async (data: any) => {
    // Save the data from the current step
    if (currentStep === 1) {
      setFunderDetails(data);
    } else if (currentStep === 2) {
      if (proposalType === "application") {
        setApplicationQuestions(data.questions || []);
      } else {
        setRfpDetails(data);
      }
    }

    // If this is the last step, submit the proposal
    if (currentStep === totalSteps) {
      setIsSubmitting(true);

      try {
        // Prepare proposal data based on type
        const proposalData = {
          title:
            funderDetails.programName ||
            funderDetails.funderName ||
            "Untitled Proposal",
          description:
            funderDetails.programDescription ||
            funderDetails.funderDescription ||
            "",
          proposal_type: proposalType,
          funder_details: funderDetails,
          status: "draft",
          deadline: funderDetails.deadline || undefined,
        };

        if (proposalType === "application") {
          // Add application-specific data
          const applicationData = {
            ...proposalData,
            proposal_type: "application" as const,
            questions: applicationQuestions,
          };

          await submitProposal(applicationData);
        } else {
          // Add RFP-specific data
          const rfpData = {
            ...proposalData,
            proposal_type: "rfp" as const,
            // If there's document data in rfpDetails, include it
            rfp_document: rfpDetails.document || undefined,
          };

          // Submit the proposal first
          const proposal = await submitProposal(rfpData);

          // If there's a file to upload and proposal was created successfully
          if (rfpDetails.file && proposal && proposal.id) {
            await uploadFile(rfpDetails.file, proposal.id);
          }
        }

        // The navigation will be handled by the onSuccess callback
      } catch (error) {
        // Error handling is done in the hook's onError callback
        console.error("Error submitting proposal:", error);
      }

      return;
    }

    // Otherwise, go to the next step
    const nextStep = currentStep + 1;

    // Push the new step to history
    window.history.pushState(
      { step: nextStep, proposalType },
      "",
      window.location.pathname
    );

    setCurrentStep(nextStep);
  };

  const handleBack = () => {
    if (currentStep === 1) {
      // For the first step, we want to go back to the dashboard
      // Let the browser handle the back navigation
      onCancel();
      return;
    }

    // Otherwise, go to the previous step
    const prevStep = currentStep - 1;

    // Use browser's history.back() to maintain proper history stack
    window.history.back();
  };

  const handleEdit = (step: number) => {
    // Navigate directly to the specified step
    window.history.pushState(
      { step, proposalType },
      "",
      window.location.pathname
    );

    setCurrentStep(step);
  };

  const handleCancel = () => {
    onCancel();
  };

  return {
    currentStep,
    totalSteps,
    funderDetails,
    applicationQuestions,
    rfpDetails,
    isSubmitting,
    handleNext,
    handleBack,
    handleEdit,
    handleCancel,
  };
}

// VIEW
interface ProposalCreationFlowViewProps extends ProposalCreationFlowProps {
  currentStep: number;
  totalSteps: number;
  funderDetails: FunderDetails;
  applicationQuestions: Question[];
  rfpDetails: any;
  isSubmitting: boolean;
  handleNext: (data: any) => void;
  handleBack: () => void;
  handleEdit: (step: number) => void;
  handleCancel: () => void;
}

function ProposalCreationFlowView({
  proposalType,
  currentStep,
  totalSteps,
  funderDetails,
  applicationQuestions,
  rfpDetails,
  isSubmitting,
  handleNext,
  handleBack,
  handleEdit,
  handleCancel,
}: ProposalCreationFlowViewProps) {
  // First step is now Funder Details for both proposal types
  if (currentStep === 1) {
    return (
      <FunderDetailsView
        onSubmit={handleNext}
        onBack={handleBack}
        proposalType={proposalType}
      />
    );
  }

  // Second step depends on proposal type
  if (currentStep === 2) {
    if (proposalType === "application") {
      return (
        <ApplicationQuestionsView onSubmit={handleNext} onBack={handleBack} />
      );
    }

    if (proposalType === "rfp") {
      return <RFPResponseView onSubmit={handleNext} onBack={handleBack} />;
    }
  }

  // Third step is review for both proposal types
  if (currentStep === 3) {
    return (
      <ReviewProposalView
        onSubmit={handleNext}
        onBack={handleBack}
        onEdit={handleEdit}
        funderDetails={funderDetails}
        applicationQuestions={
          proposalType === "application" ? applicationQuestions : []
        }
        proposalType={proposalType}
        isSubmitting={isSubmitting}
      />
    );
  }

  // Fallback for unimplemented steps
  return (
    <div className="container max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">
        Step {currentStep} of {totalSteps}
      </h1>
      <p className="mb-8 text-muted-foreground">
        This step is not yet implemented.
      </p>
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>
        <Button onClick={() => handleNext({})}>Continue</Button>
      </div>
    </div>
  );
}

// COMPONENT
export default function ProposalCreationFlow(props: ProposalCreationFlowProps) {
  const model = useProposalCreationFlow(props);
  return <ProposalCreationFlowView {...props} {...model} />;
}
