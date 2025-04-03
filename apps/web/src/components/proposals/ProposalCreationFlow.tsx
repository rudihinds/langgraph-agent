"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ApplicationQuestionsView from "./ApplicationQuestionsView";
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
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentStep === 1) {
      onCancel();
      return;
    }

    setCurrentStep((prev) => prev - 1);
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
  // Render the appropriate step based on the current step and proposal type
  if (proposalType === "application" && currentStep === 1) {
    return (
      <ApplicationQuestionsView onSubmit={handleNext} onBack={handleBack} />
    );
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
