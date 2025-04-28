"use client";

import React from "react";
import { cn } from "@/lib/utils/utils";
import { CheckIcon, LoaderCircle } from "lucide-react";

type ProgressStepperProps = {
  currentStep: number;
  totalSteps: number;
  /** Whether to make the stepper fixed at the top of the screen */
  fixed?: boolean;
  /** Optional title to display when in fixed mode */
  title?: string;
  /** Whether the current step is in a loading state */
  isLoading?: boolean;
};

export function ProgressStepper({
  currentStep = 1,
  totalSteps = 3,
  fixed = false,
  title = "Create New Proposal",
  isLoading = false,
}: ProgressStepperProps) {
  // Create default steps
  const stepsArray = Array.from({ length: totalSteps }, (_, i) => ({
    title: `Step ${i + 1}`,
    description: `Step ${i + 1}`,
  }));

  return (
    <div
      className={cn(
        "w-full",
        fixed &&
          "sticky top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b py-4 px-4 shadow-sm transition-all duration-300"
      )}
    >
      <div className="relative max-w-3xl mx-auto">
        {/* Title - only shown in fixed mode */}
        {fixed && (
          <h1 className="mb-4 text-xl font-semibold text-center">{title}</h1>
        )}

        {/* Progress bar */}
        <div className="h-2 mb-6 overflow-hidden rounded bg-muted">
          <div
            className="h-full transition-all duration-300 ease-in-out bg-primary"
            style={{
              width: `${Math.max(((currentStep - 1) / (totalSteps - 1)) * 100, 0)}%`,
            }}
          />
        </div>

        {/* Steps */}
        <div className="flex justify-between">
          {stepsArray.map((step, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;

            // Only show loading if it's the active step and isLoading is true
            const stepIsLoading = isActive && isLoading;

            console.log(`ProgressStepper: Step ${stepNumber}`, {
              isActive,
              isCompleted,
              isLoading: stepIsLoading,
              currentStep,
            });

            return (
              <div
                key={`step-${index}`}
                className={cn(
                  "flex flex-col items-center",
                  isActive
                    ? "text-primary"
                    : isCompleted
                      ? "text-primary"
                      : "text-muted-foreground"
                )}
              >
                {/* Circle indicator */}
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full mb-2 border-2 relative",
                    isActive
                      ? "border-primary bg-primary/10"
                      : isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 bg-background"
                  )}
                >
                  {stepIsLoading && (
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                  )}
                  {isCompleted && !stepIsLoading && (
                    <CheckIcon className="w-4 h-4" />
                  )}
                  {!isCompleted && !stepIsLoading && (
                    <span className="text-sm font-medium">{stepNumber}</span>
                  )}
                </div>

                {/* Step title */}
                <span
                  className={cn(
                    "text-sm font-medium",
                    isActive
                      ? "text-primary"
                      : isCompleted
                        ? "text-primary"
                        : "text-muted-foreground"
                  )}
                >
                  {step.title}
                </span>

                {/* Step description - hide on small screens if fixed */}
                <span
                  className={cn(
                    "text-xs mt-0.5 text-muted-foreground max-w-[120px] text-center",
                    fixed && "hidden sm:block"
                  )}
                >
                  {step.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
