"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ApplicationQuestionsView from "./ApplicationQuestionsView";
import RFPResponseView from "./RFPResponseView";
import OrganizationInfoView from "./OrganizationInfoView";
import { Button } from "@/components/ui/button";

// MODEL
export type ProposalType = "rfp" | "application";

export interface ProposalCreationFlowProps {
  proposalType: ProposalType;
  onCancel: () => void;
}

interface UseProposalCreationFlowModel {
  currentStep: number;
  totalSteps: number;
  handleNext: (data: any) => void;
  handleBack: () => void;
  handleCancel: () => void;
}

function useProposalCreationFlow({
  proposalType,
  onCancel,
}: ProposalCreationFlowProps): UseProposalCreationFlowModel {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<any>({});

  const totalSteps = proposalType === "rfp" ? 4 : 3;

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

  const handleNext = (data: any) => {
    // Save the data from the current step
    setFormData((prev) => ({ ...prev, ...data }));

    // If this is the last step, submit the proposal
    if (currentStep === totalSteps) {
      // TODO: Save the proposal to the database
      console.log("Submitting proposal:", {
        ...formData,
        ...data,
        type: proposalType,
      });
      router.push("/dashboard");
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

  const handleCancel = () => {
    onCancel();
  };

  return {
    currentStep,
    totalSteps,
    handleNext,
    handleBack,
    handleCancel,
  };
}

// VIEW
interface ProposalCreationFlowViewProps extends ProposalCreationFlowProps {
  currentStep: number;
  totalSteps: number;
  handleNext: (data: any) => void;
  handleBack: () => void;
  handleCancel: () => void;
}

function ProposalCreationFlowView({
  proposalType,
  currentStep,
  totalSteps,
  handleNext,
  handleBack,
  handleCancel,
}: ProposalCreationFlowViewProps) {
  // First step is now Organization Info for both proposal types
  if (currentStep === 1) {
    return <OrganizationInfoView onSubmit={handleNext} onBack={handleBack} />;
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

  // TODO: Add other steps for the proposal creation flow

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
