"use client";

import React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/utils";
import { LoaderCircle, AlertCircle, CheckCircle } from "lucide-react";

type StateType = "idle" | "loading" | "success" | "error" | "disabled";

type SubmitButtonProps = {
  state?: StateType;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  disabledText?: string;
  icon?: React.ReactNode;
  successIcon?: React.ReactNode;
  errorIcon?: React.ReactNode;
  children: React.ReactNode;
} & Omit<ButtonProps, "asChild">;

export function SubmitButton({
  state = "idle",
  loadingText = "Loading...",
  successText = "Success!",
  errorText = "Error",
  disabledText,
  icon,
  successIcon,
  errorIcon,
  className,
  children,
  ...props
}: SubmitButtonProps) {
  const getStateContent = () => {
    switch (state) {
      case "loading":
        return (
          <>
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            {loadingText}
          </>
        );
      case "success":
        return (
          <>
            {successIcon || <CheckCircle className="mr-2 h-4 w-4" />}
            {successText}
          </>
        );
      case "error":
        return (
          <>
            {errorIcon || <AlertCircle className="mr-2 h-4 w-4" />}
            {errorText}
          </>
        );
      case "disabled":
        return disabledText || children;
      default:
        return children;
    }
  };

  const getStateClassName = () => {
    switch (state) {
      case "loading":
        return "opacity-90";
      case "success":
        return "bg-green-600 hover:bg-green-700 text-white border-green-600";
      case "error":
        return "bg-destructive hover:bg-destructive/90 text-white border-destructive";
      case "disabled":
        return "";
      default:
        return "";
    }
  };

  return (
    <Button
      className={cn(getStateClassName(), className)}
      disabled={state === "loading" || state === "disabled"}
      {...props}
    >
      {getStateContent()}
    </Button>
  );
}
