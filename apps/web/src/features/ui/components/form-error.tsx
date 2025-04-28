"use client";

import * as React from "react";
import { cn } from "@/lib/utils/utils";
import { Alert, AlertDescription } from "@/features/ui/components/alert";
import { X, AlertCircle, Info } from "lucide-react";

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
  // Don"t render anything if no message
  if (!message) return null;

  return (
    <Alert
      variant="destructive"
      className={cn("flex items-start mb-4", dismissible && "pr-8", className)}
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

  /**
   * ID for accessibility and aria-describedby references
   */
  id?: string;
}

/**
 * Field error component for displaying field-level validation errors
 */
export function FieldError({ error, className, id }: FieldErrorProps) {
  console.log("🔧 FieldError rendering with:", { error, id });
  if (!error) {
    console.log("🔧 FieldError - no error to display, returning null");
    return null;
  }

  return (
    <p
      id={id}
      className={cn(
        "text-xs font-medium text-destructive mt-1.5 flex items-center",
        className
      )}
    >
      <AlertCircle className="w-3 h-3 mr-1.5 flex-shrink-0" />
      {error}
    </p>
  );
}

/**
 * Component that provides error context to forms
 */
const FormErrorProvider = React.createContext<{
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
  console.log(
    "🔍 FormErrorBoundary rendering with initialErrors:",
    JSON.stringify(initialErrors, null, 2)
  );

  const [errors, setErrors] =
    React.useState<Record<string, string>>(initialErrors);

  // Debug state reference to track state changes
  const previousErrorsRef = React.useRef<Record<string, string>>({});
  const renderCountRef = React.useRef(0);
  renderCountRef.current++;

  // Update errors when initialErrors change
  React.useEffect(() => {
    console.log(
      "🔍 FormErrorBoundary useEffect - initialErrors prop changed:",
      JSON.stringify(initialErrors, null, 2)
    );
    console.log(
      "🔍 FormErrorBoundary useEffect - current internal errors state:",
      JSON.stringify(errors, null, 2)
    );

    // Compare incoming prop with internal state to prevent unnecessary updates/loops
    const incomingErrors = initialErrors || {}; // Ensure we have an object
    const currentInternalErrors = errors || {};

    // Simple string comparison for efficiency. For deep objects, a deep equality check might be needed.
    if (
      JSON.stringify(incomingErrors) !== JSON.stringify(currentInternalErrors)
    ) {
      console.log(
        "🔍 FormErrorBoundary useEffect - incoming errors differ, updating internal state."
      );
      setErrors(incomingErrors);
    } else {
      console.log(
        "🔍 FormErrorBoundary useEffect - incoming errors are the same, skipping state update."
      );
    }
  }, [initialErrors, errors]); // Add 'errors' to dependency array to compare against the latest internal state

  // Monitor errors state changes
  React.useEffect(() => {
    const hasChanged =
      JSON.stringify(errors) !== JSON.stringify(previousErrorsRef.current);
    console.log(
      "🔍 FormErrorBoundary - errors state changed:",
      JSON.stringify(errors, null, 2)
    );
    console.log("🔍 FormErrorBoundary - state changed?", hasChanged);

    if (hasChanged) {
      console.log(
        "🔍 Previous errors:",
        JSON.stringify(previousErrorsRef.current, null, 2)
      );
      console.log("🔍 New errors:", JSON.stringify(errors, null, 2));
      previousErrorsRef.current = { ...errors };
    }
  }, [errors]);

  // Create a more visible form-level error display
  const hasFormError = errors && errors._form;
  const hasFieldErrors = errors && Object.keys(errors).length > 0;

  console.log("🔍 FormErrorBoundary render #", renderCountRef.current, {
    hasFormError,
    hasFieldErrors,
    errorCount: Object.keys(errors).length,
    formError: errors._form,
  });

  return (
    <FormErrorProvider.Provider value={{ errors, setErrors }}>
      {/* Removed the form-level error alert display that was here */}
      {children}
    </FormErrorProvider.Provider>
  );
}
