"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetOverlay,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Validation schema
const formSchema = z.object({
  proposalName: z.string().min(1, { message: "Proposal name is required" }),
  clientName: z.string().min(1, { message: "Client name is required" }),
});

type FormValues = z.infer<typeof formSchema>;

// Types for the component's props
interface NewProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Model - Contains business logic and state management
function useNewProposalModal(props: NewProposalModalProps) {
  const { open, onOpenChange } = props;
  const router = useRouter();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      proposalName: "",
      clientName: "",
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    // In a real implementation, we would save the proposal to the database here
    // For now, we'll just redirect to the new proposal page
    router.push("/proposals/new");
    onOpenChange(false);
  });

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return {
    open,
    onOpenChange,
    form,
    handleSubmit,
    handleCancel,
    errors: form.formState.errors,
    isSubmitting: form.formState.isSubmitting,
  };
}

// View - Presentation component that renders the UI
function NewProposalModalView({
  open,
  onOpenChange,
  form,
  handleSubmit,
  handleCancel,
  errors,
  isSubmitting,
}: ReturnType<typeof useNewProposalModal>) {
  const { register } = form;
  
  // Focus the first input when the modal opens
  const inputRef = React.useRef<HTMLInputElement>(null);
  
  React.useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetOverlay data-testid="dialog-overlay" />
      <SheetContent
        side="right"
        className="sm:max-w-md w-full"
        aria-label="Create new proposal form"
        role="dialog"
        aria-modal="true"
      >
        <SheetHeader>
          <SheetTitle>Create New Proposal</SheetTitle>
          <SheetDescription>
            Start a new proposal by providing some basic information.
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="proposalName">
              Proposal Name
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="proposalName"
              {...register("proposalName")}
              placeholder="Enter proposal name"
              ref={inputRef}
              aria-invalid={!!errors.proposalName}
            />
            {errors.proposalName && (
              <p className="text-sm text-destructive mt-1">
                {errors.proposalName.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientName">
              RFP/Client Name
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="clientName"
              {...register("clientName")}
              placeholder="Enter client or RFP name"
              aria-invalid={!!errors.clientName}
            />
            {errors.clientName && (
              <p className="text-sm text-destructive mt-1">
                {errors.clientName.message}
              </p>
            )}
          </div>
          
          <SheetFooter className="pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
              className="ml-2"
            >
              Create
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// Combined component using MCP pattern
export function NewProposalModal(props: NewProposalModalProps) {
  const model = useNewProposalModal(props);
  return <NewProposalModalView {...model} />;
}

export default NewProposalModal;