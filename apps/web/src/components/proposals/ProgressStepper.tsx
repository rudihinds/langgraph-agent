"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { CheckIcon, LoaderCircle } from "lucide-react";

type Step = {
  title: string;
  description: string;
};

type ProgressStepperProps = {
  activeStep: number;
  steps: Step[];
  /** Whether to make the stepper fixed at the top of the screen */
  fixed?: boolean;
  /** Optional title to display when in fixed mode */
  title?: string;
};

export function ProgressStepper({
  activeStep,
  steps,
  fixed = false,
  title = "Create New RFP Proposal",
}: ProgressStepperProps) {
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
          <h1 className="text-xl font-semibold text-center mb-4">{title}</h1>
        )}

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded overflow-hidden mb-6">
          <div
            className="h-full bg-primary transition-all duration-300 ease-in-out"
            style={{
              width: `${Math.max(((activeStep - 1) / (steps.length - 1)) * 100, 0)}%`,
            }}
          />
        </div>

        {/* Steps */}
        <div className="flex justify-between">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === activeStep;
            const isCompleted = stepNumber < activeStep;
            const isLoading =
              isActive &&
              (activeStep === 2 || activeStep === 3 || activeStep === 4);

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
                  {isLoading && (
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                  )}
                  {isCompleted && !isLoading && (
                    <CheckIcon className="w-4 h-4" />
                  )}
                  {!isCompleted && !isLoading && (
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
