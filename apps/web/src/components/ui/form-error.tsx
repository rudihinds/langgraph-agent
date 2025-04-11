"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, AlertCircle } from "lucide-react";

interface FormErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Error message to display
   */
  message?: string | null;
  
  /**
   * Whether to show a dismiss button
   */
  dismissible?: boolean;
  
  /**
   * Callback when error is dismissed
   */
  onDismiss?: () => void;
  
  /**
   * Additional className for the component
   */
  className?: string;
  
  /**
   * Icon to display next to the error message
   */
  icon?: React.ReactNode;
}

/**
 * Form error component for displaying form-level errors
 */
export function FormError({
  message,
  dismissible = true,
  onDismiss,
  className,
  icon = <AlertCircle className="h-4 w-4" />,
  ...props
}: FormErrorProps) {
  // Don't render anything if no message
  if (!message) return null;

  return (
    <Alert
      variant="destructive"
      className={cn(
        "flex items-start mb-4",
        dismissible && "pr-8",
        className
      )}
      {...props}
    >
      <div className="flex items-start">
        {icon && <span className="mr-2 shrink-0 mt-0.5">{icon}</span>}
        <AlertDescription className="mt-0">{message}</AlertDescription>
      </div>
      
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 hover:bg-destructive/10 p-1 rounded-full"
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </Alert>
  );
}

interface FieldErrorProps {
  /**
   * Field-specific error message
   */
  error?: string;
  
  /**
   * Additional className for the component
   */
  className?: string;
}

/**
 * Field error component for displaying field-level validation errors
 */
export function FieldError({ error, className }: FieldErrorProps) {
  if (!error) return null;
  
  return (
    <p className={cn("text-sm font-medium text-destructive mt-1", className)}>
      {error}
    </p>
  );
}

/**
 * Component that provides error context to forms
 */
export const FormErrorProvider = React.createContext<{
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}>({
  errors: {},
  setErrors: () => {},
});

/**
 * Hook to use form errors from context
 */
export function useFormErrors() {
  return React.useContext(FormErrorProvider);
}

/**
 * High-order component that provides error context to a form
 */
export function FormErrorBoundary({
  children,
  initialErrors = {},
}: {
  children: React.ReactNode;
  initialErrors?: Record<string, string>;
}) {
  const [errors, setErrors] = React.useState<Record<string, string>>(initialErrors);

  return (
    <FormErrorProvider.Provider value={{ errors, setErrors }}>
      {errors._form && (
        <FormError
          message={errors._form}
          dismissible
          onDismiss={() => {
            setErrors(current => {
              const updated = { ...current };
              delete updated._form;
              return updated;
            });
          }}
        />
      )}
      {children}
    </FormErrorProvider.Provider>
  );
}