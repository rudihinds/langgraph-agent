"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ApplicationQuestionsView from "./ApplicationQuestionsView";
import RFPResponseView from "../../../../../RFPResponseView";
import FunderDetailsView from "./FunderDetailsView";
import ReviewProposalView from "./ReviewProposalView";
import { Button } from "@/components/ui/button";
import { useProposalSubmission } from "@/hooks/useProposalSubmission";
import { useToast } from "@/components/ui/use-toast";
import { Question } from "./ApplicationQuestionsView";
import { FunderDetails } from "./FunderDetailsView";
import { ProgressStepper } from "./ProgressStepper";
import { cn } from "@/lib/utils/utils";

// MODEL
export type ProposalType = "rfp" | "application";

interface ProposalCreationFlowProps {
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
  formErrors: Record<string, string>;
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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const { submitProposal, uploadFile, loading, error } = useProposalSubmission({
    onSuccess: (proposalId) => {
      toast({
        title: "Success!",
        description: "Your proposal has been created successfully.",
      });
      // Navigate to the success page
      router.push("/proposals/created");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create proposal: ${error.message}`,
        variant: "destructive",
      });
      setIsSubmitting(false);
      // Set form-level error
      setFormErrors({
        submission: `Failed to create proposal: ${error.message}`,
      });
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
    console.log("ProposalCreationFlow: handleNext called", {
      currentStep,
      totalSteps,
      data,
    });

    // Reset previous errors
    setFormErrors({});

    // Check if data contains validation errors
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error(
        "ProposalCreationFlow: Validation errors detected",
        data.errors
      );
      setFormErrors(data.errors);
      toast({
        title: "Validation Error",
        description: "Please correct the errors in the form before continuing.",
        variant: "destructive",
      });
      return;
    }

    // Save the data from the current step
    if (currentStep === 1) {
      setFunderDetails(data);
    } else if (currentStep === 2) {
      if (proposalType === "application") {
        console.log(
          "ProposalCreationFlow: Saving application questions",
          data.questions?.length
        );
        if (!data.questions || data.questions.length === 0) {
          setFormErrors({
            questions: "At least one question is required",
          });
          toast({
            title: "Validation Error",
            description: "Please add at least one question before continuing.",
            variant: "destructive",
          });
          return;
        }
        setApplicationQuestions(data.questions || []);
      } else {
        setRfpDetails(data);
      }
    }

    // If this is the last step, submit the proposal
    if (currentStep === totalSteps) {
      console.log("ProposalCreationFlow: Final step - submitting proposal");
      setIsSubmitting(true);

      try {
        // If we're at the review step, the data should already be prepared
        // in the correct format by the ReviewProposalView component
        console.log("Submitting proposal with data:", data);

        // Submit the proposal
        const proposal = await submitProposal(data);

        // If there's a file to upload and proposal was created successfully
        if (
          proposalType === "rfp" &&
          rfpDetails.file &&
          proposal &&
          proposal.id
        ) {
          await uploadFile(rfpDetails.file, proposal.id);
        }
      } catch (error) {
        // Error handling is done in the hook's onError callback
        console.error("Error submitting proposal:", error);
      }

      return;
    }

    // Otherwise, go to the next step
    const nextStep = currentStep + 1;
    console.log("ProposalCreationFlow: Moving to next step", {
      currentStep,
      nextStep,
    });

    // Push the new step to history
    window.history.pushState(
      { step: nextStep, proposalType },
      "",
      window.location.pathname
    );

    setCurrentStep(nextStep);
    console.log("ProposalCreationFlow: Step updated", { newStep: nextStep });
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
    formErrors,
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
  formErrors: Record<string, string>;
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
  formErrors,
  handleNext,
  handleBack,
  handleEdit,
  handleCancel,
}: ProposalCreationFlowViewProps) {
  return (
    <div
      className={cn(
        "relative",
        proposalType === "application" ? "pt-32" : "pt-8"
      )}
    >
      {proposalType === "application" && (
        <div className="fixed top-0 left-0 right-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container py-4">
            <ProgressStepper
              currentStep={currentStep}
              totalSteps={totalSteps}
              isLoading={isSubmitting}
            />
          </div>
        </div>
      )}

      <div className={proposalType === "application" ? "pt-0" : "pt-8"}>
        <div className="mt-8">
          {currentStep === 1 && (
            <FunderDetailsView
              onSubmit={handleNext}
              onBack={handleBack}
              formErrors={formErrors}
            />
          )}
          {currentStep === 2 && proposalType === "application" && (
            <ApplicationQuestionsView
              onSubmit={handleNext}
              onBack={handleBack}
              isSubmitting={isSubmitting}
              formErrors={formErrors}
            />
          )}
          {currentStep === 2 && proposalType === "rfp" && (
            <RFPResponseView
              onSubmit={handleNext}
              onBack={handleBack}
              formErrors={formErrors}
            />
          )}
          {currentStep === 3 && (
            <ReviewProposalView
              funderDetails={funderDetails}
              applicationQuestions={applicationQuestions}
              rfpDetails={rfpDetails}
              proposalType={proposalType}
              onEdit={handleEdit}
              onSubmit={handleNext}
              onBack={handleBack}
              isSubmitting={isSubmitting}
              formErrors={formErrors}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// COMPONENT
export default function ProposalCreationFlow(props: ProposalCreationFlowProps) {
  const model = useProposalCreationFlow(props);
  return <ProposalCreationFlowView {...props} {...model} />;
}
