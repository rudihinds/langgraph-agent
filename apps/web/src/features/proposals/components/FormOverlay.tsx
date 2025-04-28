"use client";

import React, { useEffect } from "react";
import { LoaderCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils/utils";

interface FormOverlayProps {
  isVisible: boolean;
  currentStep: number; // 0: validating, 1: creating, 2: uploading, 3: completed
  onComplete?: () => void;
}

export function FormOverlay({
  isVisible,
  currentStep,
  onComplete,
}: FormOverlayProps) {
  useEffect(() => {
    if (currentStep === 3 && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentStep, onComplete]);

  if (!isVisible) return null;

  const getMessage = () => {
    switch (currentStep) {
      case 0:
        return "Validating your document...";
      case 1:
        return "Creating your proposal...";
      case 2:
        return "Uploading your document...";
      case 3:
        return "Process completed successfully!";
      default:
        return "Processing...";
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card rounded-lg shadow-lg p-6 max-w-md w-full border">
        <div className="flex flex-col items-center">
          {currentStep < 3 ? (
            <div className="mb-4">
              <LoaderCircle className="h-12 w-12 text-primary animate-spin" />
            </div>
          ) : (
            <div className="mb-4 text-green-500">
              <CheckCircle className="h-12 w-12" />
            </div>
          )}

          <h3 className="text-xl font-semibold mb-4">{getMessage()}</h3>

          <div className="w-full bg-muted rounded-full h-2 mb-4">
            <div
              className={cn(
                "h-full rounded-full bg-primary transition-all duration-300",
                currentStep === 3 ? "bg-green-500" : "bg-primary"
              )}
              style={{
                width: `${((currentStep + 1) / 4) * 100}%`,
              }}
            />
          </div>

          <div className="flex justify-between w-full px-2">
            <StepIndicator
              isActive={currentStep >= 0}
              isComplete={currentStep > 0}
              label="Validating"
            />
            <StepIndicator
              isActive={currentStep >= 1}
              isComplete={currentStep > 1}
              label="Creating"
            />
            <StepIndicator
              isActive={currentStep >= 2}
              isComplete={currentStep > 2}
              label="Uploading"
            />
            <StepIndicator
              isActive={currentStep >= 3}
              isComplete={currentStep === 3}
              label="Complete"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  isActive: boolean;
  isComplete: boolean;
  label: string;
}

function StepIndicator({ isActive, isComplete, label }: StepIndicatorProps) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "w-4 h-4 rounded-full mb-1",
          isComplete
            ? "bg-green-500"
            : isActive
              ? "bg-primary"
              : "bg-muted-foreground/30"
        )}
      >
        {isComplete && <CheckCircle className="h-4 w-4 text-white" />}
      </div>
      <span
        className={cn(
          "text-xs",
          isComplete
            ? "text-green-500"
            : isActive
              ? "text-primary"
              : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}
