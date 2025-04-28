"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/ui/components/dialog";
import { Button } from "@/features/ui/components/button";
import { FileText, ClipboardList, Check } from "lucide-react";

// MODEL: Define types and business logic
export type ProposalType = "rfp" | "application";

interface ProposalTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: ProposalType) => void;
  className?: string;
}

function useProposalTypeModal(props: ProposalTypeModalProps) {
  const { open, onOpenChange, onSelect } = props;
  const [selectedType, setSelectedType] = useState<ProposalType | null>(null);

  // Reset selection when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedType(null);
    }
  }, [open]);

  const handleSelect = (type: ProposalType) => {
    setSelectedType(type);
  };

  const handleContinue = () => {
    if (selectedType) {
      onSelect(selectedType);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return {
    open,
    selectedType,
    handleSelect,
    handleContinue,
    handleCancel,
  };
}

// VIEW: Render the UI
const ProposalTypeCard = React.forwardRef<
  HTMLDivElement,
  {
    title: string;
    description: string;
    icon: React.ElementType;
    selected: boolean;
    onClick: () => void;
    testId: string;
  }
>(({ title, description, icon: Icon, selected, onClick, testId }, ref) => {
  return (
    <div
      className={cn(
        "relative p-6 border rounded-lg cursor-pointer transition-all flex flex-col items-center text-center gap-3",
        "hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary bg-primary/5 ring-2 ring-primary"
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      role="radio"
      aria-checked={selected}
      aria-selected={selected}
      tabIndex={0}
      data-testid={testId}
      ref={ref}
    >
      {selected && (
        <div className="absolute top-3 right-3 text-primary">
          <Check className="w-5 h-5" />
        </div>
      )}
      <div className="flex items-center justify-center w-12 h-12 mb-2 rounded-full bg-primary/10">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
});

ProposalTypeCard.displayName = "ProposalTypeCard";

function ProposalTypeModalView({
  open,
  selectedType,
  handleSelect,
  handleContinue,
  handleCancel,
  className,
}: ReturnType<typeof useProposalTypeModal> & { className?: string }) {
  const firstOptionRef = useRef<HTMLDivElement>(null);

  // Set focus to first option when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        firstOptionRef.current?.focus();
      }, 100);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent
        className={cn("sm:max-w-[550px] p-6 gap-6", className)}
        onEscapeKeyDown={handleCancel}
        aria-labelledby="proposal-type-modal-title"
        aria-describedby="proposal-type-modal-description"
      >
        <DialogTitle id="proposal-type-modal-title" className="text-2xl">
          Create New Proposal
        </DialogTitle>
        <DialogDescription id="proposal-type-modal-description">
          Select the type of proposal you want to create
        </DialogDescription>

        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          role="radiogroup"
          aria-labelledby="proposal-type-modal-title"
        >
          <ProposalTypeCard
            title="RFP Response"
            description="Create a proposal in response to a formal Request for Proposals (RFP)"
            icon={FileText}
            selected={selectedType === "rfp"}
            onClick={() => handleSelect("rfp")}
            testId="option-rfp"
            ref={firstOptionRef}
          />
          <ProposalTypeCard
            title="Application Questions"
            description="Answer a series of application questions for a grant or funding opportunity"
            icon={ClipboardList}
            selected={selectedType === "application"}
            onClick={() => handleSelect("application")}
            testId="option-application"
          />
        </div>

        <div className="p-3 mt-2 text-sm rounded-md bg-muted/50 text-muted-foreground">
          <p>
            <span className="font-medium">Not sure which to choose?</span> RFP
            Response is best for structured procurement documents, while
            Application Questions works well for grants with specific questions.
          </p>
        </div>

        <DialogFooter className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleContinue}
            disabled={!selectedType}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// COMPONENT: Public-facing component with proper forwarded refs
export default function ProposalTypeModal(props: ProposalTypeModalProps) {
  const hookData = useProposalTypeModal(props);
  return <ProposalTypeModalView {...hookData} className={props.className} />;
}
